# Privacy Policy

**Data Controller:** Soothsayer  
**Last Updated:** October 2026

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

### Anonymous Supabase Session

The app creates an anonymous session with our backend (Supabase) to access shared data like price snapshots. This session uses a random UUID and is not linked to any personal identity.

### Security and Abuse Prevention

When the app contacts backend endpoints, Soothsayer may create a short-lived pseudonymous security identifier for rate limiting and abuse prevention. This identifier is derived from your network address using HMAC-SHA-256 with a server-side secret.

- Your raw IP address is **not stored** in the database
- The identifier cannot be decoded back into your IP address without the server-side secret
- The identifier is used only for rate limiting, abuse detection, and protecting backend services
- These request records are retained for 24-48 hours and then automatically cleaned up

### Community Drop Rate Uploads

When community uploads are enabled (Settings → Privacy & Telemetry), Soothsayer automatically shares your stacked deck drop data at the end of each session to help build community drop rate statistics.

- All shared card data (names, counts, and separately opted-in opening times and areas) is uploaded anonymously under a **locally-generated random ID** (UUID) unless you choose to verify your data by linking your GGG account. These upload IDs keep contributions deduplicated without including your GGG account details in anonymous uploads. The app keeps its installation ID separate from upload IDs created when you unlink.
- Your **card drop counts** (card name + cumulative count) are uploaded per league
- **Opening times and in-game areas are off by default and require separate, explicit agreement**, including for users who already enabled card count uploads. Enabling Community Drop Rates or linking a GGG account does not grant this permission.
- Only after you agree, card drops that can be matched to an entry in `Client.txt` share the **in-game area name**, **minute of the local day**, and **UTC offset** at the time of the opening. **These times show time-of-day patterns.** Unverified uploads use a random upload ID, without your GGG account details. Areas refer to locations within Path of Exile, not your real-world location. Exact dates and timestamps are not uploaded.
- Soothsayer may scan preserved entries in `Client.txt` to add this context to earlier locally recorded drops. Your separate agreement also covers uploading this historical context. Until you agree, context and queued events stay on your device. Context is skipped when the log was deleted, truncated, has no preceding area entry, or cannot be matched confidently.
- If you link your GGG account via OAuth, your **GGG account name** and **GGG account UUID** are stored alongside future uploads for a "verified" badge. Previously anonymous uploads stay anonymous
- The GGG OAuth token is used solely to verify your identity and is **not** stored server-side
- Community uploads are **off until you explicitly enable Community Drop Rates** in Settings → Privacy & Telemetry or confirm the contribution banner. Existing contributors keep their original agreement to share card names and counts, unless they turned sharing off. Older automatic upload preferences alone do not grant consent. Opening times and areas always require their separate agreement. Turning community uploads off stops both card-count and time/area uploads.
- GGG account linking is **entirely optional** — uploads work anonymously without it
- **Existing cumulative card counts** stay local until you enable community sharing. If you have counts that have not been contributed yet, the app shows a one-time banner with an opt-in checkbox. Checking the box and confirming enables Community Drop Rates and contributes those counts. Dismissing the banner is **permanent** (persisted locally); you can still choose to share from Settings later. This count backfill does not grant permission to upload opening times and areas; that requires the separate agreement above.

### Local App Performance Diagnostics

When app performance diagnostics are enabled, Soothsayer records local diagnostic readings to help troubleshoot performance issues. These readings are stored only on your computer in the local SQLite database unless you manually export and send a report to the maintainers.

Local diagnostics may include:

- **CPU usage** — Soothsayer process usage and system usage samples
- **Memory usage** — Soothsayer process memory, renderer memory, and system memory samples
- **Renderer FPS** — frame-rate samples while the app window is visible
- **Route/page timeline** — labels for pages visited during the diagnostic capture, such as "Cards", "Settings", or "App Performance"
- **Timestamps and capture duration**
- **App/runtime metadata in exported reports** — app version, Electron version, Node version, operating system type/version, sample counts, and summary statistics

Performance diagnostic reports are **not uploaded automatically**. The app only creates a `.txt` report when you choose to export one. The maintainers only receive a report if you choose to send it yourself, for example through Discord or GitHub. If you send a report through a third-party service, that message is also subject to that service's own privacy policy.

---

## What We Do NOT Collect

- Usernames or file paths (scrubbed before sending)
- Raw IP addresses in telemetry or backend request logs
- Game data beyond the community drop information disclosed above, stash contents, or trade history
- Keystroke or input data
- App performance diagnostics unless you manually export and send a report
- Crash reports when crash reporting is disabled
- Usage analytics or feature interaction events

