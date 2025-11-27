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

// Auto-updater logic
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { dialog, shell } = require('electron');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Disable auto-download for macOS to handle it manually (notification only)
// For Windows, we keep it true (default)
if (process.platform === 'darwin') {
    autoUpdater.autoDownload = false;
}

function checkForUpdates() {
    if (!app.isPackaged) return;

    log.info('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
}

autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);

    if (process.platform === 'darwin') {
        dialog.showMessageBox({
            type: 'info',
            title: 'Actualización disponible',
            message: `Una nueva versión (${info.version}) está disponible.`,
            detail: '¿Quieres descargarla ahora desde GitHub?',
            buttons: ['Sí, descargar', 'Más tarde'],
            defaultId: 0
        }).then(({ response }) => {
            if (response === 0) {
                shell.openExternal('https://github.com/blackorchid-a11y/summary-visor/releases/latest');
            }
        });
    }
    // On Windows, it will auto-download by default
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);

    dialog.showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: 'La actualización se ha descargado. La aplicación se reiniciará para instalarla.',
        buttons: ['Reiniciar ahora', 'Más tarde']
    }).then(({ response }) => {
        if (response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater:', err);
});

app.whenReady().then(() => {
    createWindow();

    // Check for updates after a short delay
    setTimeout(checkForUpdates, 3000);

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
