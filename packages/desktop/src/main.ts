import { app as electronApp, BrowserWindow, dialog, protocol, net, session } from 'electron';
import { join, dirname } from 'node:path';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { migrate } from 'drizzle-orm/libsql/migrator';

// Set data paths before any backend module initialises
const isDev = !electronApp.isPackaged;
const userData = electronApp.getPath('userData');
process.env.DATABASE_URL = `file:${join(userData, 'gmassisstant.db')}`;
process.env.UPLOADS_BASE_DIR = join(userData, 'uploads');
if (!isDev) {
  // Tells the backend to serve the pre-built frontend over HTTP so history
  // routing works and all requests share one origin (no file:// mismatch).
  process.env.ELECTRON_FRONTEND_DIR = join(process.resourcesPath, 'frontend');
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as AddressInfo;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function startBackend(): Promise<number> {
  const [{ app: honoApp }, { db }] = await Promise.all([
    import('@gmassisstant/backend') as Promise<{ app: { fetch: (r: Request) => Promise<Response> } }>,
    import('@gmassisstant/backend/db') as unknown as Promise<{ db: Parameters<typeof migrate>[0] }>,
  ]);

  await migrate(db, {
    migrationsFolder: isDev
      ? join(__dirname, '../../backend/drizzle')
      : join(process.resourcesPath, 'drizzle'),
  });

  const port = isDev ? 3000 : await getFreePort();
  process.env.PORT = String(port);

  await new Promise<void>((resolve) => {
    serve({ fetch: honoApp.fetch, port }, () => {
      console.log(`[desktop] Hono on port ${port}`);
      resolve();
    });
  });

  return port;
}

function registerProtocolInterceptor(port: number) {
  protocol.handle('http', (request) => {
    const url = new URL(request.url);
    if (
      url.hostname === 'localhost' &&
      (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads'))
    ) {
      const target = `http://127.0.0.1:${port}${url.pathname}${url.search}`;
      return net.fetch(target, {
        method: request.method,
        headers: request.headers,
        body: request.body ?? undefined,
      } as Parameters<typeof net.fetch>[1]);
    }
    return net.fetch(request);
  });
}

async function createWindow(port: number) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    await win.loadURL(`http://localhost:${port}/`);
  }

  return win;
}

electronApp.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const host = new URL(details.url).hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; " +
                'frame-src https://www.youtube.com https://www.youtube-nocookie.com;',
            ],
          },
        });
      } else {
        callback({ responseHeaders: details.responseHeaders });
      }
    });

    const port = await startBackend();

    if (!isDev) {
      registerProtocolInterceptor(port);
    }

    await createWindow(port);

    electronApp.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow(port);
      }
    });
  } catch (err) {
    dialog.showErrorBox(
      'GM Assistant — Startup Error',
      `Failed to start:\n\n${err instanceof Error ? err.message : String(err)}`,
    );
    electronApp.quit();
  }
});

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') electronApp.quit();
});
