# Future Infrastructure Plan (Beta Launch)

**Objective**: Launch a scalable, cost-effective Beta environment that supports data synchronization across devices and minimizes "idle time" costs.

## 1. The Trap: Avoid "Always-On" Infrastructure
For a Beta launch, you want to avoid paying for servers that sit idle at 3 AM.
- **Avoid**: Raw Virtual Machines (AWS EC2, Azure VMs, DigitalOcean Droplets).
- **Why**: They bill for *uptime* (24/7), not usage.
- **Target**: **Serverless / Scale-to-Zero**. You should only pay when a user actually opens the app.

## 2. Recommended Stack

### A. Frontend (The App)
**Solution**: Static Hosting / CDN
- **Providers**: Vercel, Netlify, Firebase Hosting, AWS Amplify.
- **Cost**: Generous free tiers. Effectively $0 for Beta data transfer volumes.
- **Benefit**: Global speed, instant deployments via Git, zero server management.

### B. Backend & Database (The Brain)
**Champion**: **Firebase (Google)** 🏆
- **Plan**: "Spark Plan" (Free Forever tier).
- **Cost when idle**: **$0.00**.
- **Limits**: Generous (e.g., 50k reads/day, 1GB stored). Enough for hundreds of beta users.
- **Why**:
    - **All-in-One**: Database (Firestore), Authentication, Cloud Functions, and Hosting in one SDK.
    - **Sync**: Built-in offline support and real-time data sync across devices (fixes the multi-device merchant issue).
    - **Auth**: Solves "Sign In with Google/Apple" instantly.

**Runner Up**: **Supabase**
- **Plan**: Free Tier.
- **Cost when idle**: **$0.00**.
- **Benefit**: Full PostgreSQL database (better for complex queries/analytics later). Great open-source alternative if you want to avoid Google lock-in.

## 3. Migration Roadmap
When ready to move from "Prototype" (LocalStorage) to "Beta" (Database):

1.  **Authentication**: Implement Firebase Auth (replace dummy login).
2.  **Data Models**: Map `spendigo_orders` from localStorage JSON to Firestore Collections (`orders`, `users`, `stores`).
3.  **Sync Logic**: Replace `localStorage.setItem` with `addDoc` (Firestore).
4.  **Security Rules**: Configure simple rules so users can only read their own orders.

## 4. Cost Projection (Beta Phase)
| Component | Provider | Estimated Cost |
| :--- | :--- | :--- |
| **Hosting** | Firebase / Vercel | $0.00 |
| **Database** | Firestore (Spark) | $0.00 |
| **Auth** | Firebase Auth | $0.00 |
| **Total** | | **$0.00 / month** |

*Note: You only start paying (blended cents) once you exceed the free tier limits, which usually happens only after significant traction.*
