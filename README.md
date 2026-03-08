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
Run the schema found in `lib/supabase/schema.sql` and `lib/supabase/results_migration.sql` in your Supabase SQL Editor to initialize the tables and RLS policies.

### 2. Environment Variables
Create a `.env.local` file in the root directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Installation
```bash
npm install
```

### 4. Development
```bash
# Run web version
npm run dev

# Run full test suite
npm run test

# Type-check
npm run type-check
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
- **Mobile Bridge**: Capacitor JS
- **Automation**: GitHub Actions (Lint, Type-check, Test, APK Build)

## 🧪 Testing
The project includes a robust test suite covering:
- **Scoring Logic**: Distance-based points and DNF bonuses.
- **API Integrity**: Correct parsing of F1 results and DNF identification.
- **Sync Logic**: Reachability and schema verification for Supabase.
- **Race Timing**: Automated lockouts and round transitions.

Run all tests with: `npm run test`

## 📄 License
This project is for personal and community use. F1 and related marks are trademarks of Formula One Licensing BV.
