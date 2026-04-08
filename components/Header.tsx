import React, { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserIcon, UploadIcon, LogOutIcon, LayoutDashboardIcon, SettingsIcon, HelpCircleIcon, Volume2Icon, VolumeXIcon } from './Icons';
import { playClickSound } from '../audio';
import { Session } from '../api';

interface HeaderProps {
  session: Session | null;
  onUploadClick: () => void;
  onLoginClick: () => void;
  onSignOut: () => void;
  onDashboardClick: () => void;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  onOpenSetup: () => void;
  onOpenSettings: () => void;
  isSubscribed: boolean;
  creditsLeft?: number;
}

const Header: React.FC<HeaderProps> = ({ 
  session, 
  onUploadClick, 
  onLoginClick, 
  onSignOut, 
  onDashboardClick,
  soundEnabled,
  onToggleSound,
  onOpenSetup,
  onOpenSettings,
  isSubscribed,
  creditsLeft
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-700 ease-out ${isScrolled ? 'py-4 bg-[#020202]/90 backdrop-blur-2xl border-b border-white/5' : 'py-8 bg-transparent'}`}>
      <div className="container mx-auto px-6 max-w-7xl flex items-center justify-between">
        
        {/* Logo */}
        <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => { playClickSound(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <span className="text-black font-black text-2xl tracking-tighter">T</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-white leading-none">Templr</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Ecosystem</span>
          </div>
        </motion.div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
            <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => { playClickSound(); onToggleSound(!soundEnabled); }} 
                className="text-slate-500 hover:text-white transition-colors"
            >
                {soundEnabled ? <Volume2Icon className="w-5 h-5" /> : <VolumeXIcon className="w-5 h-5" />}
            </motion.button>
            
            {session ? (
                <div className="flex items-center gap-4">
                    <button onClick={() => { playClickSound(); onDashboardClick(); }} className="text-sm font-bold text-slate-400 hover:text-white transition-colors">Dashboard</button>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { playClickSound(); onUploadClick(); }} 
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-bold hover:bg-slate-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    >
                        <UploadIcon className="w-4 h-4" />
                        <span>Upload</span>
                    </motion.button>
                    
                    {/* User Menu */}
                    <div className="relative">
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { playClickSound(); setIsMenuOpen(!isMenuOpen); }} 
                            className="w-10 h-10 rounded-full bg-glow-gradient border border-white/10 flex items-center justify-center hover:border-white/20 transition-all"
                        >
                            <UserIcon className="w-5 h-5 text-white" />
                        </motion.button>
                        
                        <AnimatePresence>
                            {isMenuOpen && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className="absolute right-0 mt-3 w-56 bg-glow-gradient border border-white/10 rounded-2xl shadow-2xl p-2"
                                >
                                    <div className="px-4 py-3 border-b border-white/5">
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Account</p>
                                        <p className="text-sm text-white truncate">{session.user.email}</p>
                                    </div>
                                    <button onClick={() => { setIsMenuOpen(false); onOpenSettings(); }} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors">
                                        <SettingsIcon className="w-4 h-4" /> Settings
                                    </button>
                                    <button onClick={() => { setIsMenuOpen(false); onOpenSetup(); }} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/5 rounded-xl flex items-center gap-3 transition-colors">
                                        <HelpCircleIcon className="w-4 h-4" /> Setup Guide
                                    </button>
                                    <button onClick={() => { setIsMenuOpen(false); onSignOut(); }} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-3 transition-colors">
                                        <LogOutIcon className="w-4 h-4" /> Sign Out
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            ) : (
                <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { playClickSound(); onLoginClick(); }} 
                    className="px-6 py-2.5 rounded-full bg-glow-gradient border border-white/10 text-sm font-bold text-white hover:border-white/20 transition-all"
                >
                    Sign In
                </motion.button>
            )}
        </div>
      </div>
    </header>
  );
};

export default memo(Header);
