# Spendigo Mobile App Build Guide

**Location**: `apps/web`
**Status**: Beta Verified
**Framework**: Ionic Capacitor (v6.0)

This guide details how to build and deploy the Spendigo application for Android and iOS.

## Prerequisites

Ensure you have the following installed on your development machine:
- **Node.js** (v20+)
- **Android Studio** (for Android builds)
- **Xcode** (for iOS builds - macOS only)
- **CocoaPods**: `sudo gem install cocoapods`

---

## 1. Project Navigation
The mobile configuration lives inside the `web` workspace.

```bash
cd /Users/shahbaz/Documents/Spendigo/apps/web
```

## 2. Build the Web Assets
Capacitor wraps your compiled web app. You must build the React app first.

```bash
npm run build
```

This creates the `dist` folder which is referenced in `capacitor.config.ts`.

## 3. Sync with Capacitor
Copy the web assets and native plugins to the iOS/Android projects.

```bash
npx cap sync
```

**Run this command whenever you:**
- Edit `package.json`
- Update web code (`dist`)
- Change `capacitor.config.ts`

---

## 4. Building for Android

1.  **Open Android Studio**:
    ```bash
    npx cap open android
    ```
2.  **Run**: Click the Green Play button (select an Emulator or USB Device).
3.  **Build APK**: Menu -> Build -> Build Bundle(s) / APK(s) -> Build APK.

## 5. Building for iOS (macOS)

1.  **Open Xcode**:
    ```bash
    npx cap open ios
    ```
2.  **Run**: Select a Simulator (iPhone 15) and click Play.
3.  **Deploy**: Configure Signing & Capabilities with your Apple ID.

---

## 6. Live Reload (Development Mode)

For faster iteration without rebuilding:

1.  Find your local IP (e.g., `192.168.2.54`).
2.  Edit `capacitor.config.ts`:
    ```typescript
    server: {
      url: 'https://192.168.2.54:443', // Your IP and SSL Port
      cleartext: false
    }
    ```
3.  Run the dev server:
    ```bash
    npm run dev -- --host
    ```
4.  Sync and Run:
    ```bash
    npx cap sync
    npx cap open android
    ```

**Important**: Remove the `server` block before building for Production!

---

## 7. Troubleshooting

- **Android Keystore**: If signing fails, verify your `key.jks` location.
- **Gradle Errors**: Ensure JDK 17+ is selected in Android Studio Settings.
- **SSL Errors on Localhost**: Since we use `https://spendigo.ca` locally, you must install the self-signed cert on the Android Emulator or use the IP address method above.
