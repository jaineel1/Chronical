import { defineConfig } from 'vite';

// Bundles the Electron main process, electron-updater included, into one CommonJS file so the
// installer needs no node_modules. The renderer is the normal web build in dist/.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'electron/main.ts',
    outDir: 'dist-electron',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: {
      external: ['electron'],
      output: { format: 'cjs', entryFileNames: 'main.cjs' },
    },
  },
  ssr: { noExternal: true },
});
