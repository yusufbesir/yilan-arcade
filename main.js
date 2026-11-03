const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Eski "Yilan Arcade" verisi (rekor, ilerleme) yeni ürün adına taşınır; ilk açılışta tek sefer kopyalanır.
try {
  const newDir = app.getPath('userData');
  const oldDir = path.join(path.dirname(newDir), 'Yilan Arcade');
  if (!fs.existsSync(newDir) && fs.existsSync(oldDir)) fs.cpSync(oldDir, newDir, { recursive: true });
} catch (e) { /* taşıma başarısızsa oyun sıfır veriyle açılır */ }

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
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
