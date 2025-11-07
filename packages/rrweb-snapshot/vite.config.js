import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { copyFileSync } from 'node:fs';
import { build as esbuild } from 'esbuild';
import { umdWrapper } from 'esbuild-plugin-umd-wrapper';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Build both main entry point and record-only entry point
export default defineConfig({
  build: {
    lib: {
      entry: {
        'rrweb-snapshot': path.resolve(__dirname, 'src/index.ts'),
        'rrweb-snapshot.record': path.resolve(__dirname, 'src/record.ts'),
      },
      name: 'rrwebSnapshot',
      formats: ['es', 'cjs'],
    },
    outDir: 'dist',
    emptyOutDir: !process.argv.includes('--watch'),
    minify: false,
    sourcemap: true,
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      entryRoot: 'src',
      afterBuild: (emittedFiles) => {
        const files = Array.from(emittedFiles.keys());
        files.forEach((file) => {
          // Create .d.cts files
          const ctsFile = file.replace('.d.ts', '.d.cts');
          copyFileSync(file, ctsFile);

          // Create index.d.ts and record.d.ts as aliases
          const fileName = file.split('/').pop();
          if (fileName === 'rrweb-snapshot.d.ts') {
            const indexPath = file.replace('rrweb-snapshot.d.ts', 'index.d.ts');
            copyFileSync(file, indexPath);
            copyFileSync(ctsFile, indexPath.replace('.d.ts', '.d.cts'));
          } else if (fileName === 'rrweb-snapshot.record.d.ts') {
            const recordPath = file.replace('rrweb-snapshot.record.d.ts', 'record.d.ts');
            copyFileSync(file, recordPath);
            copyFileSync(ctsFile, recordPath.replace('.d.ts', '.d.cts'));
          }
        });
      },
    }),
    visualizer({
      filename: resolve(__dirname, 'rrwebSnapshot-bundle-analysis.html'),
      open: false,
    }),
  ],
});
