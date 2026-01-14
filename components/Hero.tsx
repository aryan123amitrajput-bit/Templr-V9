
import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRightIcon, UploadIcon, ArrowLeftIcon } from './Icons';
import { playClickSound } from '../audio';
import { motion, AnimatePresence } from 'framer-motion';
import Galaxy from './Galaxy';
import QuantumFlow from './QuantumFlow';

interface HeroProps {
  onUploadClick: () => void;
}

// --- Particle Text Component ---
const ParticleText: React.FC<{ 
  text: string; 
  className: string;
  colors: string;
}> = ({ 
  text, 
  className,
  colors,
}) => {
  
  const containerVariants = {
    hidden: { 
      opacity: 0,
      transition: { staggerChildren: 0.05 } 
    },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.05,
        delayChildren: 0.1
      } 
    },
    exit: {
      opacity: 0,
      transition: { 
        staggerChildren: 0.02, 
        staggerDirection: -1,
        when: "afterChildren"
      }
    }
  };

  const charVariants = {
    hidden: { 
      opacity: 0, 
      y: 50, 
      filter: 'blur(8px)',
      scale: 0.8
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: 'blur(0px)',
      scale: 1,
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 150
      }
    },
    exit: {
      opacity: 0,
      y: -50, 
      filter: 'blur(8px)',
      scale: 0.5,
      transition: { 
        duration: 0.4
      }
    }
  };

  return (
    <motion.div 
      className={`flex flex-col items-center justify-center text-center ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ display: 'flex', flexDirection: 'column', width: '100%', pointerEvents: 'none' }}
    >
      {text.split('\n').map((line, lineIdx) => (
        <div key={`line-${lineIdx}`} className="flex flex-wrap justify-center overflow-visible">
          {line.split(' ').map((word, wordIdx) => (
            <div key={`word-${lineIdx}-${wordIdx}`} className="flex whitespace-nowrap mr-[0.25em] last:mr-0">
              {word.split('').map((char, charIdx) => (
                <motion.span
                  key={`char-${lineIdx}-${wordIdx}-${charIdx}`}
                  variants={charVariants}
                  className={`inline-block ${colors}`}
                  style={{ willChange: 'transform, opacity, filter' }}
                >
                  {char}
                </motion.span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </motion.div>
  );
};

const Hero: React.FC<HeroProps> = ({ onUploadClick }) => {
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const headlines = useMemo(() => [
    {
        id: 1,
        text: "Design the\nExtraordinary",
        className: "text-6xl md:text-8xl lg:text-9xl pb-4 font-display font-bold tracking-tight",
        colors: "bg-gradient-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] pb-6"
    },
    {
        id: 2,
        text: "Optimized for phone",
        className: "text-6xl md:text-8xl lg:text-9xl pb-4 font-display font-bold tracking-tight",
        colors: "bg-gradient-to-b from-cyan-300 via-blue-600 to-indigo-900 bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(0,140,255,0.6)] filter brightness-125 pb-6"
    },
    {
        id: 3,
        text: "The simplest\nTemplate library",
        className: "text-5xl md:text-7xl lg:text-8xl pb-4 font-display font-bold tracking-tight",
        colors: "bg-gradient-to-b from-amber-300 via-orange-600 to-red-900 bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(255,100,0,0.6)] filter brightness-125 pb-6"
    }
  ], []);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
        setHeadlineIndex((prev) => (prev + 1) % headlines.length);
    }, 4000); 

    return () => clearInterval(interval);
  }, [headlines.length, isPaused]);

  const nextHeadline = () => {
    playClickSound();
    setHeadlineIndex((prev) => (prev + 1) % headlines.length);
  };

  const prevHeadline = () => {
    playClickSound();
    setHeadlineIndex((prev) => (prev - 1 + headlines.length) % headlines.length);
  };

  const goToHeadline = (index: number) => {
      playClickSound();
      setHeadlineIndex(index);
  }

  const scrollToGallery = () => {
    playClickSound();
    const gallery = document.getElementById('gallery');
    if (gallery) gallery.scrollIntoView({ behavior: 'smooth' });
  };

  const currentHeadline = headlines[headlineIndex];

  return (
    <section 
        className="relative h-screen min-h-[800px] w-full flex flex-col items-center justify-center overflow-hidden"
    >
      
      {/* --- GALAXY BACKGROUND (Z-[-2]) --- */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-black">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/30 via-[#050505] to-black z-0"></div>
         <Galaxy density={3} mouseInteraction={true} />
      </div>

      {/* --- 3D QUANTUM FLOW (Canvas Fluid) Z-0 --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[800px] z-0 pointer-events-none opacity-100 mix-blend-screen perspective-[1000px]">
          <div className="w-full h-full transform rotate-12 scale-110">
              <QuantumFlow />
          </div>
      </div>

      {/* --- MAIN CONTENT (Z-10) --- */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-7xl mx-auto px-6 mt-[10vh] w-full">
        
        {/* Release Pill */}
        <motion.div 
            initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-8 relative group"
        >
            <div className="relative inline-flex overflow-hidden rounded-full p-[1.5px]">
                <span className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#0000_0%,#0000_75%,#3b82f6_100%)]" />
                <div className="relative inline-flex items-center gap-3 rounded-full bg-slate-950/80 px-6 py-2 text-sm font-medium text-white backdrop-blur-3xl transition-colors hover:bg-slate-900/80">
                    <div className="flex items-center gap-1.5">
                         <span className="relative flex h-2 w-2">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-50"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
                         </span>
                         <span className="text-[11px] font-bold tracking-[0.2em] text-white uppercase shadow-black drop-shadow-md">Templr v3.0</span>
                    </div>
                    <div className="h-3 w-[1px] bg-white/20 mx-1"></div>
                    <span className="text-[11px] text-slate-300 font-medium tracking-wide group-hover:text-white transition-colors">
                         The Future of Design
                    </span>
                </div>
            </div>
        </motion.div>

        {/* --- CAROUSEL CONTAINER --- */}
        <div 
            className="relative w-full flex flex-col items-center group/carousel"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Cinematic Headline */}
            <div className="relative h-[350px] md:h-[550px] w-full flex items-center justify-center mb-2 perspective-container z-20">
                <button 
                    onClick={prevHeadline}
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-30 p-4 rounded-full text-white/20 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover/carousel:opacity-100 -translate-x-4 group-hover/carousel:translate-x-0"
                    aria-label="Previous Headline"
                >
                    <ArrowLeftIcon className="w-8 h-8" />
                </button>
                
                <button 
                    onClick={nextHeadline}
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-30 p-4 rounded-full text-white/20 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover/carousel:opacity-100 translate-x-4 group-hover/carousel:translate-x-0"
                    aria-label="Next Headline"
                >
                    <ArrowRightIcon className="w-8 h-8" />
                </button>

                <AnimatePresence mode="popLayout" initial={false}>
                     <ParticleText 
                        key={currentHeadline.id}
                        text={currentHeadline.text} 
                        className={`absolute inset-0 flex items-center justify-center ${currentHeadline.className}`}
                        colors={currentHeadline.colors}
                     />
                </AnimatePresence>
            </div>

            {/* Carousel Indicators */}
            <div className="flex items-center gap-3 z-30 mb-8">
                {headlines.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => goToHeadline(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === headlineIndex 
                                ? 'w-8 bg-white shadow-[0_0_10px_white]' 
                                : 'w-1.5 bg-white/20 hover:bg-white/40'
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>

        {/* Subtext */}
        <motion.p 
            initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-2xl text-slate-300 font-light max-w-2xl mx-auto mb-12 leading-relaxed tracking-wide mix-blend-plus-lighter will-change-[transform,opacity] drop-shadow-md"
        >
            The curated marketplace for high-fidelity digital assets. <br className="hidden md:block"/>
            <span className="text-slate-400">Built for the obsessive.</span>
        </motion.p>

        {/* Premium Action Stack */}
        <motion.div 
            initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="flex flex-col md:flex-row items-center gap-8 w-full justify-center"
        >
            
            {/* Primary Button: Explore Collection */}
            <motion.button 
                onClick={scrollToGallery}
                whileHover={{ 
                    scale: 1.05, 
                    boxShadow: "0 0 50px rgba(255,255,255,0.3)",
                    textShadow: "0 0 8px rgba(255,255,255,0.5)"
                }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="group relative h-14 px-8 min-w-[200px] rounded-full shadow-[0_20px_50px_-20px_rgba(255,255,255,0.3),0_10px_20px_-10px_rgba(255,255,255,0.1)] overflow-hidden ring-1 ring-white/50"
            >
                <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-100 to-[#d4d4d8]"></div>
                <div className="absolute top-[2px] left-[2px] right-[2px] h-[40%] bg-gradient-to-b from-white to-transparent rounded-t-full opacity-90"></div>
                
                <span className="relative z-10 flex items-center justify-center gap-2 text-black font-bold tracking-wide text-sm drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                    Explore Collection
                    <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
            </motion.button>

            {/* Secondary Button: Submit Work - 50% MORE UPPER GLOW */}
            <motion.button 
                onClick={() => { playClickSound(); onUploadClick(); }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="group relative h-14 min-w-[200px] rounded-full"
            >
                {/* 1. Deep Atmosphere Glow (Blue/Purple Base) */}
                <div className="absolute -inset-6 rounded-full bg-blue-600/30 blur-3xl opacity-30 group-hover:opacity-60 transition-opacity duration-500"></div>
                
                {/* 2. Intense Rim Flare (Cyan) - Concentrated at Top */}
                <div className="absolute -top-3 -inset-x-2 h-12 rounded-full bg-cyan-400/50 blur-xl opacity-20 group-hover:opacity-80 transition-opacity duration-500"></div>

                {/* Crystal Container */}
                <div className="absolute inset-0 rounded-full overflow-hidden bg-slate-900/95 backdrop-blur-3xl border border-white/10 group-hover:border-cyan-200 shadow-[0_0_30px_-10px_rgba(34,211,238,0.5)] group-hover:shadow-[0_0_60px_-10px_rgba(34,211,238,0.8),inset_0_0_20px_rgba(34,211,238,0.3)] transition-all duration-500">
                    
                    {/* Base Dark Crystal */}
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-700 via-black to-slate-950 z-0"></div>

                    {/* Top Light Catch (The Facet) - BOOSTED 50% */}
                    <div className="absolute top-0 inset-x-0 h-[60%] bg-gradient-to-b from-white/30 to-transparent z-10 border-b border-white/10 opacity-100 group-hover:from-cyan-300/50 transition-all duration-500"></div>
                    
                    {/* Sharp Top Edge Highlight - BOOSTED 50% */}
                    <div className="absolute top-0 left-4 right-4 h-[1.5px] bg-white/100 blur-[1.5px] group-hover:bg-cyan-100 group-hover:blur-[3px] group-hover:shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-all z-20"></div>
                    
                    {/* NEW: Top-Center SPECULAR GLOW */}
                    <div className="absolute top-[-2px] left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-white blur-[2px] opacity-80 group-hover:opacity-100 group-hover:w-[60%] transition-all z-30"></div>

                    {/* Bottom Glow (Internal Light) */}
                    <div className="absolute bottom-0 inset-x-0 h-[40%] bg-gradient-to-t from-blue-500/20 to-transparent z-10 opacity-60 group-hover:opacity-100 transition-opacity"></div>

                    {/* Moving Sheen */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out z-20"></div>

                    {/* Content */}
                    <div className="relative z-40 flex items-center justify-center gap-3 h-full px-8">
                        {/* Icon with Bloom */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-cyan-400 blur-lg opacity-0 group-hover:opacity-70 transition-opacity"></div>
                            <UploadIcon className="relative w-4 h-4 text-cyan-50 group-hover:text-white transition-colors drop-shadow-[0_0_8px_rgba(34,211,238,1)]" />
                        </div>
                        
                        {/* Text with Bloom */}
                        <span className="text-sm font-bold uppercase tracking-widest text-white text-shadow-md group-hover:text-shadow-[0_0_20px_rgba(34,211,238,1)] transition-all">
                            Submit Work
                        </span>
                    </div>
                </div>
            </motion.button>

        </motion.div>
      </div>
      
      {/* --- BOTTOM FADE --- */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black to-transparent z-20 pointer-events-none"></div>

    </section>
  );
};

export default Hero;
