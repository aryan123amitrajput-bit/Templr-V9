
import React from 'react';
import { TwitterIcon, DribbbleIcon, GithubIcon } from './Icons';
import { playClickSound } from '../audio';
import { ScrollReveal } from './ScrollReveal';

interface FooterProps {
  onShowNotification: (message: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onShowNotification }) => {
  const handleLink = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    playClickSound();
    window.open(url, '_blank');
  };

  return (
    <footer className="bg-[#030304] border-t border-white/[0.08] pt-12 pb-10">
      <div className="container mx-auto px-6">
        <ScrollReveal>
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                
                {/* Logo Area */}
                <div className="text-center md:text-left">
                    <h4 className="text-white font-bold text-lg mb-1 tracking-tight">Templr</h4>
                    <p className="text-slate-600 text-xs">
                        High-performance template ecosystem.
                    </p>
                </div>

                {/* Socials (Real or Placeholders) */}
                <div className="flex gap-6">
                    <a href="https://twitter.com" onClick={(e) => handleLink(e, 'https://twitter.com')} className="text-slate-500 hover:text-white transition-colors"><TwitterIcon className="w-4 h-4" /></a>
                    <a href="https://github.com" onClick={(e) => handleLink(e, 'https://github.com')} className="text-slate-500 hover:text-white transition-colors"><GithubIcon className="w-4 h-4" /></a>
                    <a href="https://dribbble.com" onClick={(e) => handleLink(e, 'https://dribbble.com')} className="text-slate-500 hover:text-white transition-colors"><DribbbleIcon className="w-4 h-4" /></a>
                </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-white/5 text-center">
                <p className="text-slate-700 text-[10px]">© 2024 Templr Inc. All rights reserved.</p>
            </div>
        </ScrollReveal>
      </div>
    </footer>
  );
};

export default Footer;
