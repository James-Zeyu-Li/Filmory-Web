import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSyncDiagnosticEntries,
  getSyncDiagnosticEntries,
  recordSyncDiagnostic,
} from '../services/syncDiagnostics';

describe('sync diagnostics', () => {
  beforeEach(() => {
    clearSyncDiagnosticEntries();
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearSyncDiagnosticEntries();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('does not persist diagnostics unless explicitly enabled', () => {
    vi.stubEnv('VITE_ENABLE_SYNC_DEBUG_LOGGING', 'false');

    recordSyncDiagnostic('intent_requested', { intent: 'immediate', reason: 'film-stock-adjust' });

    expect(getSyncDiagnosticEntries()).toEqual([]);
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('keeps the latest 100 sanitized diagnostic entries when enabled', () => {
    vi.stubEnv('VITE_ENABLE_SYNC_DEBUG_LOGGING', 'true');

    for (let index = 0; index < 101; index += 1) {
      recordSyncDiagnostic('intent_requested', {
        intent: 'debounced',
        reason: `edit-${index}`,
      });
    }

    const entries = getSyncDiagnosticEntries();
    expect(entries).toHaveLength(100);
    expect(entries[0]).toMatchObject({ reason: 'edit-1', intent: 'debounced' });
    expect(entries.at(-1)).toMatchObject({ reason: 'edit-100', intent: 'debounced' });
    expect(console.debug).toHaveBeenCalledTimes(101);
  });
});
