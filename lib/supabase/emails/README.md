# P10 Racing - Supabase Email Configuration Guide

These templates are designed to work perfectly with Gmail SMTP and Resend, maintaining a professional F1-branded look even when styles are stripped by aggressive email clients.

## 📍 Where to Paste

In your **Supabase Dashboard**:
1. Go to **Authentication** > **Email Templates**.

### 1. Confirm Signup
- **Subject:** `Confirm your P10 Racing grid access 🏁`
- **Body:** Copy the content of `confirm_signup.html` into the "Message body" field.

### 2. Reset Password
- **Subject:** `P10 Racing: Password Recovery dispatched 🏎️💨`
- **Body:** Copy the content of `reset_password.html` into the "Message body" field.

---

## ⚙️ URL Configuration
Ensure your links redirect correctly:
1. Go to **Authentication** > **URL Configuration**.
2. **Site URL:** `https://p10racing.app`
3. **Redirect URLs:** 
   - `https://p10racing.app/**`
   - `com.p10racing.app://*` (For native app redirection)
