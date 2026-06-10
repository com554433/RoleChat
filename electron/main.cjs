const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    title: 'RoleChat - 二次元角色扮演',
    icon: path.join(__dirname, '..', 'public', 'favicon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true,
    autoHideMenuBar: true,
  });

  // 授权 clipboard-read 权限，允许 navigator.clipboard.readText()
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') {
        callback(true);
      } else {
        callback(false);
      }
    },
  );

  // 加载构建产物
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(distPath);

  // 禁止导航到外部，但在默认浏览器打开链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
