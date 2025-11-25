import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { copyFileSync } from 'node:fs';
import { build as esbuild } from 'esbuild';
import { umdWrapper } from 'esbuild-plugin-umd-wrapper';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// don't empty out dir if --watch flag is passed
const emptyOutDir = !process.argv.includes('--watch');

// Plugin to generate UMD bundles using esbuild after vite build
function umdPlugin({ outDir }) {
  return {
    name: 'umd-plugin',
    async writeBundle(outputOptions, bundle) {
      for (const file of Object.values(bundle)) {
        if (
          file.type === 'asset' &&
          (file.fileName.endsWith('.cjs.map') || file.fileName.endsWith('.css'))
        ) {
          const isCSS = file.fileName.endsWith('.css');
          const inputFilePath = resolve(
            outputOptions.dir,
            file.fileName,
          ).replace(/\.map$/, '');
          const baseFileName = file.fileName.replace(/(\.cjs|\.css)(\.map)?$/, '');
          const outputFilePath = resolve(outputOptions.dir, baseFileName);

          // Determine library name based on filename
          let libraryName = 'rrweb';
          if (baseFileName.includes('rrweb-record')) {
            libraryName = 'rrwebRecord';
          } else if (baseFileName.includes('rrweb-replay')) {
            libraryName = 'rrwebReplay';
          }

          if (isCSS) {
            await esbuild({
              entryPoints: [inputFilePath],
              outfile: `${outputFilePath}.min.css`,
              minify: true,
              sourcemap: true,
            });
            console.log(`${outDir}/${baseFileName}.min.css`);
            console.log(`${outDir}/${baseFileName}.min.css.map`);
          } else {
            await esbuild({
              entryPoints: [inputFilePath],
              outfile: `${outputFilePath}.umd.cjs`,
              minify: false,
              sourcemap: true,
              format: 'umd',
              target: 'es2017',
              treeShaking: true,
              bundle: true,
              plugins: [
                umdWrapper({
                  libraryName: libraryName,
                }),
              ],
            });

            await esbuild({
              entryPoints: [inputFilePath],
              outfile: `${outputFilePath}.umd.min.cjs`,
              minify: true,
              sourcemap: true,
              format: 'umd',
              target: 'es2017',
              treeShaking: true,
              bundle: true,
              plugins: [
                umdWrapper({
                  libraryName: libraryName,
                }),
              ],
            });

            console.log(`${outDir}/${baseFileName}.umd.cjs`);
            console.log(`${outDir}/${baseFileName}.umd.cjs.map`);
            console.log(`${outDir}/${baseFileName}.umd.min.cjs`);
            console.log(`${outDir}/${baseFileName}.umd.min.cjs.map`);
          }
        }
      }
    },
  };
}

export default defineConfig({
  build: {
    lib: {
      entry: {
        'rrweb': path.resolve(__dirname, 'src/index.ts'),
        'rrweb-record': path.resolve(__dirname, 'src/entries/record.ts'),
        'rrweb-replay': path.resolve(__dirname, 'src/entries/replay.ts'),
      },
      cssFileName: 'style',
      formats: ['es', 'cjs'],
    },
    outDir: 'dist',
    sourcemap: true,
    minify: false,
    emptyOutDir,
    rollupOptions: {
      // Mark rrweb-snapshot sub-paths as external so tree-shaking happens at consumer level
      external: [
        '@posthog/rrweb-snapshot',
        '@posthog/rrweb-snapshot/record',
        '@posthog/rrweb-snapshot/replay',
        '@posthog/rrweb-types',
        '@posthog/rrweb-utils',
        '@posthog/rrdom',
      ],
      output: {
        globals: {
          '@posthog/rrweb-snapshot': 'rrwebSnapshot',
          '@posthog/rrweb-snapshot/record': 'rrwebSnapshotRecord',
          '@posthog/rrweb-snapshot/replay': 'rrwebSnapshotReplay',
          '@posthog/rrweb-types': 'rrwebTypes',
          '@posthog/rrweb-utils': 'rrwebUtils',
          '@posthog/rrdom': 'rrdom',
        },
      },
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      afterBuild: (emittedFiles) => {
        const files = Array.from(emittedFiles.keys());
        files.forEach((file) => {
          const ctsFile = file.replace('.d.ts', '.d.cts');
          copyFileSync(file, ctsFile);
        });
      },
    }),
    umdPlugin({ outDir: 'dist' }),
    visualizer({
      filename: resolve(__dirname, 'rrweb-bundle-analysis.html'),
      open: false,
    }),
    {
      name: 'move-worker-sourcemap',
      generateBundle(options, bundle) {
        Object.entries(bundle).forEach(([fileName, output]) => {
          if (fileName.includes('worker') && fileName.endsWith('.map')) {
            console.log('Moving worker sourcemap:', fileName);
            const newFileName = fileName.replace('assets/', '');
            bundle[newFileName] = output;
            output.fileName = newFileName;
            delete bundle[fileName];
          }
        });
      }
    }
  ],
});
