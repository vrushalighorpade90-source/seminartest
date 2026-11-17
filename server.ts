import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import mammoth from 'mammoth';
import type { SeminarTest, Question, StudentSubmission } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistence directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const TESTS_FILE = path.join(DATA_DIR, 'tests.json');

// Helper to load and save tests
function loadTests(): Record<string, SeminarTest> {
  try {
    if (fs.existsSync(TESTS_FILE)) {
      const data = fs.readFileSync(TESTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading tests file, initializing default:', err);
  }
  return {};
}

function saveTests(tests: Record<string, SeminarTest>) {
  try {
    fs.writeFileSync(TESTS_FILE, JSON.stringify(tests, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving tests file:', err);
  }
}

// In-memory test store initialized from file
let testsStore: Record<string, SeminarTest> = loadTests();

// Real-time SSE subscribers for live marks synchronization
const sseSubscribers = new Map<string, Set<express.Response>>();

function broadcastTestUpdate(code: string, updatedTest: SeminarTest) {
  const normCode = (code || '').toUpperCase().trim();
  const clients = sseSubscribers.get(normCode);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    type: 'test_updated',
    test: updatedTest,
    timestamp: new Date().toISOString()
  });

  for (const client of clients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (err) {
      clients.delete(client);
    }
  }
}


// Helper to check and initialize Gemini Client dynamically from environment
function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '' && key !== 'MY_GEMINI_API_KEY');
}

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

import JSZip from 'jszip';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Robust extractor for modern PowerPoint (.pptx)
async function extractTextFromPptx(buffer: Buffer, fileBase64?: string): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    
    // Find all slide XML files and sort numerically
    const slideFileNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
        return numA - numB;
      });

    const slidesText: string[] = [];

    for (const fileName of slideFileNames) {
      const slideNum = fileName.match(/slide(\d+)\.xml/i)?.[1] || '';
      const xml = await zip.files[fileName].async('text');
      
      const paragraphs: string[] = [];
      const pMatches = xml.match(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi) || [xml];
      
      for (const pXml of pMatches) {
        const tMatches = pXml.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi);
        if (tMatches) {
          const pText = tMatches
            .map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, '').trim()))
            .filter(Boolean)
            .join(' ');
          if (pText) {
            paragraphs.push(pText);
          }
        }
      }
      
      if (paragraphs.length > 0) {
        slidesText.push(`--- Slide ${slideNum} ---\n${paragraphs.join('\n')}`);
      }
    }

    // Extract speaker notes if available
    const noteFileNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/notesSlide(\d+)\.xml/i)?.[1] || '0', 10);
        const numB = parseInt(b.match(/notesSlide(\d+)\.xml/i)?.[1] || '0', 10);
        return numA - numB;
      });

    const notesText: string[] = [];
    for (const fileName of noteFileNames) {
      const noteNum = fileName.match(/notesSlide(\d+)\.xml/i)?.[1] || '';
      const xml = await zip.files[fileName].async('text');
      const tMatches = xml.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi);
      if (tMatches) {
        const noteText = tMatches
          .map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, '').trim()))
          .filter((t) => t && !t.match(/^\d+$/))
          .join(' ');
        if (noteText && noteText.length > 10) {
          notesText.push(`Slide ${noteNum} Speaker Notes: ${noteText}`);
        }
      }
    }

    let fullText = slidesText.join('\n\n');
    if (notesText.length > 0) {
      fullText += '\n\n--- Presenter Notes ---\n' + notesText.join('\n');
    }

    // If slide text is very short or slides are image-based, check for embedded slide images to OCR
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim() !== '' &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );

    if (fullText.trim().length < 150 && hasGeminiKey) {
      const mediaFiles = Object.keys(zip.files).filter((name) =>
        /^ppt\/media\/image\d+\.(png|jpe?g|webp)$/i.test(name)
      );
      if (mediaFiles.length > 0) {
        console.log(`PPTX has sparse XML text (${fullText.trim().length} chars) but contains ${mediaFiles.length} media images. Running Gemini OCR...`);
        try {
          const sampleImages = mediaFiles.slice(0, 10);
          const imageParts: any[] = [];
          for (const imgName of sampleImages) {
            const imgBuffer = await zip.files[imgName].async('nodebuffer');
            const mime = imgName.endsWith('.png') ? 'image/png' : 'image/jpeg';
            imageParts.push({
              inlineData: {
                mimeType: mime,
                data: imgBuffer.toString('base64'),
              },
            });
          }

          const ai = getGeminiClient();
          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: {
              parts: [
                ...imageParts,
                {
                  text: 'Perform Optical Character Recognition (OCR) on these study slides. Transcribe all titles, bullet points, definitions, chemical/mathematical equations, data values, and scientific explanations in structured format.',
                },
              ],
            },
            config: {
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
              },
            },
          });

          if (response.text && response.text.trim().length > 50) {
            fullText = response.text.trim() + (fullText ? '\n\n' + fullText : '');
          }
        } catch (ocrErr) {
          console.warn('PPTX media OCR fallback error:', ocrErr);
        }
      }
    }

    return fullText.trim();
  } catch (err) {
    console.error('Error in extractTextFromPptx:', err);
    return '';
  }
}

// Extractor for legacy binary PowerPoint (.ppt)
function extractTextFromPptLegacy(buffer: Buffer): string {
  try {
    const rawLatin = buffer.toString('latin1');
    // Extract sequences of readable ASCII text of 4 or more chars
    const asciiMatches = rawLatin.match(/[\x20-\x7E]{4,}/g) || [];
    const filtered = asciiMatches
      .map((s) => s.trim())
      .filter((s) => {
        // filter out binary noise, font names, system headers
        if (s.length < 5) return false;
        if (/^(Times|Arial|Calibri|Symbol|Wingdings|Microsoft|PowerPoint|Document|Current User)/i.test(s)) return false;
        return /[a-zA-Z]{3,}/.test(s);
      });
    return filtered.join('\n');
  } catch (err) {
    console.error('Error extracting legacy ppt text:', err);
    return '';
  }
}

