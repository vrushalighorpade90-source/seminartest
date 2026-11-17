import React from 'react';
import { Smartphone, Monitor, ShieldCheck, GraduationCap, LogOut, Globe, Sparkles, UserCheck } from 'lucide-react';
import type { TeacherUser } from '../types';

interface NavbarProps {
  activeSection: 'student' | 'admin';
  onSelectSection: (section: 'student' | 'admin') => void;
  teacher: TeacherUser | null;
  onOpenTeacherLogin: () => void;
  onLogoutTeacher: () => void;
  isMobilePreview: boolean;
  onToggleMobilePreview: () => void;
  hasActiveTest: boolean;
  onOpenGlobalShare: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeSection,
  onSelectSection,
  teacher,
  onOpenTeacherLogin,
  onLogoutTeacher,
  isMobilePreview,
  onToggleMobilePreview,
  onOpenGlobalShare,
}) => {
  // If no teacher is logged in (Students opening the link to give test),
  // hide ALL teacher portal links, login buttons, and administration controls.
  if (!teacher) {
    return (
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
          {/* Student Header Wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-xs">
              TP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  Test Portal
                </span>
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                  Student View
                </span>
              </div>
            </div>
          </div>

          {/* Student Status & Simulator Toggle */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Exam System Connected</span>
            </div>

            <button
              onClick={onToggleMobilePreview}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer text-slate-500 p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
              title="Toggle mobile device frame simulator"
            >
              {isMobilePreview ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-normal hidden sm:inline">Exit Mobile Frame</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-normal hidden sm:inline">Mobile Simulator</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Teacher Navigation (Shown ONLY when the teacher has successfully authenticated)
  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectSection('admin')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2 hover:opacity-85 transition-opacity cursor-pointer"
          >
            <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-xs">
              TP
            </span>
            <span>Test Portal</span>
          </button>
          <span className="hidden sm:inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            Faculty Admin Mode
          </span>
        </div>

        {/* Zone 2: Faculty Navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => onSelectSection('admin')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'admin'
                ? 'text-indigo-600 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Faculty Dashboard &amp; Marksheet</span>
          </button>

          <button
            onClick={onOpenGlobalShare}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer text-slate-600"
            title="Scan QR Code or project to seminar hall"
          >
            <Globe className="w-4 h-4 text-indigo-600" />
            <span>Project QR &amp; Links</span>
          </button>

          <button
            onClick={onToggleMobilePreview}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer text-slate-500"
            title="Toggle mobile device frame simulator"
          >
            {isMobilePreview ? (
              <>
                <Monitor className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-normal">Exit Phone Frame</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-normal">Phone Simulator</span>
              </>
            )}
          </button>
        </nav>

        {/* Zone 3: Faculty Profile & Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectSection(activeSection === 'admin' ? 'student' : 'admin')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            title="Test the student perspective"
          >
            <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
            <span>{activeSection === 'admin' ? 'Preview Student View' : 'Back to Faculty Portal'}</span>
          </button>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-700 hidden lg:inline max-w-[140px] truncate" title={teacher.email}>
              {teacher.name || teacher.email}
            </span>
            <button
              onClick={onLogoutTeacher}
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer"
              title="Sign Out of Faculty Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
