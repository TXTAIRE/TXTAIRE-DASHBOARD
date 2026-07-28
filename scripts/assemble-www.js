// Builds the www/ folder Capacitor packages into the native app. The web app itself has
// no build step, so this just copies the same static files ess.html already loads in the
// browser, renamed to index.html (Capacitor's required start page).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const www = path.join(root, 'www');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

copyDir(path.join(root, 'js'), path.join(www, 'js'));
copyDir(path.join(root, 'css'), path.join(www, 'css'));
copyDir(path.join(root, 'assets'), path.join(www, 'assets'));
fs.copyFileSync(path.join(root, 'ess.html'), path.join(www, 'index.html'));

console.log('www/ assembled from ess.html + js/ + css/ + assets/');
