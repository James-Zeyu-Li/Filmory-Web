import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CircleHelp, RefreshCw, Undo2, X } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './ui/Button';
import { useConfirm } from '../contexts/useConfirm';
import { useFeedback } from '../contexts/useFeedback';
import { useLanguage } from '../contexts/useLanguage';
import { db, isSyncOperationQueueItem, isSyncRecordQueueItem, type SyncQueueItem } from '../db/schema';
import {
  canKeepRollWithoutInventory,
  keepRollWithoutInventory,
  retrySyncIssue,
  undoSyncIssue,
} from '../services/syncIssueService';
import './SyncIssuesModal.css';

type SyncIssue = {
  queueItem: SyncQueueItem & { id: number };
  targetName: string;
  canKeepWithoutInventory: boolean;
};

const getIssueMessageKey = (code?: string) => {
  switch (code) {
    case '42501':
      return 'syncIssues.errorPermission';
    case '23503':
    case 'FILM_STOCK_NOT_FOUND':
      return 'syncIssues.errorFilmMissing';
    case '23505':
      return 'syncIssues.errorConflict';
    case '22P02':
      return 'syncIssues.errorInvalid';
    case 'PGRST202':
    case 'PGRST204':
      return 'syncIssues.errorSchema';
    default:
      return 'syncIssues.errorGeneric';
  }
};

const getIssueTargetName = async (operation: SyncQueueItem, userId: string): Promise<string> => {
  if (isSyncRecordQueueItem(operation)) {
    const payload = operation.payload;
    if (payload && typeof payload.name === 'string') return payload.name;
    return operation.recordId;
  }

  if (operation.operationType === 'adjust_film_stock') {
    const filmStockId = operation.operationPayload.filmStockId;
    if (typeof filmStockId === 'string') {
      const film = await db.filmStocks.get(filmStockId);
      if (film?.userId === userId) return `${film.brand} ${film.name}`.trim();
    }
    return '';
  }

  const roll = operation.operationPayload.roll;
  if (typeof roll === 'object' && roll !== null && 'name' in roll && typeof roll.name === 'string') {
    return roll.name;
  }
  return '';
};

const useSyncIssues = (isOpen: boolean) => useLiveQuery(async (): Promise<SyncIssue[]> => {
  if (!isOpen) return [];
  const userId = localStorage.getItem('grainfolio_user_id');
  if (!userId) return [];
  const queue = await db.syncQueue.orderBy('timestamp').toArray();
  const failedItems = queue.filter((item): item is SyncQueueItem & { id: number } => (
    item.id !== undefined
    && item.userId === userId
    && item.failureKind === 'needs_attention'
  ));
  const visibleItems = new Map<string, SyncQueueItem & { id: number }>();

  failedItems.forEach(item => {
    const key = isSyncRecordQueueItem(item)
      ? `record:${item.tableName}:${item.recordId}`
      : `operation:${item.operationId}`;
    // The queue is timestamp ordered, so the latest record payload becomes the
    // representative issue while idempotent operations remain independent.
    visibleItems.set(key, item);
  });

  return Promise.all([...visibleItems.values()].map(async queueItem => ({
    queueItem,
    targetName: await getIssueTargetName(queueItem, userId),
    canKeepWithoutInventory: isSyncOperationQueueItem(queueItem) && await canKeepRollWithoutInventory(queueItem, userId),
  })));
}, [isOpen], []);

interface SyncIssuesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncIssuesModal: React.FC<SyncIssuesModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  const issues = useSyncIssues(isOpen);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const runAction = async (issue: SyncIssue, action: () => Promise<void>, successMessage: string) => {
    const userId = localStorage.getItem('grainfolio_user_id');
    if (!userId) return;

