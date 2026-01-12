
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { HeartIcon, EyeIcon, ArrowRightIcon, LockIcon, LayersIcon, GlobeIcon, FileCodeIcon, SmartphoneIcon } from './Icons';
import { playClickSound, playLikeSound } from '../audio';

interface TemplateCardProps {
  title: string;
  author: string;
  authorAvatar?: string; // New Prop
  imageUrl: string; // Live Code URL (iframe)
  bannerUrl: string; // Static Banner URL
  likes: number;
  views: number;
  isLiked: boolean;
  category: string;
  price?: string;
  
  // New props for Smart View logic
  fileUrl?: string;
  sourceCode?: string;
  fileType?: string;
  videoUrl?: string; // ADDED: Support for video previews

  onMessageCreator: (authorName: string) => void;
  onView: () => void;
  onLike: () => void;
  onCreatorClick?: (authorName: string) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ 
  title, 
  author, 
  authorAvatar,
  imageUrl,
  bannerUrl, 
  likes, 
  views, 
  isLiked, 
  category, 
  price = 'Free', 
  fileUrl,
  sourceCode,
  fileType,
  videoUrl,
  onView, 
  onLike,
  onCreatorClick
}) => {
  const [likeBump, setLikeBump] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [imageError, setImageError] = useState(false);
  const isFirstRender = useRef(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- SMART VIEW LOGIC ---
  const isZip = fileType === 'zip';
  const hasCode = (sourceCode && sourceCode.trim().length > 0) || isZip;
  const hasLink = fileUrl && fileUrl.trim() !== '' && fileUrl !== '#' && !isZip;
  const isVisualOnly = !hasCode && !hasLink;

  useEffect(() => {
    if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
    }
    setLikeBump(true);
    const timer = setTimeout(() => setLikeBump(false), 200);
    return () => clearTimeout(timer);
  }, [likes]);

  // --- INTERSECTION OBSERVER FOR SMART AUTO-PLAY ---
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    // Play when visible
                    videoRef.current?.play().catch((e) => {
                        // Silent catch for autoplay blocks (user hasn't interacted yet)
                        console.debug("Autoplay suppressed", e);
                    });
                } else {
                    // Pause immediately when out of view
                    videoRef.current?.pause();
                }
            });
        },
        { 
            threshold: 0.5, // 50% visible before playing
            rootMargin: '0px'
        }
    );

    observer.observe(videoRef.current);

    return () => {
        observer.disconnect();
    };
  }, [videoUrl]);
  
  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLiked) playLikeSound();
    else playClickSound();
    onLike();
  };

  const handleViewButton = (e: React.MouseEvent) => {
    e.stopPropagation();
    playClickSound();
    onView();
  };

  const handleCreatorClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onCreatorClick) {
          playClickSound();
          onCreatorClick(author);
      }
  };

  // Fallback if no banner exists or error
  const displayBanner = bannerUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop';
  
  // Avatar Logic: Real DB Avatar -> Generated Fallback
  const displayAvatar = authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=000&color=fff`;

  return (
    <motion.div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      
      whileHover={{ y: -10, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}

      className="group relative w-full aspect-[4/3] rounded-[24px] bg-[#050505] cursor-default isolate"
    >
        {/* --- 0. SHADOW LAYER --- */}
        <div className="absolute inset-0 rounded-[24px] shadow-[0_0_0_1px_rgba(255,255,255,0.05)] transition-all duration-500 group-hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.1)] pointer-events-none z-0"></div>

        {/* --- 1. MEDIA CONTENT (Clipped) --- */}
        <div className="absolute inset-0 rounded-[24px] overflow-hidden z-0 bg-[#111]">
             <div className="absolute inset-0">
                {/* VIDEO vs IMAGE/CODE LOGIC */}
                {videoUrl ? (
                    <div className="absolute inset-0 z-10 bg-black">
                        <video 
                            ref={videoRef}
                            src={videoUrl}
                            className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-1000"
                            muted
                            loop
                            playsInline
                            // No autoPlay prop here. Controlled by Observer.
                        />
                    </div>
                ) : (
                    <>
                        {/* STATIC BANNER (Fades out for Code Preview) */}
                        <div className={`absolute inset-0 transition-opacity duration-500 ${imageUrl && !imageUrl.startsWith('http') && isHovering ? 'opacity-0' : 'opacity-100'}`}>
                            {!imageError ? (
                                <img 
                                    src={displayBanner} 
                                    alt={title}
                                    onError={() => setImageError(true)}
                                    className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-1000"
                                />
                            ) : (
                                // Fallback Gradient for Broken Images
                                <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
                                    <LayersIcon className="w-12 h-12 text-slate-800" />
                                </div>
                            )}
                        </div>

                        {/* LIVE CODE (On Hover) - Only if imageUrl looks like an iframe source */}
                        {imageUrl && !imageUrl.startsWith('http') && ( 
                            <div className={`absolute inset-0 transition-opacity duration-500 ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
                                <iframe 
                                    src={imageUrl} 
                                    title={title}
                                    className="w-full h-full object-cover border-0 pointer-events-none"
                                    loading="lazy"
                                    sandbox="allow-scripts allow-same-origin"
                                />
                            </div>
                        )}
                    </>
                )}
                
                {/* Cinematic Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 opacity-80 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none z-20"></div>
                
                {/* Color Wash on Hover */}
                <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20"></div>
            </div>
        </div>

        {/* --- 2. FLOATING BADGES (Glass) --- */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-30 pointer-events-none">
             <div className="flex gap-2 pointer-events-auto">
                 {/* Category Badge */}
                 <div className="px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-200 shadow-xl group-hover:border-white/20 transition-colors">
                    {category}
                 </div>
             </div>

             {/* Price Badge - Always "Free" or Hidden if redundancy disliked, but keeping consistent UI structure */}
             <div className={`
                px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold backdrop-blur-xl border shadow-2xl transition-all duration-500 pointer-events-auto
                bg-white/10 border-white/5 text-white
             `}>
                Free
             </div>
        </div>

        {/* --- 3. HOLOGRAPHIC HUD (Bottom) --- */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-30 translate-y-2 group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none">
            
            {/* Main Info */}
            <div className="flex justify-between items-end">
                <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-white font-bold text-xl leading-none truncate mb-2 group-hover:text-cyan-200 transition-colors drop-shadow-lg">
                        {title}
                    </h3>
                    <div 
                        className="flex items-center gap-2 pointer-events-auto cursor-pointer group/author w-fit"
                        onClick={handleCreatorClick}
                    >
                         <div className="relative w-4 h-4 rounded-full overflow-hidden border border-white/20 group-hover/author:border-blue-400 transition-colors">
                             <img src={displayAvatar} className="w-full h-full object-cover" alt={author} />
                         </div>
                         <p className="text-xs text-slate-300 font-medium tracking-wide group-hover/author:text-white transition-colors">{author}</p>
                    </div>
                </div>

                {/* Quick Actions (Reveal on Hover) */}
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 transform translate-y-2 group-hover:translate-y-0 pointer-events-auto">
                     <button 
                        onClick={handleLike}
                        className="group/btn w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="Like"
                     >
                        <HeartIcon className={`w-5 h-5 transition-transform group-hover/btn:scale-110 ${isLiked ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
                     </button>
                     <button 
                        onClick={handleViewButton}
                        className="group/btn w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.5)] hover:bg-slate-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="View Details"
                     >
                         <ArrowRightIcon className="w-5 h-5 transition-transform group-hover/btn:translate-x-0.5" />
                     </button>
                </div>
            </div>
            
            {/* Data Scanline */}
            <div className="mt-4 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-out"></div>
            
            {/* Extended Stats & Smart Indicators */}
            <div className="flex justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <EyeIcon className="w-3 h-3" />
                        <span className="text-[10px] font-mono">{views >= 1000 ? (views/1000).toFixed(1) + 'k' : views}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <HeartIcon className="w-3 h-3" />
                        <span className="text-[10px] font-mono">{likes}</span>
                    </div>
                </div>
                
                {/* SMART VIEW INDICATORS */}
                <div className="flex items-center gap-2">
                    {hasCode && (
                        <span className="text-[10px] font-mono text-cyan-400/80 uppercase tracking-widest flex items-center gap-1" title="Source Code Available">
                            <FileCodeIcon className="w-3 h-3" /> <span className="hidden sm:inline">Code</span>
                        </span>
                    )}
                    {hasLink && (
                        <span className="text-[10px] font-mono text-blue-400/80 uppercase tracking-widest flex items-center gap-1" title="Live Link Available">
                            <GlobeIcon className="w-3 h-3" /> <span className="hidden sm:inline">Live</span>
                        </span>
                    )}
                    {isVisualOnly && (
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1" title="Visual Reference Only">
                            <LayersIcon className="w-3 h-3" /> <span className="hidden sm:inline">Visual</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    </motion.div>
  );
};

export default TemplateCard;
