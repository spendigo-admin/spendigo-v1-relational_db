# Spendigo SmartCart

Spendigo SmartCart is a Canada-first "Marketplace Facilitator" platform connecting independent convenience stores with local consumers. It features smart basket optimization, flyer deal integration, and strict regulatory compliance (Stripe Connect, Canadian Tax, Fraud Checks).

## Project Structure

This is a monorepo managed by `turbo` and `npm workspaces`.

- **apps/web**: React (Vite) frontend for Consumers, Merchants, and Admins.
- **services/api**: Node.js backend services (Optimization, Payments, Compliance).
- **packages/shared**: Shared TypeScript types and utilities.
- **infra**: Terraform infrastructure definitions (GCP).
- **docs**: Architecture, Wireframes, and Legal documentation.

## Getting Started

### Prerequisites
- Node.js (v20+)
- npm (v9+) or pnpm

### Installation

**How to Install on Mac:**
The easiest way is using [Homebrew](https://brew.sh/):
```bash
brew install node
```
Alternatively, download the installer from [nodejs.org](https://nodejs.org/).

Once Node is installed, run:

```bash
# Install all dependencies from the root
npm install
```

### Development

To start the development servers:

```bash
# Starts both Frontend and Backend in dev mode
npm run dev
```

### Troubleshooting

**"Cannot find module 'react'..." or "vite" errors?**
This means `node_modules` are missing. Please ensure you have run `npm install` at the project root.
