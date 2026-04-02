import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, UserIcon, HelpCircleIcon } from './Icons';
import { playClickSound } from '../audio';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (e: string, p: string) => Promise<void>;
  onSignup: (e: string, p: string, n: string) => Promise<any>;
  onOpenSetup: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin, onSignup, onOpenSetup }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    playClickSound();
    try {
        if (isLogin) {
            await onLogin(email, password);
        } else {
            await onSignup(email, password, name);
        }
        onClose();
    } catch (err: any) {
        setError(err.message || "An error occurred");
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
                className="relative w-full max-w-md bg-[#030304] border border-white/10 rounded-none md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl p-8"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold text-white tracking-tight">{isLogin ? 'Sign In' : 'Create Account'}</h2>
                    <button onClick={() => { playClickSound(); onClose(); }} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <XIcon className="w-5 h-5"/>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <input 
                            type="text" 
                            placeholder="Name" 
                            value={name} 
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                            required
                        />
                    )}
                    <input 
                        type="email" 
                        placeholder="Email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                        required
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                        required
                    />
                    
                    {error && <p className="text-xs text-red-400 font-bold">{error}</p>}

                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="mt-8 pt-8 border-t border-white/5 text-center">
                    <p className="text-sm text-slate-500">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button onClick={() => { playClickSound(); setIsLogin(!isLogin); }} className="text-blue-400 font-bold ml-2 hover:text-blue-300">
                            {isLogin ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                    <button onClick={() => { playClickSound(); onOpenSetup(); }} className="text-slate-600 text-xs mt-4 flex items-center justify-center gap-2 hover:text-slate-400">
                        <HelpCircleIcon className="w-3 h-3" /> Need help setting up?
                    </button>
                </div>
            </motion.div>
        </div>
    </AnimatePresence>
  );
};

export default LoginModal;
