import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { ScrollReveal } from './ScrollReveal';
import { playClickSound } from '../audio';

const creators = [
  { name: "Alex Rivera", role: "UI/UX Designer", avatar: "https://ui-avatars.com/api/?name=Alex+Rivera&background=0ea5e9&color=fff" },
  { name: "Sarah Chen", role: "Frontend Dev", avatar: "https://ui-avatars.com/api/?name=Sarah+Chen&background=8b5cf6&color=fff" },
  { name: "Marcus Thorne", role: "Product Designer", avatar: "https://ui-avatars.com/api/?name=Marcus+Thorne&background=f43f5e&color=fff" },
  { name: "Elena Rossi", role: "SaaS Specialist", avatar: "https://ui-avatars.com/api/?name=Elena+Rossi&background=10b981&color=fff" }
];

interface FeaturedCreatorsProps {
  onCreatorClick: (name: string) => void;
}

const FeaturedCreators: React.FC<FeaturedCreatorsProps> = ({ onCreatorClick }) => {
  return (
    <section className="py-32 bg-[#020408]">
      <div className="container mx-auto px-6 max-w-7xl">
        
        <ScrollReveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
                <div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">Featured Creators</h2>
                    <p className="text-slate-500 text-lg">Meet the minds behind our top-performing templates.</p>
                </div>
                <button 
                    onClick={() => { playClickSound(); }}
                    className="text-blue-400 font-bold text-sm hover:text-white transition-colors flex items-center gap-2"
                >
                    View All Creators →
                </button>
            </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {creators.map((creator, index) => (
            <ScrollReveal key={creator.name} staggerIndex={index}>
              <motion.div 
                whileHover={{ y: -10 }}
                className="group relative p-6 rounded-3xl bg-[#09090b] border border-white/5 hover:border-white/10 transition-all duration-300 hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] cursor-pointer"
                onClick={() => { playClickSound(); onCreatorClick(creator.name); }}
              >
                <div className="relative w-20 h-20 mb-6 rounded-full overflow-hidden border-2 border-white/5 group-hover:border-blue-500/30 transition-colors">
                    <img src={creator.avatar} alt={creator.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{creator.name}</h3>
                <p className="text-sm text-slate-500 font-medium">{creator.role}</p>
                
                <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    <span>12 Assets</span>
                    <span className="text-blue-500">View Profile</span>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default memo(FeaturedCreators);
