import React from 'react';

const RestoreIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 3v5h5" />
    <path d="M21 12A9 9 0 0 0 6.44 6.44L3 10" />
    <path d="M21 21v-5h-5" />
    <path d="M3 12a9 9 0 0 0 14.56 5.56L21 14" />
  </svg>
);

export default RestoreIcon;
