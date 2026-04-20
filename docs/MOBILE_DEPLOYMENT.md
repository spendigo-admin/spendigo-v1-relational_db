# Spendigo Mobile App Build Guide

**Last Updated**: 2026-04-20
**Status**: Production-Ready (v1.0)
**Framework**: Ionic Capacitor (v7.0)
**Target Platforms**: iOS (14+), Android (API 24+)

---

## 1. Project Architecture
Spendigo uses a hybrid mobile strategy. The mobile app is a Capacitor-wrapped instance of the `apps/web` React application. This ensures 1:1 parity for the **SmartCart Optimizer** and **Private Ad Network** features across all devices.

### Native Plugin Dependencies
- **Geolocation**: Required for proximity-based deals and delivery radius validation.
- **Camera**: Required for barcode scanning in the Master Catalog workflow.
- **Push Notifications**: Firebase Cloud Messaging (FCM) integration for price drop alerts.
- **Haptics**: Micro-animations for add-to-cart actions.

---

## 2. Sync & Build Workflow

### Step 1: Web Compilation
Native builds must always be preceded by a production web build.
```bash
cd apps/web
npm run build
```

### Step 2: Capacitor Sync
Update the native project code and dependencies.
```bash
npx cap sync
```

### Step 3: Asset Generation
Generate icons and splash screens from `src/assets/logo.svg`.
```bash
npx @capacitor/assets generate --icon --splash
```

---

## 3. Platform Specifics

### Android (Google Play)
1. **Open IDE**: `npx cap open android`
2. **Signing**: Use the `spendigo-production.keystore` (Managed in Vault).
3. **Internal Testing**: Upload the generated `.aab` (Android App Bundle) to the Google Play Console.

### iOS (Apple App Store)
1. **Open IDE**: `npx cap open ios`
2. **Signing**: Ensure the 'Spendigo' Provisioning Profile (Team: `Spendigo Inc`) is active in Xcode.
3. **Privacy**: Verify `Info.plist` contains the following description strings:
   - `NSLocationWhenInUseUsageDescription`: "Used to show nearby grocery deals."
   - `NSCameraUsageDescription`: "Used to scan product barcodes."
4. **TestFlight**: Build the archive and upload to App Store Connect.

---

## 4. Deep Linking Configuration

Spendigo supports the `spendigo://` URI scheme for sharing wishlists and orders.

**Android**: Verified App Links in `AndroidManifest.xml`.
**iOS**: Universal Links via `apple-app-site-association` file on `spendigo.ca`.

---

## 5. Deployment Checklist
- [ ] `capacitor.config.ts` has `server.url` REMOVED for production.
- [ ] `StatusBar` color is set to `#ffffff` (matches new retail design).
- [ ] Push notification certificates (p8/FCM Key) are uploaded to Firebase.
- [ ] Version code in `build.gradle` and `Info.plist` is incremented.
- [ ] `google-services.json` / `GoogleService-Info.plist` are in place.
