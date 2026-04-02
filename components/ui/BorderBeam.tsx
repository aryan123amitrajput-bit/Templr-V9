import React from 'react';
import { motion } from 'framer-motion';

export const BorderBeam = ({ className }: { className?: string }) => {
  return (
    <div className={`absolute inset-0 rounded-[inherit] border-[1px] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#fff,#fff)] ${className}`}>
      <motion.div
        className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-transparent via-blue-500 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
};
