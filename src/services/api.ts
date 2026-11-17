import type { SeminarTest, Question, StudentSubmission, TeacherUser } from '../types';

function getStoredTeacherEmail(): string {
  try {
    const raw = sessionStorage.getItem('seminar_teacher_user');
    if (raw) {
      const u = JSON.parse(raw);
      return u?.email || '';
    }
  } catch {}
  return '';
}

async function safeFetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  const teacherEmail = getStoredTeacherEmail();
  const headers = new Headers(options?.headers || {});
  if (teacherEmail && !headers.has('x-teacher-email')) {
    headers.set('x-teacher-email', teacherEmail);
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers,
  };

  try {
    res = await fetch(url, mergedOptions);
  } catch (netErr: any) {
    throw new Error(netErr.message || 'Network connection failed. Please check your internet connection.');
  }

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    if (contentType.includes('application/json')) {
      try {
        const errData = await res.json();
        throw new Error(errData.error || errData.message || `Request failed with HTTP status ${res.status}`);
      } catch (e: any) {
        if (e.message && !e.message.includes('JSON')) throw e;
        throw new Error(`Server request failed with HTTP ${res.status}`);
      }
    } else {
      const rawText = await res.text();
      const titleMatch = rawText.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : `HTTP ${res.status}`;
      throw new Error(`Server temporarily unavailable (${title}). Please retry.`);
    }
  }

  if (contentType.includes('application/json')) {
    try {
      return (await res.json()) as T;
    } catch {
      throw new Error('Received malformed JSON from server.');
    }
  }

  const raw = await res.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Received unexpected non-JSON response from server.');
  }
}

