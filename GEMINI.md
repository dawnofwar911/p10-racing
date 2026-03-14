# P10 Racing - Production Roadmap & App Store Vision

## 🎯 Project Goal
To evolve P10 Racing from a locally-stored web prototype into a fully polished, multiplayer mobile application published on the Google Play Store and Apple App Store, complete with online leagues, automated testing, and CI/CD pipelines.

---

## 🏗️ Phase 1: App Polish & Native Feel ✅ COMPLETE
*   [x] **Native Navigation:** Implemented smooth sliding fade transitions and a dedicated mobile bottom tab bar.
*   [x] **Hardware Back Button:** Added Android physical/gesture back button support.
*   [x] **Pull-to-Refresh:** Developed a custom high-fidelity F1-styled refresh indicator with haptics.
*   [x] **Mobile-First Layout:** Refined navbar and footer stability; hidden web scrollbars for an immersive look.
*   [x] **Infrastructure:** Integrated `@capacitor/splash-screen`, `@capacitor/haptics`, and `@capacitor/status-bar`.
*   [x] **Status Bar Management:** Configured native wrapper and CSS safe-area-insets to prevent UI overlap.
*   [x] **Haptic Feedback:** Added tactile response for driver selection, navigation, and submission.
*   [x] **Offline Support:** Created `OfflineStatus` component for real-time connection monitoring.
*   [x] **UI Refinement:** Developed bespoke F1-styled components with a global forced dark theme and high-contrast accessibility.

---

## ⚙️ Phase 2: CI/CD & Automated Pipeline ✅ COMPLETE
*   [x] **Code Quality Gates:** GitHub Actions now runs `eslint` and `tsc` on every push.
*   [x] **Automated Test Suite:** High-fidelity Vitest suite with MSW cloud mocking (~90% logic coverage).
*   [x] **Capacitor Sync:** Pipeline automates `next build` and `npx cap sync`.
*   [x] **Android Build:** GitHub Actions compiles the Android project and outputs a debug APK.

---

## 🌍 Phase 3: The Multiplayer Backend Migration ✅ COMPLETE
*   [x] **Backend Selection:** **Supabase** integrated for relational data and authentication.
*   [x] **User Authentication:** Implemented secure Email/Password login and signup.
*   [x] **Database Schema:** Tables for `profiles`, `leagues`, `league_members`, `predictions`, and `verified_results` live in production.
*   [x] **Private Leagues:** Users can create/join leagues with 8-digit invite codes.
*   [x] **Centralized Scoring:** Scoring engine now supports verified global results.
*   [x] **Data Migration:** Built an import tool to move "Guest" data to the cloud.

---

## 🤖 Phase 4: Google Play Store Release ✅ COMPLETE (Internal Testing)
*   [x] **Google Play Developer Account:** Register and set up the organization profile.
*   [x] **Keystore Management:** Generate production signing key and store in GitHub Secrets.
*   [x] **Store Listing:** Create screenshots, feature graphics, and SEO descriptions.
*   [x] **AAB Generation:** Update CI/CD to output a signed Android App Bundle (.aab).
*   [x] **Privacy & Compliance:** Hosted Privacy Policy and Account Deletion request pages.
*   [x] **In-App Deletion:** Implementation of `delete_user_data` RPC and UI button.

---

## 🍎 Phase 5: Apple App Store Release ⏸️ PAUSED (Optional)
*   [ ] **Note:** This phase requires a $99/year Apple Developer Program subscription.
*   [ ] **iOS Platform Integration:** Add `@capacitor/ios` and initialize the Xcode project.
*   [ ] **Apple Developer Program:** Register for an individual/organization developer account.
*   [ ] **App Store Connect:** Set up app metadata, icons, and screenshots for iOS.
*   [ ] **Xcode Configuration:** Configure signing certificates, identifiers, and provisioning profiles.
*   [ ] **TestFlight Deployment:** Set up automated beta testing for iOS users.
*   [ ] **App Store Submission:** Final review and release for iPhone users.

---

## 🚀 CI/CD & Release Strategy
To ensure the web and mobile versions stay in sync, we use a dual-track release process:

### 1. Staging (Active Development)
*   **Branch:** `main`
*   **Web:** Deploys automatically to Vercel (recommended: set up a staging domain).
*   **Android:** GitHub Actions builds and **automatically uploads** to the **Internal Testing** track on Google Play.
*   **Goal:** Immediate testing on your own device.

### 2. Production (Stable Release)
*   **Branch:** `stable`
*   **Web:** Deploys to the production URL (`p10-racing.com`).
*   **Android:** GitHub Actions builds and **automatically uploads** to the **Closed Testing** track for beta testers.
*   **Goal:** Public-facing updates and tester feedback.

### 🛠️ How to Release
1.  **Develop & Test:** Push all changes to `main`.
    *   **Note:** Your commit message is automatically used as the **Play Store Release Note** (en-GB). Ensure it is clear and user-friendly (e.g., `fix: resolve crash on driver selection` instead of `fix: bug`).
2.  **Verify:** Confirm on your phone via the Play Store "Internal Testing" update.
3.  **Increment Version:** Update the `version` in `package.json` before merging to `stable`.
4.  **Promote to Stable:** Merge `main` into `stable`.
    ```bash
    git checkout stable
    git merge main
    git push origin stable
    git checkout main
    ```
5.  **Manual Promotion:** In the Google Play Console, manually promote the successful Internal Testing build to **Closed Testing** or **Production**.

---

## 🛠️ Current Tech Stack
*   **Frontend:** Next.js 15 (React 19), Bootstrap 5, TypeScript, Framer Motion.
*   **Backend:** Supabase (Auth, PostgreSQL, RLS).
*   **Hosting:** Vercel (Production Web & Policy hosting).
*   **Mobile:** Capacitor JS 8 (Android & iOS).
*   **CI/CD:** GitHub Actions.
*   **Data Source:** Jolpica F1 API.

---

*   **Testing:** New tests MUST use the `.vitest.test.ts` extension and leverage MSW for cloud service mocking to ensure CI/CD performance and isolation.
*   **Architectural Mandates:**
    *   **Automated Ingestion:** The `verified_results` table is automatically populated by a Supabase Edge Function polling the Jolpica F1 API. Manual entry is a fallback only.
    *   **Client-Side Scoring:** Point calculation (predictions vs. verified results) MUST happen on the frontend using `lib/scoring.ts` to support both guest and authenticated users consistently.
*   **Versioning Mandates:**
*   **Source of Truth:** Always use `package.json` version for all release-related versioning.
*   **Sync:** Do not hardcode versions in `android/app/build.gradle` or the UI footer; they are automated.
*   **Android API Mandate:** You MUST NOT use deprecated Android APIs or parameters (e.g., `setStatusBarColor`, `setNavigationBarColor`) that conflict with Android 15's default edge-to-edge enforcement. Use version-specific resource overrides (e.g., `values-v35/styles.xml`) where necessary and proactively investigate console deprecation warnings. Rely on CSS `safe-area-insets` and modern Capacitor configuration for layout.
*   **Increment Policy:** You **MUST** increment the version in `package.json` before finishing any task that includes a bug fix or new feature.
    *   **Patch (x.x.1):** Bug fixes, small tweaks.
    *   **Minor (x.1.x):** New features, significant UI changes.
    *   **Major (1.x.x):** Breaking changes or major architectural shifts.
*   **Exemption:** Purely internal CI/CD, build pipeline, or workflow-only changes (that do not affect the app's code or behavior) do not require a version bump. These are automatically handled by the `versionCode` in the build process.
