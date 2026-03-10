# P10 Racing - Production Roadmap & App Store Vision

## 🎯 Project Goal
To evolve P10 Racing from a locally-stored web prototype into a fully polished, multiplayer mobile application published on the Google Play Store and Apple App Store, complete with online leagues, automated testing, and CI/CD pipelines.

---

## 🏗️ Phase 1: App Polish & Native Feel ✅ COMPLETE
*   [x] **Native Navigation:** Implemented smooth sliding fade transitions using `framer-motion`.
*   [x] **Infrastructure:** Integrated `@capacitor/splash-screen`, `@capacitor/haptics`, and `@capacitor/status-bar`.
*   [x] **Status Bar Management:** Configured native wrapper and CSS safe-area-insets to prevent UI overlap.
*   [x] **Haptic Feedback:** Added tactile response for driver selection, navigation, and submission.
*   [x] **Offline Support:** Created `OfflineStatus` component for real-time connection monitoring.
*   [x] **UI Refinement:** Developed bespoke F1-styled components with a global forced dark theme and high-contrast accessibility.

---

## ⚙️ Phase 2: CI/CD & Automated Pipeline ✅ COMPLETE
*   [x] **Code Quality Gates:** GitHub Actions now runs `eslint` and `tsc` on every push.
*   [x] **Automated Test Suite:** Full Node.js test suite (`tests/run_all.ts`) runs automatically in CI.
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

## 🛠️ Current Tech Stack
*   **Frontend:** Next.js 15 (React 19), Bootstrap 5, TypeScript, Framer Motion.
*   **Backend:** Supabase (Auth, PostgreSQL, RLS).
*   **Hosting:** Vercel (Production Web & Policy hosting).
*   **Mobile:** Capacitor JS 8 (Android & iOS).
*   **CI/CD:** GitHub Actions.
*   **Data Source:** Jolpica F1 API.

---

## 📦 Versioning Mandates
*   **Source of Truth:** Always use `package.json` version for all release-related versioning.
*   **Sync:** Do not hardcode versions in `android/app/build.gradle` or the UI footer; they are automated.
*   **Increment Policy:** You **MUST** increment the version in `package.json` before finishing any task that includes a bug fix or new feature.
    *   **Patch (x.x.1):** Bug fixes, small tweaks.
    *   **Minor (x.1.x):** New features, significant UI changes.
    *   **Major (1.x.x):** Breaking changes or major architectural shifts.
