const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../public/logo.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simple local apps this is often easier, though less secure. 
            // For a production app with external content, we'd want contextIsolation: true and a preload script.
            // Given we are loading local HTML files, we might need node integration if we were doing file system ops directly,
            // but our React app uses 'idb' which is browser-native.
            // However, to be safe and standard, let's stick to defaults where possible, but for this specific request
            // of a "local exe", we often want to be able to access local files easily.
            // Let's start with standard web preferences.
        },
    });

    // In development, load from the Vite dev server
    // In production, load the index.html file
    const isDev = !app.isPackaged;

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.setMenuBarVisibility(false); // Hide default menu bar for cleaner look
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