// Extractor for PDF documents (supports native text, embedded OCR layers, and Gemini Vision OCR)
async function extractTextFromPdf(buffer: Buffer, fileBase64: string): Promise<string> {
  let localText = '';

  // 1. Try local PDFParse (extracts native PDF text and embedded OCR text streams)
  try {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    localText = (parsed.text || '').trim();
    // Clean up excessive page delimiter lines while keeping readable flow
    localText = localText.replace(/-- \d+ of \d+ --/g, '').replace(/\n{3,}/g, '\n\n').trim();
    console.log(`Local PDFParse extracted ${localText.length} characters.`);
  } catch (localErr) {
    console.warn('Local PDFParse error:', localErr);
  }

  // 2. If valid Gemini API Key is available, use Gemini 3.8 Flash for high-precision OCR on scanned PDFs
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim() !== '' &&
    process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );

  if (hasGeminiKey) {
    // If local text is sparse (e.g., scanned PDF with images) or user requested OCR
    if (localText.length < 200 || fileBase64) {
      try {
        console.log('Querying Gemini 4 Hydrogen for PDF layout extraction and OCR...');
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: fileBase64,
                },
              },
              {
                text: 'Extract the full academic study material, key topics, definitions, equations, scientific concepts, and main subject notes from this document. If this PDF contains scanned pages or images, perform complete Optical Character Recognition (OCR) and transcribe all text thoroughly.',
              },
            ],
          },
          config: {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        });

        const geminiText = (response.text || '').trim();
        if (geminiText.length > 50) {
          console.log(`Gemini OCR successfully extracted ${geminiText.length} characters from PDF.`);
          return geminiText;
        }
      } catch (geminiErr: any) {
        console.warn('Gemini PDF OCR call error (falling back to local PDF text):', geminiErr.message || geminiErr);
      }
    }
  }

  return localText;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Teacher Login Endpoint
app.post('/api/auth/teacher-login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Any faculty login or demo credentials accepted
  const user = {
    id: 'fac-' + Math.random().toString(36).substring(2, 8),
    name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    email,
    department: 'Academic Faculty & Seminar Assessment Council',
    token: 'jwt-fac-' + Date.now()
  };

  return res.json({ success: true, user });
});

// Parse uploaded document (PowerPoint .pptx / .ppt, PDF, Word .docx, or text)
app.post('/api/parse-document', async (req, res) => {
  try {
    const { fileName, fileBase64, mimeType } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: 'No file content provided' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    let extractedText = '';
    const lowerName = (fileName || '').toLowerCase();

    if (lowerName.endsWith('.pptx') || mimeType?.includes('presentationml')) {
      // Modern PowerPoint Presentation (.pptx)
      extractedText = await extractTextFromPptx(buffer, fileBase64);
      if (!extractedText || extractedText.length < 30) {
        // Fallback for corrupt or non-standard PPTX
        extractedText = extractTextFromPptLegacy(buffer);
      }
    } else if (lowerName.endsWith('.ppt') || mimeType?.includes('ms-powerpoint')) {
      // Legacy PowerPoint Presentation (.ppt)
      extractedText = extractTextFromPptLegacy(buffer);
    } else if (lowerName.endsWith('.pdf') || mimeType?.includes('pdf')) {
      // PDF Document (Native text or Scanned with OCR)
      extractedText = await extractTextFromPdf(buffer, fileBase64);
    } else if (lowerName.endsWith('.docx') || mimeType?.includes('wordprocessingml')) {
      // Microsoft Word (.docx)
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } catch (docErr) {
        console.warn('Mammoth docx parse error, attempting JSZip XML fallback:', docErr);
        try {
          const zip = await JSZip.loadAsync(buffer);
          const docXml = await zip.files['word/document.xml'].async('text');
          const tMatches = docXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
          extractedText = tMatches.map((t) => decodeXmlEntities(t.replace(/<[^>]+>/g, '').trim())).join(' ');
        } catch (zErr) {
          console.error('Docx zip fallback error:', zErr);
        }
      }
    } else {
      // Plain text, markdown, or csv
      extractedText = buffer.toString('utf-8');
    }

    extractedText = (extractedText || '').trim();

    return res.json({
      success: true,
      textLength: extractedText.length,
      sample: extractedText.substring(0, 500),
      text: extractedText,
      fileName
    });
  } catch (err: any) {
    console.error('Error parsing document:', err);
    return res.status(500).json({ error: err.message || 'Failed to parse document' });
  }
});

// Option Randomizer & Balancer: Guarantees balanced distribution across A, B, C, D without repeating B/D or predictable patterns
function shuffleOptionsWithBalance(questions: Question[]): Question[] {
  const n = questions.length;
  if (n === 0) return [];

  // Create an array of target slots evenly distributed among 0(A), 1(B), 2(C), 3(D)
  const slots: number[] = [];
  for (let i = 0; i < n; i++) {
    slots.push(i % 4);
  }

  // Fisher-Yates shuffle the target slots so the order is random and unpredictable
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  // Prevent consecutive identical answer slots (e.g. A-A or B-B) where possible
  for (let i = 1; i < slots.length; i++) {
    if (slots[i] === slots[i - 1]) {
      for (let k = i + 1; k < slots.length; k++) {
        if (slots[k] !== slots[i - 1] && (k === slots.length - 1 || slots[i] !== slots[k + 1])) {
          [slots[i], slots[k]] = [slots[k], slots[i]];
          break;
        }
      }
    }
  }

  return questions.map((q, idx) => {
    const targetIdx = slots[idx];
    const originalCorrect = q.options[q.correctOptionIndex] || q.options[0];
    const originalDistractors = q.options.filter((_, i) => i !== q.correctOptionIndex);

    // Shuffle the distractors among themselves
    for (let i = originalDistractors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [originalDistractors[i], originalDistractors[j]] = [originalDistractors[j], originalDistractors[i]];
    }

    const newOptions: string[] = new Array(4);
    newOptions[targetIdx] = originalCorrect;

    let dIdx = 0;
    for (let o = 0; o < 4; o++) {
      if (o !== targetIdx) {
        newOptions[o] = originalDistractors[dIdx++] || `Alternative physiological parameter ${dIdx}`;
      }
    }

    return {
      ...q,
      options: newOptions,
      correctOptionIndex: targetIdx
    };
  });
}

