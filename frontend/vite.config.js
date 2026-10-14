import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app will be mounted at https://aarkay.tech/url/ by the existing Vercel project.
export default defineConfig({
  base: '/url/',
  plugins: [react()],
});