export const api = {
  // Teacher Auth
  async loginTeacher(email: string, password: string): Promise<{ success: boolean; user: TeacherUser }> {
    const data = await safeFetchJson<{ success: boolean; user: TeacherUser }>('/api/auth/teacher-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (data?.user?.email) {
      try {
        sessionStorage.setItem('seminar_teacher_user', JSON.stringify(data.user));
      } catch {}
    }
    return data;
  },

  // Parse document file
  async parseDocument(fileName: string, fileBase64: string, mimeType: string): Promise<{ success: boolean; text: string; textLength: number }> {
    return safeFetchJson<{ success: boolean; text: string; textLength: number }>('/api/parse-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileBase64, mimeType }),
    });
  },

  // Auto-generate MCQs with Gemini
  async generateQuestions(params: {
    materialText: string;
    numQuestions: number;
    course: string;
    program: string;
    marksPerQuestion: number;
    topic?: string;
  }): Promise<{ success: boolean; questions: Question[]; count: number }> {
    return safeFetchJson<{ success: boolean; questions: Question[]; count: number }>('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  // Create new seminar test
  async createTest(testData: Partial<SeminarTest>): Promise<{ success: boolean; test: SeminarTest }> {
    return safeFetchJson<{ success: boolean; test: SeminarTest }>('/api/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    });
  },

  // Get all tests for teacher
  async getTests(teacherEmail?: string): Promise<{ tests: SeminarTest[] }> {
    const email = teacherEmail || getStoredTeacherEmail();
    const url = email ? `/api/tests?teacherEmail=${encodeURIComponent(email)}` : '/api/tests';
    return safeFetchJson<{ tests: SeminarTest[] }>(url);
  },

  // Delete test by code
  async deleteTest(code: string): Promise<{ success: boolean; message: string }> {
    return safeFetchJson<{ success: boolean; message: string }>(`/api/tests/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
  },

  // Update Test Questions & Markings
  async updateTestQuestions(code: string, payload: {
    questions: Question[];
    marksPerQuestion?: number;
    durationMinutes?: number;
    topic?: string;
    course?: string;
  }): Promise<{ success: boolean; test: SeminarTest; message: string }> {
    return safeFetchJson<{ success: boolean; test: SeminarTest; message: string }>(
      `/api/tests/${encodeURIComponent(code)}/questions`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  },

  // Get single test (role can be 'student' or 'teacher')
  async getTestByCode(code: string, role: 'student' | 'teacher' = 'student', teacherEmail?: string): Promise<{ test: SeminarTest }> {
    const email = teacherEmail || (role === 'teacher' ? getStoredTeacherEmail() : '');
    const emailParam = email ? `&teacherEmail=${encodeURIComponent(email)}` : '';
    return safeFetchJson<{ test: SeminarTest }>(`/api/tests/${encodeURIComponent(code)}?role=${role}${emailParam}`);
  },

  // Real-time Server-Sent Events (SSE) subscription for instant student submission updates
  subscribeToTestStream(code: string, teacherEmail?: string, onUpdate?: (test: SeminarTest) => void): () => void {
    const email = teacherEmail || getStoredTeacherEmail();
    const sseUrl = `/api/tests/${encodeURIComponent(code)}/stream?role=teacher&teacherEmail=${encodeURIComponent(email)}`;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(sseUrl);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.test && onUpdate) {
            onUpdate(payload.test);
          }
        } catch (e) {
          console.warn('SSE message parse error:', e);
        }
      };
      eventSource.onerror = () => {
        // EventSource will auto-reconnect
      };
    } catch (err) {
      console.warn('Failed to initialize SSE EventSource:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  },

  // Check if student roll number has already submitted this test
  async checkRollEligibility(code: string, rollNumber: number): Promise<{
    eligible: boolean;
    isPresenter?: boolean;
    alreadySubmitted: boolean;
    submittedAt?: string;
    message?: string;
  }> {
    return safeFetchJson<{
      eligible: boolean;
      isPresenter?: boolean;
      alreadySubmitted: boolean;
      submittedAt?: string;
      message?: string;
    }>(`/api/tests/${encodeURIComponent(code)}/check-eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber }),
    });
  },

  // Submit student test
  async submitStudentTest(code: string, payload: {
    rollNumber: number;
    answers: Record<number, number>;
    durationSpentSeconds: number;
    violationCount?: number;
    violations?: any[];
    autoSubmittedReason?: string;
    isFlaggedForReview?: boolean;
  }): Promise<{ success: boolean; message: string; rollNumber: number; submittedAt?: string; isAutoSubmitted?: boolean }> {
    return safeFetchJson<{ success: boolean; message: string; rollNumber: number; submittedAt?: string; isAutoSubmitted?: boolean }>(
      `/api/tests/${encodeURIComponent(code)}/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  },

  // Record student exam violation (screen leave, tab switch, floating app, etc.)
  async recordViolation(code: string, payload: {
    rollNumber: number;
    violationNumber: number;
    type: string;
    description: string;
  }): Promise<{ success: boolean; isLocked: boolean; isAutoSubmitted: boolean }> {
    return safeFetchJson<{ success: boolean; isLocked: boolean; isAutoSubmitted: boolean }>(
      `/api/tests/${encodeURIComponent(code)}/record-violation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  },

  // Verify Invigilator 4-digit PIN to unlock after 2nd violation
  async verifyInvigilatorPin(code: string, pin: string, rollNumber: number): Promise<{ success: boolean; authorized: boolean; message?: string }> {
    return safeFetchJson<{ success: boolean; authorized: boolean; message?: string }>(
      `/api/tests/${encodeURIComponent(code)}/verify-invigilator-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, rollNumber }),
      }
    );
  },

  // Remote unlock student by teacher
  async unlockStudent(code: string, rollNumber: number): Promise<{ success: boolean; message: string }> {
    return safeFetchJson<{ success: boolean; message: string }>(
      `/api/tests/${encodeURIComponent(code)}/unlock-student`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumber }),
      }
    );
  },

  // Update presenter details
  async updatePresenter(code: string, payload: {
    presenterRoll?: number;
    presenterTeacherMarks?: number;
    presenterName?: string;
  }): Promise<{ success: boolean; test: SeminarTest }> {
    return safeFetchJson<{ success: boolean; test: SeminarTest }>(
      `/api/tests/${encodeURIComponent(code)}/presenter`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  },

  // Sync to Google Sheet Webhook
  async syncGoogleSheet(code: string, webhookUrl: string): Promise<{ success: boolean; message: string }> {
    return safeFetchJson<{ success: boolean; message: string }>(
      `/api/tests/${encodeURIComponent(code)}/google-sheet-sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      }
    );
  }
};