// Strip structural slide/page headers so the AI analyzes pure academic subject matter
function cleanStudyMaterialForAI(rawText: string): string {
  return (rawText || '')
    .replace(/^---\s*Slide\s*\d+\s*---$/gim, '')
    .replace(/^Slide\s*\d+\s*Speaker\s*Notes\s*:\s*/gim, '')
    .replace(/^---\s*Presenter\s*Notes\s*---$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Sample evenly across beginning, middle, and end if document exceeds maxChars
function sampleStudyContentEvenly(text: string, maxChars: number = 45000): string {
  if (text.length <= maxChars) return text;
  const chunkSize = Math.floor(maxChars / 3);
  const start = text.slice(0, chunkSize);
  const midOffset = Math.max(0, Math.floor((text.length - chunkSize) / 2));
  const middle = text.slice(midOffset, midOffset + chunkSize);
  const end = text.slice(text.length - chunkSize);
  return `${start}\n\n[...]\n\n${middle}\n\n[...]\n\n${end}`;
}

function parseJsonArraySafe(rawText: string | undefined): any[] {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return [];
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    if (startIdx !== -1 && endIdx > startIdx) {
      const sliced = cleaned.slice(startIdx, endIdx + 1);
      const parsed = JSON.parse(sliced);
      return Array.isArray(parsed) ? parsed : [];
    }
    throw new Error('AI response could not be parsed as valid JSON array.');
  }
}

// Strict Subject-Matter Filter: Rejects any MCQ referencing slides, tables, figures, charts,
// arbitrary equation letters/numbers, or arbitrary formulation/batch/sample labels
function isDocumentSpecificQuestion(q: Question): boolean {
  if (!q || !q.questionText || !Array.isArray(q.options) || q.options.length < 4) {
    return true;
  }

  const combined = [
    q.questionText,
    ...q.options,
    q.explanation || ''
  ].join(' ');

  // 1. Presentation / slide / document meta-references
  const metaRegex = /\b(slide|slides|presentation|seminar|powerpoint|pptx|speaker|presenter|uploaded\s+(?:file|material|document|pdf|ppt)|handout|lecture\s*slide)\b/i;
  if (metaRegex.test(combined)) return true;

  // 2. Table / Figure / Chart / Graph / Diagram / Equation / Formulation numeric or coded labels
  // (e.g., "Table 1", "Table no 1", "Eq. (2)", "Formulation F1", "Figure 3a")
  const numericOrCodedLabelRegex = /\b(?:table|fig(?:ure)?|chart|graph|diagram|flowchart|plot|appendix|annex|exhibit|panel|plate|equation|eq\.?|formula|formulation|batch|sample|group|trial|lot|run|cohort|arm|regime|case|example)\s*(?:no\.?|number|#)?\s*(?:\(?\d+[a-z]?\)?|[a-z]+\d+)\b/i;
  if (numericOrCodedLabelRegex.test(combined)) return true;

  // 3. Single uppercase letter or parenthesized letter labels (case-sensitive on the letter so "formulation a matrix" is allowed while "Formulation B" or "Equation (b)" is caught)
  const letterLabelRegex = /\b(?:[Tt]able|[Ff]ig(?:ure)?|[Cc]hart|[Gg]raph|[Dd]iagram|[Ff]lowchart|[Pp]lot|[Ee]quation|[Ee]q\.?|[Ff]ormula|[Ff]ormulation|[Bb]atch|[Ss]ample|[Gg]roup|[Tt]rial|[Ll]ot|[Rr]un|[Cc]ase|[Ee]xample)\s+(?:(?:[Nn]o\.?|[Nn]umber|#)\s*[A-Za-z]|[A-Z]|\([A-Za-z]\))(?=\b|\s|\?|,|\.|\))/;
  if (letterLabelRegex.test(combined)) return true;

  // 4. Roman numeral labels (e.g., "Table I", "Figure II", "Equation IV") without affecting "BCS Class II"
  const romanLabelRegex = /\b(?:[Tt]able|[Ff]ig(?:ure)?|[Cc]hart|[Gg]raph|[Dd]iagram|[Ee]quation|[Ee]q\.?|[Ff]ormula|[Ff]ormulation|[Cc]ase|[Ss]ection|[Pp]art)\s+(?:no\.?\s*)?(?:II|III|IV|VI|VII|VIII|IX|XI|XII|I)\b/;
  if (romanLabelRegex.test(combined)) return true;

  // 5. Explicit positional / document-bound references (e.g. "in the table", "according to the figure", "shown above")
  const positionalRegex = /\b(?:(?:in|from|of|on|within|using|see|refer\s+to|according\s+to|shown\s+in|listed\s+in|tabulated\s+in|depicted\s+in|illustrated\s+in)\s+(?:the\s+)?(?:table|figure|graph|chart|diagram|flowchart|slide|presentation|uploaded\s+(?:file|document|material)|study\s+material)|(?:shown|illustrated|listed|tabulated|presented|mentioned|given)\s+(?:above|below)|from\s+(?:the\s+)?(?:given|above)\s+(?:table|figure|graph|chart|data|equation|formula))\b/i;
  if (positionalRegex.test(combined)) return true;

  // 6. Reject broken/fragmentary options or placeholder strings
  if (q.options.some((opt) => !opt || opt.trim().length < 2)) return true;

  return false;
}

const MCQ_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  description: 'List of self-contained, generalized subject-matter multiple-choice exam questions',
  items: {
    type: Type.OBJECT,
    properties: {
      questionText: {
        type: Type.STRING,
        description: 'Self-contained, generalized academic exam question testing the scientific concept directly without referring to any table, figure, formulation code, equation label, or slide'
      },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Four parallel, plausible, textbook-grade answer choices belonging to the same conceptual category'
      },
      correctOptionIndex: {
        type: Type.INTEGER,
        description: '0-based index of the single best answer (0, 1, 2, or 3)'
      },
      explanation: {
        type: Type.STRING,
        description: 'Clear, generalized scientific explanation of the principle (never mentioning tables, figures, formulations, equations by letter/number, or slides)'
      },
    },
    required: ['questionText', 'options', 'correctOptionIndex', 'explanation'],
  },
};

function normalizeAiQuestions(parsed: any[]): Question[] {
  const mapped: Question[] = parsed.map((item, idx) => ({
    id: `q-${Date.now()}-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
    questionText: String(item.questionText || '').trim(),
    options: Array.isArray(item.options) && item.options.length === 4
      ? item.options.map((o: any) => String(o || '').trim())
      : (Array.isArray(item.options) ? item.options.map((o: any) => String(o || '').trim()) : [])
          .concat(['Option A', 'Option B', 'Option C', 'Option D'])
          .slice(0, 4),
    correctOptionIndex:
      typeof item.correctOptionIndex === 'number' && item.correctOptionIndex >= 0 && item.correctOptionIndex <= 3
        ? item.correctOptionIndex
        : 0,
    explanation: String(item.explanation || 'Based on established scientific principles.').trim(),
  }));

  // Filter out any question that slipped in a document-specific reference
  return mapped.filter((q) => !isDocumentSpecificQuestion(q));
}

// Helper to execute Gemini generateContent with exponential backoff retry on transient errors
async function generateQuestionsFromGemini(
  prompt: string,
  systemInstruction: string,
  thinkingLevel: ThinkingLevel
): Promise<Question[]> {
  const ai = getGeminiClient();
  let lastError: any;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel,
          },
          responseSchema: MCQ_RESPONSE_SCHEMA,
        },
      });
      const parsed = parseJsonArraySafe(response.text);
      return normalizeAiQuestions(parsed);
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.code;
      // Only retry transient rate limit / 5xx errors
      if ((status === 429 || (typeof status === 'number' && status >= 500)) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Auto-generate MCQs strictly grounded in the uploaded study material using Gemini AI
app.post('/api/generate-questions', async (req, res) => {
  try {
    const { materialText, numQuestions, course, program, marksPerQuestion, topic } = req.body;

    const count = parseInt(numQuestions, 10) || 10;
    const safeCourse = (course || 'Pharmaceutical Sciences').trim();
    const safeProgram = (program || 'Bachelor of Pharmacy (B.Pharm)').trim();
    const safeTopic = (topic || safeCourse).trim();
    const cleanedUploaded = cleanStudyMaterialForAI(
      materialText && typeof materialText === 'string' ? materialText : ''
    );

    if (cleanedUploaded.length < 20) {
      return res.status(400).json({
        error: 'Please upload a PowerPoint, PDF, or Word study file (or paste study material notes) first so questions are grounded strictly in your uploaded topic.',
        code: 'EMPTY_STUDY_MATERIAL'
      });
    }

    if (!hasValidGeminiKey()) {
      return res.status(503).json({
        error: 'Gemini AI API key (GEMINI_API_KEY) is not configured. Please add your API key in Settings > Secrets, then click Generate MCQs again.',
        code: 'MISSING_GEMINI_API_KEY'
      });
    }

    const sampledContent = sampleStudyContentEvenly(cleanedUploaded, 45000);

    const systemPrompt = `You are a distinguished university professor designing an official academic examination strictly based on the provided study material.
Program: ${safeProgram}
Course: ${safeCourse}
Topic: ${safeTopic}
Required Number of Questions: Exactly ${count} questions.
Marks per Question: ${marksPerQuestion || 1} mark(s).

CRITICAL MANDATORY RULES:
1. STRICT SUBJECT-MATTER FIDELITY (ZERO OUT-OF-SCOPE TOPICS):
   - The STUDY MATERIAL CONTENT below is the SOLE authoritative source of the subject and topic. Even if the Course/Topic form metadata above mentions another subject (such as a generic default), ignore any conflicting metadata and derive ALL ${count} questions EXCLUSIVELY from the scientific concepts, processes, mechanisms, materials, equations, parameters, defects, classifications, advantages, limitations, and applications ACTUALLY COVERED in the provided STUDY MATERIAL CONTENT.
   - NEVER generate unrelated out-of-scope questions from other subjects or topics not covered in the uploaded material.
   - Distribute your ${count} questions across the major concepts throughout the uploaded material so the whole topic is fairly assessed.
2. GENERALIZED TEXTBOOK-STYLE FRAMING (ZERO DOCUMENT-LOCAL LABELS):
   - Every question MUST be 100% self-contained and answerable by a student who mastered the subject without ever seeing the uploaded slides, tables, or arbitrary labels.
   - NEVER mention tables, figures, charts, graphs, or diagrams (e.g., NEVER write "Table 1", "Table no 1", "Figure 2", "Graph A", "in the table", "shown above").
   - NEVER mention arbitrary equation, formula, formulation, batch, sample, or group codes (e.g., NEVER write "Equation B", "Equation 1", "Formula A", "Formulation B", "Formulation F1", "Batch A", "Sample 1"). Name the real scientific equation/concept instead (e.g., "Heckel equation", "brittle fragmentation").
   - NEVER mention slides, presentations, seminars, speakers, or the uploaded file ("According to the presentation", "On slide 5", "In the uploaded material").
3. CONCEPTUALLY PARALLEL DISTRACTORS:
   - All 4 options must belong to the same conceptual category, have parallel structure, and comparable length, with only one unambiguous best answer.
4. RANDOMIZED CORRECT ANSWERS & CLEAR EXPLANATIONS:
   - Vary correctOptionIndex across 0, 1, 2, and 3.
   - Explain the underlying scientific principle directly without referring to slides, tables, or arbitrary codes.`;

    const userPrompt = `Thoroughly read the entire study material below and generate exactly ${count} generalized, concept-oriented MCQs covering ONLY the subject matter taught in this material:

--- STUDY MATERIAL CONTENT ---
${sampledContent}
--- END STUDY MATERIAL CONTENT ---`;

    let generatedQuestions: Question[] = [];
    try {
      generatedQuestions = await generateQuestionsFromGemini(
        userPrompt,
        systemPrompt,
        ThinkingLevel.MEDIUM
      );

      // Regenerate any shortfall caused by filtering document-specific phrasing (up to 2 passes)
      for (let pass = 0; pass < 2 && generatedQuestions.length < count; pass++) {
        const needed = count - generatedQuestions.length;
        const existingPrompts = generatedQuestions.map((q) => q.questionText).join('\n- ');
        const retryPrompt = `Generate ${needed} MORE completely generalized, textbook-style MCQs strictly covering concepts from the study material below.
DO NOT repeat these already-generated questions:
- ${existingPrompts || 'None yet'}

RULES REMINDER:
- Cover ONLY concepts actually present in the study material below (no unrelated outside topics).
- Do NOT mention any Table, Figure, Graph, Equation letter/number (like Equation A/B), Formulation code (like Formulation B), Sample, Batch, or Slide.

--- STUDY MATERIAL CONTENT ---
${sampledContent}
--- END STUDY MATERIAL CONTENT ---`;

        const retryQuestions = await generateQuestionsFromGemini(
          retryPrompt,
          systemPrompt,
          ThinkingLevel.LOW
        );
        const existingSet = new Set(generatedQuestions.map((q) => q.questionText.toLowerCase()));
        for (const rq of retryQuestions) {
          if (generatedQuestions.length >= count) break;
          if (!existingSet.has(rq.questionText.toLowerCase())) {
            existingSet.add(rq.questionText.toLowerCase());
            generatedQuestions.push(rq);
          }
        }
      }
    } catch (aiErr: any) {
      const status = aiErr?.status;
      const rawMsg = String(aiErr?.message || aiErr || '');
      let cleanReason = rawMsg;
      try {
        const parsedErr = JSON.parse(rawMsg);
        if (parsedErr?.error?.message) {
          cleanReason = parsedErr.error.message;
        }
      } catch {
        // rawMsg is plain text
      }
      console.error('Gemini MCQ generation error:', status, cleanReason);

      if (status === 403 || /PERMISSION_DENIED|API_KEY_INVALID|API key not valid|free tier is not available/i.test(cleanReason)) {
        return res.status(502).json({
          error: `${cleanReason} Please select a billing-enabled GEMINI_API_KEY in Settings > Secrets.`,
          code: 'GEMINI_AUTH_ERROR'
        });
      }
      if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(cleanReason)) {
        return res.status(429).json({
          error: 'Gemini AI rate limit or quota exceeded. Please wait a moment and try again, or verify your billing-enabled API key in Settings > Secrets.',
          code: 'GEMINI_QUOTA_ERROR'
        });
      }
      if (status === 404 || /NOT_FOUND/i.test(cleanReason)) {
        return res.status(502).json({
          error: 'Gemini model configuration mismatch encountered. Please retry in a moment.',
          code: 'GEMINI_MODEL_ERROR'
        });
      }
      return res.status(502).json({
        error: `Gemini AI could not generate questions right now: ${cleanReason || 'Upstream service error'}`,
        code: 'GEMINI_API_ERROR'
      });
    }

    if (generatedQuestions.length === 0) {
      return res.status(502).json({
        error: 'Gemini AI did not return any valid generalized questions for this study material. Please try clicking Generate MCQs again.',
        code: 'EMPTY_AI_RESPONSE'
      });
    }

    // CRITICAL REQUIREMENT: Apply option shuffling & distribution balancer
    // Guarantees balanced distribution across A, B, C, D without repeating B/D or predictable patterns
    const finalizedQuestions = shuffleOptionsWithBalance(generatedQuestions.slice(0, count));

    return res.json({
      success: true,
      count: finalizedQuestions.length,
      questions: finalizedQuestions
    });
  } catch (err: any) {
    console.error('Error generating questions:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate questions' });
  }
});

// Create a new Seminar Test
app.post('/api/tests', (req, res) => {
  try {
    const {
      program,
      course,
      semester,
      topic,
      numQuestions,
      marksPerQuestion,
      durationMinutes,
      totalStudents,
      presenterRoll,
      presenterName,
      presenterTeacherMarks,
      questions,
      teacherEmail,
      teacherName,
      createdByTeacherEmail,
      createdByTeacherName,
      invigilatorPin,
      enableProctoring
    } = req.body;

    if (!program || !course || !semester || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Missing required test configuration parameters' });
    }

    const nQ = parseInt(numQuestions, 10) || questions.length || 10;
    const mpq = parseFloat(marksPerQuestion) || 1;
    const totalMarks = nQ * mpq;
    const duration = parseInt(durationMinutes, 10) || 15;
    const studentsCount = Math.min(200, Math.max(1, parseInt(totalStudents, 10) || 50));
    
    // Support "None" (General Purpose Test where all students take the test)
    const isNone = presenterRoll === null || presenterRoll === 0 || presenterRoll === '0' || presenterRoll === 'none';
    const presRoll = isNone ? null : (parseInt(presenterRoll, 10) || null);

    // Generate easy-to-read unique code e.g. "SEM-7294"
    let code = `SEM-${Math.floor(1000 + Math.random() * 9000)}`;
    while (testsStore[code]) {
      code = `SEM-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const maxFacultyMarks = totalMarks / 2;
    const teacherMarks = presRoll ? Math.min(maxFacultyMarks, Math.max(0, parseFloat(presenterTeacherMarks) || (maxFacultyMarks * 0.8))) : 0;

    const finalTeacherEmail = (createdByTeacherEmail || teacherEmail || '').trim() || undefined;
    const finalTeacherName = (createdByTeacherName || teacherName || '').trim() || undefined;
    const finalPin = (invigilatorPin && String(invigilatorPin).trim()) || '7392';

    const newTest: SeminarTest = {
      id: `test-${Date.now()}`,
      code,
      program: program.trim(),
      course: course.trim(),
      semester: semester.trim(),
      topic: (topic || course).trim(),
      numQuestions: nQ,
      marksPerQuestion: mpq,
      totalMarks,
      durationMinutes: duration,
      totalStudents: studentsCount,
      presenterRoll: presRoll,
      presenterName: presRoll ? (presenterName ? presenterName.trim() : `Student (Roll #${presRoll})`) : 'None (General Purpose Test)',
      presenterTeacherMarks: teacherMarks,
      questions: questions.slice(0, nQ),
      submissions: {},
      liveAlerts: {},
      createdAt: new Date().toISOString(),
      status: 'active',
      createdByTeacherEmail: finalTeacherEmail,
      createdByTeacherName: finalTeacherName,
      invigilatorPin: finalPin,
      enableProctoring: enableProctoring !== false
    };

    testsStore[code] = newTest;
    saveTests(testsStore);

    res.json({ success: true, test: newTest });
  } catch (err: any) {
    console.error('Error creating test:', err);
    res.status(500).json({ error: err.message || 'Failed to create test' });
  }
});

// List all tests (strictly tests created by the teacher, accessible 24/7)
app.get('/api/tests', (req, res) => {
  const teacherEmail = req.query.teacherEmail as string;
  const role = req.query.role as string;

  // Students have zero access to the teacher test directory
  if (role === 'student' || (!teacherEmail && !req.headers['x-teacher-token'])) {
    return res.json({ tests: [] });
  }

  let testsList = Object.values(testsStore);
  if (teacherEmail) {
    testsList = testsList.filter(t => !t.createdByTeacherEmail || t.createdByTeacherEmail.toLowerCase() === teacherEmail.toLowerCase());
  }
  testsList.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ tests: testsList });
});

// Delete test by code
app.delete('/api/tests/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  if (!testsStore[code]) {
    return res.status(404).json({ error: `Test with code "${code}" not found.` });
  }
  delete testsStore[code];
  saveTests(testsStore);
  res.json({ success: true, message: `Test "${code}" has been permanently deleted.` });
});

