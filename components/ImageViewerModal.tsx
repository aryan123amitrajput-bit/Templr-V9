import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, LayersIcon } from './Icons';
import { playClickSound } from '../audio';
import { Template } from '../src/types';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
  onUsageAttempt: () => boolean;
  onOpenSubscription: () => void;
  usageCount: number;
  isSubscribed: boolean;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ 
  isOpen, 
  onClose, 
  template, 
  onUsageAttempt,
  onOpenSubscription,
  usageCount,
  isSubscribed
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleDownload = () => {
      playClickSound();
      if (onUsageAttempt()) {
          setIsDownloading(true);
          // Simulate download
          setTimeout(() => {
              window.open(template?.downloadUrl, '_blank');
              setIsDownloading(false);
          }, 1000);
      }
  };

  if (!isOpen || !template) return null;

  return (
    <AnimatePresence>
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-0 md:p-6" onClick={onClose}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-2xl" />

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                className="relative w-full max-w-6xl h-full md:h-[90vh] bg-[#030304] border border-white/10 rounded-none md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-shrink-0 p-6 flex justify-between items-center bg-[#030304]/80 backdrop-blur-md border-b border-white/5 absolute top-0 inset-x-0 z-20">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">{template.title}</h2>
                        <p className="text-slate-500 text-xs">{template.author}</p>
                    </div>
                    <button onClick={() => { playClickSound(); onClose(); }} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
                        <XIcon className="w-5 h-5"/>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pt-24 pb-8 px-6 md:px-12">
                    <div className="max-w-4xl mx-auto">
                        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl mb-8">
                            <img src={template.bannerUrl || template.imageUrl} alt={template.title} className="w-full h-auto" />
                        </div>
                        
                        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-white mb-4">Description</h3>
                                <p className="text-slate-400 leading-relaxed">{template.description || "No description provided."}</p>
                            </div>
                            
                            <div className="w-full md:w-72 bg-[#09090b] p-6 rounded-2xl border border-white/5">
                                <div className="flex justify-between mb-6">
                                    <span className="text-slate-500 text-sm">Category</span>
                                    <span className="text-white font-bold text-sm">{template.category}</span>
                                </div>
                                <button 
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                >
                                    {isDownloading ? 'Downloading...' : 'Download Template'}
                                </button>
                                {!isSubscribed && (
                                    <p className="text-[10px] text-slate-500 text-center mt-4">
                                        {3 - usageCount} free downloads remaining. <button onClick={onOpenSubscription} className="text-blue-400 underline">Upgrade to Pro</button>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    </AnimatePresence>
  );
};

export default ImageViewerModal;
