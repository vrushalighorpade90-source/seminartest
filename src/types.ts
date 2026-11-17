export interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface ProctorViolation {
  id: string;
  timestamp: string;
  violationNumber: number; // 1, 2, or 3
  type: 'tab_switch' | 'app_minimize' | 'window_blur' | 'floating_app_detected' | 'fullscreen_exit' | 'screen_lock' | 'unauthorized_action';
  description: string;
}

export interface StudentSubmission {
  rollNumber: number;
  studentName?: string;
  answers: Record<number, number>; // questionIndex -> selectedOptionIndex
  score: number;
  totalPossible: number;
  percentage: number;
  submittedAt: string;
  durationSpentSeconds: number;
  violationCount?: number;
  violations?: ProctorViolation[];
  autoSubmittedReason?: string;
  isFlaggedForReview?: boolean;
  isLockedOut?: boolean;
}

export interface LiveProctorAlert {
  rollNumber: number;
  violationNumber: number;
  latestViolation: ProctorViolation;
  isLocked: boolean;
  isAutoSubmitted: boolean;
  updatedAt: string;
}

export interface SeminarTest {
  id: string;
  code: string; // e.g. "SEM-4921"
  program: string; // e.g. "B.Tech Computer Science"
  course: string; // e.g. "Cloud Computing & Distributed Systems"
  semester: string; // e.g. "Semester 6"
  topic: string; // e.g. "Kubernetes Architecture and Microservices"
  numQuestions: number; // 10, 20, 30
  marksPerQuestion: number; // e.g. 2
  totalMarks: number; // numQuestions * marksPerQuestion
  durationMinutes: number; // e.g. 15
  totalStudents: number; // up to 200
  presenterRoll: number | null; // Roll of student delivering seminar (null or 0 if None/General Test)
  presenterName?: string;
  presenterTeacherMarks: number; // Faculty 50% allotment (out of totalMarks / 2)
  questions: Question[];
  submissions: Record<number, StudentSubmission>; // rollNumber -> submission
  liveAlerts?: Record<number, LiveProctorAlert>; // rollNumber -> live violation tracking
  createdAt: string;
  status: 'active' | 'completed';
  createdByTeacherEmail?: string;
  createdByTeacherName?: string;
  invigilatorPin?: string; // 4-digit PIN (default "7392") for unlocking second violations
  enableProctoring?: boolean; // Default true
}

export interface TeacherUser {
  id: string;
  name: string;
  email: string;
  department: string;
  token: string;
}

export interface TestStats {
  totalEnrolled: number;
  submittedCount: number;
  pendingCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  presenterTeacherScore: number;
  presenterAudienceScore: number;
  presenterTotalScore: number;
  presenterMaxPossible: number;
}