// Real-time SSE Stream for Teacher Monitoring (instant 0ms synchronization of student submissions)
app.get('/api/tests/:code/stream', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  const test = testsStore[code];
  if (!test) {
    return res.status(404).json({ error: 'Test not found' });
  }

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('\n');

  // Register client
  if (!sseSubscribers.has(code)) {
    sseSubscribers.set(code, new Set());
  }
  sseSubscribers.get(code)!.add(res);

  // Send initial state immediately
  res.write(`data: ${JSON.stringify({ type: 'initial_state', test, timestamp: new Date().toISOString() })}\n\n`);

  // Periodic heartbeat ping every 15s to keep proxy connection alive
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    const clients = sseSubscribers.get(code);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseSubscribers.delete(code);
      }
    }
  });
});

// Get test by Code
app.get('/api/tests/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  const test = testsStore[code];
  if (!test) {
    return res.status(404).json({ error: `Test with code "${code}" not found.` });
  }

  const role = req.query.role;
  const teacherEmail = (req.query.teacherEmail as string) || (req.headers['x-teacher-email'] as string);
  const teacherToken = req.headers['x-teacher-token'] as string;

  // A request is recognized as a teacher if role === 'teacher' or a teacher identifier is present
  const isTeacher = role === 'teacher' || Boolean(teacherEmail) || Boolean(teacherToken);

  if (!isTeacher) {
    // Sanitize test for students: NEVER expose correctOptionIndex, explanations, or submissions!
    const sanitizedQuestions = test.questions.map(q => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
    }));

    return res.json({
      test: {
        code: test.code,
        program: test.program,
        course: test.course,
        semester: test.semester,
        topic: test.topic,
        numQuestions: test.numQuestions,
        marksPerQuestion: test.marksPerQuestion,
        totalMarks: test.totalMarks,
        durationMinutes: test.durationMinutes,
        totalStudents: test.totalStudents,
        presenterRoll: test.presenterRoll,
        presenterName: test.presenterName,
        questions: sanitizedQuestions,
        status: test.status,
        enableProctoring: test.enableProctoring !== false
      }
    });
  }

  // Teacher role gets full test with submissions, answers, and statistics
  return res.json({ test });
});

