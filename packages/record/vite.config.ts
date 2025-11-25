import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { copyFileSync } from 'node:fs';
import { build as esbuild } from 'esbuild';
import { umdWrapper } from 'esbuild-plugin-umd-wrapper';
import { resolve } from 'path';

// don't empty out dir if --watch flag is passed
const emptyOutDir = !process.argv.includes('--watch');

// Plugin to generate UMD bundles using esbuild after vite build
function umdPlugin({ outDir }: { outDir: string }) {
  return {
    name: 'umd-plugin',
    async writeBundle(
      outputOptions: { dir?: string },
      bundle: Record<string, { type: string; fileName: string }>,
    ) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.cjs.map')) {
          const inputFilePath = resolve(
            outputOptions.dir!,
            file.fileName,
          ).replace(/\.map$/, '');
          const baseFileName = file.fileName.replace(/(\.cjs)(\.map)?$/, '');
          const outputFilePath = resolve(outputOptions.dir!, baseFileName);

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
                libraryName: 'rrwebRecord',
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
                libraryName: 'rrwebRecord',
              }),
            ],
          });

          console.log(`${outDir}/${baseFileName}.umd.cjs`);
          console.log(`${outDir}/${baseFileName}.umd.cjs.map`);
          console.log(`${outDir}/${baseFileName}.umd.min.cjs`);
          console.log(`${outDir}/${baseFileName}.umd.min.cjs.map`);
        }
      }
    },
  };
}

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'rrwebRecord',
      fileName: 'rrweb-record',
      formats: ['es', 'cjs'],
    },
    outDir: 'dist',
    sourcemap: true,
    minify: false,
    emptyOutDir,
    rollupOptions: {
      // Keep @posthog packages as external dependencies
      external: [
        '@posthog/rrweb',
        '@posthog/rrweb/record',
        '@posthog/rrweb-types',
        '@posthog/rrweb-utils',
      ],
      output: {
        globals: {
          '@posthog/rrweb': 'rrweb',
          '@posthog/rrweb/record': 'rrwebRecord',
          '@posthog/rrweb-types': 'rrwebTypes',
          '@posthog/rrweb-utils': 'rrwebUtils',
        },
      },
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      afterBuild: (emittedFiles: Map<string, string>) => {
        const files = Array.from(emittedFiles.keys());
        files.forEach((file) => {
          const ctsFile = file.replace('.d.ts', '.d.cts');
          copyFileSync(file, ctsFile);
        });
      },
    }),
    umdPlugin({ outDir: 'dist' }),
  ],
});
