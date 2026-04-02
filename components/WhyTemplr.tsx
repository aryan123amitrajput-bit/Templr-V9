import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { ScrollReveal } from './ScrollReveal';
import { LayersIcon, ShieldCheckIcon, CpuIcon } from './Icons';

const features = [
  {
    title: "High Fidelity",
    description: "Every template is crafted with pixel-perfect attention to detail.",
    icon: LayersIcon,
  },
  {
    title: "Secure Code",
    description: "Rigorous security audits for every single asset.",
    icon: ShieldCheckIcon,
  },
  {
    title: "Optimized",
    description: "Built for speed, SEO, and maximum conversion rates.",
    icon: CpuIcon,
  }
];

const WhyTemplr: React.FC = () => {
  return (
    <section className="py-32 bg-[#020408]">
      <div className="container mx-auto px-6 max-w-7xl">
        <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-20 text-center">Why Templr?</h2>
        </ScrollReveal>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {features.map((feature, index) => (
            <ScrollReveal key={feature.title} staggerIndex={index}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                    <feature.icon className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm max-w-xs mx-auto">{feature.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default memo(WhyTemplr);
