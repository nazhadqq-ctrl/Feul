const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let serverProcess = null;
const PORT = 3000;

// Check if server is already running
function isServerRunning(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/api/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Start embedded node server if needed
async function startServer() {
    const running = await isServerRunning(PORT);
    if (running) {
        console.log('Server is already running on port ' + PORT);
        return;
    }

    try {
        require('./server.js');
        console.log('Embedded server started successfully.');
    } catch (e) {
        console.error('Failed to start embedded server:', e);
    }
}

// Wait for server to become responsive
async function waitForServer(port, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
        const running = await isServerRunning(port);
        if (running) return true;
        await new Promise((r) => setTimeout(r, 400));
    }
    return false;
}

function createMainWindow() {
    const iconPath = path.join(__dirname, 'assets', 'app.ico');

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 1024,
        minHeight: 700,
        title: 'سیستەمی تۆمارکردنی بەنزینخانە - Feul Station Pro',
        icon: iconPath,
        backgroundColor: '#070b14',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        show: false
    });

    // Custom App Menu
    const template = [
        {
            label: 'فایل',
            submenu: [
                {
                    label: 'نوێکردنەوە (Refresh)',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => mainWindow.reload()
                },
                {
                    label: 'پڕاوپڕی شاشە (Full Screen)',
                    accelerator: 'F11',
                    click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen())
                },
                { type: 'separator' },
                {
                    label: 'داخستن (Exit)',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'بینین',
            submenu: [
                {
                    label: 'گەورەکردن (Zoom In)',
                    accelerator: 'CmdOrCtrl+Plus',
                    role: 'zoomIn'
                },
                {
                    label: 'بچووککردن (Zoom Out)',
                    accelerator: 'CmdOrCtrl+-',
                    role: 'zoomOut'
                },
                {
                    label: 'قەبارەی بنەڕەتی (Reset Zoom)',
                    accelerator: 'CmdOrCtrl+0',
                    role: 'resetZoom'
                }
            ]
        },
        {
            label: 'یارمەتی',
            submenu: [
                {
                    label: 'دەربارەی سیستەم',
                    click: () => {
                        const { dialog } = require('electron');
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'دەربارەی سیستەمی بەنزینخانە',
                            message: 'Feul Station Pro v1.0.0',
                            detail: 'سیستەمی مۆدێرنی تۆمارکردن و کۆنترۆڵکردنی پێدانی سووتەمەنی\nپەیوەست بە داتابەیسی SQL Server\nگەشەپێدەر: Nazhad',
                            icon: iconPath
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow.loadURL(`http://localhost:${PORT}`);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    await startServer();
    await waitForServer(PORT);
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
