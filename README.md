# P10 Racing 🏎️

Predict the Midfield. Compete with Friends. Master the Grid.

P10 Racing is a multiplayer mobile application for F1 fans who love the midfield battle. Predict exactly who will finish in P10 and who will be the first DNF of every Grand Prix to earn points and climb the global leaderboard.

## 🚀 Features
- **Global & Private Leagues**: Create your own competitions or compete with the world.
- **Real-Time Data**: Live driver standings and race results via the Jolpica F1 API.
- **Native Experience**: Smooth transitions, haptic feedback, and offline support.
- **Cloud Sync**: Secure authentication and prediction backup via Supabase.
- **Migration Tool**: Easily move your local guest scores to your cloud account.

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v22+)
- Android Studio (for mobile builds)
- A Supabase account

### 1. Database Configuration
Run the schema found in `lib/supabase/schema.sql`, `lib/supabase/results_migration.sql`, and `lib/supabase/delete_user.sql` in your Supabase SQL Editor to initialize the tables, RLS policies, and account deletion functions.

### 2. Environment Variables
Create a `.env.local` file in the root directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Web & Privacy Policy Hosting (Vercel)
The web version and privacy policy are hosted on Vercel. 
- **Production URL:** `https://p10-racing.vercel.app`
- **Privacy Policy:** `/privacy`
- **Account Deletion:** `/delete-account`

Ensure the Environment Variables are also added to the Vercel project settings.

### 4. Installation
```bash
npm install
```

### 4. Development
```bash
# Run web version
npm run dev

# Run full Vitest suite (Modern, Mocked E2E)
# Type-check
npm run type-check

# Run tests (Vitest with E2E Mocks)
npm test

# Run tests with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### 5. Android Development
```bash
# Build the web assets
npm run build

# Sync with Android project
npx cap sync android

# Open in Android Studio
npx cap open android
```

## 🏗️ Architecture
- **Framework**: Next.js 15 (App Router)
- **Styling**: Bootstrap 5 + Custom CSS
- **State Management**: React Hooks + Supabase Auth
- **Database**: PostgreSQL (Supabase)
- **Testing**: Vitest + MSW (Mock Service Worker) + React Testing Library
- **Mobile Bridge**: Capacitor JS
- **Automation**: GitHub Actions (Lint, Type-check, Vitest, APK Build)

## 🧪 Testing
The project uses **Vitest** for a fast, modern testing experience, combined with **MSW** to mock cloud services (Supabase, FCM, F1 API) and **Capacitor** plugins.

- **Mocked E2E**: Tests real Supabase client logic by intercepting network calls. No real database or secrets required in CI.
- **Scoring Logic**: 100% verified distance-based points and DNF calculations.
- **Data Integrity**: Automated checks for team colors, driver IDs, and season logic.
- **Race Logic**: Validates the "active race" index and prediction locking mechanisms.

Run all tests: `npm test`
New tests should use the `.vitest.test.ts` extension.

## 📦 Versioning & Releases

To ensure consistency across web, Android, and the App Store, we use a single source of truth for versioning:

1.  **Source of Truth:** The `version` field in `package.json`.
2.  **Automatic Sync:**
    -   **Android:** The `versionName` in `android/app/build.gradle` is automatically pulled from `package.json`.
    -   **UI:** The version displayed in the homepage footer is dynamically imported from `package.json`.
3.  **Process:**
    -   Increment the version in `package.json` after **every** bug fix (patch) or new feature (minor/major).
    -   The `versionCode` for Android is automatically incremented by the GitHub Actions pipeline using `${{ github.run_number }}` to ensure uniqueness for the Play Store.

## 📄 License
This project is for personal and community use. F1 and related marks are trademarks of Formula One Licensing BV.