// Check Student Eligibility before starting test (prevents re-attempt after prior submission)
app.post('/api/tests/:code/check-eligibility', (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const test = testsStore[code];
    if (!test) {
      return res.status(404).json({ error: `Test with code "${code}" not found.` });
    }

    const roll = parseInt(String(req.body?.rollNumber ?? '').replace(/[^0-9]/g, ''), 10);
    if (isNaN(roll) || roll < 1 || roll > test.totalStudents) {
      return res.status(400).json({
        error: `Please enter a valid roll number between 1 and ${test.totalStudents}.`
      });
    }

    if (test.presenterRoll && test.presenterRoll > 0 && roll === test.presenterRoll) {
      return res.json({
        eligible: false,
        isPresenter: true,
        alreadySubmitted: false,
        message: `Roll #${roll} is designated as the Seminar Presenter and is exempt from this test.`
      });
    }

    const existingSubmission = test.submissions ? test.submissions[roll] : undefined;
    if (existingSubmission) {
      return res.json({
        eligible: false,
        isPresenter: false,
        alreadySubmitted: true,
        submittedAt: existingSubmission.submittedAt,
        message: `Roll #${roll} has already submitted this test (${code}). Re-attempting the same test is not permitted.`
      });
    }

    return res.json({
      eligible: true,
      isPresenter: false,
      alreadySubmitted: false
    });
  } catch (err: any) {
    console.error('Error checking eligibility:', err);
    return res.status(500).json({ error: err.message || 'Failed to verify roll number eligibility.' });
  }
});

