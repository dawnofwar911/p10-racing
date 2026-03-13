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

---

## 🛡️ How to Stop Emails from Going to Spam

If your emails are landing in "Spam" or "Junk," it is because your domain (`p10racing.app`) has not been fully "authorized" to send mail.

### 1. Complete Resend Domain Verification (Crucial)
In your **Resend Dashboard** > **Domains**, you must add the **DKIM** and **SPF** records they provide to your domain registrar (GoDaddy, Namecheap, etc.).
- This proves to email providers (Gmail, Outlook) that you are the real owner.

### 2. Add a DMARC Record
Adding a DMARC record tells email providers what to do with "fake" emails claiming to be you. It increases your trust score significantly. 
Go to your domain DNS settings and add a new **TXT** record:
- **Host/Name:** `_dmarc`
- **Value:** `v=DMARC1; p=none;`

### 3. Match the "From" Address
In your Supabase SMTP settings, ensure the **Sender Email** is exactly:
`no-reply@p10racing.app`
(The domain MUST match your verified Resend domain perfectly).

---

## 🎨 How to set the Sender Avatar (Inbox Logo)

The logo that appears next to your name in the user's inbox is not in the HTML. Since you are using Resend with a custom domain, you must link your address to a profile picture:

1. **For Gmail (Most users):** 
   - Go to Google Account Signup.
   - Click **"Use my current email address instead"**.
   - Enter `no-reply@p10racing.app`.
   - Once verified, upload your logo as the profile picture for that Google account.
2. **For Others (Outlook/Apple):** 
   - Register `no-reply@p10racing.app` at **Gravatar.com**.
   - Upload your logo there.
3. **BIMI (Professional):** For the "Blue Checkmark" in some clients, you can look into "BIMI" DNS records, which is the official enterprise standard.
