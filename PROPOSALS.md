# P10 Racing - Feature Proposals & Implementation Plans

This document outlines the strategic roadmap for upcoming features designed to increase user engagement, gamification, and platform reach.

---

## 1. 📊 Driver Insights ("The Analyst") [COMPLETED ✅]
**Goal:** Provide historical context focused on the P10 target to help users make data-driven predictions.

### Implementation Status:
*   **Data Strategy:** Uses Jolpica F1 API via `fetchRecentResults` in `lib/api.ts`.
*   **UI/UX:** Form badges integrated into `components/SelectionList.tsx`.
*   **Caching:** Implemented in `lib/hooks/use-f1-data.ts`.

---

## 2. 🏆 Achievement & Badge System [COMPLETED ✅]
**Goal:** Increase long-term retention through gamification.

### Implementation Status:
*   **Backend:** `user_achievements` table and `lib/utils/achievements.ts` logic.
*   **Hook:** `lib/hooks/use-achievements.ts` for real-time evaluation.
*   **UI:** Integrated into `UserDrawer.tsx`.

---

## 3. 🏁 Enhanced "Live" Race Center [COMPLETED ✅]
**Goal:** Make the app the primary "second screen" during a Grand Prix.

### Implementation Status:
*   **Data Layer:** `f1-live-proxy` Edge Function fetching official F1 static JSON.
*   **Hook:** `lib/hooks/use-f1-live-timing.ts` with 60s polling.
*   **UI:** `components/LiveRaceCenter.tsx` with P10 Tracker and Live Prediction Status.

---

## 4. 🍎 Phase 5: iOS Integration
**Goal:** Expand the P10 Racing community to Apple users.

### Implementation Plan:
*   **Environment:** 
    *   Install `@capacitor/ios` and run `npx cap add ios`.
    *   Initialize the Xcode project and configure Bundle IDs.
*   **Native Polish:**
    *   Implement `androidx.activity.EdgeToEdge` equivalents for iOS (Safe Area Insets).
    *   Optimize `globals.css` for the **Dynamic Island** and Notch.
*   **Deployment:** Set up a GitHub Action to build `.ipa` files and upload to **TestFlight**.

---

## 🎨 Personalized User Profiles [COMPLETED ✅]
**Goal:** Deepen the connection between the user and the F1 sport.

### Implementation Status:
*   **Backend:** Added `favorite_team` and `favorite_driver` columns to `profiles` table.
*   **Dynamic Theme:** Created `DynamicThemeProvider` to inject user-specific CSS variables (`--team-accent`) globally.
*   **UI:** 
    *   "Personalization" section in `app/settings/page.tsx` with Skeleton loader and Framer Motion transitions.
    *   Active navigation, headers, and buttons automatically adjust to the user's favorite team colors.
    *   Added a "Team Theme" opt-out toggle for users who prefer the standard F1 Red.

---

## 🚀 Technical Enhancements [COMPLETED ✅]

### 1. 🏁 Real-time "Smart Finish"
**Goal:** Transition the app out of "Race Mode" immediately when the checkered flag drops.
*   **Implementation:** `f1-signalr-relay` detects `Finished` or `Final` session status and updates `kv_cache`. Frontend displays "RESULTS PENDING" badge instantly.

### 2. 📡 Real-time Data Expansion (SignalR) [COMPLETED ✅]
**Goal:** Leverage the low-latency track stream for more than just P10/DNF tracking.
*   **🛞 Live Tire Insights:** Real-time tire compound and age displayed in the P10 Tracker.
*   **🚥 Live Track Status:** Dynamic banners for Yellow Flag, VSC, Safety Car, and Red Flag.

### 3. 🎯 Future: Real-time Achievement Unlocking
**Goal:** Use live telemetry to trigger certain achievements immediately.
*   **The Sniper 🎯:** Awarded if a user's P10 pick occupies the 10th position for at least **50% of the total race laps**. The relay tracks this lap-by-lap and unlocks the trophy the moment the threshold is hit, providing instant gratification.

### 4. 📐 Fix Maskable Icon Padding [COMPLETED ✅]

### 4. 🧮 Unified Scoring Utility
**Goal:** Centralize all prediction-to-point logic to prevent duplication.
*   **Action:** Refactored `lib/scoring.ts` with `calculateRacePoints` as the single source of truth for all score calculations.

