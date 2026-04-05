import React from 'react';

interface LogoIconProps {
  className?: string;
  size?: number;
}

export const LogoIcon: React.FC<LogoIconProps> = ({ className = '', size = 32 }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 120 120" 
      className={className}
    >
      <defs>
        <linearGradient id="logo_bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" /> {/* much brighter modern blue */}
          <stop offset="100%" stopColor="#1d4ed8" /> {/* solid medium blue */}
        </linearGradient>
        <radialGradient id="gloss" cx="30%" cy="30%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Circle Background */}
      <circle cx="60" cy="60" r="56" fill="url(#logo_bg)" />
      {/* Light Reflection */}
      <circle cx="60" cy="60" r="56" fill="url(#gloss)" />

      {/* 
        The precise logo from the image:
        A continuous thick white line forming an S-Tail into a horizontal arrow, 
        sitting perfectly atop a curved U-shape cart base.
      */}

      {/* 1) The S-Curve tail transitioning into the fast arrow shaft */}
      <path 
        d="M 22 47 S 30 47 38 55 L 75 55" 
        fill="none" 
        stroke="white" 
        strokeWidth="7" 
        strokeLinecap="round" 
      />
      {/* Arrow Head pointing right */}
      <polygon points="86,55 70,41 70,69" fill="white" stroke="white" strokeWidth="2" strokeLinejoin="round" />

      {/* 2) The Cart Base holding the arrow */}
      <path 
        d="M 44 58 L 47 73 C 48 77 52 80 56 80 L 80 80 C 84 80 88 77 89 73 L 95 47" 
        fill="none" 
        stroke="white" 
        strokeWidth="7" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

      {/* 3) The Wheels */}
      <circle cx="56" cy="94" r="7" fill="white" />
      <circle cx="80" cy="94" r="7" fill="white" />

    </svg>
  );
};
