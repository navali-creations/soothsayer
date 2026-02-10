#!/usr/bin/env node
/**
 * Migration Generator Script
 *
 * Creates a new migration file with boilerplate code
 *
 * Usage:
 *   # Direct execution
 *   node main/modules/database/migrations/create-migration.ts add_user_preferences
 *
 *   # Or add to package.json scripts:
 *   "scripts": {
 *     "migration:create": "tsx main/modules/database/migrations/create-migration.ts"
 *   }
 *
 *   # Then use:
 *   npm run migration:create add_user_preferences
 */

import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createMigration(description: string): void {
  if (!description) {
    console.error("❌ Error: Migration description is required\n");
    console.log("Usage:");
    console.log("  node create-migration.ts <description>\n");
    console.log("Examples:");
    console.log("  node create-migration.ts add_user_avatar");
    console.log("  node create-migration.ts rename_column_username");
    console.log("  npm run migration:create add_user_preferences");
    process.exit(1);
  }

  // Generate timestamp in format: YYYYMMDD_HHMMSS
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

  // Sanitize description for filename and variable name
  const sanitizedDescription = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!sanitizedDescription) {
    console.error(
      "❌ Error: Description must contain at least one alphanumeric character",
    );
    process.exit(1);
  }

  const migrationId = `${timestamp}_${sanitizedDescription}`;
  const variableName = `migration_${migrationId}`;
  const filename = `${migrationId}.ts`;
  const filepath = join(__dirname, filename);

  // Check if file already exists
  if (existsSync(filepath)) {
    console.error(`❌ Error: Migration file already exists: ${filename}`);
    process.exit(1);
  }

  // Human-readable description
  const humanDescription = sanitizedDescription.replace(/_/g, " ");

  // Generate the migration template
  const template = `import type Database from "better-sqlite3";
import type { Migration } from "./Migration.interface";

/**
 * Migration: ${humanDescription}
 *
 * TODO: Describe what this migration does and why it's needed
 *
 * Example:
 * This migration adds a user_avatar column to store profile pictures.
 * We're adding this to support the new profile customization feature.
 */
export const ${variableName}: Migration = {
  id: "${migrationId}",
  description: "${humanDescription}",

  up(db: Database.Database): void {
    // TODO: Implement the migration (upgrade)
    // This code runs when migrating forward

    // Example: Add a new table
    // db.exec(\`
    //   CREATE TABLE example_table (
    //     id INTEGER PRIMARY KEY AUTOINCREMENT,
    //     name TEXT NOT NULL,
    //     created_at TEXT NOT NULL DEFAULT (datetime('now'))
    //   )
    // \`);

    // Example: Add a column to existing table
    // db.exec(\`
    //   ALTER TABLE users ADD COLUMN avatar_url TEXT
    // \`);

    // Example: Create an index
    // db.exec(\`
    //   CREATE INDEX idx_users_email ON users(email)
    // \`);

    console.log("[Migration] ✓ Applied: ${migrationId}");
  },

  down(db: Database.Database): void {
    // TODO: Implement the rollback (downgrade)
    // This code reverts the changes made by up()

    // Example: Drop the table
    // db.exec(\`DROP TABLE example_table\`);

    // Example: Remove the column (SQLite requires recreating the table)
    // db.exec(\`
    //   CREATE TABLE users_backup AS SELECT id, name, email FROM users;
    //   DROP TABLE users;
    //   ALTER TABLE users_backup RENAME TO users;
    // \`);

    // Example: Drop the index
    // db.exec(\`DROP INDEX idx_users_email\`);

    console.log("[Migration] ✓ Rolled back: ${migrationId}");
  },
};
`;

  // Write the file
  try {
    writeFileSync(filepath, template, "utf-8");
    console.log("\n✅ Migration created successfully!\n");
    console.log(`📄 File: ${filename}`);
    console.log(`📍 Path: ${filepath}\n`);

    console.log("📋 Next steps:\n");
    console.log(`1. Open ${filename}`);
    console.log("2. Implement the up() method (add your schema changes)");
    console.log("3. Implement the down() method (revert your changes)");
    console.log("4. Add the migration to index.ts:\n");

    console.log("   // In migrations/index.ts");
    console.log(`   import { ${variableName} } from "./${migrationId}";`);
    console.log("");
    console.log("   export const migrations: Migration[] = [");
    console.log("     // ... existing migrations");
    console.log(`     ${variableName}, // <- Add this line`);
    console.log("   ];\n");

    console.log(
      "5. Update Database.types.ts if you're adding/modifying tables",
    );
    console.log(
      "6. Test by starting the app - migration will run automatically\n",
    );

    console.log("💡 Tips:");
    console.log(
      "   • Migrations run in a transaction - if they fail, changes are rolled back",
    );
    console.log("   • Test both up() and down() to ensure rollback works");
    console.log("   • Keep migrations small and focused on one logical change");
    console.log("   • Never modify an already-deployed migration\n");
  } catch (error) {
    console.error("❌ Error writing migration file:", error);
    process.exit(1);
  }
}

// Main execution — only runs when the script is executed directly, not when imported
export function main(): void {
  const args = process.argv.slice(2);
  const description = args[0];

  if (!description) {
    console.error("❌ Error: No description provided\n");
    console.log("Usage:");
    console.log("  pnpm migration:create <description>");
    console.log("\nExample:");
    console.log("  pnpm migration:create add_user_preferences\n");
    process.exit(1);
  }

  createMigration(description);
}

// Guard: only execute when run directly as a script (not when imported by tests/other modules)
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1] === __filename ||
    process.argv[1] === fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main();
}
