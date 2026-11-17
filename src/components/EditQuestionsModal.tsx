import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  HelpCircle, 
  Clock, 
  Award, 
  Layers, 
  Sparkles,
  Info
} from 'lucide-react';
import type { SeminarTest, Question } from '../types';

interface EditQuestionsModalProps {
  test: SeminarTest;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPayload: {
    questions: Question[];
    marksPerQuestion: number;
    durationMinutes: number;
    topic: string;
  }) => Promise<void>;
  isSaving: boolean;
}

export const EditQuestionsModal: React.FC<EditQuestionsModalProps> = ({
  test,
  isOpen,
  onClose,
  onSave,
  isSaving,
}) => {
  const [questions, setQuestions] = useState<Question[]>(() => 
    JSON.parse(JSON.stringify(test.questions || []))
  );
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(test.marksPerQuestion || 2);
  const [durationMinutes, setDurationMinutes] = useState<number>(test.durationMinutes || 15);
  const [topic, setTopic] = useState<string>(test.topic || '');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalCalculatedMarks = questions.length * marksPerQuestion;
  const submissionsCount = test.submissions ? Object.keys(test.submissions).length : 0;

  // Question editing helpers
  const handleUpdateQuestionText = (index: number, text: string) => {
    setQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], questionText: text };
      return copy;
    });
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, text: string) => {
    setQuestions(prev => {
      const copy = [...prev];
      const newOptions = [...copy[qIndex].options];
      newOptions[optIndex] = text;
      copy[qIndex] = { ...copy[qIndex], options: newOptions };
      return copy;
    });
  };

  const handleSetCorrectOption = (qIndex: number, optIndex: number) => {
    setQuestions(prev => {
      const copy = [...prev];
      copy[qIndex] = { ...copy[qIndex], correctOptionIndex: optIndex };
      return copy;
    });
  };

  const handleUpdateExplanation = (index: number, text: string) => {
    setQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], explanation: text };
      return copy;
    });
  };

  const handleAddQuestion = () => {
    const newQ: Question = {
      id: `q-custom-${Date.now()}-${questions.length + 1}`,
      questionText: 'Which of the following statements is correct regarding this concept?',
      options: [
        'Option A description',
        'Option B description',
        'Option C description',
        'Option D description'
      ],
      correctOptionIndex: 0,
      explanation: 'Explanation for why Option A is the scientifically accurate answer.'
    };
    setQuestions(prev => [...prev, newQ]);
    setActiveQuestionIndex(questions.length);
  };

  const handleDeleteQuestion = (indexToDelete: number) => {
    if (questions.length <= 1) {
      setValidationError('A test must contain at least 1 question.');
      return;
    }
    setQuestions(prev => prev.filter((_, idx) => idx !== indexToDelete));
    setActiveQuestionIndex(prev => Math.min(prev, questions.length - 2));
    setValidationError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setValidationError(`Question #${i + 1} text cannot be empty.`);
        setActiveQuestionIndex(i);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!q.options[j] || !q.options[j].trim()) {
          setValidationError(`Question #${i + 1}, Option ${String.fromCharCode(65 + j)} cannot be empty.`);
          setActiveQuestionIndex(i);
          return;
        }
      }
    }

    if (marksPerQuestion <= 0) {
      setValidationError('Marks per question must be greater than 0.');
      return;
    }

    try {
      await onSave({
        questions,
        marksPerQuestion,
        durationMinutes,
        topic
      });
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save question changes.');
    }
  };

  const currentQ = questions[activeQuestionIndex] || questions[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg shadow-xs">
                {test.code}
              </span>
              <span className="text-xs font-bold text-slate-800">
                {test.course}
              </span>
              <span className="text-[11px] text-slate-500">
                ({test.program} · {test.semester})
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Edit Test Questions &amp; Markings
            </h2>
            <p className="text-xs text-slate-500">
              Modify question prompts, options, answer keys, or marks per question.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Markings & Config Bar */}
        <div className="p-4 bg-white border-b border-slate-100 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Marks per Question */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Marks per Question</span>
              </label>
              <input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={marksPerQuestion}
                onChange={(e) => setMarksPerQuestion(parseFloat(e.target.value) || 1)}
                className="w-full px-2 py-1 text-xs sm:text-sm font-bold font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            {/* Total Marks (Auto Calculated) */}
            <div className="p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
              <label className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Total Test Marks</span>
              </label>
              <div className="text-sm sm:text-base font-black font-mono text-indigo-700 pt-0.5">
                {totalCalculatedMarks} Marks
              </div>
            </div>

            {/* Total Questions Count */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-600" />
                <span>Question Count</span>
              </label>
              <div className="text-sm sm:text-base font-bold font-mono text-slate-800 pt-0.5">
                {questions.length} Questions
              </div>
            </div>

            {/* Duration Minutes */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                <span>Duration (Mins)</span>
              </label>
              <input
                type="number"
                min={1}
                max={180}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 15)}
                className="w-full px-2 py-1 text-xs sm:text-sm font-bold font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          {/* Submissions Re-scoring Notification */}
          {submissionsCount > 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <b>Note:</b> {submissionsCount} student(s) have already submitted this test. Updating questions or correct answer keys will automatically re-score all student submissions against the updated keys.
              </span>
            </div>
          )}

          {/* Validation Notice */}
          {validationError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Question Selector Tabs */}
        <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto select-none">
          {questions.map((_, idx) => {
            const isActive = idx === activeQuestionIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActiveQuestionIndex(idx);
                  setValidationError(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Q{idx + 1}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleAddQuestion}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors cursor-pointer border border-indigo-200"
            title="Add New Question"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Q{questions.length + 1}</span>
          </button>
        </div>

        {/* Question Editing Canvas */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {currentQ && (
            <div className="space-y-4">
              {/* Question Header & Controls */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                    Q{activeQuestionIndex + 1}
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    Question Prompt ({marksPerQuestion} mark{marksPerQuestion > 1 ? 's' : ''})
                  </span>
                </div>

                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(activeQuestionIndex)}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    title="Delete this question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Question</span>
                  </button>
                )}
              </div>

              {/* Question Textarea */}
              <div>
                <textarea
                  rows={3}
                  value={currentQ.questionText}
                  onChange={(e) => handleUpdateQuestionText(activeQuestionIndex, e.target.value)}
                  placeholder="Enter the question text..."
                  className="w-full p-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600/30 focus:border-indigo-600 focus:outline-hidden leading-relaxed"
                />
              </div>

              {/* 4 Options Editor */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold">Multiple Choice Options (Click checkbox to set correct answer):</span>
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Correct Answer: Option {String.fromCharCode(65 + currentQ.correctOptionIndex)}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {currentQ.options.map((opt, optIndex) => {
                    const isCorrect = optIndex === currentQ.correctOptionIndex;
                    const letter = String.fromCharCode(65 + optIndex);
                    return (
                      <div
                        key={optIndex}
                        className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                          isCorrect
                            ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Option Select Button */}
                        <button
                          type="button"
                          onClick={() => handleSetCorrectOption(activeQuestionIndex, optIndex)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 mt-0.5 flex items-center justify-center cursor-pointer transition-colors ${
                            isCorrect
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                          title={`Click to set Option ${letter} as the correct answer`}
                        >
                          {letter}
                        </button>

                        {/* Option Text Input */}
                        <div className="flex-1 space-y-1">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleUpdateOption(activeQuestionIndex, optIndex, e.target.value)}
                            placeholder={`Enter text for Option ${letter}...`}
                            className={`w-full px-3 py-1.5 text-xs sm:text-sm text-slate-900 rounded-lg border bg-white focus:outline-hidden ${
                              isCorrect
                                ? 'border-emerald-300 focus:ring-1 focus:ring-emerald-500 font-medium'
                                : 'border-slate-200 focus:ring-1 focus:ring-indigo-500'
                            }`}
                          />
                        </div>

                        {/* Correct Answer Tag / Toggle */}
                        <button
                          type="button"
                          onClick={() => handleSetCorrectOption(activeQuestionIndex, optIndex)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors ${
                            isCorrect
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 border border-slate-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isCorrect ? 'Correct Answer' : 'Set as Correct'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scientific Explanation */}
              <div className="pt-2 space-y-1">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Scientific Explanation / Solution Reference (Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={currentQ.explanation || ''}
                  onChange={(e) => handleUpdateExplanation(activeQuestionIndex, e.target.value)}
                  placeholder="Explain why this option is correct based on biopharmaceutics principles..."
                  className="w-full p-2.5 text-xs text-slate-800 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Total {questions.length} questions · {marksPerQuestion} mark(s) each · Total {totalCalculatedMarks} marks
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving &amp; Re-scoring...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save &amp; Apply Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
