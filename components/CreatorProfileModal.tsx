
import React, { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, TwitterIcon, DribbbleIcon, GithubIcon, CheckCircleIcon, MapPinIcon, LinkIcon } from './Icons';
import TemplateCard from './TemplateCard';
import { Template } from '../api';
import { playClickSound } from '../audio';

interface CreatorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorName: string | null;
  templates: Template[];
  onView: (template: Template) => void;
  onLike: (templateId: string) => void;
  likedIds: Set<string>; // Added prop
}

// Mock data generator for profile details based on name
const getCreatorDetails = (name: string) => {
  // Deterministic mock data based on name length/char codes
  const seed = name.length;
  return {
    role: seed % 2 === 0 ? 'UI/UX Architect' : 'Frontend Engineer',
    location: seed % 3 === 0 ? 'San Francisco, CA' : seed % 3 === 1 ? 'Tokyo, Japan' : 'Berlin, Germany',
    bio: `Digital artisan crafting high-fidelity experiences. specialized in ${seed % 2 === 0 ? 'minimalist interfaces' : 'immersive 3D web'} and design systems.`,
    followers: (seed * 1234) % 15000 + 1000,
    following: (seed * 12) % 500
  };
};

const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({ 
  isOpen, 
  onClose, 
  creatorName, 
  templates,
  onView,
  onLike,
  likedIds
}) => {
  
  const creatorTemplates = useMemo(() => {
    if (!creatorName) return [];
    return templates.filter(t => t.author === creatorName);
  }, [creatorName, templates]);

  const details = useMemo(() => {
    return creatorName ? getCreatorDetails(creatorName) : null;
  }, [creatorName]);

  // Try to find the real avatar from one of the templates
  const realAvatar = useMemo(() => {
      return creatorTemplates.find(t => t.authorAvatar)?.authorAvatar;
  }, [creatorTemplates]);

  const totalViews = creatorTemplates.reduce((acc, t) => acc + t.views, 0);
  const totalLikes = creatorTemplates.reduce((acc, t) => acc + t.likes, 0);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !creatorName || !details) return null;

  const displayAvatar = realAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorName)}&background=111&color=fff&size=256`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-0 md:p-6" onClick={onClose}>
        
        {/* Backdrop */}
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#000]/90 backdrop-blur-xl"
        />

        {/* Modal Window */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 40 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0 }}
            className="relative w-full max-w-[80rem] h-full md:h-[90vh] bg-[#050505] border border-white/10 rounded-none md:rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
        >
            
            {/* --- HEADER SECTION --- */}
            <div className="relative h-64 md:h-80 flex-shrink-0 overflow-hidden">
                {/* Banner Image */}
                <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 via-[#050505] to-[#050505]">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                </div>

                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-50 p-2 rounded-full bg-black/50 border border-white/10 text-white hover:bg-white/10 transition-colors"
                >
                    <XIcon className="w-5 h-5" />
                </button>

                {/* Profile Info Container */}
                <div className="absolute bottom-0 inset-x-0 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
                    
                    <div className="flex items-end gap-6">
                        {/* Avatar */}
                        <div className="relative group">
                             <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full blur opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                             <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full p-1 bg-[#050505]">
                                <img 
                                    src={displayAvatar} 
                                    alt={creatorName}
                                    className="w-full h-full rounded-full object-cover border border-white/10"
                                />
                             </div>
                             <div className="absolute bottom-1 right-1 bg-black rounded-full p-1">
                                 <CheckCircleIcon className="w-6 h-6 text-blue-400" />
                             </div>
                        </div>

                        {/* Text Info */}
                        <div className="mb-2">
                            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-2">{creatorName}</h1>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 font-medium">
                                <span className="text-white bg-white/10 px-3 py-1 rounded-full border border-white/5">{details.role}</span>
                                <span className="flex items-center gap-1"><MapPinIcon className="w-4 h-4" /> {details.location}</span>
                            </div>
                        </div>
                    </div>

                    {/* Social Stats */}
                    <div className="flex gap-8 md:gap-12 pb-2">
                        <div className="flex flex-col items-center md:items-end">
                            <span className="text-2xl font-bold text-white font-mono">{details.followers.toLocaleString()}</span>
                            <span className="text-[10px] uppercase tracking-widest text-slate-500">Followers</span>
                        </div>
                        <div className="flex flex-col items-center md:items-end">
                            <span className="text-2xl font-bold text-white font-mono">{totalViews >= 1000 ? (totalViews/1000).toFixed(1) + 'k' : totalViews}</span>
                            <span className="text-[10px] uppercase tracking-widest text-slate-500">Total Views</span>
                        </div>
                        <div className="flex flex-col items-center md:items-end">
                            <span className="text-2xl font-bold text-white font-mono">{totalLikes}</span>
                            <span className="text-[10px] uppercase tracking-widest text-slate-500">Likes</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* --- BODY CONTENT --- */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row border-t border-white/5 bg-[#050505]">
                
                {/* Sidebar (Bio & Links) */}
                <div className="w-full md:w-80 p-8 border-r border-white/5 bg-[#080808]/50 flex-shrink-0 overflow-y-auto">
                    <div className="mb-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">About</h3>
                        <p className="text-sm text-slate-300 leading-relaxed font-light">
                            {details.bio}
                        </p>
                    </div>

                    <div className="mb-8">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Connect</h3>
                        <div className="flex flex-col gap-3">
                            <button className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group text-sm text-slate-300 hover:text-white">
                                <TwitterIcon className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                                <span>@twitter_handle</span>
                            </button>
                            <button className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group text-sm text-slate-300 hover:text-white">
                                <DribbbleIcon className="w-4 h-4 text-slate-500 group-hover:text-pink-400 transition-colors" />
                                <span>dribbble.com/user</span>
                            </button>
                            <button className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group text-sm text-slate-300 hover:text-white">
                                <GithubIcon className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                                <span>github.com/dev</span>
                            </button>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/5">
                        <button className="w-full py-3 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-colors">
                            Follow Creator
                        </button>
                    </div>
                </div>

                {/* Main Grid (Templates) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#020202]">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-bold text-white">Portfolio <span className="text-slate-500 ml-2 text-sm font-normal">({creatorTemplates.length})</span></h3>
                        
                        {/* Simple Sort/Filter Mock */}
                        <div className="flex gap-2">
                             <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold text-white border border-white/10">All</span>
                             <span className="px-3 py-1 rounded-full bg-transparent text-[10px] font-bold text-slate-500 border border-white/5 hover:border-white/20 cursor-pointer">Popular</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {creatorTemplates.map((template, idx) => (
                            <motion.div
                                key={template.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <TemplateCard 
                                    {...template}
                                    isLiked={likedIds.has(template.id)}
                                    onMessageCreator={() => {}} // No chat inside profile
                                    onView={() => onView(template)}
                                    onLike={() => onLike(template.id)}
                                    // Disable recursion
                                    onCreatorClick={() => {}}
                                />
                            </motion.div>
                        ))}
                    </div>
                </div>

            </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreatorProfileModal;
