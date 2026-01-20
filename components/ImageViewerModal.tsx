
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, HeartIcon, EyeIcon, LockIcon, CheckCircleIcon, GlobeIcon, ArrowRightIcon, UploadIcon, ArrowLeftIcon, FileCodeIcon, LinkIcon, LayersIcon, RocketIcon } from './Icons';
import { Template } from '../api';
import { playClickSound, playSuccessSound } from '../audio';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
  onUsageAttempt: () => boolean; // Logic to check limits
  usageCount: number;
  isSubscribed: boolean;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ 
    isOpen, 
    onClose, 
    template, 
    onUsageAttempt, 
    usageCount, 
    isSubscribed 
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (template) {
        setActiveTab('preview');
    }
  }, [template]);

  const handleVisitLive = () => {
      if (!onUsageAttempt()) return; // Block if limit reached

      if (template?.fileUrl && template.fileUrl !== '#') {
          playClickSound();
          let url = template.fileUrl;
          // Auto-prepend https if missing to ensure it opens as a web link
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
              url = 'https://' + url;
          }
          window.open(url, '_blank');
      }
  };

  const handleDownload = () => {
      if (!onUsageAttempt()) return; // Block if limit reached

      playClickSound();
      playSuccessSound();
      
      // 1. If it's a Zip file, download directly
      if (template?.fileType === 'zip' && template.fileUrl) {
          const link = document.createElement('a');
          link.href = template.fileUrl;
          link.download = template.fileName || 'project-files.zip';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } 
      // 2. If it's Code Only, generate a file blob
      else if (template?.sourceCode) {
          const blob = new Blob([template.sourceCode], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const cleanTitle = template.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
          link.download = `${cleanTitle}.tsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
      }
  };

  const handleCopyCode = () => {
      if (!onUsageAttempt()) return; // Block if limit reached
      if (template?.sourceCode) {
          navigator.clipboard.writeText(template.sourceCode);
          playSuccessSound();
      }
  };
  
  if (!template) return null;

  // --- STRICT WORKFLOW LOGIC ---

  // 1. HAS CODE?
  const rawCode = template.sourceCode || '';
  const isZip = template.fileType === 'zip';
  const hasCode = (rawCode.trim().length > 0) || isZip;

  // 2. HAS LINK?
  const rawUrl = template.fileUrl || '';
  const hasLink = !!rawUrl && rawUrl.trim() !== '' && rawUrl !== '#' && !isZip;

  const displayImage = template.bannerUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop';
  
  const isLimitReached = !isSubscribed && usageCount >= 3;

  return (
    <AnimatePresence>
    {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-0 md:p-6" onClick={onClose}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#000]/95 backdrop-blur-md" />
            <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[110]" />

            <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onClick={onClose} className="fixed top-6 left-6 z-[100] px-4 py-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-full text-white transition-all flex items-center gap-2 group active:scale-90">
                <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-medium">Back</span>
            </motion.button>

            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 40 }}
                transition={{ type: "spring", duration: 0.6, bounce: 0 }}
                className="relative w-full max-w-[95rem] h-full md:h-[90vh] bg-[#050505] border border-white/10 rounded-none md:rounded-[32px] overflow-hidden flex flex-col lg:flex-row group/modal"
                onClick={(e) => e.stopPropagation()}
            >
                {/* --- LEFT: PREVIEW AREA --- */}
                <div className="relative flex-1 h-[45vh] lg:h-full bg-[#020203] flex flex-col overflow-hidden">
                    
                    {/* Mode Toggle - ONLY IF CODE EXISTS */}
                    {hasCode && (
                        <div className="absolute top-6 left-0 right-0 flex justify-center z-30 pointer-events-none">
                            <div className="flex bg-black/80 backdrop-blur-md border border-white/10 rounded-full p-1 pointer-events-auto">
                                <button onClick={() => setActiveTab('preview')} className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'preview' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>Preview</button>
                                <button onClick={() => setActiveTab('code')} className={`px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'code' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>
                                    Code
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12 lg:p-20">
                        <AnimatePresence mode="wait">
                            {activeTab === 'preview' ? (
                                <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full h-full flex items-center justify-center">
                                    
                                    {/* Video or Image Logic */}
                                    {template.videoUrl ? (
                                        <div className="relative w-full h-full max-w-full max-h-full rounded-xl overflow-hidden shadow-2xl bg-black">
                                            <video 
                                                src={template.videoUrl} 
                                                className="w-full h-full object-contain" 
                                                controls 
                                                autoPlay 
                                                muted 
                                                loop 
                                                controlsList="nodownload"
                                            />
                                        </div>
                                    ) : (
                                        <img src={displayImage} alt={template.title} className="w-auto h-auto max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div key="code" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full max-w-5xl bg-[#0A0A0A] rounded-xl border border-white/10 flex flex-col overflow-hidden shadow-2xl">
                                    <div className="h-12 bg-[#111] border-b border-white/5 flex items-center px-4 gap-4">
                                        <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/50"></div><div className="w-3 h-3 rounded-full bg-yellow-500/50"></div><div className="w-3 h-3 rounded-full bg-green-500/50"></div></div>
                                        <span className="text-slate-500 text-xs font-mono">source_code_snapshot.tsx</span>
                                        <div className="ml-auto flex gap-2">
                                            <button onClick={handleCopyCode} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-1 rounded">Copy Code</button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-auto p-6 font-mono text-xs text-slate-300 custom-scrollbar whitespace-pre-wrap leading-relaxed bg-[#050505]">
                                        {template.sourceCode || "// No source code provided."}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* --- RIGHT: INFO AREA --- */}
                <div className="w-full lg:w-[420px] h-[55vh] lg:h-full bg-[#09090b] border-l border-white/10 flex flex-col z-30 shadow-2xl">
                    <div className="p-6 md:p-8 pb-4 border-b border-white/5 bg-[#09090b]">
                        <div className="flex justify-between mb-4">
                            <span className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{template.category}</span>
                            <span className="flex items-center gap-1 text-green-400 text-[10px] font-bold uppercase"><CheckCircleIcon className="w-3 h-3" /> Verified</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-4 line-clamp-2">{template.title}</h1>
                        <div className="flex items-center gap-3">
                            <img src={`https://ui-avatars.com/api/?name=${template.author}&background=333&color=fff`} className="w-8 h-8 rounded-full" />
                            <div className="flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase">Creator</span><span className="text-sm font-bold text-white">{template.author}</span></div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8 pb-32">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                <HeartIcon className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                                <span className="text-lg font-bold text-white block">{template.likes}</span>
                                <span className="text-[10px] text-slate-500 uppercase">Likes</span>
                            </div>
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                <EyeIcon className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                                <span className="text-lg font-bold text-white block">{template.views}</span>
                                <span className="text-[10px] text-slate-500 uppercase">Views</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-widest border-b border-white/5 pb-1">Description</h4>
                            <p className="text-sm text-slate-300 leading-relaxed font-light">{template.description}</p>
                        </div>

                        {/* External Links Section - NOW ALWAYS VISIBLE IF LINK EXISTS */}
                        {hasLink && (
                            <div>
                                <h4 className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-widest border-b border-white/5 pb-1">External Links</h4>
                                <div className="space-y-2">
                                     <button onClick={handleVisitLive} className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <GlobeIcon className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{rawUrl}</span>
                                        </div>
                                        <ArrowRightIcon className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Tags */}
                        {template.tags && template.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {template.tags.map(tag => (
                                    <span key={tag} className="px-2 py-1 rounded bg-white/5 text-[10px] text-slate-400">{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* --- ACTION BAR --- */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-[#09090b]/90 backdrop-blur-xl border-t border-white/10 z-40">
                        <div className="flex justify-between items-end mb-4">
                            <div><p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Price</p><p className="text-3xl font-bold text-white tracking-tight">Free</p></div>
                            
                            {/* USAGE LIMIT INDICATOR */}
                            {!isSubscribed && (
                                <div className="flex flex-col items-end">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Daily Limit</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className={`w-1.5 h-6 rounded-full transition-colors ${i <= usageCount ? (isLimitReached ? 'bg-red-500' : 'bg-white') : 'bg-white/10'}`}></div>
                                            ))}
                                        </div>
                                        <span className={`text-xs font-mono font-bold ${isLimitReached ? 'text-red-400' : 'text-white'}`}>
                                            {Math.min(usageCount, 3)}/3
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            {isSubscribed && (
                                <div className="text-right">
                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/20">
                                        <RocketIcon className="w-3 h-3 text-yellow-500" />
                                        <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Unlimited</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                {/* LINK BUTTON */}
                                {hasLink && (
                                    <button 
                                        onClick={handleVisitLive}
                                        className={`h-14 rounded-xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all border group
                                        ${hasCode ? 'flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10' : 'w-full bg-white text-black hover:bg-slate-200'}
                                        ${isLimitReached && 'opacity-80'}`}
                                    >
                                        <GlobeIcon className="w-4 h-4" />
                                        <span>{isLimitReached ? 'Unlock Link' : 'Live Preview'}</span>
                                        {isLimitReached && <LockIcon className="w-3 h-3 text-current ml-1" />}
                                    </button>
                                )}

                                {/* CODE BUTTON */}
                                {hasCode && (
                                    <button 
                                        onClick={handleDownload} 
                                        className={`h-14 rounded-xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all border group
                                        ${hasLink ? 'flex-1' : 'w-full'}
                                        bg-white text-black hover:bg-slate-200
                                        ${isLimitReached && 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'}`}
                                    >
                                        {isLimitReached ? (
                                            <>
                                                <LockIcon className="w-4 h-4 text-yellow-500" />
                                                <span>Unlock Code</span>
                                            </>
                                        ) : (
                                            <>
                                                <UploadIcon className="w-4 h-4 rotate-180" />
                                                <span>Download Code</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* State 1: VISUALS ONLY (INFORMATIONAL LOCKED STATE) */}
                            {!hasLink && !hasCode && (
                                <div className="w-full p-6 rounded-2xl bg-[#0F0F11] border border-white/5 flex flex-col items-center justify-center text-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                        <LockIcon className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wide mb-1">Visual Reference Only</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed max-w-[250px]">
                                            This creator has shared this design for inspiration. Source code and live preview are not available.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Limit Reached Helper Text */}
                            {isLimitReached && (
                                <p className="text-[10px] text-red-400 font-medium text-center uppercase tracking-wider animate-pulse">
                                    Free limit reached. Upgrade to continue.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )}
    </AnimatePresence>
  );
};

export default ImageViewerModal;
