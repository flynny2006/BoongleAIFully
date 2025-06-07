// SVGs for icons will be inlined for simplicity in the srcDoc
// In a real app, these might be separate components or fetched, but for srcDoc, inline is easiest.

const brandLogoSvg = `<svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="width: 100px; height: 100px; color: #718096;">
<path d="M50 85C45 80 30 65 30 50C30 35 40 25 50 25C60 25 70 35 70 50C70 65 55 80 50 85Z" transform="translate(0, -5)"/>
<path d="M50 22C49.1758 22 48.3588 22.0656 47.5527 22.1944C38.2333 23.8101 32 31.9566 32 40.5C32 50.3117 40.8571 61.25 50 70C59.1429 61.25 68 50.3117 68 40.5C68 31.9566 61.7667 23.8101 52.4473 22.1944C51.6412 22.0656 50.8242 22 50 22Z" fillOpacity="0.5" transform="translate(0, -5)"/>
<path d="M40 30 H 50 Q 60 30 60 40 V 45 Q 60 55 50 55 H 40 V 65 H 55 Q 65 65 65 55 V 50 Q 65 40 55 30 H 40 Z" fill="rgba(255,255,255,0.05)" transform="translate(0, -5)"/>
</svg>`;

const imageIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; margin-right: 8px; color: #a0aec0;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>`;
const previewIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; margin-right: 8px; color: #a0aec0;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>`;
const graduationCapIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; margin-right: 8px; color: #a0aec0;"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 4 3 6 3s6-1.34 6-3v-5" /><path d="M18.5 10.5V8M22 8h-3" /></svg>`;


export const getPreviewLoadingScreenHtml = (): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loading Preview</title>
  <style>
    body {
      background-color: #2d3748; /* gray-800 */
      color: #e2e8f0; /* gray-300 */
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      margin: 0;
      padding: 20px;
      text-align: center;
      overflow: hidden;
    }
    .logo-container {
      margin-bottom: 24px;
      animation: gentleBob 3s ease-in-out infinite;
    }
    @keyframes gentleBob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    .title {
      font-size: 1.5rem; /* 24px */
      font-weight: 600;
      color: #f7fafc; /* gray-100 */
      margin-bottom: 32px; /* 8 * 4px */
    }
    .features {
      list-style: none;
      padding: 0;
      max-width: 350px;
    }
    .feature-item {
      display: flex;
      align-items: center;
      font-size: 0.875rem; /* 14px */
      color: #a0aec0; /* gray-500 */
      margin-bottom: 12px;
      text-align: left;
    }
    .feature-item svg {
      flex-shrink: 0; /* Prevent icon from shrinking */
    }
  </style>
</head>
<body>
  <div class="logo-container">
    ${brandLogoSvg}
  </div>
  <h1 class="title">Spinning up preview...</h1>
  <ul class="features">
    <li class="feature-item">
      ${imageIconSvg}
      <span>Upload images as a reference</span>
    </li>
    <li class="feature-item">
      ${previewIconSvg}
      <span>Instantly preview your changes</span>
    </li>
    <li class="feature-item">
      ${graduationCapIconSvg}
      <span>Set custom knowledge for every edit</span>
    </li>
  </ul>
</body>
</html>
`;