// Record Live Proctoring Violation Event
app.post('/api/tests/:code/record-violation', (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const test = testsStore[code];
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const { rollNumber, violationNumber, type, description } = req.body;
    const roll = parseInt(rollNumber, 10);
    const vNum = parseInt(violationNumber, 10) || 1;

    if (isNaN(roll) || roll < 1 || roll > test.totalStudents) {
      return res.status(400).json({ error: 'Invalid roll number' });
    }

    if (!test.liveAlerts) {
      test.liveAlerts = {};
    }

    const violation = {
      id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      violationNumber: vNum,
      type: type || 'tab_switch',
      description: description || 'Active examination window lost focus'
    };

    test.liveAlerts[roll] = {
      rollNumber: roll,
      violationNumber: vNum,
      latestViolation: violation,
      isLocked: vNum === 2,
      isAutoSubmitted: vNum >= 3,
      updatedAt: new Date().toISOString()
    };

    saveTests(testsStore);
    broadcastTestUpdate(code, test);

    return res.json({
      success: true,
      violation,
      isLocked: vNum === 2,
      isAutoSubmitted: vNum >= 3
    });
  } catch (err: any) {
    console.error('Error recording violation:', err);
    res.status(500).json({ error: err.message || 'Failed to record violation' });
  }
});

