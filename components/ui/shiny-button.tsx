import React from 'react';
import { motion } from 'framer-motion';

export const ShinyButton = ({ children, onClick, className }: { children: React.ReactNode, onClick?: () => void, className?: string }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative px-6 py-3 rounded-full bg-blue-600 text-white font-bold overflow-hidden ${className}`}
    >
      <motion.div
        className="absolute inset-0 bg-white opacity-20"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.5 }}
      />
      {children}
    </motion.button>
  );
};
