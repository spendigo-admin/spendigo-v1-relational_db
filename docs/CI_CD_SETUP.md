# GitHub Actions CI/CD Setup Guide

**Last Updated**: 2026-01-12
**Status**: Active & Configured

This guide explains how to set up automatic deployment to Firebase whenever you push code to GitHub.

---

## Overview

We've configured **GitHub Actions** to automatically:
1.  ✅ **Build** your app when you push to the `main` branch.
2.  ✅ **Deploy** the build artifacts to Firebase Hosting.

---

## Setup Instructions

### Step 1: Push Your Code to GitHub

If you haven't already, ensure your code is pushed to the `main` branch of your repository.

```bash
git push origin main
```

### Step 2: Create Firebase Service Account

This gives GitHub permission to deploy to your Firebase project.

1.  **Go to Firebase Console**:
    - [Project Settings > Service Accounts](https://console.firebase.google.com/project/spendigo-8540c/settings/serviceaccounts/adminsdk)

2.  **Generate New Private Key**:
    - Click "**Generate new private key**".
    - A JSON file will download.

3.  **Open the JSON file**:
    - Copy the **ENTIRE** contents of the file.

### Step 3: Add Secret to GitHub

1.  **Go to your GitHub repository Settings**:
    - `Settings` -> `Secrets and variables` -> `Actions`.
    - Click "**New repository secret**".

2.  **Add the Firebase key**:
    - **Name**: `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C`
    - **Value**: Paste the entire JSON contents from Step 2.
    - Click "**Add secret**".

---

## Workflow Configuration

The workflow is defined in `.github/workflows/main.yml`.

```yaml
name: Deploy to Firebase Hosting on merge to main

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C }}'
          channelId: live
          projectId: spendigo-8540c
```

### Key Components:
-   **`npm ci`**: Uses `package-lock.json` for a clean, deterministic install.
-   **`FirebaseExtended/action-hosting-deploy`**: The official action for deploying to Firebase Hosting.
-   **`channelId: live`**: Deploys directly to the production site.

---

## Advanced: Deploying Cloud Functions

To auto-deploy Cloud Functions as well, you would update the `with` block in your workflow file:

```yaml
        with:
          # ... existing config ...
          target: hosting,functions
```

*Note: Deploying functions typically takes longer and may require additional permissions or configuration.*

---

## Troubleshooting

### Build Errors
If the build fails, check the "Actions" tab in GitHub. Common issues include:
-   **TypeScript Errors**: Ensure `npm run build` runs locally without errors before pushing.
-   **Missing Secrets**: Verify `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C` is set correctly.

### Permission Denied
Ensure the Service Account Key used in the secret has the "Firebase Admin" or "Firebase Hosting Admin" role in the Google Cloud Console.

---

## Monitoring and Cost

-   **Monitoring**: View deployment logs in the "Actions" tab of your GitHub repository.
-   **Cost**: GitHub Actions offers 2,000 free automation minutes per month for public repositories (and generous limits for private ones), which is sufficient for frequent deployments.
