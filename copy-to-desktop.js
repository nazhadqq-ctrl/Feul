const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join('C:', 'Users', 'Nazha', 'OneDrive', 'Desktop', 'Feul');

console.log('Copying project from:', srcDir);
console.log('Destination:', destDir);

function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        // Skip .git directory to keep desktop clean
        if (entry.name === '.git') continue;

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    copyDirRecursive(srcDir, destDir);
    console.log('SUCCESS: All files and dependencies copied to:', destDir);
} catch (err) {
    console.error('ERROR during copy:', err);
    process.exit(1);
}
