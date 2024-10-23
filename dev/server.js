
import { createServer } from 'vite';
import express from 'express';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 4000;
async function dev_server() {

  const app = express();

  // Create Vite server in middleware mode
  const vite = await createServer({
    server: {
      middlewareMode: true,
      proxy: {},
      watch: {
        // Add custom paths to watch for full page refreshes
        additionalPaths: (watcher) => {
          watcher.add(resolve(__dirname, '../src/**'));
        }
      }
    },
    appType: 'custom' // don't include Vite's default HTML handling middlewares
  });

  app.get('/', async (req, res, next) => {
    try {
      let template = readFileSync(resolve(__dirname, './index.dev.html'), 'utf-8');
      // template = template.replace('<!--COMPONENTS-->', components);
      template = await vite.transformIndexHtml(req.originalUrl, template)

      // build

      res.status(200)
        .set({ 'Content-Type': 'text/html' })
        .end(template)

    } catch (err) {
      console.error(err);
      // If an error is caught, let Vite fix the stack trace so it maps back
      // to your actual source code.
      vite.ssrFixStacktrace(err);
      next(err);
    }
  });

  app.use('/src/script', express.static(resolve(__dirname, '../src/script')))
  app.use('/app', express.static(resolve(__dirname, '../src/app')))
  app.use('/module', express.static(resolve(__dirname, '../src/module.js')))

  app.use(vite.middlewares);

  app.listen(PORT, () => {
    console.log(`Started on port http://localhost:${PORT}`);
  });

}

dev_server()