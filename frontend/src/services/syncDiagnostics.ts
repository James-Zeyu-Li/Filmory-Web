import type { SyncIntent } from './syncEvents';

const SYNC_DIAGNOSTICS_STORAGE_KEY = 'grainfolio_sync_diagnostics';
const MAX_SYNC_DIAGNOSTIC_ENTRIES = 100;

export type SyncDiagnosticEvent =
  | 'intent_requested'
  | 'timer_replaced'
  | 'scheduled'
  | 'coalesced_in_flight'
  | 'run_started'
  | 'run_completed'
  | 'run_failed'
  | 'push_started'
  | 'record_batch_completed'
  | 'record_batch_failed'
  | 'inventory_operation_completed'
  | 'inventory_operation_failed'
  | 'legacy_inventory_rpc_reopened'
  | 'legacy_film_stock_schema_reopened'
  | 'pull_started'
  | 'pull_table_synced'
  | 'pull_completed'
  | 'pull_failed'
  | 'realtime_status'
  | 'realtime_change_received';

export type SyncDiagnosticEntry = {
  timestamp: number;
  event: SyncDiagnosticEvent;
  intent?: SyncIntent;
  reason?: string;
  delayMs?: number;
  runId?: number;
  triggerCount?: number;
  intentCounts?: Partial<Record<SyncIntent, number>>;
  queueItemCount?: number;
  recordItemCount?: number;
  operationItemCount?: number;
  tableName?: string;
  upsertCount?: number;
  deleteCount?: number;
  operationType?: string;
  pullMode?: 'initial' | 'incremental';
  lastSync?: string;
  downloadedCount?: number;
  keptLocalCount?: number;
  changedTableCount?: number;
  receivedRecordCount?: number;
  durationMs?: number;
  errorCode?: string;
  failureKind?: 'retryable' | 'needs_attention';
  realtimeStatus?: string;
  realtimeEventType?: string;
};

type SyncDiagnosticDetails = Omit<SyncDiagnosticEntry, 'timestamp' | 'event'>;

const isSyncDebugLoggingEnabled = () => import.meta.env.VITE_ENABLE_SYNC_DEBUG_LOGGING === 'true';

const readEntries = (): SyncDiagnosticEntry[] => {
  try {
    const raw = window.sessionStorage.getItem(SYNC_DIAGNOSTICS_STORAGE_KEY);
    if (!raw) return [];
    const entries: unknown = JSON.parse(raw);
    return Array.isArray(entries) ? entries.filter(isSyncDiagnosticEntry) : [];
  } catch {
    return [];
  }
};

const isSyncDiagnosticEntry = (value: unknown): value is SyncDiagnosticEntry => (
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { timestamp?: unknown }).timestamp === 'number' &&
  typeof (value as { event?: unknown }).event === 'string'
);

const saveEntries = (entries: SyncDiagnosticEntry[]): void => {
  try {
    window.sessionStorage.setItem(SYNC_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Diagnostics must never block the product sync path.
  }
};

export const getSyncDiagnosticEntries = (): SyncDiagnosticEntry[] => readEntries();

export const clearSyncDiagnosticEntries = (): void => {
  try {
    window.sessionStorage.removeItem(SYNC_DIAGNOSTICS_STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage in restricted contexts.
  }
};

export const recordSyncDiagnostic = (
  event: SyncDiagnosticEvent,
  details: SyncDiagnosticDetails = {},
): void => {
  if (!isSyncDebugLoggingEnabled()) return;

  const entry: SyncDiagnosticEntry = {
    timestamp: Date.now(),
    event,
    ...details,
  };
  const entries = [...readEntries(), entry].slice(-MAX_SYNC_DIAGNOSTIC_ENTRIES);
  saveEntries(entries);
  console.debug('[Grainfolio Sync]', entry);
};
