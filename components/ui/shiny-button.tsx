
"use client"

import type React from "react"

// Define props for ShinyButton
interface ShinyButtonProps {
  children?: React.ReactNode
  onClick?: () => void
  className?: string
}

export function ShinyButton({ children, onClick, className = "" }: ShinyButtonProps) {
  return (
    <>
      <style>{`
        .shiny-cta {
          /* HARD RULES: POSITIONING & LAYOUT */
          position: relative;
          z-index: 10; /* Safety Z-Index */
          isolation: isolate;
          
          /* VISUALS: SOLID & HIGH CONTRAST */
          background-color: #111111; /* Pure solid dark gray, near black but visible against #000 */
          color: #ffffff; /* Pure white text */
          
          /* BORDER & SHAPE */
          border: 1px solid #333333; /* Explicit visibility border */
          border-radius: 9999px;
          outline: none;
          
          /* SPACING & TYPOGRAPHY */
          padding: 0; /* Handled by flex layout or specific sizing classes passed in */
          display: inline-flex;
          align-items: center;
          justify-content: center;
          
          /* DEPTH (No Blur) */
          box-shadow: 
            0 10px 20px -5px rgba(0,0,0,1), /* Deep shadow to lift off black bg */
            0 0 0 1px rgba(255,255,255,0.05) inset; /* Inner subtle rim */
            
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
        }

        /* SAFE SHINE ANIMATION (No Masks/Blends) */
        .shiny-cta::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            105deg,
            transparent 20%,
            rgba(255, 255, 255, 0.1) 45%,
            rgba(255, 255, 255, 0.2) 50%,
            rgba(255, 255, 255, 0.1) 55%,
            transparent 80%
          );
          transform: translateX(-100%);
          z-index: 1;
          pointer-events: none;
          animation: safe-shine 4s infinite linear;
        }

        /* HOVER STATE: High Visibility */
        .shiny-cta:hover {
          background-color: #1a1a1a;
          border-color: #555555;
          transform: translateY(-2px);
          box-shadow: 
            0 15px 30px -5px rgba(0,0,0,1),
            0 0 25px rgba(255,255,255,0.1); /* Glow without blur filter */
        }

        .shiny-cta:active {
          transform: translateY(0);
          border-color: #333333;
        }

        /* ENSURE CONTENT IS ON TOP */
        .shiny-cta-content {
          position: relative;
          z-index: 20; /* Above the shine ::after element */
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          height: 100%;
        }

        @keyframes safe-shine {
          0% { transform: translateX(-150%) skewX(-20deg); }
          40%, 100% { transform: translateX(150%) skewX(-20deg); }
        }
      `}</style>

      <button className={`shiny-cta ${className}`} onClick={onClick}>
        <div className="shiny-cta-content">
          {children}
        </div>
      </button>
    </>
  )
}
