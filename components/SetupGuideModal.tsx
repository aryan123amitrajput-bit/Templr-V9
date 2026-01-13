
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, ClipboardIcon, CheckCircleIcon, CpuIcon, LayersIcon, ShieldCheckIcon, RocketIcon, LightbulbIcon } from './Icons';
import { playClickSound, playSuccessSound, playNotificationSound } from '../audio';
import { supabase, seedDatabase, Session } from '../api';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- 1. CRITICAL: Add missing columns (Run this to fix upload errors)
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS author_avatar text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS source_code text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS gallery_images text[];
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS file_url text;

-- 2. Create the Templates Table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  title text NOT NULL,
  author_name text,
  author_email text,
  author_avatar text, 
  image_url text,
  banner_url text,
  gallery_images text[],
  video_url text,
  description text,
  category text,
  tags text[],
  price text,
  file_url text,
  file_name text,
  file_type text,
  file_size bigint,
  source_code text,
  status text DEFAULT 'pending_review',
  views bigint DEFAULT 0,
  likes bigint DEFAULT 0,
  sales bigint DEFAULT 0,
  earnings bigint DEFAULT 0
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Fixed for Case-Insensitive Email Ownership)
-- Drop existing policies first to ensure clean update
DROP POLICY IF EXISTS "Public Read" ON public.templates;
DROP POLICY IF EXISTS "Auth Insert" ON public.templates;
DROP POLICY IF EXISTS "Owner Update" ON public.templates;
DROP POLICY IF EXISTS "Owner Delete" ON public.templates;

-- Allow everyone to read all templates
CREATE POLICY "Public Read" ON public.templates FOR SELECT USING (true);

-- Allow authenticated users to insert new templates
CREATE POLICY "Auth Insert" ON public.templates FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authors to update their OWN templates (matching email, case-insensitive)
CREATE POLICY "Owner Update" ON public.templates FOR UPDATE USING (lower(auth.jwt() ->> 'email') = lower(author_email));

-- Allow authors to DELETE their OWN templates (matching email, case-insensitive)
CREATE POLICY "Owner Delete" ON public.templates FOR DELETE USING (lower(auth.jwt() ->> 'email') = lower(author_email));

-- 5. Create Storage Bucket for Assets
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT (id) DO NOTHING;

-- Drop storage policies to refresh
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');`;

const ENV_EXAMPLE = `VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxh... (your anon key)`;

