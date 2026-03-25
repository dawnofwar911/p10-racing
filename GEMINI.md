# P10 Racing - Production Mandates & Goals

## 🎯 Active Project Goal
To maintain P10 Racing as a fully polished, multiplayer mobile application with automated testing and CI/CD pipelines.

## 🍎 Upcoming/Optional Goals (Phase 5)
*   [ ] **iOS Platform Integration:** Add `@capacitor/ios` and initialize the Xcode project ($99/year Apple Developer fee required).
*   [ ] **TestFlight Deployment:** Set up automated beta testing for iOS users.

---

## 🏗️ Architecture & Historical Context
*   **Historical Roadmap:** [ROADMAP.md](./ROADMAP.md) - History of Phase 1-4 (Native Feel, CI/CD, Backend Migration, Play Store release).
*   **Feature Proposals:** [PROPOSALS.md](./PROPOSALS.md) - Detailed plans for upcoming features (Driver Insights, Achievements, Live Race Center, etc.).
*   **Tech Stack:** Next.js 15 (React 19), Supabase (Auth/DB/Edge Functions), Capacitor JS 8 (Android/iOS), Vitest (Tests), Jolpica F1 API (Data).

---

## 🚀 CI/CD & Release Strategy
We use a dual-track release process with **Branch Protection** enforced on `main` and `stable`.

### 1. Staging (Active Development)
*   **Branch:** `main`
*   **Workflow:** Feature Branch -> Pull Request -> Merge.
*   **Android:** GitHub Actions builds and **automatically uploads** to the **Internal Testing** track on Google Play.
*   **Tagging:** Automatically tagged as `vX.X.X-internal`.

### 2. Production (Stable Release)
*   **Branch:** `stable`
*   **Workflow:** Pull Request from `main`.
*   **Android:** GitHub Actions automatically tags the release as `vX.X.X`. The build is **NOT** uploaded; instead, the maintainer manually promotes the successful Internal Testing build to the Closed Testing track in the Google Play Console.

---

## ⚖️ Engineering Mandates

*   **Testing:** New tests MUST use the `.vitest.test.ts` extension and leverage MSW for cloud service mocking to ensure CI/CD performance and isolation.
*   **PR Atomicity Mandate:** PRs MUST be atomic and focused on a single logical change. Do not bundle unrelated polish or multiple fixes.
*   **PR Description Mandate:** All PRs targeting `stable` MUST include a concise, user-facing "What's New" summary in the description for automated Play Store release notes.
*   **Release Tagging Mandate:** Every release to `main` or `stable` is automatically tagged. Never manually create these tags unless recovering from a pipeline failure.
*   **Notification Mandate:** Push notifications are managed via Supabase Edge Functions. Frontend components MUST NOT call Firebase Cloud Messaging (FCM) directly.
*   **Branch Protection Mandate:** Direct pushes to `main` and `stable` are strictly prohibited. All changes must be made via Pull Request.
*   **Architectural Mandates:**
    *   **Automated Ingestion:** The `verified_results` table is automatically populated by a Supabase Edge Function.
    *   **Client-Side Scoring:** Point calculation MUST happen on the frontend using `lib/scoring.ts` for consistency across Guest and Auth users.
*   **Versioning Mandates:**
    *   **Source of Truth:** Always use `package.json` version for all release-related versioning.
    *   **Increment Policy:** You **MUST** increment `package.json` for any bug fix (`patch`), new feature (`minor`), or breaking change (`major`).
    *   **Exemption:** Purely internal CI/CD or workflow changes that do not affect app code or behavior do not require a version bump.
*   **Android API Mandate:** You MUST NOT use deprecated Android APIs or parameters (e.g., `setStatusBarColor`) that conflict with Android 15's default edge-to-edge enforcement. Rely on `androidx.activity.EdgeToEdge` and CSS `safe-area-insets`.
