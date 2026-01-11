# GitHub Actions CI/CD Setup Guide

**Last Updated**: 2026-01-11
**Status**: Active & Configured

This guide explains how to set up automatic deployment to Firebase whenever you push code to GitHub.

---

## Overview

We've configured **GitHub Actions** to automatically:
1. ✅ Build your app when you push to `main` branch
2. ✅ Deploy to Firebase Hosting
3. ✅ (Optional) Deploy Cloud Functions

---

## Setup Instructions

### Step 1: Push Your Code to GitHub

If you haven't already, create a GitHub repository:

```bash
cd /Users/shahbaz/Documents/Spendigo

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial production deployment"

# Add remote (replace with your actual repo URL)
git remote add origin https://github.com/YOUR_USERNAME/spendigo.git

# Push to GitHub
git push -u origin main
```

---

### Step 2: Create Firebase Service Account

This gives GitHub permission to deploy to your Firebase project.

1. **Go to Firebase Console**:
   - https://console.firebase.google.com/project/spendigo-8540c/settings/serviceaccounts/adminsdk

2. **Generate New Private Key**:
   - Click "**Service accounts**" tab
   - Click "**Generate new private key**"
   - Click "**Generate key**"
   - A JSON file will download (keep it safe!)

3. **Open the JSON file**:
   - Copy the ENTIRE contents of the file

---

### Step 3: Add Secret to GitHub

1. **Go to your GitHub repository**:
   - `https://github.com/YOUR_USERNAME/spendigo`

2. **Open Settings**:
   - Click "**Settings**" (in the top menu)
   - Click "**Secrets and variables**" → "**Actions**" (in the left sidebar)
   - Click "**New repository secret**"

3. **Add the Firebase key**:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C`
   - **Value**: Paste the entire JSON contents from Step 2
   - Click "**Add secret**"

---

### Step 4: Test the Workflow

Now whenever you push code:

```bash
# Make a change (e.g., update README.md)
echo "# Spendigo - Live!" > README.md

# Commit and push
git add .
git commit -m "Test auto-deploy"
git push
```

**What Happens**:
1. GitHub receives your push
2. GitHub Actions starts the workflow
3. It builds your app (`npm run build`)
4. It deploys to Firebase Hosting
5. Your site updates at `https://spendigo.ca` (or the firebaseapp.com alias)

---

## Monitoring Deployments

### View Action Status

1. Go to your GitHub repo
2. Click "**Actions**" tab
3. You'll see all deployment runs

**Status Indicators**:
- 🟡 **Yellow (In Progress)**: Currently deploying
- ✅ **Green**: Deployment succeeded
- ❌ **Red**: Deployment failed (click to see logs)

---

## Advanced: Deploy Functions Too

To also auto-deploy Cloud Functions, update the workflow:

**Edit**: `.github/workflows/main.yml`

Change the last step to:

```yaml
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C }}'
          channelId: live
          projectId: spendigo-8540c
          # Add this line to deploy functions too:
          target: hosting,functions
```

---

## Workflow File Explained

**Location**: `.github/workflows/main.yml`

```yaml
name: Deploy to Firebase Hosting on merge to main

on:
  push:
    branches:
      - main          # Trigger on push to main branch
  workflow_dispatch:  # Allow manual trigger

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest  # Use Ubuntu server
    
    steps:
      - uses: actions/checkout@v4         # Get code
      - name: Install Dependencies
        run: npm ci                       # Install dependencies
      - name: Build
        run: npm run build                # Build production
      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C }}'
          channelId: live
          projectId: spendigo-8540c
```

---

## Troubleshooting

### Error: "Permission denied"

**Solution**: Make sure you added the `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C` secret correctly.

### Error: "Build failed"

**Solution**: Your code has errors. Check the "Actions" tab logs to see the TypeScript/build error.

### Error: "Firebase project not found"

**Solution**: Check that `projectId: spendigo-8540c` matches your actual Firebase project ID.

---

## Cost Considerations

**GitHub Actions Free Tier**:
- ✅ 2,000 minutes/month (for public repos)
- ✅ 500 MB storage
- ✅ Plenty for your use case

Each deployment takes ~2-3 minutes, so you can do **~600 deployments/month** for free.

---

**Prepared By**: Shahbaz + AI Development Team  
**Status**: Production-Ready CI/CD Pipeline
