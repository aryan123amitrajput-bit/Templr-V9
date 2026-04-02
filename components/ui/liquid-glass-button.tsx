import React from 'react';
import { motion } from 'framer-motion';

export const LiquidGlassButton = ({ children, onClick, className }: { children: React.ReactNode, onClick?: () => void, className?: string }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold transition-all hover:bg-white/20 ${className}`}
    >
      {children}
    </motion.button>
  );
};
