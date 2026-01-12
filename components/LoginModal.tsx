
import React, { useState, useEffect, useRef, memo } from 'react';
import { XIcon, LockIcon, RocketIcon, ShieldCheckIcon, LightbulbIcon } from './Icons';
import { playClickSound, playSuccessSound, playTypingSound, playNotificationSound } from '../audio';
import { motion, AnimatePresence } from 'framer-motion';
import { isApiConfigured } from '../api';

// --- Icons ---
const MailIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
);

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
);

const LockAnimated = () => (
    <div className="relative w-24 h-24 flex items-center justify-center mb-6 pointer-events-none">
      <div className="absolute inset-0 rounded-full border border-cyan-500/10 border-t-cyan-400/60 animate-[spin_4s_linear_infinite]"></div>
      <div className="absolute inset-4 rounded-full border border-blue-500/10 border-b-blue-400/60 animate-[spin_3s_linear_infinite_reverse]"></div>
      <div className="relative z-10 flex items-center justify-center w-10 h-10 bg-cyan-950/50 rounded-full shadow-[0_0_30px_-5px_rgba(6,182,212,0.6)] backdrop-blur-sm border border-cyan-500/20">
          <LockIcon className="w-4 h-4 text-cyan-200" />
      </div>
    </div>
);

// Enhanced Input with VISIBLE LABEL Support for Accessibility
const PremiumInput = ({ icon: Icon, error, label, id, ...props }: any) => (
    <div className="group relative mb-6">
        <label htmlFor={id} className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1 cursor-pointer hover:text-white transition-colors">
            {label}
        </label>
        
        <div className="relative">
            <div className={`absolute inset-0 bg-[#030407] rounded-2xl border shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)] transition-all duration-300 
                ${error 
                    ? 'border-red-500/50 group-hover:border-red-500/80 group-focus-within:border-red-500' 
                    : 'border-white/10 group-hover:border-white/20 group-focus-within:border-cyan-500/40'
                }
                ${!error && 'group-focus-within:bg-[#05060a]'}
            `}></div>
            <div className="relative z-10 flex items-center">
                <div className={`pl-5 pr-4 py-4 transition-colors duration-300 ${error ? 'text-red-400' : 'text-slate-500 group-focus-within:text-cyan-400'}`}>
                    <Icon className="w-5 h-5 relative z-10" />
                </div>
                <div className={`h-6 w-[1px] transition-colors duration-300 ${error ? 'bg-red-500/20' : 'bg-white/5 group-focus-within:bg-cyan-500/20'}`}></div>
                <input
                    id={id}
                    {...props}
                    className="relative z-50 w-full bg-transparent border-none rounded-2xl py-4 px-4 text-white placeholder-slate-600 text-sm font-medium focus:outline-none focus:ring-0"
                />
            </div>
        </div>
        
        {/* Inline Error Message */}
        <AnimatePresence>
            {error && (
                <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0 }}
                    className="absolute -bottom-5 left-4 z-20"
                >
                     <p className="text-[10px] text-red-400 font-medium tracking-wide flex items-center gap-1">
                        {error}
                     </p>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, pass: string) => Promise<void>;
  onSignup: (email: string, pass: string, name: string) => Promise<any>;
  onOpenSetup?: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin, onSignup, onOpenSetup }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Granular Error State
  const [errors, setErrors] = useState<{
      email?: string;
      password?: string;
      name?: string;
      global?: string;
  }>({});

  useEffect(() => {
    if (isOpen) {
        setErrors({});
        setSuccess(false);
        setIsLoading(false);
        setEmail('');
        setPassword('');
        setName('');
    }
  }, [isOpen]); 

  const validateForm = () => {
      const newErrors: typeof errors = {};
      let isValid = true;

      // Email Regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email) {
          newErrors.email = "Email is required.";
          isValid = false;
      } else if (!emailRegex.test(email)) {
          newErrors.email = "Please enter a valid email address.";
          isValid = false;
      }

      // Password Length
      if (!password) {
          newErrors.password = "Password is required.";
          isValid = false;
      } else if (password.length < 8) {
          newErrors.password = "Must be at least 8 characters.";
          isValid = false;
      }

      // Name (Signup only)
      if (mode === 'signup' && !name.trim()) {
          newErrors.name = "Please enter your name.";
          isValid = false;
      }

      setErrors(newErrors);
      if (!isValid) playNotificationSound();
      return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();
    setErrors({});
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (mode === 'signin') {
          await onLogin(email, password);
          setSuccess(true);
          playSuccessSound();
          setTimeout(onClose, 1500); // Allow user to see success state
      } else {
          // SIGNUP FLOW
          const data = await onSignup(email, password, name);
          
          if (data && (data.session || data.user)) {
              // Auto-login or Account Created
              // For UX, we attempt to login if session missing, otherwise success
              if (!data.session) {
                  try {
                      await onLogin(email, password);
                  } catch (ignored) {
                      // If login fails (e.g. email confirm required), just show success
                  }
              }
              setSuccess(true);
              playSuccessSound();
              setTimeout(onClose, 2000);
          }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      playNotificationSound();
      
      const rawMsg = (err.message || "").toLowerCase();
      // Default to the actual error message from backend for transparency
      let displayError = err.message || "An unexpected error occurred.";

      // Human-readable overrides for common scenarios
      if (rawMsg.includes('backend not configured') || rawMsg.includes('check api keys') || rawMsg.includes('vite_supabase_url')) {
          displayError = "Configuration Error: Backend keys (VITE_SUPABASE_URL) are missing. Login disabled.";
      } 
      else if (rawMsg.includes('invalid login credentials') || rawMsg.includes('invalid password')) {
          displayError = "Incorrect email or password.";
      } 
      else if (rawMsg.includes('user already registered') || rawMsg.includes('unique constraint')) {
          displayError = "This email is already registered. Please sign in.";
          setErrors(prev => ({ ...prev, email: displayError }));
      } 
      else if (rawMsg.includes('rate limit') || rawMsg.includes('too many requests')) {
          displayError = "Too many attempts. Please wait a moment.";
      }
      else if (rawMsg.includes('network request failed') || rawMsg.includes('fetch failed')) {
          displayError = "Network Error: Unable to reach authentication server.";
      }
      
      setErrors(prev => ({ ...prev, global: displayError }));
    } finally {
      if (!success) setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#02040a]/90 backdrop-blur-sm animate-fade-in perspective-container p-4">
      
      {/* Close Button - Larger Touch Target */}
      <button 
        onClick={() => { playClickSound(); onClose(); }} 
        className="absolute top-6 right-6 z-50 w-12 h-12 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
        aria-label="Close Login Modal"
      >
        <XIcon className="w-6 h-6" />
      </button>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[420px] mx-auto animate-slide-up transform-gpu" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-[#080a11] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl p-8 md:p-10 flex flex-col items-center">
            
            {!success ? (
                <>
                    <LockAnimated />

                    <h2 className="text-2xl font-bold text-white tracking-tight mb-1">
                        {mode === 'signin' ? 'Welcome Back' : 'Join Templr'}
                    </h2>
                    <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-8">
                        {mode === 'signin' ? 'Secure Access' : 'Create your account'}
                    </p>

                    <div className="w-full grid grid-cols-2 gap-2 p-1 bg-black/40 border border-white/5 rounded-xl mb-8">
                        <button 
                            onClick={() => { setMode('signin'); setErrors({}); }} 
                            className={`py-3 rounded-lg text-xs font-bold uppercase transition-all ${mode === 'signin' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Sign In
                        </button>
                        <button 
                            onClick={() => { setMode('signup'); setErrors({}); }} 
                            className={`py-3 rounded-lg text-xs font-bold uppercase transition-all ${mode === 'signup' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Create Account
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="w-full">
                        {mode === 'signup' && (
                            <PremiumInput 
                                id="signup-name"
                                label="Display Name"
                                icon={UserIcon} 
                                type="text" 
                                placeholder="e.g. Alex Chen" 
                                value={name} 
                                onChange={(e: any) => setName(e.target.value)}
                                error={errors.name}
                            />
                        )}
                        <PremiumInput 
                            id="email-input"
                            label="Email Address"
                            icon={MailIcon} 
                            type="email" 
                            placeholder="name@example.com" 
                            value={email} 
                            onChange={(e: any) => setEmail(e.target.value)}
                            error={errors.email}
                        />
                        <PremiumInput 
                            id="password-input"
                            label="Password"
                            icon={LockIcon} 
                            type="password" 
                            placeholder="••••••••" 
                            value={password} 
                            onChange={(e: any) => setPassword(e.target.value)}
                            error={errors.password}
                        />

                        {/* Global Error Message */}
                        <AnimatePresence>
                            {errors.global && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center overflow-hidden"
                                >
                                    <p className="text-red-400 text-[11px] font-bold font-sans leading-tight">{errors.global}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        {/* Helper Text for Signup */}
                        {mode === 'signup' && (
                            <p className="text-[10px] text-slate-500 text-center mb-4 leading-relaxed">
                                By creating an account, you agree to our Terms. <br/>
                                We'll create your account and redirect you to your dashboard.
                            </p>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className={`
                                w-full h-14 rounded-xl font-bold uppercase text-xs tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3
                                bg-white hover:bg-slate-200 text-black
                                ${isLoading ? 'opacity-80 cursor-wait' : ''}
                            `}
                        >
                            {isLoading && <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>}
                            <span>
                                {isLoading 
                                    ? (mode === 'signin' ? 'Signing in...' : 'Creating account...') 
                                    : (mode === 'signin' ? 'Sign In' : 'Create Account')
                                }
                            </span>
                        </button>
                    </form>
                </>
            ) : (
                // SUCCESS STATE
                <div className="py-12 flex flex-col items-center animate-fade-in">
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20 shadow-[0_0_40px_-10px_rgba(34,197,94,0.5)]">
                        <RocketIcon className="w-10 h-10 text-green-400 animate-bounce" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Welcome to Templr 🎉</h3>
                    <p className="text-slate-400 text-sm">Redirecting you to your dashboard...</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
