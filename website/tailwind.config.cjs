/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // App palette (kept in sync with the Electron app's tailwind.config.cjs)
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
          975: '#070810',
        },
        accent: {
          DEFAULT: '#7c5cff',
          fg: '#ffffff',
          muted: '#231c45',
        },
        // Bioluminescent secondary for the abyssal theme
        glowcyan: {
          DEFAULT: '#39e0e6',
          deep: '#1aa6c9',
        },
        ok: '#3ecf8e',
        warn: '#f5a524',
        bad: '#ef4444',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,92,255,0.4), 0 0 60px -10px rgba(124,92,255,0.55)',
        glowcyan: '0 0 0 1px rgba(57,224,230,0.35), 0 0 50px -12px rgba(57,224,230,0.5)',
        deep: '0 30px 80px -20px rgba(0,0,0,0.8)',
      },
      keyframes: {
        drift: {
          '0%,100%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(-22px) translateX(10px)' },
        },
        pulseGlow: {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        dash: {
          to: { strokeDashoffset: '-16' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        drift: 'drift 14s ease-in-out infinite',
        pulseGlow: 'pulseGlow 4s ease-in-out infinite',
        floaty: 'floaty 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
