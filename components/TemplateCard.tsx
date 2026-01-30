
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { HeartIcon, EyeIcon, ArrowRightIcon, LockIcon, LayersIcon, GlobeIcon, FileCodeIcon, SmartphoneIcon } from './Icons';
import { playClickSound, playLikeSound } from '../audio';

interface TemplateCardProps {
  title: string;
  author: string;
  authorAvatar?: string;
  imageUrl: string; 
  bannerUrl: string; 
  likes: number;
  views: number;
  isLiked: boolean;
  category: string;
  price?: string;
  
  fileUrl?: string;
  sourceCode?: string;
  fileType?: string;
  videoUrl?: string; 

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
  const [isHovering, setIsHovering] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const isFirstRender = useRef(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Lottie Ref
  const playerRef = useRef<any>(null);

  const isZip = fileType === 'zip';
  const hasCode = (sourceCode && sourceCode.trim().length > 0) || isZip;
  const hasLink = fileUrl && fileUrl.trim() !== '' && fileUrl !== '#' && !isZip;

  useEffect(() => {
    const player = playerRef.current;

    // Handle initial state (Mount)
    if (isFirstRender.current) {
        if (player) {
            if (isLiked) {
                // If liked, jump to end
                setTimeout(() => {
                    player.seek('100%');
                }, 200);
            } else {
                // If not liked, ensure start
                setTimeout(() => {
                    player.seek('0%');
                }, 200);
            }
        }
        isFirstRender.current = false;
        return;
    }
    
    // Handle Updates (User Interaction)
    if (player) {
        if (isLiked) {
            // Like: Play forward
            player.setDirection(1);
            player.play();
        } else {
            // Unlike: Play backward (unfill)
            player.setDirection(-1);
            player.play();
        }
    }
  }, [isLiked]);

  useEffect(() => {
    if (!videoRef.current || !videoUrl || videoError) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    videoRef.current?.play().catch(() => {});
                } else {
                    videoRef.current?.pause();
                }
            });
        },
        { threshold: 0.1 }
    );

    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [videoUrl, videoError]);
  
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

  const displayBanner = bannerUrl || imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop';
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
      className="group relative w-full aspect-[4/3] rounded-[24px] bg-[#050505] cursor-default isolate overflow-hidden"
    >
        <div className="absolute inset-0 rounded-[24px] shadow-[0_0_0_1px_rgba(255,255,255,0.05)] z-0 pointer-events-none"></div>

        <div className="absolute inset-0 z-0 bg-[#111]">
                
            {/* Layer 1: Static Image Base (Always visible as backup) */}
            <div className="absolute inset-0 z-0">
                {!imageError ? (
                    <img 
                        src={displayBanner} 
                        alt={title}
                        onError={() => setImageError(true)}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
                        <LayersIcon className="w-12 h-12 text-slate-800" />
                    </div>
                )}
            </div>

            {/* Layer 2: Video Preview (Covers image if data exists) */}
            {videoUrl && !videoError && (
                <div className="absolute inset-0 z-10 bg-black">
                    <video 
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                        onError={() => {
                            console.warn("Video render error:", videoUrl);
                            setVideoError(true);
                        }}
                    />
                </div>
            )}

            {/* Layer 3: Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 opacity-80 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none z-20"></div>
        </div>

        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-30 pointer-events-none">
             <div className="flex gap-2 pointer-events-auto">
                 <div className="px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-200">
                    {category}
                 </div>
             </div>
             <div className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold backdrop-blur-xl border border-white/5 bg-white/10 text-white pointer-events-auto">
                Free
             </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 z-30 translate-y-2 group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none">
            <div className="flex justify-between items-end">
                <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-white font-bold text-xl leading-none truncate mb-2 group-hover:text-cyan-200 transition-colors drop-shadow-lg">
                        {title}
                    </h3>
                    <div className="flex items-center gap-2 pointer-events-auto cursor-pointer group/author w-fit" onClick={handleCreatorClick}>
                         <div className="relative w-4 h-4 rounded-full overflow-hidden border border-white/20">
                             <img src={displayAvatar} className="w-full h-full object-cover" alt={author} />
                         </div>
                         <p className="text-xs text-slate-300 font-medium tracking-wide group-hover/author:text-white">{author}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0 pointer-events-auto">
                     <button 
                        onClick={handleLike} 
                        className="group/btn w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95 overflow-hidden"
                     >
                        {/* Lottie Animation Wrapper with Filter Logic */}
                        <div 
                            className={`w-full h-full flex items-center justify-center p-[2px] transition-[filter] duration-300 ${
                                isLiked ? '' : 'grayscale brightness-150 opacity-70 group-hover/btn:opacity-100'
                            }`}
                        >
                            {/* @ts-ignore */}
                            <dotlottie-player
                                ref={playerRef}
                                src="https://lottie.host/c3e224ed-42e1-4283-96aa-2994ab046363/gMYruNTRma.lottie"
                                background="transparent"
                                speed="1"
                                loop={false} 
                                playMode="normal"
                                style={{ width: '100%', height: '100%' }}
                            ></dotlottie-player>
                        </div>
                     </button>
                     <button onClick={handleViewButton} className="group/btn w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.5)] hover:bg-slate-200 hover:scale-105 active:scale-95 transition-all">
                         <ArrowRightIcon className="w-5 h-5 transition-transform group-hover/btn:translate-x-0.5" />
                     </button>
                </div>
            </div>
            
            <div className="mt-4 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-out"></div>
            
            <div className="flex justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
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
                
                <div className="flex items-center gap-2">
                    {hasCode && <span className="text-[10px] font-mono text-cyan-400/80 uppercase tracking-widest flex items-center gap-1"><FileCodeIcon className="w-3 h-3" /> <span className="hidden sm:inline">Code</span></span>}
                    {hasLink && <span className="text-[10px] font-mono text-blue-400/80 uppercase tracking-widest flex items-center gap-1"><GlobeIcon className="w-3 h-3" /> <span className="hidden sm:inline">Live</span></span>}
                </div>
            </div>
        </div>
    </motion.div>
  );
};

export default TemplateCard;
