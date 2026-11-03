const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// Eski ürün adlarının verisi ilk açılışta tek sefer kopyalanır (bkz. migrate.js).
const { migrateUserData } = require('./migrate.js');
try { migrateUserData(app.getPath('userData'), path.dirname(app.getPath('userData'))); } catch (e) { /* taşıma başarısızsa oyun sıfır veriyle açılır */ }

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    minWidth: 480,
    minHeight: 520,
    title: 'Twilight of the Serpents',
    backgroundColor: '#0a1220',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged }
  });
  Menu.setApplicationMenu(null);
  win.webContents.session.setPermissionRequestHandler((wc, permission, cb) => cb(false));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
