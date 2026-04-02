import React from 'react';

export const LiquidGlassView: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => {
    return (
        <div className={`relative backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl ${className}`}>
            {children}
        </div>
    );
};

export const LiquidGlassContainerView: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => {
    return (
        <div className={`relative ${className}`}>
            {children}
        </div>
    );
};
