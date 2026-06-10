const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../public/logo.png'),
        webPreferences: {
            // The renderer only uses browser APIs (idb, DOM); it never needs Node.
            // Keeping Node out of the renderer means injected content in an
            // imported note can't escalate to code execution on the machine.
            nodeIntegration: false,
            contextIsolation: true,
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

    // Create menu with zoom accelerators (needed for keyboard shortcuts to work on Windows)
    const template = [
        {
            label: 'View',
            submenu: [
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: () => {
                        const focusedWindow = BrowserWindow.getFocusedWindow();
                        if (focusedWindow) {
                            const currentZoom = focusedWindow.webContents.getZoomLevel();
                            focusedWindow.webContents.setZoomLevel(currentZoom + 0.5);
                        }
                    }
                },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+=',
                    visible: false,
                    click: () => {
                        const focusedWindow = BrowserWindow.getFocusedWindow();
                        if (focusedWindow) {
                            const currentZoom = focusedWindow.webContents.getZoomLevel();
                            focusedWindow.webContents.setZoomLevel(currentZoom + 0.5);
                        }
                    }
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => {
                        const focusedWindow = BrowserWindow.getFocusedWindow();
                        if (focusedWindow) {
                            const currentZoom = focusedWindow.webContents.getZoomLevel();
                            focusedWindow.webContents.setZoomLevel(currentZoom - 0.5);
                        }
                    }
                },
                {
                    label: 'Reset Zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => {
                        const focusedWindow = BrowserWindow.getFocusedWindow();
                        if (focusedWindow) {
                            focusedWindow.webContents.setZoomLevel(0);
                        }
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    win.setMenuBarVisibility(false); // Hide menu bar but keep accelerators working
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
