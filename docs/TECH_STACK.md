# Spendigo SmartCart — Tech Stack

## 1. Principals
- **Production-Grade**: Type-safety, automated testing, and strict linting are non-negotiable.
- **Cost-Obsessed**: Every tool must have a sustainable free tier or "scale-to-zero" model.
- **No Kubernetes**: Complexity overhead is too high for this stage.

## 2. Core Stack

### Frontend (Web)
- **Framework**: React 18+
- **Build Tool**: Vite
- **Language**: TypeScript (Strict Mode)
- **Styling**: Vanilla CSS (Variables, Flexbox/Grid) + CSS Modules for scoping. *Tailwind is allowed ONLY if user explicitly requested, but default is Vanilla for "best practices" control.*
- **State Management**: React Context + Hooks (Zustand if complexity grows).
- **Routing**: React Router v6.

### Frontend (Mobile)
- **Framework**: React Native
- **Platform**: Expo (Managed Workflow)
- **Styling**: NativeWind or StyleSheet.

### Backend
- **Runtime**: Node.js 20 (LTS)
- **Framework**: Hono, Express, or Fastify (adapted for Serverless).
- **Language**: TypeScript.
- **API Spec**: OpenAPI 3.0 (Swagger).

### Database
- **Engine**: PostgreSQL 15+.
- **Provider**: Neon (Free Tier) or Supabase (Free Tier).
- **ORM**: Prisma or Drizzle (Drizzle preferred for cold-start performance).

### Infrastructure (DevOps)
- **Registry**: GitHub Packages or Docker Hub.
- **CI/CD**: GitHub Actions.
- **IaC**: Terraform.

## 3. Third-Party Services (The "Free Tier" Stack)

| Category | Service | Free Tier Limit (Approx) | Fallback |
| :--- | :--- | :--- | :--- |
| **Auth** | Firebase Auth / Supabase Auth | 50k MAU | Cognito |
| **Object Storage** | Cloudflare R2 / AWS S3 | 10GB / 5GB | GCS |
| **Transactional Email** | Resend / SendGrid | 3,000 / 100 emails/day | AWS SES |
| **Maps** | Google Maps Platform | $200 credit/mo | Mapbox |
| **Payment** | Stripe Connect | Pay-as-you-go | N/A |
| **OCR** | Google Cloud Vision | 1,000 units/mo | Tesseract (Self-hosted) |

## 4. Development Tools
- **Linter**: ESLint (Google config).
- **Formatter**: Prettier.
- **Testing**: Vitest (Unit), Playwright (E2E).
- **Package Manager**: pnpm (for monorepo efficiency).
