import React from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Award,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  MinusCircle,
  BookOpen
} from 'lucide-react';
import type { SeminarTest, StudentSubmission } from '../types';

interface StudentPerformanceModalProps {
  test: SeminarTest;
  rollNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectRoll: (roll: number) => void;
}

export const StudentPerformanceModal: React.FC<StudentPerformanceModalProps> = ({
  test,
  rollNumber,
  isOpen,
  onClose,
  onSelectRoll,
}) => {
  if (!isOpen) return null;

  const isPresenter = Boolean(
    test.presenterRoll && test.presenterRoll > 0 && rollNumber === test.presenterRoll
  );
  const submission: StudentSubmission | undefined = test.submissions
    ? test.submissions[rollNumber]
    : undefined;

  const questions = test.questions || [];
  const marksPerQuestion = test.marksPerQuestion || 1;

  // Compute breakdown metrics
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  if (submission && submission.answers) {
    questions.forEach((q, idx) => {
      const studentAns = submission.answers[idx];
      if (studentAns === undefined || studentAns === null) {
        unansweredCount++;
      } else if (studentAns === q.correctOptionIndex) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '< 1 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const hasPrev = rollNumber > 1;
  const hasNext = rollNumber < test.totalStudents;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg shadow-xs">
                Roll #{rollNumber}
              </span>
              <span className="text-xs font-bold text-slate-800">
                {test.course}
              </span>
              <span className="text-[11px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                {test.code}
              </span>
              {isPresenter && (
                <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-600" />
                  <span>Seminar Speaker ({test.presenterName})</span>
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Question-Wise Student Examination Performance
            </h2>
            <p className="text-xs text-slate-500">
              Detailed breakdown of candidate answers, correctness, score per question, and proctoring log.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Roll Stepper */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs mr-1">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => onSelectRoll(rollNumber - 1)}
                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded disabled:opacity-20 cursor-pointer transition-colors"
                title="Previous Student"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-2 text-slate-700">
                {rollNumber} / {test.totalStudents}
              </span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => onSelectRoll(rollNumber + 1)}
                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded disabled:opacity-20 cursor-pointer transition-colors"
                title="Next Student"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Close Performance Review"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* CASE 1: PRESENTER EXEMPTION */}
          {isPresenter ? (
            <div className="p-6 bg-gradient-to-r from-indigo-50 to-amber-50 border border-indigo-200 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto ring-4 ring-amber-50">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Designated Seminar Speaker Exemption
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Roll #{rollNumber} is registered as the Seminar Presenter for this session. As per faculty examination guidelines, the speaker delivers the oral defense and does not take the audience multiple-choice test.
              </p>
              <div className="inline-flex items-center gap-2 p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs text-xs font-mono">
                <span className="text-slate-500">Evaluation Mode:</span>
                <span className="font-bold text-indigo-700">50% Faculty Score + 50% Audience Test Average</span>
              </div>
            </div>
          ) : !submission ? (
            /* CASE 2: PENDING / NOT YET SUBMITTED */
            <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50/50">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                No Submission Recorded Yet for Roll #{rollNumber}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Candidate has either not yet joined the test or is currently in progress. Question-by-question performance will appear automatically once the candidate submits their exam.
              </p>
            </div>
          ) : (
            /* CASE 3: SUBMITTED - FULL PERFORMANCE BREAKDOWN */
            <div className="space-y-5">
              {/* Performance Scorecard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total Score */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Score Awarded</span>
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-indigo-700">
                    {submission.score} / {submission.totalPossible}
                  </div>
                  <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono">
                    {submission.percentage}%
                  </span>
                </div>

                {/* Correct vs Wrong vs Unanswered */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Accuracy Breakdown</span>
                  </span>
                  <div className="text-sm font-bold font-mono text-slate-900 pt-1 space-y-0.5">
                    <div className="text-emerald-700">✓ {correctCount} Correct ({correctCount * marksPerQuestion}m)</div>
                    <div className="text-rose-600">✗ {wrongCount} Incorrect</div>
                    {unansweredCount > 0 && (
                      <div className="text-slate-500">⚪ {unansweredCount} Unanswered</div>
                    )}
                  </div>
                </div>

                {/* Duration Spent */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Time Spent</span>
                  </span>
                  <div className="text-base sm:text-lg font-bold font-mono text-slate-800 pt-0.5">
                    {formatDuration(submission.durationSpentSeconds)}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Submitted at {new Date(submission.submittedAt).toLocaleTimeString()}
                  </p>
                </div>

                {/* Proctoring Status */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                    <span>Proctoring Audit</span>
                  </span>
                  <div className="pt-0.5">
                    {submission.isFlaggedForReview || (submission.violationCount && submission.violationCount >= 3) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[11px]">
                        <AlertOctagon className="w-3 h-3 text-rose-600" />
                        <span>3 Violations (Flagged)</span>
                      </span>
                    ) : submission.violationCount && submission.violationCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[11px]">
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        <span>{submission.violationCount} Violation Warning(s)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded text-[11px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Clean Examination (0 warnings)</span>
                      </span>
                    )}
                  </div>
                  {submission.autoSubmittedReason && (
                    <p className="text-[10px] text-rose-700 italic line-clamp-1">
                      {submission.autoSubmittedReason}
                    </p>
                  )}
                </div>
              </div>

              {/* Questions Detailed Review List */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-200 pb-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                    Question-by-Question Evaluation ({questions.length} Questions)
                  </span>
                  <span className="text-slate-500 font-mono">
                    Allotted: {marksPerQuestion} mark(s) per correct question
                  </span>
                </div>

                <div className="space-y-3.5">
                  {questions.map((q, qIndex) => {
                    const studentAns = submission.answers ? submission.answers[qIndex] : undefined;
                    const isAnswered = studentAns !== undefined && studentAns !== null;
                    const isCorrect = isAnswered && studentAns === q.correctOptionIndex;
                    const marksEarned = isCorrect ? marksPerQuestion : 0;

                    return (
                      <div
                        key={q.id || qIndex}
                        className={`p-4 rounded-xl border transition-all space-y-3 ${
                          isCorrect
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : isAnswered
                            ? 'bg-rose-50/20 border-rose-200'
                            : 'bg-slate-50/60 border-slate-200'
                        }`}
                      >
                        {/* Question Header & Score Badge */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : isAnswered
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-300 text-slate-700'
                              }`}
                            >
                              {qIndex + 1}
                            </span>
                            <div className="space-y-0.5">
                              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                                {q.questionText}
                              </h4>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            {isCorrect ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>+{marksEarned} / {marksPerQuestion} mark{marksPerQuestion > 1 ? 's' : ''}</span>
                              </span>
                            ) : isAnswered ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold font-mono">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>0 / {marksPerQuestion} mark{marksPerQuestion > 1 ? 's' : ''}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium font-mono">
                                <MinusCircle className="w-3.5 h-3.5 text-slate-500" />
                                <span>Unanswered (0)</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Options List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt, optIndex) => {
                            const isStudentChoice = studentAns === optIndex;
                            const isCorrectKey = optIndex === q.correctOptionIndex;
                            const letter = String.fromCharCode(65 + optIndex);

                            let cardStyle = 'bg-white border-slate-200 text-slate-700';
                            let badgeStyle = 'bg-slate-100 text-slate-600';

                            if (isCorrectKey) {
                              cardStyle = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium ring-1 ring-emerald-300';
                              badgeStyle = 'bg-emerald-600 text-white';
                            } else if (isStudentChoice && !isCorrectKey) {
                              cardStyle = 'bg-rose-50 border-rose-300 text-rose-950 font-medium ring-1 ring-rose-300';
                              badgeStyle = 'bg-rose-600 text-white';
                            }

                            return (
                              <div
                                key={optIndex}
                                className={`p-2.5 rounded-lg text-xs border flex items-start gap-2.5 transition-all ${cardStyle}`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${badgeStyle}`}
                                >
                                  {letter}
                                </span>
                                <div className="flex-1 space-y-1">
                                  <div className="leading-relaxed break-words whitespace-normal">{opt}</div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {isStudentChoice && (
                                      <span
                                        className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          isCorrect
                                            ? 'bg-emerald-200/80 text-emerald-900'
                                            : 'bg-rose-200/80 text-rose-900'
                                        }`}
                                      >
                                        {isCorrect ? '✓ Student Answer' : '✗ Student Selected'}
                                      </span>
                                    )}
                                    {isCorrectKey && !isStudentChoice && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                        ✓ Correct Key
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="p-2.5 bg-white/80 rounded-lg border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                              <span className="font-semibold text-slate-800">Concept Explanation: </span>
                              <span>{q.explanation}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-mono">
            {submission ? (
              <span>Final Marks: {submission.score} / {submission.totalPossible} ({submission.percentage}%)</span>
            ) : isPresenter ? (
              <span>Designated Speaker Exemption</span>
            ) : (
              <span>Status: Pending</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => onSelectRoll(rollNumber - 1)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors disabled:opacity-30 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => onSelectRoll(rollNumber + 1)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors disabled:opacity-30 cursor-pointer flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
