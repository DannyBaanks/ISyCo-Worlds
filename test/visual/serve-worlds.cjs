// Development-only: the real App rendered with inert IPC and no agent bootstrap.
const path = require('node:path');
const { createServer } = require('vite');
const root = path.resolve(__dirname, '../..');
(async () => {
  const server = await createServer({
    configFile: false, root,
    plugins: [{name: 'inert-visual-bootstrap', enforce: 'pre', load(id) {
      if (id.endsWith('/hooks/useHive.ts')) return 'export function useHive() {}';
      if (id.endsWith('/store/mockEvents.ts')) return 'export function startMockLoop() {} export function stopMockLoop() {}';
    }}],
    resolve: { alias: { '@': path.join(root, 'src/renderer/src'), '@shared': path.join(root, 'src/shared'), '@brand': path.join(root, 'docs') } },
    esbuild: { jsx: 'automatic' }, define: { __APP_VERSION__: JSON.stringify('0.5.2-ISyCo.2') },
    server: { host: '127.0.0.1', port: 5199, strictPort: true }
  });
  await server.listen(); console.log('Visual fixture: http://127.0.0.1:5199/test/visual/worlds.html');
})();
