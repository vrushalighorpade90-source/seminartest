import React from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface MobileFrameWrapperProps {
  children: React.ReactNode;
  isMobilePreview: boolean;
}

export const MobileFrameWrapper: React.FC<MobileFrameWrapperProps> = ({
  children,
  isMobilePreview,
}) => {
  if (!isMobilePreview) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="py-6 px-2 flex justify-center items-center">
      {/* Realistic Mobile Device Frame */}
      <div className="relative w-full max-w-[400px] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700/50">
        {/* Dynamic Island / Speaker Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-950 rounded-full z-30 flex items-center justify-end px-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700" />
        </div>

        {/* Inner Phone Screen Container */}
        <div className="relative bg-slate-50 rounded-[34px] overflow-hidden min-h-[640px] max-h-[820px] overflow-y-auto flex flex-col border border-slate-200">
          {/* Phone Status Bar */}
          <div className="px-6 pt-3 pb-2 flex items-center justify-between text-[11px] font-semibold text-slate-800 z-20 bg-slate-50/80 backdrop-blur-xs select-none">
            <span className="font-mono">9:41</span>
            <div className="flex items-center gap-1.5">
              <Signal className="w-3 h-3 text-slate-700" />
              <Wifi className="w-3 h-3 text-slate-700" />
              <Battery className="w-3.5 h-3.5 text-slate-700" />
            </div>
          </div>

          {/* Screen Content */}
          <div className="p-3 sm:p-4 flex-1 flex flex-col">{children}</div>

          {/* Home indicator bar */}
          <div className="py-2 flex justify-center bg-slate-50">
            <div className="w-32 h-1 bg-slate-300 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
