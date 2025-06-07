import React from 'react';

const BrandLogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg" 
    {...props}
  >
    <path 
      d="M50 85C45 80 30 65 30 50C30 35 40 25 50 25C60 25 70 35 70 50C70 65 55 80 50 85Z" 
      transform="translate(0, -5)" // Adjust position slightly if needed
    />
    <path 
      d="M50 22C49.1758 22 48.3588 22.0656 47.5527 22.1944C38.2333 23.8101 32 31.9566 32 40.5C32 50.3117 40.8571 61.25 50 70C59.1429 61.25 68 50.3117 68 40.5C68 31.9566 61.7667 23.8101 52.4473 22.1944C51.6412 22.0656 50.8242 22 50 22Z" 
      fillOpacity="0.5" // Inner, slightly darker part to give some shape
      transform="translate(0, -5)"
    />
     {/* Simple 'B' like shape */}
    <path d="M40 30 H 50 Q 60 30 60 40 V 45 Q 60 55 50 55 H 40 V 65 H 55 Q 65 65 65 55 V 50 Q 65 40 55 30 H 40 Z" fill="rgba(255,255,255,0.1)" transform="translate(0, -5)"/>
  </svg>
);

export default BrandLogoIcon;
