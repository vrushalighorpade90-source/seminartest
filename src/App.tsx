import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AdminSection } from './components/AdminSection';
import { StudentSection } from './components/StudentSection';
import { TeacherLoginModal } from './components/TeacherLoginModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { GlobalShareModal } from './components/GlobalShareModal';
import { MobileFrameWrapper } from './components/MobileFrameWrapper';
import type { TeacherUser, SeminarTest } from './types';
import { api } from './services/api';
import { ShieldCheck, GraduationCap, Smartphone, FileSpreadsheet, Sparkles, Lock } from 'lucide-react';

export default function App() {
  const [activeSection, setActiveSection] = useState<'student' | 'admin'>('student');
  const [teacher, setTeacher] = useState<TeacherUser | null>(() => {
    try {
      const saved = localStorage.getItem('seminartest_teacher');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isGlobalShareOpen, setIsGlobalShareOpen] = useState(false);
  const [globalShareCode, setGlobalShareCode] = useState<string | undefined>(undefined);
  const [globalShareCourse, setGlobalShareCourse] = useState<string | undefined>(undefined);
  const [selectedSheetTest, setSelectedSheetTest] = useState<SeminarTest | null>(null);
  const [activeTestCode, setActiveTestCode] = useState<string>('');
  const [isMobilePreview, setIsMobilePreview] = useState<boolean>(false);

  // Check URL parameters: students are strictly locked into student mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    const roleParam = params.get('role');
    const adminParam = params.get('admin') || params.get('faculty');

    if (codeParam) {
      const cleanCode = codeParam.toUpperCase().trim();
      setActiveTestCode(cleanCode);
      setActiveSection('student');
    } else if (roleParam === 'student') {
      setActiveSection('student');
    }

    if (adminParam === 'true' && !teacher) {
      setIsLoginModalOpen(true);
    }
  }, []);

  // Load teacher tests strictly for authenticated faculty
  useEffect(() => {
    if (teacher?.email) {
      api.getTests(teacher.email)
        .then(res => {
          if (res.tests && res.tests.length > 0) {
            setActiveTestCode(prev => prev || res.tests[0].code);
          }
        })
        .catch(() => {});
    }
  }, [teacher?.email]);

  // Sync teacher to localStorage
  const handleLoginSuccess = (user: TeacherUser) => {
    setTeacher(user);
    localStorage.setItem('seminartest_teacher', JSON.stringify(user));
    setActiveSection('admin');
  };

  const handleLogoutTeacher = () => {
    setTeacher(null);
    localStorage.removeItem('seminartest_teacher');
    setActiveSection('student');
  };

  const handleOpenSheetsModal = (test: SeminarTest) => {
    setSelectedSheetTest(test);
    setIsSheetsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Universal Top Bar */}
      <Navbar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          if (sec === 'admin' && !teacher) {
            setIsLoginModalOpen(true);
          } else {
            setActiveSection(sec);
          }
        }}
        teacher={teacher}
        onOpenTeacherLogin={() => setIsLoginModalOpen(true)}
        onLogoutTeacher={handleLogoutTeacher}
        isMobilePreview={isMobilePreview}
        onToggleMobilePreview={() => setIsMobilePreview(!isMobilePreview)}
        hasActiveTest={!!activeTestCode}
        onOpenGlobalShare={() => {
          setGlobalShareCode(activeTestCode);
          setIsGlobalShareOpen(true);
        }}
      />

      {/* Teacher Bar (Shown ONLY to authenticated Faculty) */}
      {teacher && (
        <div className="border-b border-slate-200/80 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Faculty View:</span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setActiveSection('admin')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSection === 'admin'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Teacher Admin &amp; Evaluation</span>
                </button>

                <button
                  onClick={() => setActiveSection('student')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSection === 'student'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Student View Preview</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-500">
              {activeTestCode ? (
                <>
                  <span>Active Seminar Code:</span>
                  <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {activeTestCode}
                  </span>
                  <button
                    onClick={() => {
                      setGlobalShareCode(activeTestCode);
                      setIsGlobalShareOpen(true);
                    }}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium rounded text-xs transition-colors cursor-pointer"
                    title="Open Universal Access & QR modal"
                  >
                    Share / QR
                  </button>
                </>
              ) : (
                <span className="text-slate-400 italic">
                  No active test · Create one in Teacher Portal
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {teacher && activeSection === 'admin' ? (
          <AdminSection
            teacher={teacher}
            onOpenSheetsModal={handleOpenSheetsModal}
            activeTestCode={activeTestCode}
            onSelectTestCode={setActiveTestCode}
            onOpenGlobalShare={(code, course) => {
              if (code) {
                setActiveTestCode(code);
                setGlobalShareCode(code);
                setGlobalShareCourse(course);
              }
              setIsGlobalShareOpen(true);
            }}
          />
        ) : (
          <MobileFrameWrapper isMobilePreview={isMobilePreview}>
            <StudentSection
              initialCode={activeTestCode}
              onSelectTestCode={setActiveTestCode}
            />
          </MobileFrameWrapper>
        )}
      </main>

      {/* Modals */}
      <TeacherLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        test={selectedSheetTest}
      />

      <GlobalShareModal
        isOpen={isGlobalShareOpen}
        onClose={() => setIsGlobalShareOpen(false)}
        testCode={globalShareCode || activeTestCode}
        courseTitle={globalShareCourse}
      />

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Test Portal · Academic Peer Evaluation &amp; Mobile Testing Platform</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>50/50 Speaker Grading</span>
            <span>·</span>
            <span>Gemini AI Question Generation</span>
            <span>·</span>
            <span>Google Sheets Sync</span>
            {!teacher && (
              <>
                <span>·</span>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Faculty Portal Sign In"
                >
                  <Lock className="w-3 h-3" />
                  <span>Faculty Sign In</span>
                </button>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
