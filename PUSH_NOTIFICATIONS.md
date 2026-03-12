# Push Notification Setup (Android)

To enable push notifications for P10 Racing on Android, follow these steps:

## 1. Firebase Project Setup
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Create a new project (e.g., "P10 Racing").
3.  Add an Android app with package name `com.p10racing`.
4.  Download the `google-services.json` file.
5.  Place `google-services.json` in `android/app/`.

## 2. Supabase Integration
1.  Go to Project Settings > API in your Supabase Dashboard.
2.  Create a Supabase Edge Function named `send-push-notification`.
3.  Add your Firebase Service Account JSON to Supabase Secrets as `FIREBASE_SERVICE_ACCOUNT`.
4.  Enable the "Database Webhook" for the `public.notifications` table to trigger the Edge Function whenever a new notification is inserted.

## 3. Deployment
1.  Run `npx cap sync android` to sync the new Capacitor plugins.
2.  Build the app and install it on an Android device/emulator.

## Triggering Notifications
- **Qualifying Finished (AUTOMATIC):** Deploy the Edge Function in `lib/supabase/edge_function_check.ts` and schedule it via Supabase Cron (e.g., every 30 mins on race weekends).
- **Race Results (AUTOMATIC):** Triggered when the admin publishes results to `verified_results`.
- **End of Season (AUTOMATIC):** Triggered at Round 24.

## 4. Automation with Supabase Cron
To make Qualifying notifications fully automatic:
1.  Deploy the `check-f1-results` Edge Function (`lib/supabase/edge_function_check.ts`).
2.  Enable the `pg_cron` extension in Supabase (Database > Extensions).
3.  Run the following SQL to schedule the check every hour:
    ```sql
    select
      cron.schedule(
        'check-f1-results-job',
        '0 * * * *', -- Every hour
        $$
        select
          net.http_get(
            url:='https://<your-project-ref>.supabase.co/functions/v1/check-f1-results',
            headers:=jsonb_build_object('Authorization', 'Bearer <YOUR_ANON_OR_SERVICE_ROLE_KEY>')
          ) as request_id;
        $$
      );
    ```
