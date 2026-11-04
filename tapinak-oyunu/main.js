const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100, height: 760, minWidth: 640, minHeight: 440, title: 'Köz Tapınağı', backgroundColor: '#05030a', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged }
  });
  Menu.setApplicationMenu(null);
  win.webContents.session.setPermissionRequestHandler((wc, p, cb) => cb(false));
  const indexPath = path.join(__dirname, 'index.html');
  const kendi = (url) => { try { const u = new URL(url); return u.protocol === 'file:' && path.resolve(decodeURIComponent(u.pathname.replace(/^\/([A-Za-z]:)/, '$1'))) === path.resolve(indexPath); } catch (e) { return false; } };
  win.webContents.setWindowOpenHandler(({ url }) => { try { const u = new URL(url); if (u.protocol === 'https:') shell.openExternal(url); } catch (e) { /* yok say */ } return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!kendi(url)) e.preventDefault(); });
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());
  win.loadFile(indexPath);
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
