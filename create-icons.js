const fs = require('fs');
const path = require('path');

const src = path.join('C:', 'Users', 'Nazha', '.gemini', 'antigravity-ide', 'brain', 'b5ecdc37-38bd-4eed-bb67-172cfb2c5c87', 'feul_station_icon_1789492880210.jpg');
const assetsDir = path.join(__dirname, 'assets');
const publicAssetsDir = path.join(__dirname, 'public', 'assets');

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
if (!fs.existsSync(publicAssetsDir)) fs.mkdirSync(publicAssetsDir, { recursive: true });

fs.copyFileSync(src, path.join(assetsDir, 'icon.png'));
fs.copyFileSync(src, path.join(publicAssetsDir, 'icon.png'));
fs.copyFileSync(src, path.join(assetsDir, 'icon.jpg'));
fs.copyFileSync(src, path.join(publicAssetsDir, 'icon.jpg'));

console.log('Icons copied successfully to assets and public/assets.');
