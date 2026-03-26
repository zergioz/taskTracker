const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Store = require('electron-store')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

const store = new Store()

ipcMain.handle('store:get', (_event: unknown, key: string) => {
  return store.get(key)
})

ipcMain.handle('store:set', (_event: unknown, key: string, value: unknown) => {
  store.set(key, value)
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
