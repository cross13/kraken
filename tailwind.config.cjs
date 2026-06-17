/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d9e3',
          300: '#aab3c4',
          400: '#7c879e',
          500: '#5b6781',
          600: '#475168',
          700: '#3a4257',
          800: '#252b3a',
          900: '#171b26',
          950: '#0c0e16',
        },
        accent: {
          DEFAULT: '#7c5cff',
          fg: '#ffffff',
          muted: '#231c45',
        },
        ok: '#3ecf8e',
        warn: '#f5a524',
        bad: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.04)',
        glow: '0 0 0 1px rgba(124,92,255,0.4), 0 0 40px -10px rgba(124,92,255,0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
