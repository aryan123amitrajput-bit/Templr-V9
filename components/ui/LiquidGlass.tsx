
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface LiquidGlassProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
  effect?: 'clear' | 'frosted' | 'liquid';
  intensity?: number;
}

/**
 * A web-native implementation of Liquid Glass effect using SVG filters.
 * Mimics the @callstack/liquid-glass API for compatibility.
 */
export const LiquidGlassView: React.FC<LiquidGlassProps> = ({
  children,
  className = '',
  style = {},
  interactive = false,
  effect = 'liquid',
  intensity = 1,
}) => {
  const filterId = useMemo(() => `liquid-glass-filter-${Math.random().toString(36).substr(2, 9)}`, []);

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{
        ...style,
        backdropFilter: effect === 'frosted' ? `blur(${10 * intensity}px)` : 'none',
        WebkitBackdropFilter: effect === 'frosted' ? `blur(${10 * intensity}px)` : 'none',
      }}
    >
      <svg className="absolute inset-0 pointer-events-none opacity-0 w-0 h-0">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            {/* Liquid / Metaball Effect */}
            <feGaussianBlur in="SourceGraphic" stdDeviation={intensity * 10} result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" 
              result="liquid" 
            />
            <feComposite in="SourceGraphic" in2="liquid" operator="atop" />
          </filter>
        </defs>
      </svg>
      
      <div 
        className="relative z-10 w-full h-full"
        style={{
          filter: effect === 'liquid' ? `url(#${filterId})` : 'none',
        }}
      >
        {children}
      </div>
      
      {/* Interactive Blobs for "Liquid" feel */}
      {interactive && effect === 'liquid' && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <motion.div
            animate={{
              x: [0, 20, -20, 0],
              y: [0, -20, 20, 0],
              scale: [1, 1.2, 0.8, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              x: [0, -30, 30, 0],
              y: [0, 30, -30, 0],
              scale: [1, 0.9, 1.1, 1],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"
          />
        </div>
      )}
    </div>
  );
};

interface LiquidGlassContainerProps {
  children: React.ReactNode;
  className?: string;
  spacing?: number;
}

export const LiquidGlassContainerView: React.FC<LiquidGlassContainerProps> = ({
  children,
  className = '',
  spacing = 20,
}) => {
  const containerFilterId = useMemo(() => `liquid-container-filter-${Math.random().toString(36).substr(2, 9)}`, []);

  return (
    <div className={`relative ${className}`}>
      <svg className="absolute inset-0 pointer-events-none opacity-0 w-0 h-0">
        <defs>
          <filter id={containerFilterId} colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -12" 
              result="goo" 
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      
      <div 
        className="flex flex-wrap items-center justify-center"
        style={{ 
          filter: `url(#${containerFilterId})`,
          gap: `${spacing}px`
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const isLiquidGlassSupported = true; // Web always supports SVG filters
