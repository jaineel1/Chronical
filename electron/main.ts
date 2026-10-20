/**
 * Chronicle for Windows: the built web app (dist/) in its own window, served from app://chronicle so
 * IndexedDB, localStorage and the GitHub sync work as on any secure origin. The player's data lives in
 * %APPDATA%\Chronicle and survives updates. Updates come from this repo's GitHub Releases, published by
 * .github/workflows/desktop.yml on every push to main.
 */
import { app, BrowserWindow, dialog, net, protocol, shell } from 'electron';
import updater from 'electron-updater';
import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const { autoUpdater } = updater;

const SCHEME = 'app';
const ORIGIN = `${SCHEME}://chronicle`;
const ROOT = join(__dirname, '..', 'dist');
const UPDATE_EVERY_MS = 6 * 60 * 60 * 1000;

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let win: BrowserWindow | null = null;

function isWebUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

function serveApp(): void {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const file = normalize(join(ROOT, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
    if (!file.startsWith(ROOT + sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    title: 'Chronicle',
    backgroundColor: '#ebe3d4',
    icon: join(ROOT, 'icons', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // Claude, GitHub and every other outside link open in the default browser, never inside the app.
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${ORIGIN}/`)) return;
    event.preventDefault();
    if (isWebUrl(url)) void shell.openExternal(url);
  });
  void w.loadURL(`${ORIGIN}/index.html`);
  return w;
}

function watchForUpdates(): void {
  // Only an installed build updates; `npm run desktop` runs the working copy.
  if (!app.isPackaged) return;
  autoUpdater.on('update-downloaded', async (info) => {
    const options = {
      type: 'info' as const,
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Chronicle ${info.version} is ready.`,
      detail: 'Restart to use it. With Later, it installs the next time you close Chronicle.',
    };
    const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
    if (response === 0) autoUpdater.quitAndInstall();
  });
  // Offline is normal for a laptop: say nothing then. Any other failure is shown.
  autoUpdater.on('error', (error) => {
    if (net.isOnline()) dialog.showErrorBox('Chronicle could not check for updates', error.message);
  });
  const check = () => {
    // Failures arrive through the 'error' event above.
    autoUpdater.checkForUpdates().catch(() => undefined);
  };
  check();
  setInterval(check, UPDATE_EVERY_MS);
}

// One Chronicle at a time: two windows writing the same database would race each other.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  void app.whenReady().then(() => {
    serveApp();
    win = createWindow();
    win.on('closed', () => {
      win = null;
    });
    watchForUpdates();
  });
  app.on('window-all-closed', () => app.quit());
}
