const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Fix for "Failed to Fetch" / SSL errors due to incorrect system time
app.commandLine.appendSwitch('ignore-certificate-errors');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        backgroundColor: '#0d0d0d',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.ico')
    });
    // In production, index.html is in resources folder
    // In development, it's in parent directory
    const indexPath = app.isPackaged
        ? path.join(process.resourcesPath, 'index.html')
        : path.join(__dirname, '..', 'index.html');

    mainWindow.loadFile(indexPath);

    // Open DevTools in development
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    // Window controls
    ipcMain.on('window-minimize', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('window-maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on('window-close', () => {
        if (mainWindow) mainWindow.close();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
