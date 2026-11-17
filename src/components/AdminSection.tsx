import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  Users,
  Award,
  FileSpreadsheet,
  Edit3,
  Copy,
  ChevronRight,
  RefreshCw,
  Search,
  BookOpen,
  HelpCircle,
  QrCode,
  AlertCircle,
  Trash2,
  Plus,
  Calendar,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  AlertOctagon,
  AlertTriangle,
  Eye
} from 'lucide-react';
import type { SeminarTest, Question, TeacherUser } from '../types';
import { api } from '../services/api';
import { computePresenterMarks } from '../utils/googleSheetsExport';
import { EditQuestionsModal } from './EditQuestionsModal';
import { StudentPerformanceModal } from './StudentPerformanceModal';

interface AdminSectionProps {
  teacher: TeacherUser;
  onOpenSheetsModal: (test: SeminarTest) => void;
  activeTestCode?: string;
  onSelectTestCode: (code: string) => void;
  onOpenGlobalShare: (testCode?: string, courseTitle?: string) => void;
}

const SAMPLE_MATERIALS = [
  {
    title: 'Bioavailability & Bioequivalence (B.Pharm Sem 6)',
    course: 'Biopharmaceutics & Pharmacokinetics',
    program: 'Bachelor of Pharmacy (B.Pharm)',
    semester: 'Semester 6',
    text: `Bioavailability and Bioequivalence in Biopharmaceutics:
Bioavailability (F) is the rate and extent to which the active drug ingredient or therapeutic moiety is absorbed from a drug product and becomes available at the site of drug action.
For intravenous injection, F equals 1.0 (100%).
Bioavailability Assessment Methods:
1. Pharmacokinetic Methods (Indirect): Serial plasma drug concentration-time profile (Cmax, Tmax, AUC) and cumulative urinary drug excretion data (dXu/dt, Xu_infinity).
2. Pharmacodynamic Methods (Direct): Direct measurement of acute pharmacological response (e.g. reduction in blood pressure, pupil diameter change) or clinical therapeutic endpoint.
Bioequivalence Acceptance Criteria:
Generic formulations must demonstrate that the 90% confidence interval for the geometric mean ratio (Test / Reference) of Cmax and AUC falls strictly within the bioequivalence acceptance limit of 80.00% to 125.00%.
In-Vitro In-Vivo Correlation (IVIVC):
- Level A: Point-to-point correlation between the entire in-vitro dissolution curve and the in-vivo absorption rate profile.
- Level B: Utilizes statistical moment theory comparing mean in-vitro dissolution time with mean in-vivo residence time.
- Level C: Single point relationship between amount dissolved at a specified time and a pharmacokinetic parameter (Cmax or AUC).
BCS Classification:
- Class I: High Solubility, High Permeability
- Class II: Low Solubility, High Permeability (dissolution is rate-limiting step; enhanced via solid dispersions, micronization, lipid formulations)
- Class III: High Solubility, Low Permeability
- Class IV: Low Solubility, Low Permeability.`
  },
  {
    title: 'Pharmacokinetics & Compartment Models',
    course: 'Advanced Biopharmaceutics',
    program: 'Pharm.D / M.Pharm',
    semester: 'Semester 4',
    text: `Pharmacokinetics and Compartmental Modeling:
Pharmacokinetics describes drug Absorption, Distribution, Metabolism, and Excretion (ADME).
Key Parameters:
1. Apparent Volume of Distribution (Vd): Hypothetical volume needed to dissolve total drug at plasma concentration (Vd = Dose / C0).
2. Biological Half-Life (t1/2): Time for plasma drug concentration to decrease by 50% (t1/2 = 0.693 * Vd / Clearance).
3. Total Body Clearance (CL): Volume of biological fluid cleared of active drug per unit time (CL = Dose / AUC).
4. First-Pass Hepatic Clearance: Metabolism occurring via hepatic portal circulation prior to reaching systemic circulation.
5. One-Compartment Open Model: Assumes rapid, instantaneous uniform distribution throughout systemic biological fluids.`
  },
  {
    title: 'Novel Drug Delivery Systems (NDDS)',
    course: 'Pharmaceutics & NDDS',
    program: 'Bachelor of Pharmacy (B.Pharm)',
    semester: 'Semester 7',
    text: `Controlled Release and Novel Drug Delivery Systems:
Formulation strategies designed to maintain therapeutic blood levels over an extended duration, minimizing peak-to-trough fluctuations.
Mechanisms:
1. Diffusion-Controlled Systems: Matrix tablets (hydrophilic HPMC matrices) and reservoir systems with rate-controlling polymer membranes.
2. Dissolution-Controlled Systems: Encapsulated dissolution cores and matrix erosion systems.
3. Osmotic Systems (OROS): Utilize semi-permeable cellulose acetate membrane with laser-drilled delivery orifice driven by osmotic pressure.
4. Targeted Nano-Carriers: Liposomes, solid lipid nanoparticles (SLNs), and polymeric nanoparticles for site-specific delivery.`
  }
];

