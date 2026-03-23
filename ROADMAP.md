# P10 Racing - Project Roadmap & History

This file tracks the evolution of P10 Racing from a web prototype to a production-ready mobile application.

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

## 🤖 Phase 4: Google Play Store Release ✅ COMPLETE
*   [x] **Google Play Developer Account:** Registered and set up.
*   [x] **Keystore Management:** Production signing key stored in GitHub Secrets.
*   [x] **Store Listing:** Created screenshots and metadata.
*   [x] **AAB Generation:** CI/CD updated to output signed `.aab`.
*   [x] **Automated Releases:** Implemented dual-track (`internal` vs `closed`) deployment with automated Git tagging and PR-based release notes.
*   [x] **Privacy & Compliance:** Hosted Policy and In-App Account Deletion implemented.
