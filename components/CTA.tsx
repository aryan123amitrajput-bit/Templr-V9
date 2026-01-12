
import React from 'react';
import { playClickSound } from '../audio';
import { ScrollReveal } from './ScrollReveal';

const CTA: React.FC = () => {
  const handleGetStarted = () => {
    playClickSound();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="py-40 relative overflow-hidden bg-black">
      
      {/* Giant Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-800/20 via-black to-black blur-[100px] pointer-events-none"></div>

      <div className="container mx-auto px-6 relative z-10 text-center">
        <ScrollReveal>
            <div className="max-w-4xl mx-auto">
            <h3 className="text-6xl md:text-9xl font-bold text-white mb-8 tracking-tighter leading-[0.9]">
                Ship your <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-600">next idea.</span>
            </h3>
            <p className="text-xl md:text-2xl text-slate-500 mb-16 font-light max-w-2xl mx-auto">
                Join the thousands of developers building the future with Templr.
            </p>
            
            <div className="flex justify-center">
                {/* 
                   ULTRA-PREMIUM GLASS CTA BUTTON 
                   Spec: Dark Mode Glassmorphism, Liquid Smoke, Ethereal Halo
                */}
                <button 
                  onClick={handleGetStarted}
                  className="group relative px-14 py-6 rounded-full overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] hover:shadow-[0_0_50px_-10px_rgba(255,255,255,0.15)]"
                >
                  {/* 1. Base Material (Smoked Glass) */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800/30 via-[#050505] to-black opacity-90 z-0"></div>

                  {/* 2. Internal Texture (Liquid Smoke/Mist) */}
                  <div className="absolute inset-[-50%] opacity-40 group-hover:opacity-60 transition-opacity duration-700 z-0 mix-blend-screen pointer-events-none">
                     {/* Swirling Mist */}
                     <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(255,255,255,0.1)_100deg,transparent_220deg,rgba(255,255,255,0.1)_300deg,transparent_360deg)] animate-[spin_8s_linear_infinite] blur-2xl transform scale-150"></div>
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.15),transparent_60%)] animate-pulse-glow"></div>
                  </div>
                  
                  {/* 3. Surface Gloss (Top Reflection) */}
                  <div className="absolute top-0 inset-x-0 h-[40%] bg-gradient-to-b from-white/10 to-transparent opacity-40 rounded-t-full transform scale-x-75 blur-[1px]"></div>

                  {/* 4. Rim Light (Border) */}
                  <div className="absolute inset-0 border border-white/10 rounded-full shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] z-10"></div>

                  {/* 5. Stardust Particles */}
                  <div className="absolute top-1/2 left-1/4 w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_4px_white] animate-float-slow z-10"></div>
                  <div className="absolute bottom-1/3 right-1/4 w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_4px_white] animate-float-delayed z-10"></div>

                  {/* 6. Text Content */}
                  <span className="relative z-20 font-sans font-bold text-white text-base tracking-[0.15em] uppercase flex items-center gap-3 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] group-hover:drop-shadow-[0_0_25px_rgba(255,255,255,1)] transition-all duration-300">
                      Get Started
                  </span>
                </button>
            </div>
            </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default CTA;