---

## How We Use Your Data

- **Crash reports** — to fix bugs and edge cases across different systems
- **Anonymous sessions** — to provide access to shared price data and app functionality
- **Security identifiers** — to rate-limit backend requests, detect abuse, and protect shared services
- **Community uploads** — to aggregate card drop statistics for community insights on [wraeclast.cards](https://wraeclast.cards)
- **User-shared diagnostics** — to troubleshoot performance issues when you choose to send an exported diagnostics report

---

## Where Data Is Processed

| Service | Purpose | Region |
|---|---|---|
| [Sentry](https://sentry.io/) | Crash reporting | EU (Frankfurt) |
| [Supabase](https://supabase.com/) | Backend services | EU (Frankfurt) |
| Local device only | App performance diagnostics storage and export | Your computer |

---

## Data Retention

| Data | Retention |
|---|---|
| Sentry crash reports | 30 days (auto-deleted) |
| Supabase `api_requests` and pseudonymous security identifiers | 24–48 hours (auto-cleaned via daily cron) |
| Community upload data | Indefinite (pseudonymized by device UUID or GGG UUID) |
| Local app performance diagnostics | User-selected: 24 hours, 7 days (default), or indefinite — stored only in local SQLite unless you manually export and share |
| Local app data (SQLite) | Until you delete it — fully under your control |

---

## Your Choices

### Opt Out of Telemetry

You can disable crash reporting at any time:

- **Settings → Privacy & Telemetry** — toggle crash reporting
- **Setup Wizard** — new users are informed during initial setup; crash reporting is optional

The app is **fully functional** with crash reporting disabled. No features are gated behind telemetry consent.

### Community Uploads

Community drop rate uploads require explicit opt-in and can be toggled independently:

- **Settings → Privacy & Telemetry → Community Drop Rates** — toggle uploads on/off
- **Opening Times & Areas** — shown only while Community Drop Rates is enabled. Use its separate toggle in Privacy settings to agree to share opening times and in-game areas, or turn it off to stop future context uploads without restarting. Uploads already in progress may finish. Previously uploaded data is retained under the retention policy above; see "How to Make a Request" for deletion requests.
- The one-time sharing prompt offers **Agree** and **Disagree** buttons. Choosing Disagree keeps time and area sharing off and saves that choice, while card names and counts can still be shared. Setup offers the same optional choice through a separate checkbox.
- Linking a GGG account is optional — use the "Link GGG Account" button in Settings to verify future contributions. **Previously verified uploads stay verified and associated with that GGG account after unlinking.** Unlink clears your local GGG sign-in and starts a fresh random upload ID for future anonymous contributions. It works offline, leaves your sharing settings unchanged, and does not change historical counts or verification status. Losing your local GGG sign-in also switches future contributions to a fresh anonymous ID; pending verified contributions stay paused until that account is linked again. Linking the same GGG account again on this installation resumes its previous verified upload ID; a different account uses a separate ID. Contributions made while unlinked remain anonymous, including pending retries. Existing counts and opening events are never copied to a new upload ID.

Deleting league data also removes its unsent contributions. Future openings in that league use fresh upload IDs so deleted history is neither copied nor counted again. Already uploaded history is retained under the retention policy above.

### App Performance Diagnostics

App performance diagnostics are optional and local-first:

- **Settings → App Help → Diagnostic Log → App Performance diagnostics** — toggle diagnostics on/off
- **Keep diagnostics captures** — choose retention: 24 hours, 7 days (default), or indefinitely
- **App Performance → Export report** — creates a local `.txt` file only when you choose to export
- Reports are only shared with maintainers if you manually send them
- Diagnostics storage is counted in **Settings → Storage** and can also be removed by resetting the local database

### Your Local Data

All session data, card drops, settings, snapshots, and optional app performance diagnostics are stored locally on your computer in a SQLite database. You have full control over this data:

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

- **Anonymous uploads:** Uploads made without verification use a random upload ID and do not include GGG account details. Unlinking does not remove the account association from previously verified uploads.
- **With GGG account linked:** Your GGG username becomes the lookup key. You can request export or deletion of all associated data.
- **Ban retention:** Under GDPR Article 17(3)(e), if your account or pseudonymous security identifier has been flagged for abuse of community features, we may retain an abuse prevention record after processing a deletion request. This record does not include raw IP addresses, GGG OAuth tokens, stash contents, local file paths, or app performance diagnostics. This is necessary to protect the integrity of community-contributed data.

---

## Third-Party Services

| Service | Provider | Purpose |
|---|---|---|
| Sentry | Functional Software GmbH | Crash and error reporting |
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
