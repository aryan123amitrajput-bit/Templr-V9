
import React from 'react';
import { ScrollReveal } from './ScrollReveal';

const WhyTemplr: React.FC = () => {
  // The specific visual requested
  const HERO_IMAGE_URL = "https://cdn.discordapp.com/attachments/1052511663842136094/1460185175420833792/file_000000009eb871fabb9e910558a6a4fe.png?ex=6965feea&is=6964ad6a&hm=f98255ccc7107abc22dbc47683734195f0863febb59188ec2830e3a272520c01&";

  return (
    <section id="features" className="py-32 bg-black relative overflow-hidden">
      
      {/* Deep Ambient Background */}
      <div className="absolute inset-0 bg-[#000000]">
          <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
          <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/5 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>
      </div>

      <div className="container mx-auto px-6 md:px-12 max-w-[90rem] relative z-10">
        
        {/* Header */}
        <ScrollReveal>
            <div className="flex flex-col items-center text-center mb-16 relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md shadow-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">The Ecosystem</span>
                </div>
                <h2 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
                    Why Builders <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Choose Templr.</span>
                </h2>
                <p className="text-slate-400 text-lg max-w-2xl font-light">
                    We've reimagined the marketplace experience. No bloat, no outdated code. Just pure, production-ready design engineering.
                </p>
            </div>
        </ScrollReveal>

        {/* --- HERO IMAGE DISPLAY --- */}
        <ScrollReveal delay={100}>
            <div className="relative w-full rounded-[32px] p-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent shadow-2xl group">
                
                {/* Glow Behind */}
                <div className="absolute -inset-4 bg-blue-500/20 blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-1000 rounded-[32px]"></div>

                <div className="relative rounded-[31px] overflow-hidden bg-[#050505] border border-white/5">
                    <img 
                        src={HERO_IMAGE_URL} 
                        alt="Templr Dashboard Interface" 
                        className="w-full h-auto object-cover transform scale-100 group-hover:scale-[1.01] transition-transform duration-1000 ease-out"
                        onError={(e) => {
                            // Fallback purely for safety, though user requested specific image
                            e.currentTarget.src = "https://images.unsplash.com/photo-1642427749670-f20e2e76ed8c?q=80&w=3400&auto=format&fit=crop";
                        }}
                    />
                    
                    {/* Cinematic Vignette Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none"></div>
                    
                    {/* Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                </div>
            </div>
        </ScrollReveal>

      </div>
    </section>
  );
};

export default WhyTemplr;
