# Privacy Policy

**Data Controller:** Soothsayer  
**Last Updated:** April 2026

Soothsayer is an open-source desktop application for tracking Path of Exile divination card drops. This privacy policy explains what data we collect, how we use it, and your rights.

---

## What We Collect

### Crash Reports (Sentry)

When crash reporting is enabled, anonymous error reports are sent when something goes wrong. These include:

- **Error type and message** — file paths are scrubbed of usernames before sending
- **Stack traces** — file paths are scrubbed of usernames before sending
- **Operating system type and version** (e.g. Windows 11, Linux)
- **App version and Electron version**
- **Breadcrumb timeline** — a sequence of events leading up to the error (paths scrubbed)

Crash reports do **not** include your username, file paths, IP address, or any game data.

### Usage Analytics (Umami)

When usage analytics are enabled, anonymous page views and feature usage events are tracked via [Umami Cloud](https://umami.is/), a privacy-focused analytics platform. This helps us understand which features are used most so we can prioritize development.

Usage analytics do **not** include any personal identifiers. We see aggregated counts like "50 users opened the Overlay today", not who did.

### Anonymous Supabase Session

The app creates an anonymous session with our backend (Supabase) to access shared data like price snapshots. This session uses a random UUID and is not linked to any personal identity.

### Community Drop Rate Uploads

When community uploads are enabled (Settings → Privacy & Telemetry), Soothsayer automatically shares your stacked deck drop data at the end of each session to help build community drop rate statistics.

- A **locally-generated random ID** (UUID) is used to identify your device for deduplication — this ID is generated once and stored only on your machine. It is not linked to any personal identity.
- Your **card drop counts** (card name + cumulative count) are uploaded per league
- If you link your GGG account via OAuth, your **GGG account name** and **GGG account UUID** are stored alongside your uploads for a "verified" badge
- The GGG OAuth token is used solely to verify your identity and is **not** stored server-side
- Uploads are **on by default** but can be disabled at any time in Settings → Privacy & Telemetry
- GGG account linking is **entirely optional** — uploads work anonymously without it
- **Existing data** from prior sessions is never uploaded automatically. If you have drop data that hasn't been contributed yet, the app will show a one-time banner with an opt-in checkbox — your data is only uploaded if you explicitly check the box and confirm. Dismissing the banner is **permanent** (persisted locally) — it will never reappear, even after restarting the app.

---

## What We Do NOT Collect

- Usernames or file paths (scrubbed before sending)
- IP addresses (disabled in Sentry server settings)
- Game data, stash contents, or trade history
- Keystroke or input data
- Any data when telemetry is disabled

---

## How We Use Your Data

- **Crash reports** — to fix bugs and edge cases across different systems
- **Usage analytics** — to understand which features matter most and prioritize development
- **Anonymous sessions** — to provide access to shared price data and app functionality
- **Community uploads** — to aggregate card drop statistics for community insights on [wraeclast.cards](https://wraeclast.cards)

---

## Where Data Is Processed

| Service | Purpose | Region |
|---|---|---|
| [Sentry](https://sentry.io/) | Crash reporting | EU (Frankfurt) |
| [Umami Cloud](https://umami.is/) | Usage analytics | EU |
| [Supabase](https://supabase.com/) | Backend services | EU (Frankfurt) |

---

## Data Retention

| Data | Retention |
|---|---|
| Sentry crash reports | 30 days (auto-deleted) |
| Umami analytics | 90 days (aggregated, no personal data) |
| Supabase `api_requests` | 24–48 hours (auto-cleaned via daily cron) |
| Community upload data | Indefinite (pseudonymized by device UUID or GGG UUID) |
| Local app data (SQLite) | Until you delete it — fully under your control |

---

## Your Choices

### Opt Out of Telemetry

You can disable crash reporting and/or usage analytics at any time:

- **Settings → Privacy & Telemetry** — toggle each independently
- **Setup Wizard** — new users are informed during initial setup; all telemetry options are optional

The app is **fully functional** with all telemetry disabled. No features are gated behind telemetry consent.

### Community Uploads

Community drop rate uploads are enabled by default and can be toggled independently:

- **Settings → Privacy & Telemetry → Community Drop Rates** — toggle uploads on/off
- Linking a GGG account is optional — use the "Link GGG Account" button in Settings to get a verified badge, or "Unlink" to return to anonymous uploads

### Your Local Data

All session data, card drops, settings, and snapshots are stored locally on your computer in a SQLite database. You have full control over this data:

- Use **Settings → Storage → Delete League Data** to remove specific league data
- Use **Settings → Danger Zone → Reset Database** to delete all local data
- Or simply delete the Soothsayer app data folder from your system

---

## Your Rights (GDPR)

Under the General Data Protection Regulation (GDPR), you have the right to:

1. **Access** — Request a copy of all data we hold about you (Article 15)
2. **Erasure** — Request deletion of all your data (Article 17 — "right to be forgotten")
3. **Rectification** — Request correction of inaccurate data (Article 16)
4. **Portability** — Receive your data in a machine-readable format (Article 20)
5. **Object** — Object to processing of your data (Article 21)

### How to Make a Request

Contact **`@ailundefined`** on Discord with **`[GDPR Access Removal]`** in the message.

Requests are processed within **30 days**.

### Important Notes

- **Without GGG account linked:** We hold no data that can identify you. Your device UUID is a random identifier with no link to your personal identity.
- **With GGG account linked:** Your GGG username becomes the lookup key. You can request export or deletion of all associated data.
- **Ban retention:** Under GDPR Article 17(3)(e), if your account has been flagged for abuse of community features, we may retain a pseudonymous abuse prevention record (containing no personally identifiable information) after processing a deletion request. This is necessary to protect the integrity of community-contributed data.

---

## Third-Party Services

| Service | Provider | Purpose |
|---|---|---|
| Sentry | Functional Software GmbH | Crash and error reporting |
| Umami Cloud | Umami Software Inc. | Privacy-focused usage analytics |
| Supabase | Supabase Inc. | Backend services and database |
| GGG / Grinding Gear Games | Grinding Gear Games Ltd. | OAuth identity verification only |

Each third-party service has its own privacy policy. We encourage you to review them.

---

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be committed to this repository and noted in release changelogs. The "Last Updated" date at the top of this document reflects the most recent revision.

---

## Contact

- **Discord:** `@ailundefined` (for GDPR requests, use `[GDPR Access Removal]` prefix)
- **GitHub:** [Issues](https://github.com/navali-creations/soothsayer/issues) or [Discussions](https://github.com/navali-creations/soothsayer/discussions) on `navali-creations/soothsayer`
