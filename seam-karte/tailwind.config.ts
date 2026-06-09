import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: 'var(--obsidian)',
        ivory: 'var(--ivory)',
        'ivory-deep': 'var(--ivory-deep)',
        champagne: 'var(--champagne)',
        'champagne-deep': 'var(--champagne-deep)',
        smoke: 'var(--smoke)',
        line: 'var(--line)',
        paper: 'var(--paper)',
        crit: 'var(--crit)',
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'serif'],
        mincho: ['var(--font-shippori)', 'serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      maxWidth: {
        stage: '520px',
      },
      transitionTimingFunction: {
        seam: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