export const AdminSection: React.FC<AdminSectionProps> = ({
  teacher,
  onOpenSheetsModal,
  activeTestCode,
  onSelectTestCode,
  onOpenGlobalShare,
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'create'>('monitor');
  const [tests, setTests] = useState<SeminarTest[]>([]);
  const [currentTest, setCurrentTest] = useState<SeminarTest | null>(null);
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending' | 'presenter'>('all');

  // Inline Notification State (Replaces all intrusive browser alerts)
  const [adminNotice, setAdminNotice] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    message: string;
  } | null>(null);

  const showNotice = (type: 'error' | 'warning' | 'info' | 'success', message: string) => {
    setAdminNotice({ type, message });
  };

  // Form State for Creating New Test
  const [program, setProgram] = useState('Bachelor of Pharmacy (B.Pharm)');
  const [course, setCourse] = useState('Biopharmaceutics & Pharmacokinetics');
  const [semester, setSemester] = useState('Semester 6');
  const [topic, setTopic] = useState('Bioavailability and Bioequivalence Study');
  const [studyMaterial, setStudyMaterial] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [extractionNotice, setExtractionNotice] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(2);
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [totalStudents, setTotalStudents] = useState<number>(60);
  const [presenterRoll, setPresenterRoll] = useState<number>(0); // 0 = None (General Purpose Test for all students)
  const [presenterName, setPresenterName] = useState('');
  const [presenterTeacherMarks, setPresenterTeacherMarks] = useState<number>(0);

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateNotice, setGenerateNotice] = useState<{
    type: 'error' | 'warning' | 'info' | 'success';
    message: string;
  } | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [showCreatedModal, setShowCreatedModal] = useState<SeminarTest | null>(null);
  const [editingPresenterMarks, setEditingPresenterMarks] = useState<number | null>(null);
  const [isUpdatingPresenter, setIsUpdatingPresenter] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Edit Questions & Markings State
  const [editingQuestionsTest, setEditingQuestionsTest] = useState<SeminarTest | null>(null);
  const [isSavingQuestions, setIsSavingQuestions] = useState<boolean>(false);

  // Question-Wise Student Performance Review Modal State
  const [viewingPerformanceRoll, setViewingPerformanceRoll] = useState<number | null>(null);

  const handleSaveQuestions = async (payload: {
    questions: Question[];
    marksPerQuestion: number;
    durationMinutes: number;
    topic: string;
  }) => {
    if (!editingQuestionsTest) return;

    if (editingQuestionsTest.id === 'draft-preview') {
      setGeneratedQuestions(payload.questions);
      setMarksPerQuestion(payload.marksPerQuestion);
      setDurationMinutes(payload.durationMinutes);
      if (payload.topic) setTopic(payload.topic);
      showNotice('success', '✓ Updated draft questions and markings in preview!');
      return;
    }

    setIsSavingQuestions(true);
    try {
      const res = await api.updateTestQuestions(editingQuestionsTest.code, payload);
      setTests(prev => prev.map(t => t.code === res.test.code ? res.test : t));
      if (currentTest?.code === res.test.code) {
        setCurrentTest(res.test);
      }
      showNotice('success', `✓ Questions and markings for "${res.test.code}" updated successfully! Marks recalculated.`);
    } catch (err: any) {
      console.error('Error updating test questions:', err);
      showNotice('error', err.message || 'Failed to update test questions');
      throw err;
    } finally {
      setIsSavingQuestions(false);
    }
  };

  // Proctoring Settings & Audit Modal State
  const [invigilatorPin, setInvigilatorPin] = useState<string>('7392');
  const [enableProctoring, setEnableProctoring] = useState<boolean>(true);
  const [selectedStudentLogs, setSelectedStudentLogs] = useState<{
    rollNumber: number;
    violations: any[];
    isLocked?: boolean;
    isAutoSubmitted?: boolean;
    autoSubmittedReason?: string;
    isFlaggedForReview?: boolean;
    submittedAt?: string;
    score?: number;
    percentage?: number;
  } | null>(null);
  const [isUnlockingStudent, setIsUnlockingStudent] = useState<boolean>(false);

  // Remote Unlock Student from Dashboard
  const handleUnlockStudent = async (rollNumber: number) => {
    if (!currentTest) return;
    try {
      setIsUnlockingStudent(true);
      await api.unlockStudent(currentTest.code, rollNumber);
      const res = await api.getTestByCode(currentTest.code, 'teacher', teacher.email);
      setCurrentTest(res.test);
      if (selectedStudentLogs && selectedStudentLogs.rollNumber === rollNumber) {
        setSelectedStudentLogs(prev => prev ? { ...prev, isLocked: false } : null);
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to unlock student');
    } finally {
      setIsUnlockingStudent(false);
    }
  };

  // Load tests on mount (strictly for this teacher, available 24/7)
  const fetchTests = async () => {
    try {
      setIsLoadingTests(true);
      const res = await api.getTests(teacher.email);
      setTests(res.tests);
      if (res.tests.length > 0) {
        const found = activeTestCode
          ? res.tests.find(t => t.code === activeTestCode)
          : res.tests[0];
        const chosen = found || res.tests[0];
        setCurrentTest(chosen);
        onSelectTestCode(chosen.code);
      } else {
        setCurrentTest(null);
        onSelectTestCode('');
      }
    } catch (err) {
      console.error('Failed to load tests:', err);
    } finally {
      setIsLoadingTests(false);
    }
  };

  // Permanently delete a test created by this teacher
  const handleDeleteTest = async (code: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete seminar test "${code}" and all student responses?`)) {
      return;
    }
    try {
      await api.deleteTest(code);
      const remaining = tests.filter(t => t.code !== code);
      setTests(remaining);
      if (currentTest?.code === code) {
        const next = remaining[0] || null;
        setCurrentTest(next);
        onSelectTestCode(next ? next.code : '');
      }
      showNotice('success', `Test "${code}" deleted successfully.`);
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to delete test');
    }
  };

  useEffect(() => {
    fetchTests();
  }, [teacher.email]);

  // Real-time synchronization of current test submissions & live proctoring alerts
  useEffect(() => {
    if (!currentTest || activeTab !== 'monitor') return;

    // 1. Subscribe to instant real-time Server-Sent Events (SSE)
    const unsubscribeSSE = api.subscribeToTestStream(currentTest.code, teacher.email, (incomingTest) => {
      if (incomingTest && incomingTest.code === currentTest.code) {
        setCurrentTest(prev => {
          if (!prev || prev.code !== incomingTest.code) return incomingTest;
          const existingSubs = prev.submissions || {};
          const incomingSubs = incomingTest.submissions || {};
          return {
            ...incomingTest,
            submissions: { ...existingSubs, ...incomingSubs }
          };
        });
        setTests(prev => prev.map(t => t.code === incomingTest.code ? {
          ...t,
          submissions: { ...(t.submissions || {}), ...(incomingTest.submissions || {}) }
        } : t));
      }
    });

    // 2. High-reliability fallback polling (every 3 seconds) with explicit teacher.email and merge guarantee
    const pollInterval = setInterval(async () => {
      try {
        const res = await api.getTestByCode(currentTest.code, 'teacher', teacher.email);
        if (res.test && res.test.code === currentTest.code) {
          setCurrentTest(prev => {
            if (!prev || prev.code !== res.test.code) return res.test;
            const existingSubs = prev.submissions || {};
            const incomingSubs = res.test.submissions || {};
            return {
              ...res.test,
              submissions: { ...existingSubs, ...incomingSubs }
            };
          });
          setTests(prev => prev.map(t => t.code === res.test.code ? {
            ...t,
            submissions: { ...(t.submissions || {}), ...(res.test.submissions || {}) }
          } : t));
        }
      } catch (e) {
        // ignore transient poll error
      }
    }, 3000);

    return () => {
      unsubscribeSSE();
      clearInterval(pollInterval);
    };
  }, [currentTest?.code, activeTab, teacher.email]);

  // Derived calculation
  const totalTestMarks = numQuestions * marksPerQuestion;
  const maxFacultyMarks = totalTestMarks / 2;

  // When total marks changes, keep presenter faculty marks within 50%
  useEffect(() => {
    if (presenterTeacherMarks > maxFacultyMarks) {
      setPresenterTeacherMarks(Math.round(maxFacultyMarks * 0.85 * 10) / 10);
    }
  }, [totalTestMarks, maxFacultyMarks]);

  // Handle file upload (PPT, PPTX, PDF, DOCX, TXT)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const inputEl = e.target;
    setUploadedFileName(file.name);
    setIsParsingFile(true);
    setExtractionNotice(null);

    const reader = new FileReader();

    reader.onerror = () => {
      console.error('FileReader error:', reader.error);
      setExtractionNotice({
        message: 'Could not read file from your device. Please try again or paste text directly.',
        type: 'warning'
      });
      setIsParsingFile(false);
      inputEl.value = '';
    };

    reader.onload = async () => {
      try {
        const resultStr = reader.result as string;
        const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        const mimeType = file.type || 'application/octet-stream';

        const res = await api.parseDocument(file.name, base64, mimeType);

        if (res.text && res.text.trim().length > 0) {
          setStudyMaterial(res.text);
          setGeneratedQuestions([]);
          setGenerateNotice(null);

          // Auto-suggest topic if current topic is empty or default placeholder
          const cleanName = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .trim();
          if (
            cleanName &&
            (!topic ||
              topic === 'Bioavailability and Bioequivalence Study' ||
              topic === 'Container Orchestration & Reliability')
          ) {
            setTopic(cleanName);
          }

          setExtractionNotice({
            message: `Successfully extracted ${res.text.length.toLocaleString()} characters from "${file.name}". Ready to generate MCQs!`,
            type: 'success'
          });
        } else {
          setExtractionNotice({
            message: `No readable text found in "${file.name}" (it may contain scanned image slides without embedded OCR text). You can paste the slides or notes directly into the box below.`,
            type: 'warning'
          });
        }
      } catch (err: any) {
        console.error('File parsing error:', err);
        setExtractionNotice({
          message: `Extraction error for "${file.name}": ${err.message || 'Failed to parse file'}. You can paste study material directly below.`,
          type: 'warning'
        });
      } finally {
        setIsParsingFile(false);
        inputEl.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  // Load sample seminar material
  const handleLoadSample = (sample: typeof SAMPLE_MATERIALS[0]) => {
    setTopic(sample.title);
    setCourse(sample.course);
    setProgram(sample.program);
    setSemester(sample.semester);
    setStudyMaterial(sample.text);
    setGeneratedQuestions([]);
    setGenerateNotice(null);
    setUploadedFileName(`sample_${sample.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`);
  };

  // Generate MCQs with Gemini
  const handleGenerateQuestions = async () => {
    setAdminNotice(null);
    setGenerateNotice(null);

    if (!studyMaterial || studyMaterial.trim().length < 20) {
      const msg = 'Please upload a study document (PPTX, PDF, DOCX) or paste at least a short set of notes in Section 2 before generating MCQs.';
      setGenerateNotice({ type: 'warning', message: msg });
      showNotice('warning', msg);
      return;
    }

    setGeneratedQuestions([]);
    setIsGenerating(true);

    try {
      const res = await api.generateQuestions({
        materialText: studyMaterial,
        numQuestions,
        course,
        program,
        marksPerQuestion,
        topic,
      });

      if (res?.questions && res.questions.length > 0) {
        setGeneratedQuestions(res.questions);
        const msg = `✓ Generated ${res.questions.length} subject-matter MCQs strictly from your uploaded study material!`;
        setGenerateNotice({ type: 'success', message: msg });
        showNotice('success', msg);
      } else {
        const msg = 'Question generator returned no questions. Please check your study material and try again.';
        setGenerateNotice({ type: 'warning', message: msg });
        showNotice('warning', msg);
      }
    } catch (err: any) {
      console.error('Error generating questions:', err);
      const msg = err.message || 'Unable to generate questions right now. Please try again.';
      setGenerateNotice({ type: 'error', message: msg });
      showNotice('error', msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Create & Launch Test
  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (generatedQuestions.length === 0) {
      showNotice('warning', 'Please generate or review test questions before launching.');
      return;
    }

    if (presenterRoll !== 0 && (presenterRoll < 1 || presenterRoll > totalStudents)) {
      showNotice('warning', `Presenter roll number must be between 1 and ${totalStudents}, or choose None for a general test.`);
      return;
    }

    setIsCreatingTest(true);
    setAdminNotice(null);
    try {
      const res = await api.createTest({
        program,
        course,
        semester,
        topic,
        numQuestions,
        marksPerQuestion,
        totalMarks: totalTestMarks,
        durationMinutes,
        totalStudents,
        presenterRoll: presenterRoll === 0 ? null : presenterRoll,
        presenterName: presenterRoll === 0 ? 'None (General Purpose Test)' : (presenterName || `Student (Roll #${presenterRoll})`),
        presenterTeacherMarks: presenterRoll === 0 ? 0 : presenterTeacherMarks,
        questions: generatedQuestions,
        createdByTeacherEmail: teacher.email,
        createdByTeacherName: teacher.name,
        invigilatorPin: (invigilatorPin && invigilatorPin.trim()) || '7392',
        enableProctoring: enableProctoring !== false,
      });

      setShowCreatedModal(res.test);
      setCurrentTest(res.test);
      setTests([res.test, ...tests]);
      onSelectTestCode(res.test.code);
      setActiveTab('monitor');
      showNotice('success', `Test "${res.test.code}" created and launched successfully!`);
    } catch (err: any) {
      console.error('Failed to create test:', err);
      showNotice('error', err.message || 'Failed to create test');
    } finally {
      setIsCreatingTest(false);
    }
  };

  // Update Presenter 50% Marks Live
  const handleSavePresenterMarks = async () => {
    if (!currentTest || editingPresenterMarks === null) return;
    setIsUpdatingPresenter(true);
    try {
      const res = await api.updatePresenter(currentTest.code, {
        presenterTeacherMarks: editingPresenterMarks,
      });
      setCurrentTest(res.test);
      setEditingPresenterMarks(null);
      showNotice('success', 'Speaker faculty marks updated.');
    } catch (err: any) {
      showNotice('error', 'Failed to update presenter marks');
    } finally {
      setIsUpdatingPresenter(false);
    }
  };

  const currentPresenterStats = currentTest ? computePresenterMarks(currentTest) : null;

  return (
    <div className="space-y-6">
      {/* Faculty Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
            FAC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">{teacher.name}</h1>
              <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                Seminar Faculty In-Charge
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{teacher.email} · {teacher.department}</p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'monitor'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>All Tests &amp; Marksheets (24/7)</span>
            {tests.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md">
                {tests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create New Test</span>
          </button>
        </div>
      </div>

      {/* Admin Notice Banner (Inline feedback) */}
      {adminNotice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 border shadow-xs animate-in fade-in duration-150 ${
            adminNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-950 font-medium'
              : adminNotice.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-950 font-medium'
              : adminNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-medium'
              : 'bg-indigo-50 border-indigo-200 text-indigo-950 font-medium'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>
              {adminNotice.type === 'error' && '🚨'}
              {adminNotice.type === 'warning' && '⚠️'}
              {adminNotice.type === 'success' && '✅'}
              {adminNotice.type === 'info' && '💡'}
            </span>
            <span>{adminNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminNotice(null)}
            className="text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: CREATE TEST */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateTest} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">1. Seminar Course &amp; Academic Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">Define university program, subject course, and target semester</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Program / Degree</label>
                <input
                  type="text"
                  required
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="e.g. B.Tech Computer Science, MBBS, MBA"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Course / Subject Name</label>
                <input
                  type="text"
                  required
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. Distributed Systems & Cloud Computing"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 cursor-pointer"
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5</option>
                  <option value="Semester 6">Semester 6</option>
                  <option value="Semester 7">Semester 7</option>
                  <option value="Semester 8">Semester 8</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Seminar Presentation Topic</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Container Orchestration & Microservices Reliability"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Section 2: Upload Study Material */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">2. Upload Seminar Study Material</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload Word (.docx), PowerPoint (.pptx), PDF (.pdf), or paste presentation text
                </p>
              </div>

              {/* Sample Topic Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Quick load sample:</span>
                <div className="flex gap-1.5">
                  {SAMPLE_MATERIALS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleLoadSample(sample)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-md transition-colors cursor-pointer"
                    >
                      {sample.title.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* File Dropzone */}
            <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
              <input
                type="file"
                accept=".pptx,.ppt,.pdf,.docx,.txt,.md,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleFileUpload}
                disabled={isParsingFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    {uploadedFileName ? `Attached: ${uploadedFileName}` : 'Drop PowerPoint (.pptx/.ppt), PDF, or Word (.docx) here'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Full support for PowerPoint slides (.pptx, .ppt), PDF documents (with OCR), Word notes (.docx), and text
                  </p>
                </div>
                {isParsingFile && (
                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-2 text-xs text-indigo-700 font-medium animate-pulse">
                    <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Extracting slides, text content, and OCR layers from "{uploadedFileName}"...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Extraction Result Status Banner */}
            {extractionNotice && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                  extractionNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {extractionNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">
                  {extractionNotice.message}
                </div>
                <button
                  type="button"
                  onClick={() => setExtractionNotice(null)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Extracted / Pasted Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Study Material Content &amp; Notes</label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {studyMaterial.length} characters
                </span>
              </div>
              <textarea
                rows={5}
                value={studyMaterial}
                onChange={(e) => setStudyMaterial(e.target.value)}
                placeholder="Paste seminar slides, transcript, speaker notes, or reference study material here..."
                className="w-full p-3.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 leading-relaxed"
              />
            </div>
          </div>

          {/* Section 3: Test Rules, Student Pool, & Speaker Allotment */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">3. Examination Rules, Roll Numbers &amp; 50/50 Grading</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set question volume, marks per question, roll number roster, and speaker evaluation
              </p>
            </div>

            {/* Questions count & Marks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Number of Questions</label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 20, 30].map((qCount) => (
                    <button
                      key={qCount}
                      type="button"
                      onClick={() => setNumQuestions(qCount)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                        numQuestions === qCount
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {qCount} Questions
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Marks Per Question</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={marksPerQuestion}
                  onChange={(e) => setMarksPerQuestion(parseFloat(e.target.value) || 1)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Total Test Marks</label>
                <div className="px-3.5 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-950 flex items-center justify-between font-mono font-bold text-sm">
                  <span>{numQuestions} × {marksPerQuestion} =</span>
                  <span className="text-indigo-600 text-base">{totalTestMarks} Marks</span>
                </div>
              </div>
            </div>

            {/* Duration & Student Roster */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Test Duration (Minutes)</label>
                <div className="flex items-center gap-2">
                  {[10, 15, 20, 30, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        durationMinutes === mins
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 15)}
                    className="w-16 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-center"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Total Students (Roll Numbers 1 to N, up to 200)
                </label>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={totalStudents}
                  onChange={(e) => setTotalStudents(Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 50)))}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 font-mono"
                />
                <p className="text-[11px] text-slate-400">
                  Students will log in using roll numbers 1 through {totalStudents}.
                </p>
              </div>
            </div>

            {/* Presenter Special 50/50 Grading Rule */}
            <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                      Seminar Presenter Special Grading Rule (50/50 Split)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    The student who gives the seminar is exempt from taking the written test.
                    <br />
                    <b>50%</b> of their marks are allotted directly by you for their presentation.
                    <b> 50%</b> is auto-calculated based on the average marks scored by the other seminar attendees.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Select Presenter Roll Number
                    </label>
                    <select
                      value={presenterRoll}
                      onChange={(e) => setPresenterRoll(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 cursor-pointer"
                    >
                      <option value={0}>None (General Test for All Students)</option>
                      {Array.from({ length: totalStudents }, (_, i) => i + 1).map((roll) => (
                        <option key={roll} value={roll}>
                          Roll #{roll} {roll === presenterRoll ? `(Selected Speaker)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {presenterRoll > 0 ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Presenter Student Name
                        </label>
                        <input
                          type="text"
                          value={presenterName}
                          onChange={(e) => setPresenterName(e.target.value)}
                          placeholder="e.g. Aditya Sharma"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Faculty 50% Marks (Max: {maxFacultyMarks})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={maxFacultyMarks}
                          step={0.5}
                          value={presenterTeacherMarks}
                          onChange={(e) => setPresenterTeacherMarks(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <b>General Test Mode:</b> All enrolled students (Roll 1 to {totalStudents}) will take this test normally. No student is exempt.
                      </span>
                    </div>
                  )}
                </div>

                {presenterRoll > 0 ? (
                  <div className="p-3 bg-white border border-indigo-100 rounded-xl text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-indigo-900">Live Formula: </span>
                      <span>Speaker Total = </span>
                      <span className="font-mono font-bold text-slate-800">{presenterTeacherMarks} (Faculty)</span>
                      <span> + </span>
                      <span className="font-mono font-bold text-indigo-600">50% Class Test Average</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      Total Possible: {totalTestMarks} Marks
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                    <span>Grading: <b>100% Written Test</b> for every roll number</span>
                    <span className="font-mono font-bold text-slate-800">Total Marks: {totalTestMarks}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Active Examination Proctoring & Anti-Cheating Settings */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Active Anti-Cheating &amp; Screen Departure Proctoring
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300">
                    Automatically monitors when students minimize the app, switch tabs, lock their phone, or open ChatGPT, Gemini, WhatsApp, Google, or floating assistants like Parakeet AI.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={enableProctoring}
                    onChange={(e) => setEnableProctoring(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Invigilator Authorization PIN (4 to 6 Digits)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      maxLength={6}
                      value={invigilatorPin}
                      onChange={(e) => setInvigilatorPin(e.target.value)}
                      placeholder="e.g. 7392"
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold tracking-widest bg-slate-800 border border-slate-700 rounded-xl text-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Used to unlock a candidate's device on their 2nd violation.
                  </p>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 text-[11px] text-slate-300 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>3-Violation Policy Protocol:</span>
                  </div>
                  <div>• <b>1st Violation:</b> On-screen alert &amp; incident recorded</div>
                  <div>• <b>2nd Violation:</b> Exam frozen until Invigilator PIN or remote unlock</div>
                  <div>• <b>3rd Violation:</b> Immediate auto-submission &amp; flagged for review</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: AI Generation & Questions Review */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">4. Auto-Generate Questions with Gemini AI</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generates {numQuestions} multiple-choice questions grounded in the uploaded study material
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateQuestions}
                disabled={isGenerating || !studyMaterial}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Gemini is Generating {numQuestions} MCQs...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate {numQuestions} MCQs Now</span>
                  </>
                )}
              </button>
            </div>

            {generateNotice && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                  generateNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : generateNotice.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : generateNotice.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                }`}
              >
                {generateNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-current" />
                )}
                <div className="flex-1 leading-relaxed">{generateNotice.message}</div>
                <button
                  type="button"
                  onClick={() => setGenerateNotice(null)}
                  className="opacity-60 hover:opacity-100 font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Generated Questions List */}
            {generatedQuestions.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Questions Preview ({generatedQuestions.length} questions prepared):</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingQuestionsTest({
                        id: 'draft-preview',
                        code: 'NEW TEST DRAFT',
                        course,
                        program,
                        semester,
                        topic,
                        numQuestions: generatedQuestions.length,
                        marksPerQuestion,
                        totalMarks: generatedQuestions.length * marksPerQuestion,
                        durationMinutes,
                        totalStudents,
                        presenterRoll: null,
                        presenterName: '',
                        presenterTeacherMarks: 0,
                        questions: generatedQuestions,
                        submissions: {},
                        liveAlerts: {},
                        createdAt: new Date().toISOString(),
                        status: 'active'
                      })}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-amber-200"
                      title="Edit questions, options, answer keys, or marks before launching"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Questions &amp; Markings</span>
                    </button>
                    <span className="text-emerald-600 font-medium hidden sm:inline">✓ Ready for student testing</span>
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {generatedQuestions.map((q, qIndex) => (
                    <div
                      key={q.id || qIndex}
                      className="p-4 border border-slate-200 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          Q{qIndex + 1}. {q.questionText}
                        </span>
                        <span className="text-[11px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0">
                          {marksPerQuestion} mark(s)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, optIndex) => {
                          const isCorrect = optIndex === q.correctOptionIndex;
                          return (
                            <div
                              key={optIndex}
                              className={`p-2.5 rounded-lg text-xs flex items-start gap-2.5 border ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {String.fromCharCode(65 + optIndex)}
                              </span>
                              <span className="flex-1 break-words whitespace-normal leading-relaxed">{opt}</span>
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <p className="text-[11px] text-slate-500 italic pt-1">
                          Explanation: {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isCreatingTest || generatedQuestions.length === 0}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              {isCreatingTest ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Launching Seminar Test...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Publish Test &amp; Generate Access Code</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: LIVE MONITOR & EVALUATION (24/7 ALL TESTS) */}
      {activeTab === 'monitor' && (
        <div className="space-y-6">
          {tests.length === 0 ? (
            /* Empty State when no tests created yet */
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs space-y-4">
              <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-bold text-slate-900">No Tests Created Yet</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  All tests created by you and the results of students for those tests will be accessible here 24/7.
                  Upload your seminar study material and generate questions to launch your first exam.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Seminar Test</span>
              </button>
            </div>
          ) : (
            <>
              {/* All Created Tests 24/7 Directory */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>All Created Tests Directory ({tests.length})</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                        Visible 24/7
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select any test below to inspect its live student marksheet, presenter 50/50 breakdown, or export to Google Sheets.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('create')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Test</span>
                    </button>
                    <button
                      type="button"
                      onClick={fetchTests}
                      className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Refresh All Tests"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Grid of All Created Tests Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {tests.map((t) => {
                    const isSelected = currentTest?.code === t.code;
                    const tStats = computePresenterMarks(t);
                    const subCount = Object.keys(t.submissions || {}).length;

                    return (
                      <div
                        key={t.code}
                        onClick={() => {
                          setCurrentTest(t);
                          onSelectTestCode(t.code);
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 bg-white ${
                          isSelected
                            ? 'border-indigo-600 ring-2 ring-indigo-600/30 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">
                              {t.code}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(t.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="text-xs font-bold text-slate-900 line-clamp-1">
                            {t.course}
                          </h3>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {t.program} · {t.semester}
                          </p>
                          <p className="text-[11px] text-slate-600 line-clamp-1 italic">
                            Topic: {t.topic}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Submissions:</span>
                            <span className="font-mono font-semibold text-slate-900">
                              {subCount} / {t.presenterRoll && t.presenterRoll > 0 ? t.totalStudents - 1 : t.totalStudents} {t.presenterRoll && t.presenterRoll > 0 ? 'attendees' : 'students'}
                            </span>
                          </div>
                          {t.presenterRoll && t.presenterRoll > 0 ? (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Speaker (Roll #{t.presenterRoll}):</span>
                              <span className="font-mono font-semibold text-indigo-700">
                                {tStats.finalTotal} / {t.totalMarks} ({tStats.percentage}%)
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Mode:</span>
                              <span className="font-sans text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                General Test (All Students)
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 flex items-center justify-between gap-1.5 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentTest(t);
                              onSelectTestCode(t.code);
                            }}
                            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors text-center ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            }`}
                          >
                            {isSelected ? 'Viewing Marksheet' : 'Select Test'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingQuestionsTest(t);
                            }}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Questions & Markings"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenGlobalShare(t.code, t.course);
                            }}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                            title="Project QR Code & Universal Link"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSheetsModal(t);
                            }}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                            title="Export to Google Sheets"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTest(t.code);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Permanently Delete Test"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Test Deep-Dive Dashboard */}
              {currentTest && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Selected Seminar Test
                        </span>
                        <span className="font-mono font-bold text-base bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-xl">
                          {currentTest.code}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 mt-1">
                        {currentTest.course}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {currentTest.program} · {currentTest.semester} · {currentTest.topic}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingQuestionsTest(currentTest)}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Edit questions, options, answer keys, or marks whenever required"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Questions &amp; Markings</span>
                      </button>

                      <button
                        onClick={() => onOpenSheetsModal(currentTest)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Export to Google Sheet</span>
                      </button>

                      <button
                        onClick={() => handleDeleteTest(currentTest.code)}
                        className="p-2 text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete this test"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Test Code & Invigilator PIN Banner for Teacher & Students */}
                  <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="space-y-1 text-left">
                      <div className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">STUDENT ACCESS CODE</div>
                      <div className="text-3xl font-black font-mono tracking-wider text-emerald-400">
                        {currentTest.code}
                      </div>
                      <p className="text-xs text-slate-300">
                        Instruct students to enter this access code on their mobile phones.
                      </p>
                    </div>

                    {/* Faculty Invigilator PIN Card */}
                    <div className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-xl space-y-1 text-left">
                      <div className="text-[11px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>Invigilator Unlock PIN:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black font-mono text-white tracking-widest">
                          {currentTest.invigilatorPin || '7392'}
                        </span>
                        <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                          PIN
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Enter on student's phone to resume after 2nd violation
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenGlobalShare(currentTest.code, currentTest.course)}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Project QR Code &amp; Link</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(currentTest.code);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}


          {/* Key Metrics Grid */}
          {currentTest && currentPresenterStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Enrolled Students */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-xs font-semibold text-slate-500">Enrolled Students</span>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {currentTest.totalStudents}
                </div>
                <p className="text-[11px] text-slate-400">Roll Numbers 1 to {currentTest.totalStudents}</p>
              </div>

              {/* Submissions Received */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-xs font-semibold text-slate-500">Tests Submitted</span>
                <div className="text-2xl font-bold text-emerald-600 font-mono">
                  {Object.keys(currentTest.submissions || {}).length}
                  <span className="text-xs text-slate-400 font-normal">
                    {' '}/ {currentTest.presenterRoll && currentTest.presenterRoll > 0 ? currentTest.totalStudents - 1 : currentTest.totalStudents} {currentTest.presenterRoll && currentTest.presenterRoll > 0 ? 'attendees' : 'students'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {currentTest.presenterRoll && currentTest.presenterRoll > 0 ? 'Excludes seminar presenter' : 'All enrolled students'}
                </p>
              </div>

              {/* Class Average Score */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-xs font-semibold text-slate-500">Attendee Class Average</span>
                <div className="text-2xl font-bold text-indigo-600 font-mono">
                  {currentPresenterStats.audienceAvgScore}
                  <span className="text-xs text-slate-400 font-normal"> / {currentTest.totalMarks}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {currentTest.totalMarks > 0
                    ? `${Math.round((currentPresenterStats.audienceAvgScore / currentTest.totalMarks) * 100)}% overall performance`
                    : 'No submissions yet'}
                </p>
              </div>

              {/* Test Duration & Questions */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-xs font-semibold text-slate-500">Test Configuration</span>
                <div className="text-xl font-bold text-slate-900 font-mono">
                  {currentTest.numQuestions} Qs · {currentTest.durationMinutes}m
                </div>
                <p className="text-[11px] text-slate-400">{currentTest.marksPerQuestion} mark(s) per question</p>
              </div>
            </div>
          )}

          {/* SEMINAR SPEAKER 50/50 CARD OR GENERAL TEST CARD */}
          {currentTest && currentPresenterStats && (
            currentTest.presenterRoll && currentTest.presenterRoll > 0 ? (
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-bold tracking-wider text-indigo-300">
                          Seminar Speaker Evaluation
                        </span>
                        <span className="bg-amber-400/20 text-amber-300 text-[11px] px-2 py-0.5 rounded-md font-semibold">
                          50/50 Formula
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mt-0.5">
                        Roll #{currentTest.presenterRoll} — {currentTest.presenterName || 'Designated Speaker'}
                      </h3>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-indigo-200">Final Evaluated Mark</div>
                    <div className="text-2xl font-black font-mono text-amber-300">
                      {currentPresenterStats.finalTotal} / {currentPresenterStats.maxTotal}
                      <span className="text-sm font-normal text-white/80 ml-1">
                        ({currentPresenterStats.percentage}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Formula Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10">
                  {/* 50% Component 1: Teacher Allotted */}
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-indigo-200 font-semibold">1. Faculty Direct Score (50%)</span>
                      <button
                        onClick={() => setEditingPresenterMarks(currentTest.presenterTeacherMarks)}
                        className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </div>

                    {editingPresenterMarks !== null ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          min={0}
                          max={currentPresenterStats.maxTeacherScore}
                          step={0.5}
                          value={editingPresenterMarks}
                          onChange={(e) => setEditingPresenterMarks(parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-xs bg-white text-slate-900 rounded font-mono"
                        />
                        <button
                          onClick={handleSavePresenterMarks}
                          disabled={isUpdatingPresenter}
                          className="px-2.5 py-1 bg-amber-400 text-slate-900 text-xs font-bold rounded cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPresenterMarks(null)}
                          className="px-2 py-1 text-white text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="text-lg font-bold font-mono text-white">
                        {currentPresenterStats.teacherScore} / {currentPresenterStats.maxTeacherScore}
                      </div>
                    )}
                    <p className="text-[11px] text-white/60">
                      Allotted for presentation delivery, slides, and Q&amp;A defense.
                    </p>
                  </div>

                  {/* 50% Component 2: Audience Average */}
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/10 space-y-1.5">
                    <div className="text-xs text-indigo-200 font-semibold">
                      2. Audience Test Average (50%)
                    </div>
                    <div className="text-lg font-bold font-mono text-white">
                      {currentPresenterStats.audience50Component} / {currentPresenterStats.maxAudienceComponent}
                    </div>
                    <p className="text-[11px] text-white/60">
                      Auto-calculated from {currentPresenterStats.attendeesSubmittedCount} attendee test submissions.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl p-6 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-bold tracking-wider text-emerald-300">
                          General Purpose Test
                        </span>
                        <span className="bg-emerald-400/20 text-emerald-300 text-[11px] px-2 py-0.5 rounded-md font-semibold">
                          All Students Take Test
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mt-0.5">
                        General Test for All Enrolled Students (Roll 1 to {currentTest.totalStudents})
                      </h3>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-xs text-emerald-200">Total Marks Possible</div>
                    <div className="text-2xl font-black font-mono text-emerald-300">
                      {currentTest.totalMarks} Marks
                    </div>
                  </div>
                </div>

                <p className="text-xs text-white/80 border-t border-white/10 pt-3">
                  All enrolled students take this test normally without speaker exemption. Every student receives a score out of {currentTest.totalMarks} marks based directly on their test submission.
                </p>
              </div>
            )
          )}

          {/* Complete Student Marksheet Table */}
          {currentTest && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Seminar Student Marksheet</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live roster of roll numbers 1 through {currentTest.totalStudents} with submission records
                  </p>
                </div>

                {/* Search & Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search Roll No..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                  >
                    <option value="all">All Rolls</option>
                    <option value="submitted">Submitted</option>
                    <option value="pending">Pending</option>
                    <option value="presenter">Presenter</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">
                        <span className="flex items-center gap-1">
                          <span>Roll No</span>
                          <span className="text-[10px] lowercase text-indigo-500 font-normal font-sans">(click to inspect)</span>
                        </span>
                      </th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Test Status</th>
                      <th className="py-3 px-4">Proctor Monitoring</th>
                      <th className="py-3 px-4 text-right">Score</th>
                      <th className="py-3 px-4 text-right">Percentage</th>
                      <th className="py-3 px-4 text-right">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                    {Array.from({ length: currentTest.totalStudents }, (_, i) => i + 1)
                      .filter((roll) => {
                        const isPresenter = Boolean(currentTest.presenterRoll && currentTest.presenterRoll > 0 && roll === currentTest.presenterRoll);
                        const sub = currentTest.submissions ? currentTest.submissions[roll] : undefined;

                        if (searchFilter && !`${roll}`.includes(searchFilter.trim())) {
                          return false;
                        }

                        if (statusFilter === 'presenter' && !isPresenter) return false;
                        if (statusFilter === 'submitted' && (!sub || isPresenter)) return false;
                        if (statusFilter === 'pending' && (sub || isPresenter)) return false;

                        return true;
                      })
                      .map((roll) => {
                        const isPresenter = Boolean(currentTest.presenterRoll && currentTest.presenterRoll > 0 && roll === currentTest.presenterRoll);
                        const sub = currentTest.submissions ? currentTest.submissions[roll] : undefined;
                        const live = currentTest.liveAlerts ? currentTest.liveAlerts[roll] : undefined;

                        return (
                          <tr
                            key={roll}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isPresenter ? 'bg-indigo-50/40 font-semibold' : ''
                            }`}
                          >
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => setViewingPerformanceRoll(roll)}
                                className="font-bold font-mono text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50/80 px-2 py-1 -ml-2 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 group text-left"
                                title={`Click to view question-wise performance for Roll #${roll}`}
                              >
                                <span>Roll #{roll}</span>
                                <Eye className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                              </button>
                            </td>

                            <td className="py-3 px-4">
                              {isPresenter ? (
                                <span className="text-indigo-700 font-bold flex items-center gap-1 font-sans">
                                  <Award className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Seminar Speaker ({currentTest.presenterName})</span>
                                </span>
                              ) : (
                                <span className="text-slate-500 font-sans">
                                  {currentTest.presenterRoll && currentTest.presenterRoll > 0 ? 'Seminar Attendee' : 'Student'}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 font-sans">
                              {isPresenter ? (
                                <span className="text-indigo-700 font-medium">50/50 Evaluated</span>
                              ) : sub ? (
                                <span className="text-emerald-700 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Submitted</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">Pending / In-Progress</span>
                              )}
                            </td>

                            {/* Proctor Monitoring Column */}
                            <td className="py-3 px-4 font-sans">
                              {isPresenter ? (
                                <span className="text-slate-400 text-[11px] italic">Exempt</span>
                              ) : sub ? (
                                (() => {
                                  const vCount = sub.violationCount || (sub.violations ? sub.violations.length : 0);
                                  const isFlagged = sub.isFlaggedForReview || Boolean(sub.autoSubmittedReason) || vCount >= 3;

                                  if (isFlagged) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedStudentLogs({
                                          rollNumber: roll,
                                          violations: sub.violations || [],
                                          isLocked: false,
                                          isAutoSubmitted: true,
                                          autoSubmittedReason: sub.autoSubmittedReason,
                                          isFlaggedForReview: true,
                                          submittedAt: sub.submittedAt,
                                          score: sub.score,
                                          percentage: sub.percentage
                                        })}
                                        className="px-2 py-0.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Click to view incident log"
                                      >
                                        <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span>🚨 3 Violations (Auto-Submitted)</span>
                                      </button>
                                    );
                                  } else if (vCount === 2) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedStudentLogs({
                                          rollNumber: roll,
                                          violations: sub.violations || [],
                                          isLocked: false,
                                          submittedAt: sub.submittedAt,
                                          score: sub.score,
                                          percentage: sub.percentage
                                        })}
                                        className="px-2 py-0.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                        <span>⚠️ 2 Violations (Resolved)</span>
                                      </button>
                                    );
                                  } else if (vCount === 1) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedStudentLogs({
                                          rollNumber: roll,
                                          violations: sub.violations || [],
                                          isLocked: false,
                                          submittedAt: sub.submittedAt,
                                          score: sub.score,
                                          percentage: sub.percentage
                                        })}
                                        className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>⚠️ 1 Warning</span>
                                      </button>
                                    );
                                  } else {
                                    return (
                                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>✓ Clean (0 warnings)</span>
                                      </span>
                                    );
                                  }
                                })()
                              ) : (
                                (() => {
                                  if (live && live.isLocked) {
                                    return (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedStudentLogs({
                                            rollNumber: roll,
                                            violations: [live.latestViolation],
                                            isLocked: true
                                          })}
                                          className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-bold flex items-center gap-1 animate-pulse cursor-pointer hover:bg-rose-200"
                                        >
                                          <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                          <span>Locked (Violation 2)</span>
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isUnlockingStudent}
                                          onClick={() => handleUnlockStudent(roll)}
                                          className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded cursor-pointer transition-colors shadow-xs"
                                          title="Authorize & Unlock Student"
                                        >
                                          Unlock
                                        </button>
                                      </div>
                                    );
                                  } else if (live && live.violationNumber === 1) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedStudentLogs({
                                          rollNumber: roll,
                                          violations: [live.latestViolation],
                                          isLocked: false
                                        })}
                                        className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-200"
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>⚠️ 1 Warning</span>
                                      </button>
                                    );
                                  } else {
                                    return (
                                      <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                        <span>Monitoring Active</span>
                                      </span>
                                    );
                                  }
                                })()
                              )}
                            </td>

                            <td className="py-3 px-4 text-right font-bold">
                              {isPresenter ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingPerformanceRoll(roll)}
                                  className="text-indigo-700 hover:underline cursor-pointer"
                                  title="View speaker evaluation breakdown"
                                >
                                  {currentPresenterStats?.finalTotal} / {currentTest.totalMarks}
                                </button>
                              ) : sub ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingPerformanceRoll(roll)}
                                  className="text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer inline-flex items-center gap-1 font-mono"
                                  title={`Click to view question-wise answers of Roll #${roll}`}
                                >
                                  <span>{sub.score} / {currentTest.totalMarks}</span>
                                </button>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              {isPresenter ? (
                                <span className="text-indigo-700 font-bold">
                                  {currentPresenterStats?.percentage}%
                                </span>
                              ) : sub ? (
                                <span className="text-emerald-600 font-bold">{sub.percentage}%</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                              {isPresenter ? (
                                <span className="font-sans italic">Exempt from test</span>
                              ) : sub ? (
                                new Date(sub.submittedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Test Successfully Created & Code Announcement */}
      {showCreatedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">Seminar Test Created!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Announce this test access code to the students in the seminar hall:
              </p>
            </div>

            <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-2">
              <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                Official Test Access Code
              </span>
              <div className="text-4xl font-black font-mono tracking-widest text-emerald-400">
                {showCreatedModal.code}
              </div>
              <p className="text-xs text-slate-300">
                Duration: {showCreatedModal.durationMinutes} Minutes · Total Questions: {showCreatedModal.numQuestions}
              </p>
            </div>

            <div className="text-xs text-slate-600 text-left bg-slate-50 p-3.5 rounded-xl space-y-1">
              <p><b>Course:</b> {showCreatedModal.course} ({showCreatedModal.semester})</p>
              <p><b>Roster:</b> Roll numbers 1 through {showCreatedModal.totalStudents}</p>
              {showCreatedModal.presenterRoll && showCreatedModal.presenterRoll > 0 ? (
                <p><b>Speaker:</b> Roll #{showCreatedModal.presenterRoll} ({showCreatedModal.presenterName}) — 50/50 Evaluated</p>
              ) : (
                <p><b>Mode:</b> General Purpose Test (All students take test — No speaker exemption)</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const c = showCreatedModal.code;
                  const crs = showCreatedModal.course;
                  setShowCreatedModal(null);
                  onOpenGlobalShare(c, crs);
                }}
                className="w-full sm:flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>Project QR to Class</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(showCreatedModal.code);
                  setShowCreatedModal(null);
                }}
                className="w-full sm:flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Copy Code &amp; Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROCTOR INCIDENT AUDIT LOG */}
      {selectedStudentLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                  selectedStudentLogs.isAutoSubmitted
                    ? 'bg-rose-100 text-rose-700'
                    : selectedStudentLogs.isLocked
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Proctor Incident Audit · Roll #{selectedStudentLogs.rollNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Screen departure &amp; application switching activity
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentLogs(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Audit Status Overview */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Audit Status:</span>
                {selectedStudentLogs.isAutoSubmitted ? (
                  <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Disqualified / Auto-Submitted
                  </span>
                ) : selectedStudentLogs.isLocked ? (
                  <span className="font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                    Currently Locked (Violation 2)
                  </span>
                ) : (
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Warning Issued (Violation 1)
                  </span>
                )}
              </div>

              {selectedStudentLogs.score !== undefined && (
                <div className="flex items-center justify-between text-slate-700">
                  <span>Recorded Score at Submission:</span>
                  <span className="font-mono font-bold">
                    {selectedStudentLogs.score} marks ({selectedStudentLogs.percentage}%)
                  </span>
                </div>
              )}

              {selectedStudentLogs.autoSubmittedReason && (
                <div className="pt-1 text-[11px] text-rose-700 font-medium border-t border-slate-200">
                  Auto-Submit Note: {selectedStudentLogs.autoSubmittedReason}
                </div>
              )}
            </div>

            {/* Incidents Timeline */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800">
                Recorded Incident Events ({selectedStudentLogs.violations.length}):
              </div>

              {selectedStudentLogs.violations.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  No detailed log payload attached.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedStudentLogs.violations.map((viol: any, idx: number) => (
                    <div
                      key={viol.id || idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 font-mono">
                          Violation #{viol.violationNumber || idx + 1}: {viol.type || 'Screen Exit'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {viol.timestamp ? new Date(viol.timestamp).toLocaleTimeString() : 'Recorded'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        {viol.description || 'Active window focus lost.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              {selectedStudentLogs.isLocked && (
                <button
                  type="button"
                  disabled={isUnlockingStudent}
                  onClick={() => handleUnlockStudent(selectedStudentLogs.rollNumber)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{isUnlockingStudent ? 'Unlocking...' : 'Authorize & Unlock Candidate Now'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedStudentLogs(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Questions & Markings Modal */}
      {editingQuestionsTest && (
        <EditQuestionsModal
          test={editingQuestionsTest}
          isOpen={Boolean(editingQuestionsTest)}
          onClose={() => setEditingQuestionsTest(null)}
          onSave={handleSaveQuestions}
          isSaving={isSavingQuestions}
        />
      )}

      {/* Question-Wise Student Performance Review Modal */}
      {viewingPerformanceRoll !== null && currentTest && (
        <StudentPerformanceModal
          test={currentTest}
          rollNumber={viewingPerformanceRoll}
          isOpen={viewingPerformanceRoll !== null}
          onClose={() => setViewingPerformanceRoll(null)}
          onSelectRoll={(newRoll) => setViewingPerformanceRoll(newRoll)}
        />
      )}
    </div>
  );
};
