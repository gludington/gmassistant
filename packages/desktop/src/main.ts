import { app as electronApp, BrowserWindow, dialog, ipcMain, Menu, session } from 'electron';
import { join } from 'node:path';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { migrate } from 'drizzle-orm/libsql/migrator';

// Allow YouTube iframe to autoplay when triggered programmatically — without
// this, Chromium blocks playback because the gesture is in the main frame,
// not the cross-origin iframe, so YouTube sees no user gesture.
electronApp.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Set data paths before any backend module initialises
const isDev = !electronApp.isPackaged;
const userData = electronApp.getPath('userData');
process.env.DATABASE_URL = `file:${join(userData, 'gmassisstant.db')}`;
process.env.UPLOADS_BASE_DIR = join(userData, 'uploads');
if (!isDev) {
  // Backend serves the pre-built frontend so all traffic (HTML, assets, API)
  // shares one HTTP origin — history routing works, no file:// mismatch.
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

async function createWindow(port: number) {
  const iconPath = isDev
    ? join(__dirname, '../../assets/icon.png')
    : join(process.resourcesPath, 'icon.png');

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    icon: iconPath,
    title: 'GM Assistant',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // Use 127.0.0.1 directly — avoids localhost DNS ambiguity (IPv4 vs IPv6)
    // and bypasses the need for a protocol interceptor entirely, since Hono
    // now serves the frontend, API, and uploads all from the same origin.
    await win.loadURL(`http://127.0.0.1:${port}/`);
  }

  return win;
}

Menu.setApplicationMenu(null);

ipcMain.on('set-fullscreen', (event, flag: boolean) => {
  BrowserWindow.fromWebContents(event.sender)?.setFullScreen(flag);
});

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
