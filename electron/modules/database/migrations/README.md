# Database Migrations

This directory contains database migrations for the Soothsayer application.

## Overview

Migrations allow us to evolve the database schema over time in a controlled, versioned manner. Each migration represents a single change to the database structure.

## File Structure
migrations/
├── README.md                               # This file
├── Migration.interface.ts                  # Migration interface definition
├── MigrationRunner.ts                      # Migration execution engine
├── index.ts                                # Migration registry
└── YYYYMMDD_HHMMSS_description.ts          # Individual migration files


## How Migrations Work

1. **Automatic Execution**: Migrations run automatically when the app starts
2. **One-Time Only**: Each migration runs only once and is tracked in the `migrations` table
3. **Ordered**: Migrations execute in chronological order based on their ID
4. **Transactional**: Each migration runs in a transaction - if it fails, changes are rolled back

## Creating a New Migration

### 1. Create the Migration File

Create a new file following the naming convention:
`YYYYMMDD_HHMMSS_description_of_change.ts`


Example: `20240320_143022_add_user_preferences.ts`

### 2. Implement the Migration

```typescript
import type Database from "better-sqlite3";
import type { Migration } from "./Migration.interface";

export const migration_20240320_143022_add_user_preferences: Migration = {
  id: "20240320_143022_add_user_preferences",
  description: "Add user preferences table",

  up(db: Database.Database): void {
    // Upgrade: add new features
    db.exec(`
      CREATE TABLE user_preferences (
        id INTEGER PRIMARY KEY,
        theme TEXT NOT NULL DEFAULT 'dark',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  },

  down(db: Database.Database): void {
    // Downgrade: revert changes
    db.exec(`DROP TABLE user_preferences`);
  },
};
```
