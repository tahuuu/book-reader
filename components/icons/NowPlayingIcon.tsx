import React from 'react';

export const NowPlayingIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <style>
      {`
        .bar {
          animation: sound 0.8s linear infinite alternate;
          transform-origin: bottom;
        }
        .bar1 { animation-duration: 0.5s; animation-delay: -0.2s; }
        .bar2 { animation-duration: 0.3s; animation-delay: -0.5s; }
        .bar3 { animation-duration: 0.4s; animation-delay: -0.1s; }
        .bar4 { animation-duration: 0.6s; animation-delay: -0.3s; }
        
        @keyframes sound {
          0% { transform: scaleY(0.2); }
          100% { transform: scaleY(1); }
        }
      `}
    </style>
    <path className="bar bar1" d="M6 18V6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path className="bar bar2" d="M10 18V6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path className="bar bar3" d="M14 18V6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path className="bar bar4" d="M18 18V6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
