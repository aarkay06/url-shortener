import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app will be mounted at https://url.aarkay.tech
export default defineConfig({
  base: '/',
  plugins: [react()],
});