const CopyBlock = ({ label, content }: { label: string, content: string }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        playSuccessSound();
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                <button 
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${copied ? 'text-green-400 bg-green-500/10' : 'text-blue-400 hover:text-white'}`}
                >
                    {copied ? <CheckCircleIcon className="w-3 h-3" /> : <ClipboardIcon className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="relative group">
                <div className="absolute inset-0 bg-blue-500/5 rounded-xl blur-sm group-hover:bg-blue-500/10 transition-colors"></div>
                <pre className="relative bg-[#080808] border border-white/10 rounded-xl p-4 overflow-x-auto custom-scrollbar text-[11px] font-mono text-slate-300 leading-relaxed">
                    {content}
                </pre>
            </div>
        </div>
    );
};

const SetupGuideModal: React.FC<SetupGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'env' | 'db' | 'seed'>('quick');
  
  // Quick Connect State
  const [urlInput, setUrlInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  
  // Seed State
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [seedError, setSeedError] = useState('');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if(isOpen) {
        // Load existing keys from LS if available
        setUrlInput(localStorage.getItem('templr_project_url') || '');
        setKeyInput(localStorage.getItem('templr_anon_key') || '');
        setIsSaved(false);
        setSeedSuccess(false);
        setSeedError('');

        supabase.auth.getSession().then(({ data }) => {
            const mapped = data.session ? {
                user: {
                    id: data.session.user.id,
                    email: data.session.user.email,
                    user_metadata: {
                        full_name: data.session.user.user_metadata.full_name,
                        avatar_url: data.session.user.user_metadata.avatar_url
                    }
                }
            } : null;
            setSession(mapped);
        });
    }
  }, [isOpen]);

  const handleSaveKeys = () => {
      if (urlInput.trim() && keyInput.trim()) {
          localStorage.setItem('templr_project_url', urlInput.trim());
          localStorage.setItem('templr_anon_key', keyInput.trim());
          setIsSaved(true);
          playSuccessSound();
          
          // Slight delay before reload to show success state
          setTimeout(() => {
              window.location.reload();
          }, 800);
      }
  };

  const handleSeedData = async () => {
      if (!session) {
          setSeedError("You must be logged in to seed data.");
          return;
      }
      setIsSeeding(true);
      setSeedError('');
      
      try {
          await seedDatabase(session.user);
          setSeedSuccess(true);
          playSuccessSound();
          // Reload to show data
          setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
          console.error(err);
          setSeedError(err.message || "Failed to seed data.");
          playNotificationSound();
      } finally {
          setIsSeeding(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
                        <CpuIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Connect Backend</h2>
                        <p className="text-xs text-slate-500">Configure Supabase for Live Data</p>
                    </div>
                </div>
                <button onClick={() => { playClickSound(); onClose(); }} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                    <XIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 bg-[#0a0a0a] overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setActiveTab('quick')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 min-w-[100px] ${activeTab === 'quick' ? 'border-blue-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Connect
                </button>
                <button 
                    onClick={() => setActiveTab('env')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 min-w-[100px] ${activeTab === 'env' ? 'border-blue-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    .env
                </button>
                <button 
                    onClick={() => setActiveTab('db')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 min-w-[100px] ${activeTab === 'db' ? 'border-blue-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    SQL
                </button>
                <button 
                    onClick={() => setActiveTab('seed')}
                    className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 min-w-[100px] ${activeTab === 'seed' ? 'border-emerald-500 text-white bg-emerald-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Seed Data
                </button>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar bg-[#050505] flex-1">
                <AnimatePresence mode="wait">
                    
                    {/* --- QUICK CONNECT TAB --- */}
                    {activeTab === 'quick' ? (
                        <motion.div 
                            key="quick"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="space-y-6"
                        >
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-4 items-start">
                                <RocketIcon className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                                <div>
                                    <h4 className="text-sm font-bold text-white mb-1">Instant Configuration</h4>
                                    <p className="text-xs text-blue-200/70 leading-relaxed">
                                        Paste your Supabase keys below to connect immediately. <br/>
                                        Data is stored securely in your browser's local storage.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Key Finding Instructions */}
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                                <h5 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                                    <LightbulbIcon className="w-3 h-3 text-yellow-400" />
                                    How to get these keys?
                                </h5>
                                <ol className="text-[11px] text-slate-400 space-y-1.5 list-decimal list-inside ml-1">
                                    <li>Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Supabase Dashboard</a> and open your project.</li>
                                    <li>Navigate to <span className="text-white font-bold">Project Settings</span> (cog icon) &rarr; <span className="text-white font-bold">API</span>.</li>
                                    <li>Copy the <span className="font-mono text-slate-300 bg-white/5 px-1 rounded">Project URL</span> and <span className="font-mono text-slate-300 bg-white/5 px-1 rounded">anon public</span> key.</li>
                                </ol>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Project URL</label>
                                    <input 
                                        type="text" 
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        placeholder="https://your-project.supabase.co"
                                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder-slate-700 font-mono shadow-inner"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Anon Public Key</label>
                                    <input 
                                        type="text" 
                                        value={keyInput}
                                        onChange={(e) => setKeyInput(e.target.value)}
                                        placeholder="eyJxh..."
                                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder-slate-700 font-mono shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button 
                                    onClick={handleSaveKeys}
                                    disabled={!urlInput || !keyInput || isSaved}
                                    className={`
                                        w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all
                                        ${isSaved 
                                            ? 'bg-green-500 text-white cursor-default' 
                                            : 'bg-white text-black hover:bg-slate-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]'}
                                    `}
                                >
                                    {isSaved ? (
                                        <>
                                            <CheckCircleIcon className="w-5 h-5" />
                                            <span>Connected! Reloading...</span>
                                        </>
                                    ) : (
                                        <span>Save & Connect</span>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    ) : activeTab === 'env' ? (
                        <motion.div 
                            key="env"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                        >
                            <ol className="list-decimal list-inside space-y-6 text-sm text-slate-300 marker:text-blue-500 marker:font-bold">
                                <li>
                                    <span className="font-bold text-white">Create Project:</span> Go to <a href="https://supabase.com" target="_blank" className="text-blue-400 hover:underline">Supabase.com</a> and create a free project.
                                </li>
                                <li>
                                    <span className="font-bold text-white">Get Credentials:</span> Go to <strong>Settings &rarr; API</strong>. Copy the Project URL and Anon Public Key.
                                </li>
                                <li>
                                    <span className="font-bold text-white">Configure Environment:</span> Create a file named <code>.env</code> in your project root and paste the following:
                                </li>
                            </ol>
                            <div className="mt-6">
                                <CopyBlock label=".env File Content" content={ENV_EXAMPLE} />
                            </div>
                        </motion.div>
                    ) : activeTab === 'seed' ? (
                        <motion.div 
                            key="seed"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                        >
                            <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-emerald-900/10 border border-emerald-500/20">
                                <LayersIcon className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-emerald-300 uppercase mb-1">Populate Content</p>
                                    <p className="text-xs text-emerald-200/70 leading-relaxed">
                                        Inject our high-quality demo data (12 templates) into your database instantly. This allows you to demo the platform without manually uploading files.
                                    </p>
                                </div>
                            </div>

                            {!session ? (
                                <div className="text-center p-8 border border-white/5 rounded-2xl bg-white/5">
                                    <p className="text-sm text-slate-400 mb-4">You must be logged in to seed data.</p>
                                    <p className="text-xs text-slate-600">Please close this modal and sign in first.</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <button 
                                        onClick={handleSeedData}
                                        disabled={isSeeding || seedSuccess}
                                        className={`
                                            w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg
                                            ${seedSuccess 
                                                ? 'bg-emerald-500 text-white cursor-default' 
                                                : isSeeding 
                                                    ? 'bg-slate-800 text-slate-500 cursor-wait'
                                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20'}
                                        `}
                                    >
                                        {isSeeding ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                <span>Injecting Data...</span>
                                            </>
                                        ) : seedSuccess ? (
                                            <>
                                                <CheckCircleIcon className="w-5 h-5" />
                                                <span>Data Seeded! Reloading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <RocketIcon className="w-4 h-4" />
                                                <span>Inject Demo Data</span>
                                            </>
                                        )}
                                    </button>
                                    {seedError && (
                                        <p className="text-xs text-red-400 mt-4">{seedError}</p>
                                    )}
                                </div>
                            )}

                        </motion.div>
                    ) : (
                        <motion.div 
                            key="db"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                        >
                            <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-orange-900/10 border border-orange-500/20">
                                <ShieldCheckIcon className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-orange-300 uppercase mb-1">Fixing "Column Not Found"</p>
                                    <p className="text-xs text-orange-200/70 leading-relaxed">
                                        This script adds the missing <code>tags</code> and <code>author_avatar</code> columns to your database. Running this in your Supabase SQL Editor will fix your upload errors.
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-400 mb-6">
                                Run this SQL script in your Supabase <strong>SQL Editor</strong>.
                            </p>
                            <CopyBlock label="SQL Setup & Fix Script" content={SQL_SCRIPT} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            <div className="p-6 border-t border-white/5 bg-[#0a0a0a] flex justify-end">
                <button onClick={onClose} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                    Close Guide
                </button>
            </div>

        </motion.div>
    </div>
  );
};

export default SetupGuideModal;
