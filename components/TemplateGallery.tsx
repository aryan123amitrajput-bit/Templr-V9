import React, { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TemplateCard from './TemplateCard';
import { Template } from '../src/types';
import { ScrollReveal } from './ScrollReveal';

interface TemplateGalleryProps {
  templates: Template[];
  isLoading: boolean;
  initialCategory: string;
  onMessageCreator: (name: string) => void;
  onLike: (id: string) => void;
  onFavorite: (id: string) => void;
  onView: (t: Template) => void;
  onCreatorClick: (name: string) => void;
  likedIds: Set<string>;
  favoriteIds: Set<string>;
  isLoggedIn: boolean;
}

const categories = ['All', 'Popular', 'Newest', 'Portfolio', 'E-commerce', 'SaaS', 'Blog'];

const TemplateGallery: React.FC<TemplateGalleryProps> = ({ 
  templates, isLoading, initialCategory, onMessageCreator, onLike, onFavorite, onView, onCreatorClick, likedIds, favoriteIds, isLoggedIn
}) => {
  const [activeCategory, setActiveCategory] = useState(initialCategory);

  const filteredTemplates = useMemo(() => {
    if (activeCategory === 'All') return templates;
    if (activeCategory === 'Popular') return [...templates].sort((a, b) => b.views - a.views);
    if (activeCategory === 'Newest') return [...templates].sort((a, b) => b.id.localeCompare(a.id));
    return templates.filter(t => t.category === activeCategory);
  }, [templates, activeCategory]);

  return (
    <section className="py-32 bg-[#020408]">
      <div className="container mx-auto px-6 max-w-7xl">
        
        <ScrollReveal>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-16 gap-8">
                <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Marketplace</h2>
                
                <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-white text-black' : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-white'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>
        </ScrollReveal>

        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-96 bg-white/5 rounded-3xl animate-pulse"></div>)}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                    {filteredTemplates.map((template, index) => (
                        <motion.div
                            key={template.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                        >
                            <TemplateCard 
                                {...template}
                                index={index}
                                isLiked={likedIds.has(template.id)}
                                isFavorited={favoriteIds.has(template.id)}
                                onMessageCreator={onMessageCreator}
                                onView={() => onView(template)}
                                onLike={() => onLike(template.id)}
                                onFavorite={() => onFavorite(template.id)}
                                onCreatorClick={onCreatorClick}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        )}
      </div>
    </section>
  );
};

export default memo(TemplateGallery);
