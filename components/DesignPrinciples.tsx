
import React from 'react';
import { motion } from 'framer-motion';
import { LayersIcon, RocketIcon, EyeIcon, ShieldCheckIcon } from './Icons';

const principles = [
  {
    title: 'Technical Precision',
    description: 'Interfaces designed for mission-critical clarity. Grid-based layouts and monospace data points.',
    icon: <LayersIcon className="w-6 h-6" />,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/20'
  },
  {
    title: 'Editorial Elegance',
    description: 'Bold typography and dramatic whitespace. High-contrast layouts that command attention.',
    icon: <EyeIcon className="w-6 h-6" />,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20'
  },
  {
    title: 'Brutalist Energy',
    description: 'Raw, unconventional, and high-energy. Thick borders, neon accents, and graphic motion.',
    icon: <RocketIcon className="w-6 h-6" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20'
  },
  {
    title: 'Atmospheric Depth',
    description: 'Immersive experiences with glassmorphism, layered gradients, and cinematic blur.',
    icon: <ShieldCheckIcon className="w-6 h-6" />,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20'
  }
];

const DesignPrinciples: React.FC = () => {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <div className="max-w-2xl">
            <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.4em] text-cyan-500 mb-4">
              Design Philosophy
            </h2>
            <h3 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[0.9]">
              Crafted for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40 italic serif">Modern Web</span>
            </h3>
          </div>
          <p className="text-slate-500 max-w-sm text-sm leading-relaxed">
            We believe in intentional pairings—where typography, color, and motion reinforce a specific mood.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {principles.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={`p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all group`}
            >
              <div className={`w-12 h-12 rounded-2xl ${p.bg} ${p.border} border flex items-center justify-center ${p.color} mb-6 group-hover:scale-110 transition-transform`}>
                {p.icon}
              </div>
              <h4 className="text-xl font-bold text-white mb-3 tracking-tight">{p.title}</h4>
              <p className="text-slate-500 text-sm leading-relaxed">
                {p.description}
              </p>
              
              <div className="mt-8 flex items-center gap-2">
                <div className={`h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10`}></div>
                <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest">0{i + 1}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DesignPrinciples;
