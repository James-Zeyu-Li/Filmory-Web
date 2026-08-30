export type SyncFailure = {
  kind: 'retryable' | 'needs_attention';
  code: string;
  message: string;
};

export class SyncPushError extends Error {
  readonly nextRetryAt: number | null;

  constructor(nextRetryAt: number | null) {
    super('One or more sync push batches failed.');
    this.nextRetryAt = nextRetryAt;
  }
}

export const getErrorDetails = (error: unknown): { code: string; status?: number; message: string } => {
  const value = error as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof value?.code === 'string' ? value.code : '';
  const status = typeof value?.status === 'number' ? value.status : undefined;
  const message = error instanceof Error
    ? error.message
    : typeof value?.message === 'string'
      ? value.message
      : 'Unknown sync failure.';
  return { code, status, message };
};

export const classifySyncFailure = (error: unknown): SyncFailure => {
  const { code, status, message } = getErrorDetails(error);
  const normalizedCode = code.toUpperCase();
  const isRetryableStatus = status === 408 || status === 429 || (status !== undefined && status >= 500);
  const isActionableStatus = status !== undefined && status >= 400 && status < 500 && !isRetryableStatus;
  const isActionableCode = /^(42501|23503|23505|22P02|PGRST)/.test(normalizedCode);

  return {
    kind: isActionableStatus || isActionableCode ? 'needs_attention' : 'retryable',
    code: code || (status ? String(status) : 'unknown'),
    message: message.slice(0, 240),
  };
};

export const RETRY_SYNC_DELAY_MS = 5000;
const MAX_RETRY_SYNC_DELAY_MS = 5 * 60_000;

export const getRetryDelayMs = (attemptCount: number) => Math.min(
  RETRY_SYNC_DELAY_MS * (2 ** Math.max(0, attemptCount - 1)),
  MAX_RETRY_SYNC_DELAY_MS,
);
