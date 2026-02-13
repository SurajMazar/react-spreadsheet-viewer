import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';

  return {
    plugins: [react()],
    build: isLib
      ? {
          lib: {
            entry: resolve(__dirname, 'src/lib/index.ts'),
            formats: ['es'],
            fileName: 'sheet-viewer',
          },
          rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime'],
            output: {
              globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
              },
            },
          },
          cssFileName: 'sheet-viewer',
        }
      : {
          rollupOptions: {
            output: {
              manualChunks: {
                xlsx: ['xlsx'],
                chartjs: ['chart.js', 'react-chartjs-2'],
                'react-vendor': ['react', 'react-dom'],
              },
            },
          },
          chunkSizeWarningLimit: 600,
        },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './vitest.setup.ts',
    },
  };
});
