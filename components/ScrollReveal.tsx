import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  staggerIndex?: number;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, staggerIndex = 0 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay: staggerIndex * 0.1, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};
