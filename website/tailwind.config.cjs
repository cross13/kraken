/** @type {import('tailwindcss').Config} */
// Signal — the app's brand palette, mirrored from the desktop app's
// `src/styles.css` (`:root[data-theme='signal']`). Three base colours: green
// #76B900, brand grey #1E1E1E (never pure black) and white. Two accents with
// ONE role each: green = execute & progress, violet = agent, wait & decide.
// Radius 0, no shadows; hierarchy is a lighter grey plus a 1px border.
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    // Radius 0 is the brand, not a default to extend. Even the status dots are
    // squares — the whole form comes from straight 1px borders.
    borderRadius: {
      none: '0px',
      sm: '0px',
      DEFAULT: '0px',
      md: '0px',
      lg: '0px',
      xl: '0px',
      '2xl': '0px',
      '3xl': '0px',
      full: '0px',
    },
    extend: {
      colors: {
        // surfaces
        rail: '#1A1A1A',
        bg: '#1E1E1E',
        panel: '#232323',
        card: '#2A2A2A',
        raised: '#262626',
        elev: '#333333',
        line: '#393939',
        // text — #A8A8A8 is the contrast floor
        ink: {
          600: '#848484',
          500: '#A8A8A8',
          400: '#B4B4B4',
          300: '#C8C8C8',
          200: '#ECECEC',
          100: '#F2F2F2',
          50: '#FAFAFA',
        },
        // green — execute & progress. #76B900 is 2.41:1 on white: FILL ONLY.
        accent: {
          DEFAULT: '#76B900',
          hi: '#8AD000',
          text: '#A6E62E',
          num: '#C4F06A',
          fg: '#0F1400',
        },
        // violet — agent, wait & decide. Never on a control that executes work.
        agent: {
          DEFAULT: '#9B6BFF',
          hi: '#B28BFF',
          text: '#C9A9FF',
          tint: '#2A2140',
          fg: '#12081F',
        },
        danger: { DEFAULT: '#E0533C', text: '#FF8A72' },
      },
      fontFamily: {
        // Space Grotesk is a DISPLAY face — headings and figures only.
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        // The palette allows no shadows. What was a glow becomes the one halo
        // it does permit: a 50% accent hairline.
        glow: '0 0 0 1px rgba(118,185,0,0.5)',
        agent: '0 0 0 1px rgba(155,107,255,0.5)',
      },
      transitionDuration: {
        // Hover 120ms, progress bars 250ms — the palette's rhythm.
        DEFAULT: '120ms',
        bar: '250ms',
      },
      keyframes: {
        dash: { to: { strokeDashoffset: '-16' } },
        sweep: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } },
        blink: { '0%,92%,100%': { opacity: '1' }, '95%': { opacity: '0.15' } },
      },
      animation: {
        sweep: 'sweep 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        blink: 'blink 4.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
