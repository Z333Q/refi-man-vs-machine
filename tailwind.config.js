/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'terminal-black': '#050806',
        'terminal-deep': '#08110D',
        'terminal-panel': '#0C1712',
        'phosphor-dim': '#27634E',
        'phosphor-mid': '#0A8F68',
        'phosphor': '#0CD4A0',
        'phosphor-hot': '#79FFD7',
        'paper-green': '#B8FFD9',
        'terminal-white': '#D8EEE5',
        'risk-red': '#D94C4C',
        'alert-amber': '#D6A647',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        terminal: '2px',
        panel: '3px',
      },
      boxShadow: {
        phosphor: '0 0 4px rgba(12,212,160,.22), 0 0 12px rgba(12,212,160,.08)',
        'phosphor-strong': '0 0 6px rgba(12,212,160,.32), 0 0 18px rgba(12,212,160,.12)',
      },
      animation: {
        cursor: 'cursorBlink 1s steps(1,end) infinite',
        scan: 'scanMove 8s linear infinite',
        interference: 'interference 140ms steps(2,end) 1',
        'boot-fade': 'bootFade 0.3s ease-in forwards',
      },
      keyframes: {
        cursorBlink: {
          '0%,49%': { opacity: '1' },
          '50%,100%': { opacity: '0' },
        },
        scanMove: {
          '0%': { backgroundPositionY: '0px' },
          '100%': { backgroundPositionY: '4px' },
        },
        interference: {
          '0%': { transform: 'translateX(0)', filter: 'none' },
          '33%': { transform: 'translateX(-1px)', filter: 'contrast(1.05)' },
          '66%': { transform: 'translateX(1px)', filter: 'contrast(.98)' },
          '100%': { transform: 'translateX(0)', filter: 'none' },
        },
        bootFade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