// Verify Invigilator PIN to unlock 2nd violation
app.post('/api/tests/:code/verify-invigilator-pin', (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const test = testsStore[code];
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const { pin, rollNumber } = req.body;
    const roll = parseInt(rollNumber, 10);
    const expectedPin = (test.invigilatorPin || '7392').trim();
    const userPin = (pin || '').toString().trim();

    // Check if PIN matches test's invigilator PIN or master override PIN
    if (userPin === expectedPin || userPin === '7392') {
      if (test.liveAlerts && roll && test.liveAlerts[roll]) {
        test.liveAlerts[roll].isLocked = false;
        test.liveAlerts[roll].updatedAt = new Date().toISOString();
        saveTests(testsStore);
        broadcastTestUpdate(code, test);
      }
      return res.json({
        success: true,
        authorized: true,
        message: 'Invigilator authorization confirmed. Examination resumed.'
      });
    }

    return res.status(401).json({
      success: false,
      authorized: false,
      error: 'Invalid Invigilator PIN. Please present your device to the seminar faculty.'
    });
  } catch (err: any) {
    console.error('Error verifying invigilator pin:', err);
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// Teacher remotely unlocks a student from the marksheet table
app.post('/api/tests/:code/unlock-student', (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const test = testsStore[code];
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const { rollNumber } = req.body;
    const roll = parseInt(rollNumber, 10);

    if (test.liveAlerts && roll && test.liveAlerts[roll]) {
      test.liveAlerts[roll].isLocked = false;
      test.liveAlerts[roll].updatedAt = new Date().toISOString();
      saveTests(testsStore);
      broadcastTestUpdate(code, test);
    }

    return res.json({ success: true, message: `Roll #${roll} unlocked successfully.` });
  } catch (err: any) {
    console.error('Error unlocking student:', err);
    res.status(500).json({ error: err.message || 'Failed to unlock student' });
  }
});

// Submit Student Test
app.post('/api/tests/:code/submit', (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const test = testsStore[code];
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const {
      rollNumber,
      answers,
      durationSpentSeconds,
      violationCount,
      violations,
      autoSubmittedReason,
      isFlaggedForReview
    } = req.body;
    const roll = parseInt(String(rollNumber ?? '').replace(/[^0-9]/g, ''), 10);

    if (isNaN(roll) || roll < 1 || roll > test.totalStudents) {
      return res.status(400).json({
        error: `Invalid roll number. Please enter a valid roll number between 1 and ${test.totalStudents}.`
      });
    }

    if (test.presenterRoll && roll === test.presenterRoll) {
      return res.status(403).json({
        error: `Roll #${roll} is designated as the Seminar Presenter. As per seminar rules, you do not need to take this exam.`
      });
    }

    // Graceful idempotent response for mobile retries and double-taps:
    // If the student's submission is already saved, return success immediately without throwing a 409 error
    if (test.submissions[roll]) {
      return res.json({
        success: true,
        message: 'Your test responses have been successfully submitted and recorded with the faculty.',
        submittedAt: test.submissions[roll].submittedAt,
        alreadySubmitted: true
      });
    }

    // Calculate score on the server side
    let correctCount = 0;
    const studentAnswers = answers || {};

    test.questions.forEach((q, idx) => {
      if (studentAnswers[idx] === q.correctOptionIndex) {
        correctCount++;
      }
    });

    const score = correctCount * test.marksPerQuestion;
    const percentage = test.totalMarks > 0 ? (score / test.totalMarks) * 100 : 0;
    const vCount = parseInt(violationCount, 10) || (Array.isArray(violations) ? violations.length : 0);

    const submission: StudentSubmission = {
      rollNumber: roll,
      answers: studentAnswers,
      score,
      totalPossible: test.totalMarks,
      percentage: Math.round(percentage * 10) / 10,
      submittedAt: new Date().toISOString(),
      durationSpentSeconds: parseInt(durationSpentSeconds, 10) || 0,
      violationCount: vCount,
      violations: Array.isArray(violations) ? violations : [],
      autoSubmittedReason: autoSubmittedReason || undefined,
      isFlaggedForReview: Boolean(isFlaggedForReview || vCount >= 3)
    };

    test.submissions[roll] = submission;

    // Update liveAlerts state
    if (test.liveAlerts) {
      if (vCount >= 3) {
        test.liveAlerts[roll] = {
          rollNumber: roll,
          violationNumber: vCount,
          latestViolation: (violations && violations[violations.length - 1]) || {
            id: `v-auto-${Date.now()}`,
            timestamp: new Date().toISOString(),
            violationNumber: vCount,
            type: 'unauthorized_action',
            description: autoSubmittedReason || 'Auto-submitted due to proctoring policy'
          },
          isLocked: false,
          isAutoSubmitted: true,
          updatedAt: new Date().toISOString()
        };
      }
    }

    // Permanently commit to database storage file
    saveTests(testsStore);

    // Broadcast the update in real-time to all connected teacher screens!
    broadcastTestUpdate(code, test);

    // CRITICAL REQUIREMENT: Do NOT reveal marks to student at the end of the test!
    return res.json({
      success: true,
      message: autoSubmittedReason
        ? 'Test automatically concluded and saved in accordance with the examination proctoring policy.'
        : 'Your test responses have been successfully submitted and recorded with the faculty.',
      rollNumber: roll,
      submittedAt: submission.submittedAt,
      isAutoSubmitted: Boolean(autoSubmittedReason)
    });
  } catch (err: any) {
    console.error('Error submitting test:', err);
    res.status(500).json({ error: err.message || 'Failed to submit test' });
  }
});

// Update Presenter Marks or Roll Number by Teacher
app.patch('/api/tests/:code/presenter', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  const test = testsStore[code];
  if (!test) {
    return res.status(404).json({ error: 'Test not found' });
  }

  const { presenterRoll, presenterTeacherMarks, presenterName } = req.body;

  if (presenterRoll !== undefined) {
    const pRoll = parseInt(presenterRoll, 10);
    if (!isNaN(pRoll) && pRoll >= 1 && pRoll <= test.totalStudents) {
      test.presenterRoll = pRoll;
    }
  }

  if (presenterTeacherMarks !== undefined) {
    const marks = parseFloat(presenterTeacherMarks);
    const maxHalf = test.totalMarks / 2;
    if (!isNaN(marks)) {
      test.presenterTeacherMarks = Math.min(maxHalf, Math.max(0, marks));
    }
  }

  if (presenterName !== undefined) {
    test.presenterName = presenterName.trim();
  }

  saveTests(testsStore);
  return res.json({ success: true, test });
});

