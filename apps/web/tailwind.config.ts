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
        cairo: ['var(--font-cairo)', 'Cairo', 'sans-serif'],
      },
      colors: {
        teal: {
          DEFAULT: '#0D7A7A',
          50: '#E6F5F5',
          100: '#CCEbEB',
          200: '#99D7D7',
          300: '#66C3C3',
          400: '#33AFAF',
          500: '#0D7A7A',
          600: '#0A6262',
          700: '#084A4A',
          800: '#053131',
          900: '#031919',
        },
        navy: {
          DEFAULT: '#1A2F4A',
          50: '#E8EBF0',
          100: '#D1D7E1',
          200: '#A3AFC3',
          300: '#7587A5',
          400: '#475F87',
          500: '#1A2F4A',
          600: '#15263B',
          700: '#101C2C',
          800: '#0A131E',
          900: '#05090F',
        },
      },
    },
  },
  plugins: [rtlPlugin],
};

export default config;
