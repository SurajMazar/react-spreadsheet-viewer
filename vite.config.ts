import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';

  return {
    plugins: [
      react({
        jsxRuntime: 'classic',
      }),
      isLib && dts({
        include: ['src/lib/**/*.ts', 'src/lib/**/*.tsx'],
        outDir: 'dist/types',
        rollupTypes: true,
      }),
    ].filter(Boolean),
    build: isLib
      ? {
          lib: {
            entry: resolve(__dirname, 'src/lib/index.ts'),
            formats: ['es'],
            fileName: 'sheet-viewer',
          },
          rollupOptions: {
            external: (id: string) =>
              /^react($|\/)/.test(id) || /^react-dom($|\/)/.test(id),
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
      server: {
        deps: {
          // Force react-chartjs-2 through Vite's transform pipeline
          // so React 17's CJS jsx-runtime can be resolved properly
          inline: ['react-chartjs-2'],
        },
      },
    },
  };
});
