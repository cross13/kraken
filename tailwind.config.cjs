/** @type {import('tailwindcss').Config} */

// Every colour is backed by a CSS variable holding space-separated RGB channels
// (e.g. `--bg: 8 8 12`) so Tailwind's `/opacity` modifiers keep working
// (`rgb(var(--bg) / <alpha-value>)`) AND the whole app re-themes by swapping the
// variables on `<html data-theme>`. The channel values live in src/styles.css.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral scale — remapped onto the design's themed surfaces. Existing
        // components reference these names; they now follow the active theme.
        ink: {
          50: v('--ink-50'),
          100: v('--ink-100'),
          200: v('--ink-200'),
          300: v('--dim'),
          400: v('--ink-400'),
          500: v('--faint'),
          600: v('--ink-600'),
          700: v('--line'),
          800: v('--elev'),
          850: v('--card'),
          900: v('--panel'),
          950: v('--bg'),
        },
        accent: {
          DEFAULT: v('--accent'),
          2: v('--accent2'),
          fg: v('--accent-fg'),
          muted: 'rgb(var(--accent) / 0.16)',
        },
        // Semantic design tokens (new) — also themed.
        card: v('--card'),
        elev: v('--elev'),
        rail: v('--rail'),
        panel: v('--panel'),
        dim: v('--dim'),
        faint: v('--faint'),
        good: v('--good'),
        ok: v('--good'),
        warn: v('--warn'),
        danger: v('--danger'),
        bad: v('--danger'),
      },
      fontFamily: {
        sans: ['Hanken Grotesk', 'Geist', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Space Grotesk', 'Hanken Grotesk', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.04)',
        glow: '0 0 0 1px rgb(var(--accent) / 0.4), 0 0 40px -10px rgb(var(--accent) / 0.6)',
        card: '0 12px 34px rgba(0,0,0,0.34)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 200ms ease-out',
        rise: 'rise 0.18s ease both',
        ping2: 'ping2 1.8s ease-out infinite',
        float: 'float 3.5s ease-in-out infinite',
        bar: 'bar 1.4s ease-in-out infinite',
        blink: 'blink 1.6s ease-in-out infinite',
        // Mission Control: shimmering progress fill + a steady status pulse.
        flow: 'flow 1.2s linear infinite',
        'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        ping2: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '80%,100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        bar: {
          '0%': { transform: 'scaleX(0.15)' },
          '50%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0.15)' },
        },
        blink: {
          '0%,100%': { opacity: '0.9' },
          '50%': { opacity: '0.4' },
        },
        flow: {
          to: { backgroundPosition: '-200% 0' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
    },
  },
  plugins: [],
};
