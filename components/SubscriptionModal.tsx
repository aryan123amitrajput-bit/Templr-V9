import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, ShieldCheckIcon } from './Icons';
import { playClickSound } from '../audio';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeConfirm: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, onUpgradeConfirm }) => {
  
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6" onClick={onClose}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />

            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                className="relative w-full max-w-md bg-[#030304] border border-white/10 rounded-none md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl p-8"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <ShieldCheckIcon className="w-6 h-6 text-blue-400" />
                        Upgrade to Pro
                    </h2>
                    <button onClick={() => { playClickSound(); onClose(); }} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <XIcon className="w-5 h-5"/>
                    </button>
                </div>

                <div className="space-y-6 text-slate-400 text-sm leading-relaxed mb-8">
                    <p>Unlock unlimited downloads and premium features with Templr Pro.</p>
                    <ul className="list-disc list-inside space-y-2 text-white font-bold">
                        <li>Unlimited downloads</li>
                        <li>Priority support</li>
                        <li>Early access to new templates</li>
                    </ul>
                </div>

                <button 
                    onClick={() => { playClickSound(); onUpgradeConfirm(); onClose(); }}
                    className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                    Upgrade Now - $29/mo
                </button>
            </motion.div>
        </div>
    </AnimatePresence>
  );
};

export default SubscriptionModal;
