import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Absolute base: the guides live two levels deep (/es/guides/<id>), and a
  // relative base resolves ./assets against that path on a deep-link reload.
  // The site is served from the domain root by nginx (see nginx.conf).
  base: '/',
  // The guides are shared with the desktop app and live at the repo root.
  server: { fs: { allow: ['..'] } },
});
