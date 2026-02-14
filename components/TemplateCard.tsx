
import React, { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { HeartIcon, EyeIcon, ArrowRightIcon, LockIcon, LayersIcon, GlobeIcon, FileCodeIcon, SmartphoneIcon } from './Icons';
import { playClickSound, playLikeSound } from '../audio';

interface TemplateCardProps {
  id: string;
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
  index: number; 

  onMessageCreator: (authorName: string) => void;
  onView: (id: string) => void;
  onLike: (id: string) => void;
  onCreatorClick?: (authorName: string) => void;
}

// --- VIDEO CONCURRENCY CONTROLLER ---
// Singleton manager to ensure only 3 videos play at once globally
class VideoController {
    private playing = new Set<string>();
    private listeners = new Map<string, (play: boolean) => void>();
    private max = 3;

    register(id: string, listener: (play: boolean) => void) {
        this.listeners.set(id, listener);
    }

    unregister(id: string) {
        this.listeners.delete(id);
        this.playing.delete(id);
    }

    requestPlay(id: string) {
        // If already playing, ignore
        if (this.playing.has(id)) return;

        // Add to active set
        this.playing.add(id);
        
        // Notify component to play
        this.listeners.get(id)?.(true);

        // Enforce Limit: Remove the oldest (FIFO)
        if (this.playing.size > this.max) {
            const oldestId = this.playing.values().next().value;
            if (oldestId && oldestId !== id) {
                this.playing.delete(oldestId);
                this.listeners.get(oldestId)?.(false); // Force pause
            }
        }
    }

    notifyHidden(id: string) {
        if (this.playing.has(id)) {
            this.playing.delete(id);
            this.listeners.get(id)?.(false); // Pause when hidden
        }
    }
}

const videoManager = new VideoController();


// Helper to downscale Unsplash images for thumbnails (huge performance win)
const getOptimizedImageUrl = (url: string, width = 600) => {
    if (!url) return '';
    if (url.includes('images.unsplash.com')) {
        if (url.includes('w=')) {
            return url.replace(/w=\d+/, `w=${width}`);
        }
        return `${url}&w=${width}`;
    }
    return url;
};

// Internal component for the heavy UI
const CardContent: React.FC<TemplateCardProps> = ({ 
  id,
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
  index,
  onView, 
  onLike,
  onCreatorClick
}) => {
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null); // Lottie ref

  const isZip = fileType === 'zip';
  const hasCode = (sourceCode && sourceCode.trim().length > 0) || isZip;
  const hasLink = fileUrl && fileUrl.trim() !== '' && fileUrl !== '#' && !isZip;

  // Lottie Animation Logic
  useEffect(() => {
    const player = playerRef.current;
    if (player) {
        if (isLiked) {
            player.setDirection(1);
            player.play();
        } else {
            player.setDirection(-1);
            player.play();
        }
    }
  }, [isLiked]);

  // Video Manager Registration
  useEffect(() => {
    videoManager.register(id, (shouldPlay) => {
        if (videoRef.current) {
            if (shouldPlay) {
                const promise = videoRef.current.play();
                if (promise !== undefined) {
                    promise.catch(() => {
                        // Autoplay prevented or aborted
                    });
                }
            } else {
                videoRef.current.pause();
            }
        }
    });
    return () => videoManager.unregister(id);
  }, [id]);

  // Visibility Observer for Video Playback
  useEffect(() => {
    if (!videoRef.current || !videoUrl || videoError) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    videoManager.requestPlay(id);
                } else {
                    videoManager.notifyHidden(id);
                }
            });
        },
        { 
            threshold: 0.2,
            rootMargin: '50px 0px 50px 0px' // Slight pre-roll buffer
        } 
    );

    observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, [videoUrl, videoError, id]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLiked) playLikeSound();
    else playClickSound();
    onLike(id);
  };

  const handleViewButton = (e: React.MouseEvent) => {
    e.stopPropagation();
    playClickSound();
    onView(id);
  };

  const handleCreatorClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onCreatorClick) {
          playClickSound();
          onCreatorClick(author);
      }
  };

  const rawBanner = bannerUrl || imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop';
  const displayBanner = getOptimizedImageUrl(rawBanner);
  const displayAvatar = authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=000&color=fff`;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0, 
        transition: { duration: 0.4, ease: "easeOut" } 
    },
    hover: { y: -8, transition: { type: "spring", stiffness: 400, damping: 25 } }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="group relative w-full h-full bg-[#050505] cursor-default isolate overflow-hidden backface-hidden"
    >
        <div className="absolute inset-0 rounded-[24px] shadow-[0_0_0_1px_rgba(255,255,255,0.05)] z-0 pointer-events-none"></div>

        <div className="absolute inset-0 z-0 bg-[#111]">
            {/* Background Image (Always present as fallback/base) */}
            <div className="absolute inset-0 z-0">
                {!imageError ? (
                    <img 
                        src={displayBanner} 
                        alt={title}
                        onError={() => setImageError(true)}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
                        <LayersIcon className="w-12 h-12 text-slate-800" />
                    </div>
                )}
            </div>

            {/* Video Layer */}
            {videoUrl && !videoError && (
                <div className="absolute inset-0 z-10 bg-black">
                    <video 
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                        muted
                        loop
                        playsInline
                        preload="auto"
                        onError={() => setVideoError(true)}
                    />
                </div>
            )}

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

        <div className="absolute bottom-0 left-0 right-0 p-5 z-30 translate-y-2 group-hover:translate-y-0 transition-transform duration-300 ease-out pointer-events-none">
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

                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
                     <button 
                        onClick={handleLike} 
                        className="group/btn w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all overflow-hidden"
                     >
                        <div 
                            className={`w-full h-full flex items-center justify-center p-[2px] transition-[filter] duration-300 ${
                                isLiked ? '' : 'grayscale brightness-150 opacity-70 group-hover/btn:opacity-100'
                            }`}
                        >
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
                     <button onClick={handleViewButton} className="group/btn w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.5)] hover:bg-slate-200 transition-all">
                         <ArrowRightIcon className="w-5 h-5" />
                     </button>
                </div>
            </div>
            
            <div className="mt-4 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out"></div>
            
            <div className="flex justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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

// Main Component with Intersection Observer for Virtualization
// Optimized for "Instant Rendering" by mounting aggressively (800px buffer)
const TemplateCard: React.FC<TemplateCardProps> = (props) => {
    const [inView, setInView] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Buffer increased to 800px to ensure card mounts long before scrolling into view
                setInView(entry.isIntersecting);
            },
            {
                root: null, // viewport
                rootMargin: '800px 0px 800px 0px', // Large mounting buffer
                threshold: 0
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div 
            ref={containerRef} 
            className="w-full aspect-[4/3] rounded-[24px] relative"
            style={{ contain: 'content' }} // Performance optimization hint
        >
            {inView ? (
                <CardContent {...props} />
            ) : (
                // Lightweight Skeleton when off-screen (preserves layout)
                <div className="w-full h-full rounded-[24px] bg-[#050505] border border-white/5" />
            )}
        </div>
    );
};

export default memo(TemplateCard);
