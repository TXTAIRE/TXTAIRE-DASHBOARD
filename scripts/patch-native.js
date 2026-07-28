// `npx cap add` generates bare native projects with no permissions declared. The ESS app
// needs camera (clock-in/out photo proof) and location (best-effort geotag) access, so this
// patches both native projects right after they're (re-)generated in CI, every run — the
// native folders are not committed to the repo, so nothing here is a one-time manual edit.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function patchAndroidManifest() {
  const file = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  if (!fs.existsSync(file)) { console.log('Skip: ' + file + ' not found'); return; }
  let xml = fs.readFileSync(file, 'utf8');
  const perms = [
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  ];
  perms.forEach((tag) => {
    if (!xml.includes(tag)) xml = xml.replace('</manifest>', '    ' + tag + '\n</manifest>');
  });
  if (!xml.includes('android.hardware.camera')) {
    xml = xml.replace(
      '</manifest>',
      '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>'
    );
  }
  fs.writeFileSync(file, xml);
  console.log('Patched AndroidManifest.xml with camera/location permissions.');
}

function patchInfoPlist() {
  const file = path.join(root, 'ios/App/App/Info.plist');
  if (!fs.existsSync(file)) { console.log('Skip: ' + file + ' not found'); return; }
  let plist = fs.readFileSync(file, 'utf8');
  const entries = {
    NSCameraUsageDescription: 'TxTAIRE My Portal uses the camera to attach a photo when you clock in or out.',
    NSLocationWhenInUseUsageDescription: 'TxTAIRE My Portal uses your location to tag where you clocked in or out (optional, best-effort).',
  };
  Object.entries(entries).forEach(([key, value]) => {
    if (!plist.includes('<key>' + key + '</key>')) {
      plist = plist.replace(
        '</dict>',
        `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>`
      );
    }
  });
  fs.writeFileSync(file, plist);
  console.log('Patched Info.plist with camera/location usage descriptions.');
}

patchAndroidManifest();
patchInfoPlist();
