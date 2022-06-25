const path = require('path');
const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'BidiRpc',
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {},
  },
});
