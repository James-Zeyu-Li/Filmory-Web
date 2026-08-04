import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../../../supabase/migrations/20260803002000_add_sync_updated_at_triggers.sql',
);

describe('sync updated_at migration', () => {
  it('installs the update trigger on every table used by SyncService', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    const syncTables = [
      'cameras',
      'camera_systems',
      'film_backs',
      'lenses',
      'film_stocks',
      'rolls',
      'photo_assets',
      'other_equipments',
      'collections',
      'albums',
      'album_photos',
      'tag_configs',
      'ledger_transactions',
      'user_profiles',
    ];

    expect(migration).toContain('NEW.updated_at = now()');
    expect(migration).toContain("'CREATE TRIGGER set_sync_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_sync_updated_at()'");
    expect(migration).toContain("'DROP TRIGGER IF EXISTS set_sync_updated_at ON public.%I'");
    for (const table of syncTables) {
      expect(migration).toContain(`'${table}'`);
    }
  });

  it('does not backfill or rewrite existing user rows', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).not.toMatch(/UPDATE\s+public\.[a-z_]+\s+SET/i);
  });
});
