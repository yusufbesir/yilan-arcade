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
  // Dış bağlantı: yalnız http/https (URL ayrıştırılarak), yeni pencere asla açılmaz
  const disHttp = (url) => { try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:'; } catch (e) { return false; } };
  win.webContents.setWindowOpenHandler(({ url }) => { if (disHttp(url)) shell.openExternal(url); return { action: 'deny' }; });
  // Gezinme: yalnız oyunun kendi index.html dosyasına (sorgu/çapa serbest), başka hiçbir yere
  const indexPath = path.join(__dirname, 'src', 'index.html');
  const kendiSayfasi = (url) => { try { const u = new URL(url); return u.protocol === 'file:' && path.resolve(decodeURIComponent(u.pathname.replace(/^\/([A-Za-z]:)/, '$1'))) === path.resolve(indexPath); } catch (e) { return false; } };
  win.webContents.on('will-navigate', (e, url) => { if (!kendiSayfasi(url)) e.preventDefault(); });
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());
  win.loadFile(indexPath);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
