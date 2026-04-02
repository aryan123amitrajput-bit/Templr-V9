import React from 'react';
import { motion } from 'framer-motion';

export const MovingBorder = ({ children, className, duration = 2000 }: { children: React.ReactNode, className?: string, duration?: number }) => {
  return (
    <div className={`relative p-[1px] rounded-[inherit] overflow-hidden ${className}`}>
      <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-spin-slow"></div>
      <div className="relative bg-[#09090b] rounded-[inherit] h-full w-full">
        {children}
      </div>
    </div>
  );
};
