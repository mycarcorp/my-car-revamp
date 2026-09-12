# Inventory uploads

Place the latest DealerCenter CSV export in this folder. Start the watcher with `bun run inventory:watch` to import new CSV files automatically.

Completed files are moved to `uploads/processed`. Invalid files remain in this folder and are reported in the terminal.

The watcher requires `INVENTORY_IMPORT_ACCESS_TOKEN` to be set to a staff access token, plus the existing Supabase environment variables used by the application.
