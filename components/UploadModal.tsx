import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, UploadIcon, LayersIcon } from './Icons';
import { playClickSound, playSuccessSound } from '../audio';
import { NewTemplateData } from '../src/types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTemplate: (data: NewTemplateData) => Promise<void>;
  onDashboardClick: () => void;
  isLoggedIn: boolean;
  onLoginRequest: () => void;
  userEmail: string | undefined;
  onShowNotification: (msg: string) => void;
  initialData?: any;
  isEditing?: boolean;
}

const UploadModal: React.FC<UploadModalProps> = ({ 
  isOpen, onClose, onAddTemplate, onDashboardClick, isLoggedIn, onLoginRequest, userEmail, onShowNotification, initialData, isEditing 
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState(initialData?.category || 'SaaS');
  const [description, setDescription] = useState(initialData?.description || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
        setTitle(initialData.title);
        setCategory(initialData.category);
        setDescription(initialData.description);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
        onLoginRequest();
        return;
    }
    setLoading(true);
    playClickSound();
    try {
        await onAddTemplate({ title, category, description, author: userEmail || 'Anonymous' });
        playSuccessSound();
        onShowNotification(isEditing ? "Template updated!" : "Template uploaded!");
        onClose();
    } catch (err) {
        onShowNotification("Failed to upload.");
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-0 md:p-6" onClick={onClose}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />

            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                className="relative w-full max-w-lg bg-[#030304] border border-white/10 rounded-none md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl p-8"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <UploadIcon className="w-6 h-6 text-blue-400" />
                        {isEditing ? 'Edit Template' : 'Upload Template'}
                    </h2>
                    <button onClick={() => { playClickSound(); onClose(); }} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <XIcon className="w-5 h-5"/>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Title</label>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Category</label>
                        <select 
                            value={category} 
                            onChange={e => setCategory(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                        >
                            {['SaaS', 'Startup', 'Portfolio', 'E-commerce', 'Blog'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Description</label>
                        <textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors h-32 resize-none"
                            required
                        />
                    </div>
                    
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isEditing ? 'Save Changes' : 'Upload')}
                    </button>
                </form>
            </motion.div>
        </div>
    </AnimatePresence>
  );
};

export default UploadModal;
