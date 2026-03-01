---
"soothsayer": minor
---

- **Storage settings card:** A new Storage card on the Settings page shows how much disk space Soothsayer's app data and SQLite database consume. Two progress bars visualise usage — app data relative to total disk space, and the database relative to app data — with human-readable sizes and percentages.

- **League data cleanup:** The Storage card lists every league with stored data, showing session and snapshot counts alongside estimated sizes. You can delete all data for a league to reclaim space, with a confirmation modal to prevent accidents. The active session's league is protected from deletion.

- **Low disk space warning:** When free disk space drops below 1 GB a warning icon appears in the app bar. Hovering shows remaining space; clicking navigates straight to Settings so you can clean up.