import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  AlertOctagon,
  EyeOff,
  Hash,
  BookOpen,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { SeminarTest, ProctorViolation } from '../types';
import { api } from '../services/api';
import {
  buildShuffledStudentQuestions,
  mapShuffledAnswersToCanonical,
  type ShuffledQuestionView,
} from '../utils/shuffleExam';

interface StudentSectionProps {
  initialCode?: string;
  onSelectTestCode?: (code: string) => void;
}

export const StudentSection: React.FC<StudentSectionProps> = ({
  initialCode = '',
}) => {
  // Step: 'enter_code' -> 'enter_roll' -> 'testing' -> 'submitted' | 'presenter_exempt'
  const [step, setStep] = useState<'enter_code' | 'enter_roll' | 'testing' | 'submitted' | 'presenter_exempt'>('enter_code');

  const [testCodeInput, setTestCodeInput] = useState(initialCode);
  const [test, setTest] = useState<SeminarTest | null>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const [rollNumberInput, setRollNumberInput] = useState('');
  const [rollError, setRollError] = useState<string | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [alreadySubmittedNotice, setAlreadySubmittedNotice] = useState<{
    rollNumber: number;
    submittedAt?: string;
    message: string;
  } | null>(null);

  // Testing State (uniquely shuffled per student)
  const [studentQuestions, setStudentQuestions] = useState<ShuffledQuestionView[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  // Proctoring State (3-Violation Policy)
  const [violationCount, setViolationCount] = useState<number>(0);
  const [violations, setViolations] = useState<ProctorViolation[]>([]);
  const [showViolation1Modal, setShowViolation1Modal] = useState<boolean>(false);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);
  const [invigilatorPinInput, setInvigilatorPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [isCheckingRemoteUnlock, setIsCheckingRemoteUnlock] = useState<boolean>(false);
  const [latestViolationEvent, setLatestViolationEvent] = useState<ProctorViolation | null>(null);
  const [autoSubmittedReason, setAutoSubmittedReason] = useState<string | null>(null);
  const [submitErrorNotice, setSubmitErrorNotice] = useState<string | null>(null);

  // Submission result
  const [submissionReceipt, setSubmissionReceipt] = useState<{
    rollNumber: number;
    submittedAt: string;
    message: string;
    isAutoSubmitted?: boolean;
    violationCount?: number;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Refs to prevent state staleness across window blur / visibilitychange listeners
  const violationCountRef = useRef<number>(0);
  const violationsRef = useRef<ProctorViolation[]>([]);
  const lastTriggerTimeRef = useRef<number>(0);
  const isLockedOutRef = useRef<boolean>(false);
  const isAutoSubmittingRef = useRef<boolean>(false);
  const studentQuestionsRef = useRef<ShuffledQuestionView[]>([]);
  const selectedAnswersRef = useRef<Record<number, number>>({});

  // Auto-fetch if initialCode provided
  useEffect(() => {
    if (initialCode && step === 'enter_code') {
      setTestCodeInput(initialCode);
      handleFetchTest(initialCode);
    }
  }, [initialCode]);

  // Fetch test details
  const handleFetchTest = async (codeToFetch?: string) => {
    const code = (codeToFetch || testCodeInput).toUpperCase().trim();
    if (!code) {
      setTestError('Please enter a test code.');
      return;
    }

    setTestError(null);
    setIsLoadingTest(true);

    try {
      const res = await api.getTestByCode(code, 'student');
      setTest(res.test);
      setStep('enter_roll');
    } catch (err: any) {
      setTestError(err.message || `Test code "${code}" not found. Please verify with your instructor.`);
    } finally {
      setIsLoadingTest(false);
    }
  };

  // Validate Roll Number, verify no prior submission, & Start Test
  const handleStartExam = async () => {
    if (!test || isCheckingEligibility) return;
    setRollError(null);
    setAlreadySubmittedNotice(null);

    const roll = parseInt(String(rollNumberInput).replace(/[^0-9]/g, ''), 10);
    if (isNaN(roll) || roll < 1 || roll > test.totalStudents) {
      setRollError(`Please enter a valid roll number between 1 and ${test.totalStudents}.`);
      return;
    }

    // CHECK IF THIS ROLL NUMBER IS THE SEMINAR SPEAKER
    if (test.presenterRoll && test.presenterRoll > 0 && roll === test.presenterRoll) {
      setStep('presenter_exempt');
      return;
    }

    // Verify with backend whether this student has already submitted this test
    setIsCheckingEligibility(true);
    try {
      const eligibility = await api.checkRollEligibility(test.code, roll);
      if (eligibility.isPresenter) {
        setStep('presenter_exempt');
        return;
      }
      if (eligibility.alreadySubmitted || eligibility.eligible === false) {
        setAlreadySubmittedNotice({
          rollNumber: roll,
          submittedAt: eligibility.submittedAt,
          message:
            eligibility.message ||
            `Roll #${roll} has already submitted this test. Re-attempting the same test is not permitted.`,
        });
        return;
      }
    } catch (err: any) {
      // Fallback check against local device receipt if server is temporarily unreachable
      try {
        const localSubmittedAt = localStorage.getItem(`seminar_submitted_${test.code}_${roll}`);
        if (localSubmittedAt) {
          setAlreadySubmittedNotice({
            rollNumber: roll,
            submittedAt: localSubmittedAt,
            message: `Roll #${roll} has already submitted this test. Re-attempting the same test is not permitted.`,
          });
          return;
        }
      } catch {}
      setRollError(err.message || 'Unable to verify test eligibility. Please try again.');
      return;
    } finally {
      setIsCheckingEligibility(false);
    }

    // Reset proctoring state
    violationCountRef.current = 0;
    violationsRef.current = [];
    lastTriggerTimeRef.current = 0;
    isLockedOutRef.current = false;
    isAutoSubmittingRef.current = false;
    setViolationCount(0);
    setViolations([]);
    setShowViolation1Modal(false);
    setIsLockedOut(false);
    setAutoSubmittedReason(null);

    // Shuffle BOTH question order AND option order (A, B, C, D) uniquely for this student
    const shuffled = buildShuffledStudentQuestions(test.questions || []);
    studentQuestionsRef.current = shuffled;
    setStudentQuestions(shuffled);

    // Start Timer
    const durationSeconds = (test.durationMinutes || 15) * 60;
    setSecondsRemaining(durationSeconds);
    startTimeRef.current = Date.now();
    setCurrentQuestionIndex(0);
    selectedAnswersRef.current = {};
    setSelectedAnswers({});
    setStep('testing');
  };

  // Timer countdown
  useEffect(() => {
    if (step === 'testing') {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // AUTO SUBMIT WHEN TIME RUNS OUT!
            handleFinalSubmit(true, 'Test duration elapsed.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, rollNumberInput, test]);

  // PROCTORING VIOLATION DISPATCHER
  const handleProctorViolation = (type: ProctorViolation['type'], description: string) => {
    // Only monitor when in active exam, proctoring is enabled, and not already auto-submitting
    if (step !== 'testing' || !test || isAutoSubmittingRef.current) return;
    if (test.enableProctoring === false) return;

    // Debounce triggers (e.g. 1.8s) so a single app switch / phone lock doesn't fire both blur and visibilitychange
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 1800) {
      return;
    }
    lastTriggerTimeRef.current = now;

    // If currently locked out in Violation 2, don't accumulate further until unlocked
    if (isLockedOutRef.current) {
      return;
    }

    const currentViolations = violationCountRef.current;
    const nextViolationNum = currentViolations + 1;
    violationCountRef.current = nextViolationNum;
    setViolationCount(nextViolationNum);

    const roll = parseInt(rollNumberInput, 10);
    const violation: ProctorViolation = {
      id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      violationNumber: nextViolationNum,
      type,
      description,
    };

    const updatedViolations = [...violationsRef.current, violation];
    violationsRef.current = updatedViolations;
    setViolations(updatedViolations);
    setLatestViolationEvent(violation);

    // Notify backend in background
    api.recordViolation(test.code, {
      rollNumber: roll,
      violationNumber: nextViolationNum,
      type,
      description,
    }).catch((err) => console.warn('Background proctor alert log error:', err));

    // POLICY ACTIONS
    if (nextViolationNum === 1) {
      // 1ST VIOLATION: Display prominent warning, record incident, flag attempt
      setShowViolation1Modal(true);
    } else if (nextViolationNum === 2) {
      // 2ND VIOLATION: Restrict further examination activity and require invigilator authorization
      setShowViolation1Modal(false);
      setIsLockedOut(true);
      isLockedOutRef.current = true;
    } else if (nextViolationNum >= 3) {
      // 3RD VIOLATION: Automatically submit examination using answers saved up to that point
      setShowViolation1Modal(false);
      setIsLockedOut(false);
      isLockedOutRef.current = false;
      isAutoSubmittingRef.current = true;
      const reason = 'Disqualified: 3 proctoring violations recorded (Leaving exam screen / Application switch / Floating tools detected).';
      setAutoSubmittedReason(reason);
      handleFinalSubmit(true, reason);
    }
  };

  // ACTIVE SCREEN MONITORING EVENT LISTENERS
  useEffect(() => {
    if (step !== 'testing') return;

    // 1. Detect app minimized, tab switched, recent-apps tray, or phone screen locked
    const onVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        handleProctorViolation(
          'app_minimize',
          'Left active examination screen: Tab switched, app minimized, or mobile screen locked.'
        );
      }
    };

    // 2. Detect window blur (Floating apps like Parakeet AI, notifications shade, split screen, external assistant)
    const onWindowBlur = () => {
      handleProctorViolation(
        'floating_app_detected',
        'Examination screen lost focus: Floating overlay assistant (e.g. Parakeet AI), split-screen, or multitasking detected.'
      );
    };

    // 3. Detect page hide / navigation away
    const onPageHide = () => {
      handleProctorViolation(
        'tab_switch',
        'Navigated away from examination application.'
      );
    };

    // 4. Examination integrity locks: Disable right-click context menu and copy-paste
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const preventClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('copy', preventClipboard);
    document.addEventListener('cut', preventClipboard);
    document.addEventListener('paste', preventClipboard);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('copy', preventClipboard);
      document.removeEventListener('cut', preventClipboard);
      document.removeEventListener('paste', preventClipboard);
    };
  }, [step, test, rollNumberInput]);

  // Invigilator PIN verification to resume from 2nd violation
  const handleVerifyInvigilatorPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test || !invigilatorPinInput.trim() || isVerifyingPin) return;

    setIsVerifyingPin(true);
    setPinError(null);

    const roll = parseInt(rollNumberInput, 10);
    try {
      const res = await api.verifyInvigilatorPin(test.code, invigilatorPinInput.trim(), roll);
      if (res.authorized) {
        setIsLockedOut(false);
        isLockedOutRef.current = false;
        setInvigilatorPinInput('');
        setPinError(null);
      } else {
        setPinError('Invalid Invigilator Authorization PIN. Please contact the teacher in the seminar hall.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Authorization failed. Please ensure the invigilator enters the correct PIN.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Remote Unlock Check (Teacher unlocks from their dashboard)
  const handleCheckRemoteUnlock = async () => {
    if (!test) return;
    setIsCheckingRemoteUnlock(true);
    setPinError(null);
    try {
      const res = await api.getTestByCode(test.code, 'student');
      // If teacher unlocked this student remotely
      const roll = parseInt(rollNumberInput, 10);
      if (res.test.liveAlerts && res.test.liveAlerts[roll] && res.test.liveAlerts[roll].isLocked === false) {
        setIsLockedOut(false);
        isLockedOutRef.current = false;
        setInvigilatorPinInput('');
      } else {
        setPinError('The instructor has not unlocked your test yet. Please ask the instructor to unlock or enter their 4-digit PIN.');
      }
    } catch (e: any) {
      setPinError('Could not check unlock status. Please try again.');
    } finally {
      setIsCheckingRemoteUnlock(false);
    }
  };

  // Submit test to backend
  const handleFinalSubmit = async (isAutoSubmit: boolean = false, autoReason?: string) => {
    if (!test || isSubmitting) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitting(true);
    setSubmitErrorNotice(null);

    const durationSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    const cleanRoll = parseInt(String(rollNumberInput).replace(/[^0-9]/g, ''), 10);
    const finalReason = autoReason || autoSubmittedReason || (isAutoSubmit ? 'Auto-submitted' : undefined);

    // Map student's shuffled display answers back to canonical question & option indices
    const canonicalAnswers = mapShuffledAnswersToCanonical(
      selectedAnswersRef.current,
      studentQuestionsRef.current
    );

    // Save a persistent local copy of student answers on their mobile device
    try {
      localStorage.setItem(`seminar_answers_backup_${test.code}_${cleanRoll}`, JSON.stringify(canonicalAnswers));
    } catch {}

    const submitCall = async () => {
      return await api.submitStudentTest(test.code, {
        rollNumber: cleanRoll,
        answers: canonicalAnswers,
        durationSpentSeconds: durationSpent,
        violationCount: violationCountRef.current,
        violations: violationsRef.current,
        autoSubmittedReason: finalReason,
        isFlaggedForReview: Boolean(finalReason || violationCountRef.current >= 3),
      });
    };

    try {
      let res;
      try {
        res = await submitCall();
      } catch (firstNetErr) {
        // Automatic single retry for transient mobile network glitch
        await new Promise((resolve) => setTimeout(resolve, 800));
        res = await submitCall();
      }

      // Persist local completion record on device
      try {
        localStorage.setItem(
          `seminar_submitted_${test.code}_${cleanRoll}`,
          res.submittedAt || new Date().toISOString()
        );
      } catch {}

      setShowSubmitConfirm(false);
      setSubmissionReceipt({
        rollNumber: cleanRoll,
        submittedAt: res.submittedAt || new Date().toISOString(),
        message: res.message,
        isAutoSubmitted: isAutoSubmit || Boolean(finalReason),
        violationCount: violationCountRef.current,
      });

      // Confetti burst for honest test completion only (not on violation disqualification)
      if (!isAutoSubmit && !finalReason) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      setStep('submitted');
    } catch (err: any) {
      console.error('Submission error:', err);
      // NEVER show an alert() popup on student mobile screen!
      setSubmitErrorNotice(err.message || 'Mobile network interrupted. Your answers are safely stored! Tap Retry Submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format time remaining MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Timer color indicator
  const isTimeCritical = secondsRemaining > 0 && secondsRemaining <= 60;
  const isTimeWarning = secondsRemaining > 60 && secondsRemaining <= 300;

  const currentQ = studentQuestions[currentQuestionIndex];
  const totalQ = studentQuestions.length;
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="max-w-xl mx-auto w-full">
      {/* STEP 1: ENTER TEST ACCESS CODE */}
      {step === 'enter_code' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Test Portal</h1>
            <p className="text-xs text-slate-500">
              Enter the unique access code announced by your instructor after the seminar
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleFetchTest();
            }}
            className="space-y-4"
          >
            {testError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block text-center">
                Seminar Test Access Code
              </label>
              <input
                type="text"
                required
                value={testCodeInput}
                onChange={(e) => setTestCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. SEM-4821"
                className="w-full text-center text-xl font-mono font-bold tracking-widest px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingTest || !testCodeInput.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoadingTest ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Checking Seminar Test...</span>
                </>
              ) : (
                <>
                  <span>Load Seminar Test</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {initialCode ? (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Active Seminar Session:</span>
              <button
                type="button"
                onClick={() => {
                  setTestCodeInput(initialCode);
                  handleFetchTest(initialCode);
                }}
                className="font-mono font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                {initialCode}
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
              Obtain the 6-character access code from your seminar faculty or projected on the screen.
            </div>
          )}
        </div>
      )}

      {/* STEP 2: ENTER ROLL NUMBER */}
      {step === 'enter_roll' && test && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('enter_code')}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
              {test.code}
            </span>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold text-slate-900">{test.course}</h1>
            <p className="text-xs text-slate-500">
              {test.program} · {test.semester}
            </p>
            <div className="text-xs font-medium text-slate-700 pt-1">
              Topic: <span className="font-semibold text-indigo-700">{test.topic}</span>
            </div>
          </div>

          {/* Test Metadata Overview */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Questions</span>
              <span className="font-bold text-slate-900 font-mono">{test.numQuestions} Qs</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Total Marks</span>
              <span className="font-bold text-slate-900 font-mono">{test.totalMarks} Marks</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Duration</span>
              <span className="font-bold text-indigo-600 font-mono">{test.durationMinutes} Mins</span>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStartExam();
            }}
            className="space-y-4"
          >
            {rollError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{rollError}</span>
              </div>
            )}

            {alreadySubmittedNotice && (
              <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 space-y-2 shadow-xs animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                      Re-Attempt Not Permitted · Already Submitted
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      {alreadySubmittedNotice.message}
                    </p>
                    {alreadySubmittedNotice.submittedAt && (
                      <p className="text-[11px] font-mono text-amber-700 pt-0.5">
                        Prior submission recorded on:{' '}
                        {new Date(alreadySubmittedNotice.submittedAt).toLocaleString()}
                      </p>
                    )}
                    <p className="text-[11px] text-amber-800 pt-0.5">
                      Each student is allowed only one attempt per test. If you entered an incorrect roll number by mistake, please update your Roll Number above.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Enter Your Roll Number (1 to {test.totalStudents})
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  required
                  min={1}
                  max={test.totalStudents}
                  value={rollNumberInput}
                  onChange={(e) => {
                    setRollNumberInput(e.target.value);
                    if (alreadySubmittedNotice) setAlreadySubmittedNotice(null);
                    if (rollError) setRollError(null);
                  }}
                  placeholder="e.g. 18"
                  className="w-full pl-10 pr-4 py-2.5 text-base font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Roll numbers are assigned from 1 to {test.totalStudents}.
              </p>
            </div>

            {/* Live Proctoring Rules Banner */}
            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl text-[11px] text-rose-950 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-rose-700">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Active Proctoring &amp; Anti-Cheating Policy:</span>
              </div>
              <p>• <b>Do NOT leave this exam screen</b>. Minimizing the app, switching browser tabs, locking your screen, or opening recent apps is tracked.</p>
              <p>• <b>Floating apps &amp; AI tools prohibited</b>: Use of floating apps (like Parakeet AI), ChatGPT, Gemini, WhatsApp, or Google Search will trigger violations.</p>
              <p>• <b>Randomized Paper</b>: Questions and answer choices (A–D) are uniquely shuffled for each student.</p>
              <div className="p-2 bg-white/70 rounded-lg border border-rose-100 font-mono text-[10px] space-y-0.5 text-slate-700">
                <div><b>Violation 1:</b> Incident logged + Formal warning on screen</div>
                <div><b>Violation 2:</b> Exam locked out (Requires Invigilator PIN to unlock)</div>
                <div><b>Violation 3:</b> Immediate auto-submission &amp; flagged for review</div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isCheckingEligibility}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isCheckingEligibility ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Student Eligibility...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Acknowledge &amp; Start Seminar Test</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* PRESENTATION SPEAKER EXEMPTION SCREEN */}
      {step === 'presenter_exempt' && test && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-6 sm:p-8 shadow-md text-center space-y-5 animate-in fade-in duration-200">
          <div className="w-16 h-16 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Award className="w-8 h-8 text-amber-500" />
          </div>

          <div className="space-y-1">
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              Seminar Speaker Detected
            </span>
            <h2 className="text-xl font-black text-slate-900 pt-2">
              Welcome, Roll #{test.presenterRoll}!
            </h2>
            <p className="text-xs text-slate-500">
              {test.presenterName ? `Speaker: ${test.presenterName}` : 'Designated Seminar Presenter'}
            </p>
          </div>

          <div className="p-5 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl text-left space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-300">
              Seminar Speaker Evaluation Policy
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed">
              As the candidate who delivered this seminar, you are <b>exempt from taking the written multiple-choice test</b>.
            </p>
            <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
              <div className="flex items-center justify-between text-indigo-200">
                <span>1. Faculty Presentation Score:</span>
                <span className="font-mono font-bold text-white">50% of Test Marks</span>
              </div>
              <div className="flex items-center justify-between text-indigo-200">
                <span>2. Attending Students Average:</span>
                <span className="font-mono font-bold text-emerald-400">50% of Test Marks</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 italic pt-1">
              Your marks are being directly computed in the faculty admin portal based on your presentation defense and the peer test results.
            </p>
          </div>

          <button
            onClick={() => setStep('enter_roll')}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Return to Roll Number Entry
          </button>
        </div>
      )}

      {/* STEP 3: INTERACTIVE MOBILE TEST TAKING */}
      {step === 'testing' && test && currentQ && (
        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[520px]">
          {/* Mobile Test Header with Countdown Timer & Proctor Badge */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-20 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700">
                  Question {currentQuestionIndex + 1} of {totalQ}
                </span>
                <span className="text-[10px] text-slate-400">· Roll #{rollNumberInput}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-indigo-600 font-medium">
                  {answeredCount} of {totalQ} answered
                </span>
                {/* Live Proctor Shield Status */}
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                    violationCount === 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : violationCount === 1
                      ? 'bg-amber-50 text-amber-700 border border-amber-300 animate-pulse'
                      : 'bg-rose-50 text-rose-700 border border-rose-300'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Proctor: {violationCount}/3 Warnings</span>
                </span>
              </div>
            </div>

            {/* Timer Banner */}
            <div
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-mono text-xs font-bold transition-all ${
                isTimeCritical
                  ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                  : isTimeWarning
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-slate-100">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / totalQ) * 100}%` }}
            />
          </div>

          {/* Question Body */}
          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-6 select-none">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900 leading-snug">
                  {currentQ.questionText}
                </h2>
              </div>

              {/* 4 Touch-friendly Shuffled Options */}
              <div className="space-y-2.5">
                {currentQ.options.map((opt, optIndex) => {
                  const isSelected = selectedAnswers[currentQuestionIndex] === optIndex;
                  return (
                    <button
                      key={`${currentQ.id}-${opt.originalOptionIndex}`}
                      type="button"
                      onClick={() => {
                        const updated = {
                          ...selectedAnswersRef.current,
                          [currentQuestionIndex]: optIndex,
                        };
                        selectedAnswersRef.current = updated;
                        setSelectedAnswers(updated);
                      }}
                      className={`w-full p-3.5 sm:p-4 rounded-xl text-left text-xs sm:text-sm border transition-all flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-600 text-indigo-950 font-semibold shadow-xs ring-1 ring-indigo-600'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {String.fromCharCode(65 + optIndex)}
                      </span>
                      <span className="flex-1 leading-relaxed break-words whitespace-normal">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-30 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                {/* Question Palette Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPalette(!showPalette)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  <span>Q-Grid ({answeredCount}/{totalQ})</span>
                </button>

                {currentQuestionIndex < totalQ - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQ - 1, prev + 1))}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(true)}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit</span>
                  </button>
                )}
              </div>

              {/* Question Navigation Grid Drawer */}
              {showPalette && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500">Jump to Question:</div>
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                    {studentQuestions.map((_, idx) => {
                      const isAnswered = selectedAnswers[idx] !== undefined;
                      const isCurrent = idx === currentQuestionIndex;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCurrentQuestionIndex(idx);
                            setShowPalette(false);
                          }}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                            isCurrent
                              ? 'ring-2 ring-indigo-600 bg-white text-indigo-700'
                              : isAnswered
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-600'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* PROCTORING OVERLAYS                                       */}
          {/* ========================================================= */}

          {/* 1ST VIOLATION MODAL: WARNING */}
          {showViolation1Modal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border-2 border-amber-500 text-center space-y-4">
                <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto ring-4 ring-amber-50">
                  <AlertOctagon className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                    Examination Warning 1 of 3
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 pt-2">
                    Leaving Examination Screen Prohibited!
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The examination monitor detected that you switched away from the active test screen.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-950 space-y-1.5">
                  <div className="font-semibold text-amber-900">Recorded Incident:</div>
                  <p className="text-[11px] font-mono text-slate-700">
                    {latestViolationEvent?.description || 'Active examination window lost focus or switched away.'}
                  </p>
                  <p className="text-[11px] text-amber-800 pt-1">
                    • Switching to <b>WhatsApp, Chrome, ChatGPT, Gemini</b>, or floating assistants like <b>Parakeet AI</b> is strictly forbidden.
                  </p>
                  <p className="text-[11px] font-bold text-rose-700">
                    ⚠️ A 2nd violation will freeze your test and require an invigilator PIN to unlock.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowViolation1Modal(false)}
                  className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  I Understand &amp; Return to Examination
                </button>
              </div>
            </div>
          )}

          {/* 2ND VIOLATION MODAL: FROZEN EXAM LOCKOUT REQUIRING INVIGILATOR PIN */}
          {isLockedOut && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-950/90 backdrop-blur-md animate-in zoom-in-95 duration-200">
              <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border-2 border-rose-600 text-center space-y-4">
                <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto ring-4 ring-rose-50">
                  <Lock className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-3 py-1 rounded-full">
                    Violation 2 of 3 · Examination Suspended
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 pt-2">
                    Invigilator Authorization Required
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A second attempt to navigate away from the test was detected. Further examination activity has been restricted.
                  </p>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-left text-xs text-rose-950 space-y-1">
                  <div className="font-semibold text-rose-900">Incident Details:</div>
                  <p className="text-[11px] font-mono text-slate-700">
                    Candidate: Roll #{rollNumberInput} · Time: {latestViolationEvent?.timestamp ? new Date(latestViolationEvent.timestamp).toLocaleTimeString() : 'Recorded'}
                  </p>
                  <p className="text-[11px] text-rose-800">
                    Please call the seminar invigilator or faculty member to verify your mobile device and enter their 4-digit Invigilator PIN to unlock your test.
                  </p>
                </div>

                {pinError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-left">
                    {pinError}
                  </div>
                )}

                <form onSubmit={handleVerifyInvigilatorPin} className="space-y-3">
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-slate-700 block text-center">
                      Invigilator 4-Digit Authorization PIN
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        maxLength={6}
                        required
                        value={invigilatorPinInput}
                        onChange={(e) => setInvigilatorPinInput(e.target.value)}
                        placeholder="Enter Faculty PIN"
                        className="w-full pl-9 pr-3 py-2.5 text-center text-lg font-mono font-bold tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white text-slate-900"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifyingPin || !invigilatorPinInput.trim()}
                    className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isVerifyingPin ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verifying PIN...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Authorize &amp; Resume Examination</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Instructor unlocked remotely?</span>
                  <button
                    type="button"
                    onClick={handleCheckRemoteUnlock}
                    disabled={isCheckingRemoteUnlock}
                    className="text-indigo-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingRemoteUnlock ? 'animate-spin' : ''}`} />
                    <span>Check Remote Unlock</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANUAL SUBMISSION CONFIRMATION MODAL */}
      {showSubmitConfirm && test && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Confirm Test Submission</h3>
              <p className="text-xs text-slate-500 mt-1">
                You have answered <span className="font-bold text-slate-900">{answeredCount}</span> of{' '}
                <span className="font-bold text-slate-900">{totalQ}</span> questions.
              </p>
              {answeredCount < totalQ && (
                <p className="text-[11px] text-amber-600 mt-1">
                  {totalQ - answeredCount} question(s) remain unanswered.
                </p>
              )}
            </div>

            {submitErrorNotice && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-left space-y-1">
                <div className="text-xs font-bold text-rose-800">⚠️ Network Notice</div>
                <p className="text-[11px] text-rose-700 leading-relaxed">{submitErrorNotice}</p>
              </div>
            )}

            {isSubmitting ? (
              <div className="py-2 flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600">
                <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Recording your test securely...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl cursor-pointer"
                >
                  Continue Test
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinalSubmit(false)}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  {submitErrorNotice ? 'Retry Submit' : 'Yes, Submit Now'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DEDICATED INLINE RETRY MODAL IF SUBMISSION FAILED ON MOBILE (NO POPUP) */}
      {submitErrorNotice && !showSubmitConfirm && step === 'testing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-amber-300 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Submission Notice</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {submitErrorNotice}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Your answers are safely preserved on your phone. Tap retry to send again.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmitErrorNotice(null)}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleFinalSubmit(false)}
                className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Retry Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: POST-SUBMISSION SCREEN (HONEST SUBMIT OR 3RD VIOLATION AUTO-SUBMIT) */}
      {step === 'submitted' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-md text-center space-y-5 animate-in zoom-in-95 duration-200">
          {submissionReceipt?.isAutoSubmitted ? (
            /* AUTO SUBMITTED (3RD VIOLATION) NOTIFICATION */
            <>
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto ring-4 ring-rose-50">
                <AlertOctagon className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 px-3 py-1 rounded-full">
                  Disqualified · Flagged for Review
                </span>
                <h2 className="text-xl font-bold text-slate-900 pt-2">
                  Test Automatically Submitted
                </h2>
                <p className="text-xs text-rose-600 font-medium">
                  3 proctoring violations were recorded during your examination.
                </p>
              </div>

              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl text-left text-xs text-slate-700 space-y-2">
                <div className="flex items-center justify-between text-slate-900 font-semibold pb-1 border-b border-rose-200">
                  <span>Candidate Roll Number:</span>
                  <span className="font-mono text-rose-700 font-bold">Roll #{submissionReceipt?.rollNumber}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Reason for Auto-Submit:</span>
                  <span className="text-rose-700 font-semibold text-[11px]">3 Screen Departure / App Switch Violations</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Time Logged:</span>
                  <span className="font-mono text-[11px]">
                    {submissionReceipt?.submittedAt
                      ? new Date(submissionReceipt.submittedAt).toLocaleTimeString()
                      : 'Recorded'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Audit Status:</span>
                  <span className="text-rose-700 font-bold">Flagged for Administrator Review</span>
                </div>
                <p className="text-[11px] text-slate-500 pt-1 italic">
                  Answers saved up to the 3rd violation have been locked and submitted. As per examination policy, marks remain confidential and are transmitted directly to the faculty dashboard.
                </p>
              </div>
            </>
          ) : (
            /* HONEST NORMAL SUBMISSION */
            <>
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto ring-4 ring-emerald-50">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">Test Submitted Successfully!</h2>
                <p className="text-xs text-slate-500">
                  Your seminar examination responses have been securely recorded.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-600 space-y-2">
                <div className="flex items-center justify-between text-slate-900 font-semibold pb-1 border-b border-slate-200">
                  <span>Candidate Roll Number:</span>
                  <span className="font-mono text-indigo-600 font-bold">Roll #{submissionReceipt?.rollNumber}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Submission Time:</span>
                  <span className="font-mono">
                    {submissionReceipt?.submittedAt
                      ? new Date(submissionReceipt.submittedAt).toLocaleTimeString()
                      : 'Recorded'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Status:</span>
                  <span className="text-emerald-600 font-semibold">Delivered to Faculty Portal</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Proctoring Audit:</span>
                  <span className="text-emerald-700 font-mono font-medium">
                    {submissionReceipt?.violationCount === 0 ? '✓ Clean (0 warnings)' : `${submissionReceipt?.violationCount} incident(s) recorded`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1 italic">
                  Note: In compliance with university seminar examination guidelines, marks are not displayed directly to students and will be reviewed and published in the faculty admin portal.
                </p>
              </div>
            </>
          )}

          <button
            onClick={() => {
              setStep('enter_code');
              setTest(null);
              setRollNumberInput('');
            }}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Done · Return to Home
          </button>
        </div>
      )}
    </div>
  );
};
