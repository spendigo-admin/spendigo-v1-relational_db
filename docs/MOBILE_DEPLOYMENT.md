# Spendigo Mobile App Build Guide

This guide details how to build and deploy the Spendigo application for Android and iOS using Capacitor.

## Prerequisites

Ensure you have the following installed on your development machine:

- **Node.js** (v18+)
- **Android Studio** (for Android builds)
- **Xcode** (for iOS builds - macOS only)
- **CocoaPods** (for iOS dependencies): `sudo gem install cocoapods`

## 1. Build the Web Assets

Before building the mobile apps, you must compile the React web application. This creates the `dist` folder that Capacitor will wrap.

```bash
cd apps/web
npm run build
```

## 2. Sync with Capacitor

This command copies the built web assets (`dist`) and any native plugins into the Android and iOS project folders.

```bash
npx cap sync
```

> **Note:** You should run this command every time you make changes to the web code or install new npm packages.

## 3. Building for Android

1.  **Open the Android Project**:
    ```bash
    npx cap open android
    ```
    This will launch Android Studio.

2.  **Run the App**:
    -   Wait for Gradle sync to finish.
    -   Select a connected device or an emulator from the toolbar.
    -   Click the **Play (Run)** button (green triangle).

3.  **Generating an APK (for distribution)**:
    -   Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)** in the Android Studio menu.

## 4. Building for iOS (macOS Only)

1.  **Open the iOS Project**:
    ```bash
    npx cap open ios
    ```
    This will launch Xcode.

2.  **Run the App**:
    -   Select a Simulator (e.g., iPhone 15) or a connected device from the top bar.
    -   Click the **Play** button.

3.  **Deployment**:
    -   You will need a valid Apple Developer account to sign and deploy the app to a physical device or the App Store.
    -   Configure signing in **App Target > Signing & Capabilities**.

## 5. Live Reload (Development Mode)

For faster development without rebuilding every time:

1.  Find your computer's local IP address (e.g., `192.168.1.5`).
2.  Edit `capacitor.config.ts`:
    ```typescript
    server: {
      url: 'http://192.168.1.5:5173', // Your IP and Vite port
      cleartext: true
    }
    ```
3.  Run the dev server:
    ```bash
    npm run dev -- --host
    ```
4.  Run `npx cap sync` and redeploy to the device.
5.  **Important:** Revert these changes in `capacitor.config.ts` before building for production!

## Troubleshooting

-   **"Gradle sync failed"**: Ensure you have the correct Java/JDK version installed (JDK 17 is recommended for recent Android builds) and the Android SDK platforms are downloaded via the SDK Manager.
-   **"Pod install failed"**: If `npx cap sync` fails on iOS, try running `cd ios/App && pod install` manually to see detailed errors.
-   **"No target device found"**:
    -   **Android**: Open Android Studio, go to **Tools > Device Manager**, create a new virtual device (e.g., Pixel 5), and click the **Play** button to start the emulator *before* running the app.
    -   **iOS**: In Xcode, check the top toolbar. If it says "Any iOS Device", click it and select a specific simulator (e.g., "iPhone 15") from the list.
