import React from 'react';

const ReloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M21.5 2v6h-6M2.5 22v-6h6" />
    <path d="M22 11.5A10 10 0 0 1 12 22a10 10 0 0 1-10-10.5c0-5.25 3.75-9.71 8.59-10.43" />
    <path d="M2 12.5a10 10 0 0 1 10-10.5c5.523 0 10 4.477 10 10a10 10 0 0 1-8.59 10.43" />
  </svg>
);

export default ReloadIcon;