import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, BookOpenIcon, CodeIcon, ZapIcon, ShieldCheckIcon } from './Icons';
import { playClickSound } from '../audio';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DocSection = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
    <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <div className="text-slate-400 leading-relaxed text-sm pl-12">
            {children}
        </div>
    </div>
);

const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-0 md:p-6" onClick={onClose}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />

            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                className="relative w-full max-w-3xl h-full md:h-[85vh] bg-[#030304] border border-white/10 rounded-none md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-shrink-0 p-8 border-b border-white/5 bg-[#030304] flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Documentation</h2>
                        <p className="text-slate-500 text-sm">Everything you need to build with Templr.</p>
                    </div>
                    <button onClick={() => { playClickSound(); onClose(); }} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <XIcon className="w-5 h-5"/>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-12 bg-[#030304]">
                    
                    <DocSection title="Getting Started" icon={ZapIcon}>
                        <p className="mb-4">Templr is designed for speed. Simply upload your template, and our engine will automatically process it for preview and deployment.</p>
                        <ul className="list-disc list-inside space-y-2 text-slate-500">
                            <li>Upload your zip file</li>
                            <li>Configure metadata</li>
                            <li>Publish to the marketplace</li>
                        </ul>
                    </DocSection>

                    <DocSection title="Technical Specs" icon={CodeIcon}>
                        <p className="mb-4">We support all modern web frameworks. Ensure your template includes a <code>package.json</code> for automatic dependency installation.</p>
                        <div className="bg-[#09090b] p-4 rounded-lg border border-white/5 font-mono text-xs text-slate-300">
                            {`{ "name": "my-template", "dependencies": { ... } }`}
                        </div>
                    </DocSection>

                    <DocSection title="Security & Compliance" icon={ShieldCheckIcon}>
                        <p>All templates are scanned for malicious code before being approved for the marketplace. Ensure your code follows our security guidelines to avoid rejection.</p>
                    </DocSection>

                    <div className="mt-12 pt-8 border-t border-white/5 text-center">
                        <p className="text-slate-500 text-xs font-mono uppercase tracking-widest">Still need help?</p>
                        <a href="mailto:support@templr.com" className="text-blue-400 hover:text-blue-300 text-sm font-bold mt-2 block">support@templr.com</a>
                    </div>
                </div>
            </motion.div>
        </div>
    </AnimatePresence>
  );
};

export default DocumentationModal;