    try {
      setProcessingId(issue.queueItem.id);
      await action();
      notify({ type: 'success', title: t('syncIssues.updatedTitle'), message: successMessage });
    } catch (error) {
      notify({
        type: 'error',
        title: t('syncIssues.actionFailedTitle'),
        message: error instanceof Error ? error.message : t('syncIssues.actionFailedMessage'),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleUndo = async (issue: SyncIssue) => {
    const userId = localStorage.getItem('grainfolio_user_id');
    if (!userId) return;
    onClose();
    const accepted = await confirm({
      title: t('syncIssues.undoConfirmTitle'),
      message: t('syncIssues.undoConfirmMessage'),
      confirmText: t('syncIssues.undo'),
      isDanger: true,
    });
    if (!accepted) return;
    if (!isSyncOperationQueueItem(issue.queueItem)) return;
    await runAction(issue, () => undoSyncIssue(issue.queueItem.id, userId), t('syncIssues.undoSuccess'));
  };

  const handleKeepWithoutInventory = async (issue: SyncIssue) => {
    const userId = localStorage.getItem('grainfolio_user_id');
    if (!userId) return;
    onClose();
    const accepted = await confirm({
      title: t('syncIssues.keepWithoutInventoryConfirmTitle'),
      message: t('syncIssues.keepWithoutInventoryConfirmMessage'),
      confirmText: t('syncIssues.keepWithoutInventory'),
    });
    if (!accepted) return;
    await runAction(
      issue,
      () => keepRollWithoutInventory(issue.queueItem.id, userId),
      t('syncIssues.keepWithoutInventorySuccess'),
    );
  };

  const handleRetry = async (issue: SyncIssue) => {
    const userId = localStorage.getItem('grainfolio_user_id');
    if (!userId) return;
    await runAction(issue, () => retrySyncIssue(issue.queueItem.id, userId), t('syncIssues.retrySuccess'));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} style={{ maxWidth: '620px' }}>
      <div className="sync-issues-modal">
        <div className="modal-header sync-issues-header">
          <div className="sync-issues-title-group">
            <span className="sync-issues-icon" aria-hidden="true"><AlertTriangle size={20} /></span>
            <div>
              <h2>{t('syncIssues.title')}</h2>
              <p>{t('syncIssues.subtitle')}</p>
            </div>
          </div>
          <button type="button" className="modal-close sync-issues-close" onClick={onClose} aria-label={t('syncIssues.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body sync-issues-body" aria-live="polite">
          {issues.length === 0 ? (
            <div className="sync-issues-empty">
              <CircleHelp size={22} aria-hidden="true" />
              <p>{t('syncIssues.empty')}</p>
            </div>
          ) : (
            <ul className="sync-issues-list" aria-label={t('syncIssues.listLabel')}>
              {issues.map(issue => {
                const isProcessing = processingId === issue.queueItem.id;
                const operationLabel = isSyncOperationQueueItem(issue.queueItem)
                  ? issue.queueItem.operationType === 'adjust_film_stock'
                    ? t('syncIssues.adjustment')
                    : t('syncIssues.rollCreation')
                  : t('syncIssues.recordChange');
                return (
                  <li key={issue.queueItem.id} className="sync-issue-card">
                    <div className="sync-issue-copy">
                      <span className="sync-issue-type">{operationLabel}</span>
                      <h3>{issue.targetName || t('syncIssues.unknownTarget')}</h3>
                      <p>{t(getIssueMessageKey(issue.queueItem.lastErrorCode))}</p>
                    </div>
                    <div className="sync-issue-actions">
                      <Button type="button" variant="secondary" onClick={() => void handleRetry(issue)} disabled={isProcessing} icon={<RefreshCw size={16} />}>
                        {t('syncIssues.retry')}
                      </Button>
                      {issue.canKeepWithoutInventory && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void handleKeepWithoutInventory(issue)}
                          disabled={isProcessing}
                        >
                          {t('syncIssues.keepWithoutInventory')}
                        </Button>
                      )}
                      {isSyncOperationQueueItem(issue.queueItem) && <Button
                        type="button"
                        variant="danger"
                        onClick={() => void handleUndo(issue)}
                        disabled={isProcessing}
                        icon={<Undo2 size={16} />}
                      >
                        {t('syncIssues.undo')}
                      </Button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};
