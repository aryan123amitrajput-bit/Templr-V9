import React, { memo } from 'react';
import { playClickSound } from '../audio';

interface FooterProps {
  onShowNotification: (msg: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onShowNotification }) => {
  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();
    onShowNotification("Thanks for subscribing!");
  };

  return (
    <footer className="py-24 bg-[#020408] border-t border-white/5">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
          
          {/* Logo & About */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                <span className="text-black font-bold text-xl">T</span>
              </div>
              <span className="text-2xl font-bold text-white tracking-tighter">Templr</span>
            </div>
            <p className="text-slate-500 max-w-sm leading-relaxed mb-8">
              The premier marketplace for high-performance landing page templates. Built by creators, for creators.
            </p>
            
            <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm">
                <input 
                    type="email" 
                    placeholder="Enter your email"
                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-6 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <button 
                    type="submit"
                    className="px-6 py-3 bg-white text-black text-sm font-bold rounded-full hover:bg-slate-200 transition-colors"
                >
                    Join
                </button>
            </form>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-bold mb-6">Platform</h4>
            <ul className="space-y-4 text-slate-500 text-sm">
              <li><button onClick={playClickSound} className="hover:text-white transition-colors">Marketplace</button></li>
              <li><button onClick={playClickSound} className="hover:text-white transition-colors">Creators</button></li>
              <li><button onClick={playClickSound} className="hover:text-white transition-colors">Documentation</button></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-6">Legal</h4>
            <ul className="space-y-4 text-slate-500 text-sm">
              <li><button onClick={playClickSound} className="hover:text-white transition-colors">Terms</button></li>
              <li><button onClick={playClickSound} className="hover:text-white transition-colors">Privacy</button></li>
              <li><button onClick={playClickSound} className="hover:text-white transition-colors">Licenses</button></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-600 text-xs">
          <p>© 2026 Templr Studio. All rights reserved.</p>
          <div className="flex gap-8">
            <button onClick={playClickSound} className="hover:text-white transition-colors">Twitter</button>
            <button onClick={playClickSound} className="hover:text-white transition-colors">GitHub</button>
            <button onClick={playClickSound} className="hover:text-white transition-colors">Discord</button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(Footer);
