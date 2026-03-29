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

## 🎨 Personalized User Profiles
**Goal:** Deepen the connection between the user and the F1 sport.

### Implementation Plan:
*   **Backend:** Add `favorite_team` (ID) and `favorite_driver` (ID) columns to the `profiles` table.
*   **UI:** 
    *   Create a "Profile Customization" section in `app/settings/page.tsx`.
    *   Use the `favorite_team` color to dynamically theme the user's UI (accent colors, buttons).
*   **Social:** Display the user's favorite driver/team icon next to their name on the global and league leaderboards.

---

## 🚀 Future Technical Enhancements

### 1. 🏁 Real-time "Smart Finish"
**Goal:** Transition the app out of "Race Mode" immediately when the checkered flag drops, without waiting for the official results API (Jolpica).

*   **Logic:** Use the `f1-signalr-relay` to detect the `SessionStatus: "Finished"` or `ArchiveStatus: "Generating"` flags from the track stream.
*   **Action:** When detected, the relay updates the `kv_cache` with a "Completed" status, triggering the frontend to hide the live tracker and show a "Results Pending" state instead of waiting for the full 4-hour window to expire.

### 📡 Real-time Data Expansion (SignalR)
**Goal:** Leverage the low-latency track stream for more than just P10/DNF tracking.

*   **🛞 Live Tire Insights:** Subscribe to the `TyreData` SignalR feed to display tire compounds (Soft, Medium, Hard) and tire age (laps) for drivers in the P10 battle.
*   **🚥 Live Track Status:** Use the `SessionInfo` feed to display real-time track status banners (Yellow Flag, VSC, Safety Car, Red Flag) in the `LiveRaceCenter` header.
*   **Real-time Achievement Unlocking:** Use live telemetry to trigger certain achievements immediately.
    *   **The Sniper 🎯:** Awarded if a user's P10 pick occupies the 10th position for at least **50% of the total race laps**. The relay tracks this lap-by-lap and unlocks the trophy the moment the threshold is hit, providing instant gratification.

---

## 🛠️ Internal Maintenance & Refinement

### 1. 📐 Fix Maskable Icon Padding
**Goal:** Ensure the PWA icon looks polished on all Android launchers.
*   **Issue:** Current `logo.svg` is cropped by Android's circular/squircle mask because it lacks sufficient safe-zone padding.
*   **Action:** Update the SVG to have more transparent padding around the central logo.

### 2. 🧮 Unified Scoring Utility
**Goal:** Centralize all prediction-to-point logic to prevent duplication.
*   **Action:** Continue refactoring `lib/scoring.ts` to provide a single entry point for season-wide and single-race point calculations.

