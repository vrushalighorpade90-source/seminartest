import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Globe,
  QrCode,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Smartphone,
  Monitor,
  X,
  MessageCircle,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface GlobalShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  testCode?: string;
  courseTitle?: string;
}

export const GlobalShareModal: React.FC<GlobalShareModalProps> = ({
  isOpen,
  onClose,
  testCode,
  courseTitle,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isFullscreenQR, setIsFullscreenQR] = useState(false);

  // Compute the live public URL locked into Student mode
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = testCode
    ? `${baseUrl}/?code=${encodeURIComponent(testCode)}&role=student`
    : `${baseUrl}/?role=student`;

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(shareUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation failed:', err));
    }
  }, [isOpen, shareUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!testCode) return;
    navigator.clipboard.writeText(testCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Join our seminar test ${testCode ? `for "${courseTitle || 'Seminar'}"` : ''}!\nOpen this link on your phone to attempt the test:\n${shareUrl}\n\nTest Code: ${testCode || ''}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`relative w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all ${
          isFullscreenQR ? 'max-w-xl p-8' : 'max-w-lg p-6'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Universal Access &amp; Classroom Projection
              </h2>
              <p className="text-xs text-slate-500">
                Open on any smartphone, laptop, or PC worldwide
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFullscreenQR(!isFullscreenQR)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title={isFullscreenQR ? 'Standard view' : 'Projector mode'}
            >
              {isFullscreenQR ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-5">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center text-center space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 inline-block">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Seminar Test QR Code"
                  className={isFullscreenQR ? 'w-64 h-64 mx-auto' : 'w-44 h-44 mx-auto'}
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                  Generating QR Code...
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-slate-800">
                Scan with Any Smartphone Camera (iOS &amp; Android)
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Students point their phone camera at this screen to instantly open the test
              </p>
            </div>

            {testCode && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-indigo-900 font-semibold">Access Code:</span>
                <span className="font-mono font-bold text-indigo-700 text-sm tracking-wider">
                  {testCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-1 text-indigo-600 hover:text-indigo-800 cursor-pointer ml-1"
                  title="Copy Code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Universal Link Sharing */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">
              Universal Test Web Link (Accessible Worldwide)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-700 select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleWhatsAppShare}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Share via WhatsApp</span>
            </button>

            <a
              href={`mailto:?subject=${encodeURIComponent(
                `Seminar Test Link: ${courseTitle || testCode || 'Examination'}`
              )}&body=${encodeURIComponent(
                `Here is the link to attempt the seminar test on your mobile phone or laptop:\n\n${shareUrl}\n\nTest Code: ${testCode || ''}`
              )}`}
              className="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 text-center"
            >
              <Share2 className="w-4 h-4" />
              <span>Email to Class</span>
            </a>
          </div>

          {/* Multi-Device Guarantee & Student Privacy Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>Universal Access &amp; Security Isolation:</span>
            </div>
            <p>• <b>Isolated Student Experience:</b> Students opening this link or QR code only see the Student Exam Portal. They have zero access to the teacher's portal, AI question generator, or marksheets.</p>
            <p>• <b>Mobile Phones &amp; Laptops:</b> Works on Android, iPhone, Mac, Windows, and Chromebooks without installing any app.</p>
            <p>• <b>Results Confidentiality:</b> Scores and speaker evaluations are recorded directly to your faculty portal and never shown to students.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
