import React, { memo } from 'react';
import { playClickSound } from '../audio';
import { Template } from '../src/types';

interface TemplateCardProps extends Template {
  index: number;
  isLiked: boolean;
  isFavorited: boolean;
  onMessageCreator: (name: string) => void;
  onView: () => void;
  onLike: () => void;
  onFavorite: () => void;
  onCreatorClick: (name: string) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ 
  title, author, category, bannerUrl, imageUrl, likes, views, 
  isLiked, isFavorited, onMessageCreator, onView, onLike, onFavorite, onCreatorClick 
}) => {
  return (
    <div className="group relative bg-[#09090b] border border-white/5 rounded-3xl overflow-hidden hover:border-white/10 transition-all duration-300 hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)]">
      
      {/* Image */}
      <div className="relative aspect-video overflow-hidden">
        <img src={bannerUrl || imageUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent opacity-60"></div>
        
        {/* Quick Actions */}
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={(e) => { e.stopPropagation(); onLike(); }} className={`p-2 rounded-full backdrop-blur-md transition-colors ${isLiked ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <span className="text-xs font-bold">{likes}</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); onFavorite(); }} className={`p-2 rounded-full backdrop-blur-md transition-colors ${isFavorited ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                ★
            </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-6">
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <button onClick={() => { playClickSound(); onCreatorClick(author); }} className="text-sm text-slate-500 hover:text-blue-400 transition-colors mb-4 block">
            by {author}
        </button>
        
        <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-3 py-1 rounded-full bg-white/5 border border-white/5">{category}</span>
            <button onClick={() => { playClickSound(); onView(); }} className="text-sm font-bold text-white hover:text-blue-400 transition-colors">
                View Details →
            </button>
        </div>
      </div>
    </div>
  );
};

export default memo(TemplateCard);