// Update Test Questions and Markings with Automatic Marksheet Re-evaluation
app.put('/api/tests/:code/questions', (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const test = testsStore[code];
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const { questions, marksPerQuestion, durationMinutes, topic, course } = req.body;

    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'Questions must be a non-empty array.' });
      }

      // Clean & validate each question
      const cleanQuestions: Question[] = questions.map((q: any, idx: number) => {
        const rawOptions = Array.isArray(q.options) ? q.options : [];
        const options = [
          (rawOptions[0] ?? 'Option A').toString().trim() || 'Option A',
          (rawOptions[1] ?? 'Option B').toString().trim() || 'Option B',
          (rawOptions[2] ?? 'Option C').toString().trim() || 'Option C',
          (rawOptions[3] ?? 'Option D').toString().trim() || 'Option D',
        ];
        const correctIdx = typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3
          ? q.correctOptionIndex
          : 0;

        return {
          id: q.id || `q-${Date.now()}-${idx + 1}`,
          questionText: (q.questionText || `Question ${idx + 1}`).toString().trim(),
          options,
          correctOptionIndex: correctIdx,
          explanation: (q.explanation || '').toString().trim(),
        };
      });

      test.questions = cleanQuestions;
      test.numQuestions = cleanQuestions.length;
    }

    if (marksPerQuestion !== undefined) {
      const mpq = parseFloat(marksPerQuestion);
      if (!isNaN(mpq) && mpq > 0) {
        test.marksPerQuestion = mpq;
      }
    }

    test.totalMarks = test.numQuestions * test.marksPerQuestion;

    if (durationMinutes !== undefined) {
      const dur = parseInt(durationMinutes, 10);
      if (!isNaN(dur) && dur > 0) {
        test.durationMinutes = dur;
      }
    }

    if (topic !== undefined && typeof topic === 'string' && topic.trim()) {
      test.topic = topic.trim();
    }

    if (course !== undefined && typeof course === 'string' && course.trim()) {
      test.course = course.trim();
    }

    // AUTOMATIC RE-EVALUATION:
    // If students have already submitted answers, re-calculate their scores and percentages
    // against the revised answer key and updated marks-per-question so marksheet is 100% accurate!
    if (test.submissions) {
      for (const roll of Object.keys(test.submissions)) {
        const rollNum = parseInt(roll, 10);
        const sub = test.submissions[rollNum];
        if (sub && sub.answers) {
          let correctCount = 0;
          test.questions.forEach((q, idx) => {
            if (sub.answers[idx] === q.correctOptionIndex) {
              correctCount++;
            }
          });
          sub.score = correctCount * test.marksPerQuestion;
          sub.totalPossible = test.totalMarks;
          sub.percentage = test.totalMarks > 0 ? Math.round((sub.score / test.totalMarks) * 1000) / 10 : 0;
        }
      }
    }

    // Ensure presenter marks do not exceed totalMarks / 2 if totalMarks changed
    if (test.presenterRoll && test.presenterTeacherMarks !== undefined) {
      const maxHalf = test.totalMarks / 2;
      test.presenterTeacherMarks = Math.min(maxHalf, Math.max(0, test.presenterTeacherMarks));
    }

    saveTests(testsStore);

    // Broadcast updated test to all connected SSE clients immediately
    broadcastTestUpdate(code, test);

    return res.json({
      success: true,
      message: 'Test questions and markings updated successfully.',
      test
    });
  } catch (err: any) {
    console.error('Error updating test questions:', err);
    return res.status(500).json({ error: err.message || 'Failed to update test questions' });
  }
});

// Sync to external Google Sheet Webhook or Apps Script endpoint
app.post('/api/tests/:code/google-sheet-sync', async (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const test = testsStore[code];
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const { webhookUrl } = req.body;
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return res.status(400).json({ error: 'Please provide a valid Google Apps Script Webhook URL' });
    }

    // Compute stats
    const submissionsList = Object.values(test.submissions);
    const totalSubmissions = submissionsList.length;
    const avgScore = totalSubmissions > 0
      ? submissionsList.reduce((acc, s) => acc + s.score, 0) / totalSubmissions
      : 0;

    const maxHalf = test.totalMarks / 2;
    const audienceComponent = test.totalMarks > 0
      ? (avgScore / test.totalMarks) * maxHalf
      : 0;
    const presenterTotal = test.presenterTeacherMarks + audienceComponent;

    // Structured payload for Google Sheets
    const payload = {
      testCode: test.code,
      program: test.program,
      course: test.course,
      semester: test.semester,
      topic: test.topic,
      totalMarks: test.totalMarks,
      durationMinutes: test.durationMinutes,
      totalEnrolledStudents: test.totalStudents,
      submittedCount: totalSubmissions,
      audienceAverageScore: Math.round(avgScore * 100) / 100,
      presenter: test.presenterRoll ? {
        rollNumber: test.presenterRoll,
        name: test.presenterName,
        teacherAllottedMarks50Percent: test.presenterTeacherMarks,
        audienceAverageScore50Percent: Math.round(audienceComponent * 100) / 100,
        finalTotalMarks: Math.round(presenterTotal * 100) / 100,
        maxMarks: test.totalMarks
      } : null,
      students: Array.from({ length: test.totalStudents }, (_, i) => {
        const roll = i + 1;
        const sub = test.submissions[roll];
        const isPresenter = Boolean(test.presenterRoll && roll === test.presenterRoll);
        return {
          rollNumber: roll,
          role: isPresenter ? 'Seminar Presenter' : 'Attendee',
          score: isPresenter
            ? Math.round(presenterTotal * 100) / 100
            : (sub ? sub.score : 0),
          totalPossible: test.totalMarks,
          percentage: isPresenter
            ? Math.round((presenterTotal / test.totalMarks) * 1000) / 10
            : (sub ? sub.percentage : 0),
          status: isPresenter ? 'Evaluated (50/50 Formula)' : (sub ? 'Submitted' : 'Pending'),
          submittedAt: sub ? sub.submittedAt : null
        };
      })
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Google Sheets Webhook returned status ${response.status}`);
    }

    res.json({ success: true, message: 'Marks successfully transmitted to Google Sheet' });
  } catch (err: any) {
    console.error('Google Sheet Sync Error:', err);
    res.status(500).json({ error: err.message || 'Failed to sync with Google Sheet' });
  }
});

// Ensure unknown /api/* routes always return JSON instead of HTML doctype
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Vite Middleware for development / Static files for production
async function startServer() {
  const distDir = path.join(__dirname, 'dist');
  const distIndexPath = path.join(distDir, 'index.html');
  const useProductionStatic =
    process.env.NODE_ENV === 'production' && fs.existsSync(distIndexPath);

  if (useProductionStatic) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      if (!fs.existsSync(distIndexPath)) {
        return res.status(503).send('Application build is updating. Please refresh in a moment.');
      }
      res.sendFile(distIndexPath, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Test Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
