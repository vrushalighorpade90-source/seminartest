import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Copy,
  Download,
  ExternalLink,
  Check,
  Send,
  Code2,
  X,
  AlertCircle
} from 'lucide-react';
import type { SeminarTest } from '../types';
import {
  generateGoogleSheetsTSV,
  downloadGoogleSheetsCSV,
  computePresenterMarks,
  APPS_SCRIPT_TEMPLATE
} from '../utils/googleSheetsExport';
import { api } from '../services/api';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: SeminarTest | null;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  test,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'export' | 'webhook' | 'script'>('export');

  if (!isOpen || !test) return null;

  const presenterStats = computePresenterMarks(test);

  const handleCopyTSV = () => {
    const tsv = generateGoogleSheetsTSV(test);
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleDownloadCSV = () => {
    downloadGoogleSheetsCSV(test);
  };

  const handleOpenBlankSheet = () => {
    window.open('https://docs.google.com/spreadsheets/u/0/create', '_blank');
  };

  const handleSyncWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;
    setSyncStatus('syncing');
    setSyncMsg('');

    try {
      const res = await api.syncGoogleSheet(test.code, webhookUrl);
      setSyncStatus('success');
      setSyncMsg(res.message || 'Grades successfully pushed to Google Sheet!');
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMsg(err.message || 'Sync failed. Please verify your Web App URL permissions.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Google Sheets Integration Hub</h2>
              <p className="text-xs text-slate-500">
                Export &amp; sync marks for <span className="font-semibold text-slate-700">{test.code}</span> ({test.course})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 bg-white">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Instant Sheets Export
          </button>
          <button
            onClick={() => setActiveTab('webhook')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'webhook'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Direct Webhook Sync
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'script'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Apps Script Setup
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'export' && (
            <div className="space-y-5">
              {/* Presenter Summary in Sheet Preview */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                  <span>Seminar Speaker Marks (50/50 Rule Included)</span>
                  <span className="font-mono text-emerald-700 font-bold">
                    {presenterStats.finalTotal} / {presenterStats.maxTotal} ({presenterStats.percentage}%)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-500 block">Faculty Allotted (50%):</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {presenterStats.teacherScore} / {presenterStats.maxTeacherScore}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Audience Average (50%):</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {presenterStats.audience50Component} / {presenterStats.maxAudienceComponent}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1-Click Copy */}
                <div className="p-4 border border-slate-200 rounded-xl hover:border-emerald-400 transition-colors flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Copy Formatted Sheet</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Copies complete student &amp; speaker marks formatted for direct paste (Ctrl+V) into any Google Sheet.
                    </p>
                  </div>
                  <button
                    onClick={handleCopyTSV}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy for Google Sheets</span>
                      </>
                    )}
                  </button>
                </div>

                {/* CSV Download */}
                <div className="p-4 border border-slate-200 rounded-xl hover:border-emerald-400 transition-colors flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Download CSV</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Download standard UTF-8 CSV with all rolls (1 to {test.totalStudents}), speaker grading, and timestamps.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadCSV}
                    className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Marksheet (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Open Blank Sheet Link */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Ready to paste?</span> Open a new blank spreadsheet in your Google account:
                </div>
                <button
                  onClick={handleOpenBlankSheet}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>New Google Sheet</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'webhook' && (
            <form onSubmit={handleSyncWebhook} className="space-y-4">
              <p className="text-xs text-slate-600">
                You can push grades automatically to your institutional Google Sheet using a Google Apps Script Web App.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Google Apps Script Web App URL
                </label>
                <input
                  type="url"
                  required
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
                />
              </div>

              {syncStatus === 'success' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{syncMsg}</span>
                </div>
              )}

              {syncStatus === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{syncMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={syncStatus === 'syncing' || !webhookUrl}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {syncStatus === 'syncing' ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Push Marks to Google Sheet Now</span>
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === 'script' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Google Apps Script Web App Code:</span>
                <button
                  onClick={handleCopyScript}
                  className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedScript ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedScript ? 'Copied' : 'Copy Script'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-56 leading-relaxed">
                {APPS_SCRIPT_TEMPLATE}
              </pre>
              <div className="text-[11px] text-slate-500 space-y-1">
                <p>1. In your Google Sheet, open <b>Extensions &gt; Apps Script</b>.</p>
                <p>2. Paste the snippet above and click <b>Deploy &gt; New deployment</b>.</p>
                <p>3. Select type <b>Web app</b>, execute as <b>Me</b>, access <b>Anyone</b>, then copy the URL.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
