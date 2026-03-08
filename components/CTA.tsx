
import React from 'react';
import { playClickSound } from '../audio';
import { ScrollReveal } from './ScrollReveal';
import { ArrowRightIcon } from './Icons';

const CTA: React.FC = () => {
  const handleGetStarted = () => {
    playClickSound();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDocumentation = () => {
      playClickSound();
      // Placeholder for docs link
      window.open('#', '_blank');
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
            
            <div className="flex flex-col items-center gap-8">
                <div className="flex justify-center">
                    {/* 
                       ULTRA-PREMIUM GLASS CTA BUTTON 
                       Spec: Dark Mode Glassmorphism, Liquid Smoke, Ethereal Halo
                    */}
                    <button 
                      onClick={handleGetStarted}
                      className="group relative w-[320px] h-[64px] rounded-full overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 bg-gradient-to-b from-[#1a1a1a] to-[#050505] border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.05)] flex items-center justify-center"
                    >
                      {/* Top inner glow */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[50%] bg-gradient-to-b from-white/10 to-transparent blur-md pointer-events-none"></div>
                      
                      {/* Text Content */}
                      <span className="relative z-20 font-sans font-semibold text-white text-[13px] tracking-[0.25em] uppercase">
                          GET STARTED
                      </span>
                    </button>
                </div>

                {/* Secondary CTA */}
                <button 
                    onClick={handleDocumentation}
                    className="group flex items-center gap-2 px-6 py-2 rounded-full text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest hover:bg-white/5"
                >
                    <span>Read Documentation</span>
                    <ArrowRightIcon className="w-3 h-3 transition-transform group-hover:translate-x-1 opacity-50 group-hover:opacity-100" />
                </button>
            </div>
            </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default CTA;
