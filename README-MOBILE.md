# TxTAIRE My Portal — Android & iOS app builds

This wraps the ESS portal (`ess.html`) as a native app via [Capacitor](https://capacitorjs.com),
built entirely in GitHub Actions since this project has no local Node.js install. The admin
HR dashboard (`index.html`) is not wrapped — it stays a browser/PWA tool for HR's own use.

## What's already working

Go to the repo's **Actions** tab → **Build mobile app (My Portal)** → **Run workflow**. This:

- Builds an **unsigned Android debug APK** (downloadable from the run's Artifacts section) —
  installable on any Android phone for testing (enable "install from unknown sources").
- Compiles the **iOS project for the Simulator** as a smoke test that it builds cleanly. This
  does *not* produce an installable iPhone app yet (see below).

Neither of these is what the stores accept. Store-ready builds need real signing credentials,
which only you can create (they're tied to your identity/payment, not something I can set up).

## To publish on Google Play

1. Create a [Google Play Developer account](https://play.google.com/console/signup) (one-time
   $25 fee).
2. Generate a release signing key once, and keep it safe forever — losing it means you can
   never update the app again under the same listing:
   ```
   keytool -genkey -v -keystore release.keystore -alias txtaire -keyalg RSA -keysize 2048 -validity 10000
   ```
3. In the GitHub repo, add these under **Settings → Secrets and variables → Actions**:
   - `ANDROID_KEYSTORE_BASE64` — the keystore file, base64-encoded
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
4. Tell me once those secrets exist — I'll update `android/app/build.gradle` signing config
   and swap the workflow's `assembleDebug` step for `bundleRelease` to produce a signed `.aab`.
5. Create the app listing in [Play Console](https://play.google.com/console): store copy,
   screenshots, a privacy policy URL, and the Data Safety questionnaire (this app collects
   attendance photos and location — declare that honestly).
6. Upload the `.aab` and submit for review.

## To publish on the Apple App Store

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. In [App Store Connect](https://appstoreconnect.apple.com), register the app (bundle ID
   `com.txtaire.myportal`, matching `capacitor.config.json`).
3. In the Apple Developer portal, create a Distribution Certificate and a Provisioning
   Profile for that bundle ID.
4. Export the certificate as a `.p12` and add these as GitHub repo secrets:
   - `APPLE_CERTIFICATE_BASE64`, `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_PROVISIONING_PROFILE_BASE64`
   - `APPLE_TEAM_ID`
5. Tell me once those exist — I'll update the iOS job to sign and export a real `.ipa` via
   `xcodebuild -exportArchive`, ready to upload with Transporter or `xcrun altool`.
6. Fill in the App Store Connect listing (screenshots, description, privacy policy URL,
   App Privacy questionnaire) and submit for review — Apple's review typically takes a few
   days and can come back with change requests.

## Notes

- `www/`, `android/`, and `ios/` are generated fresh on every CI run (not committed) — the
  camera/location permissions they need are re-applied automatically by
  `scripts/patch-native.js`, so nothing manual is lost between runs.
- If you'd rather iterate locally instead of waiting on CI each time, installing
  [Node.js](https://nodejs.org) (and Android Studio and/or Xcode) on your own machine lets
  you run `npm install`, `npx cap add android`, `npx cap open android` directly.
