import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { playClickSound } from '../audio';
import { ArrowRightIcon, UploadIcon } from './Icons';

interface HeroProps {
  onUploadClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onUploadClick }) => {
  return (
    <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 overflow-hidden">
      
      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-[#020408]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-300 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>New Templates Added Daily</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tighter mb-8 leading-[0.9]">
            The Marketplace for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">High-Performance</span> UI.
          </h1>
          
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Discover, explore, and download real landing page templates. 
            Templr is the platform for designers and developers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => { playClickSound(); onUploadClick(); }}
              className="px-8 py-4 rounded-full bg-white text-black font-bold text-sm hover:bg-slate-200 transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <UploadIcon className="w-4 h-4" />
              <span>Upload Template</span>
            </button>
            <button 
              onClick={playClickSound}
              className="px-8 py-4 rounded-full bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <span>Explore Marketplace</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default memo(Hero);
