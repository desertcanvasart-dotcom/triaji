import type { Config } from 'tailwindcss';
import rtlPlugin from 'tailwindcss-rtl';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      colors: {
        teal: {
          DEFAULT: '#0D7A7A',
          500: '#0D7A7A',
          600: '#0A6262',
          700: '#084A4A',
        },
        navy: {
          DEFAULT: '#1A2F4A',
          500: '#1A2F4A',
          600: '#15263B',
          700: '#101C2C',
        },
      },
    },
  },
  plugins: [rtlPlugin],
};

export default config;
