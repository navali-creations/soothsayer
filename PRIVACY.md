# Privacy Policy

**Data Controller:** Soothsayer  
**Last Updated:** March 2026

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

### Community Uploads (Future — Feature #57)

A planned future feature will allow users to voluntarily upload divination card data for community statistics. This will require linking a GGG (Grinding Gear Games) account via OAuth. When this feature ships:

- Your **GGG account name** and **GGG account UUID** will be stored alongside your upload
- The GGG OAuth token is used solely to verify your identity and is **not** stored server-side
- Uploads are **entirely voluntary** — you must explicitly initiate each one

This privacy policy will be updated when this feature launches.

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
- **Community uploads (future)** — to aggregate card drop statistics for community insights

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
| Supabase community data (future) | Indefinite (pseudonymized by GGG UUID) |
| Local app data (SQLite) | Until you delete it — fully under your control |

---

## Your Choices

### Opt Out of Telemetry

You can disable crash reporting and/or usage analytics at any time:

- **Settings → Privacy & Telemetry** — toggle each independently
- **Setup Wizard (Step 4)** — new users choose during initial setup

The app is **fully functional** with all telemetry disabled. No features are gated behind telemetry consent.

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

- **Before the community upload feature ships:** We hold no data that can identify you. Crash reports have all personal information stripped, usage analytics are fully anonymous, and Supabase sessions use random UUIDs with no link to your identity.
- **After the community upload feature ships:** Your GGG username becomes the lookup key. You can request export or deletion of all associated data.
- **Ban retention:** Under GDPR Article 17(3)(e), if your account has been flagged for abuse of community features, we may retain a pseudonymous abuse prevention record (containing no personally identifiable information) after processing a deletion request. This is necessary to protect the integrity of community-contributed data.

---

## Third-Party Services

| Service | Provider | Purpose |
|---|---|---|
| Sentry | Functional Software GmbH | Crash and error reporting |
| Umami Cloud | Umami Software Inc. | Privacy-focused usage analytics |
| Supabase | Supabase Inc. | Backend services and database |
| GGG / Grinding Gear Games (future) | Grinding Gear Games Ltd. | OAuth identity verification only |

Each third-party service has its own privacy policy. We encourage you to review them.

---

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be committed to this repository and noted in release changelogs. The "Last Updated" date at the top of this document reflects the most recent revision.

---

## Contact

- **Discord:** `@ailundefined` (for GDPR requests, use `[GDPR Access Removal]` prefix)
- **GitHub:** [Issues](https://github.com/navali-creations/soothsayer/issues) or [Discussions](https://github.com/navali-creations/soothsayer/discussions) on `navali-creations/soothsayer`
