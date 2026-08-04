import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CircleHelp, Undo2, X } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './ui/Button';
import { useConfirm } from '../contexts/useConfirm';
import { useFeedback } from '../contexts/useFeedback';
import { useLanguage } from '../contexts/useLanguage';
import { db, isSyncOperationQueueItem, type SyncOperationQueueItem } from '../db/schema';
import {
  canKeepRollWithoutInventory,
  keepRollWithoutInventory,
  undoSyncIssue,
} from '../services/syncIssueService';
import './SyncIssuesModal.css';

type SyncIssue = {
  operation: SyncOperationQueueItem & { id: number };
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
    default:
      return 'syncIssues.errorGeneric';
  }
};

const getIssueTargetName = async (operation: SyncOperationQueueItem, userId: string): Promise<string> => {
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
  const operations = queue.filter((item): item is SyncOperationQueueItem & { id: number } => (
    isSyncOperationQueueItem(item)
    && item.id !== undefined
    && item.userId === userId
    && item.failureKind === 'needs_attention'
  ));

  return Promise.all(operations.map(async operation => ({
    operation,
    targetName: await getIssueTargetName(operation, userId),
    canKeepWithoutInventory: await canKeepRollWithoutInventory(operation, userId),
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
      setProcessingId(issue.operation.id);
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
    await runAction(issue, () => undoSyncIssue(issue.operation.id, userId), t('syncIssues.undoSuccess'));
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
      () => keepRollWithoutInventory(issue.operation.id, userId),
      t('syncIssues.keepWithoutInventorySuccess'),
    );
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
                const isProcessing = processingId === issue.operation.id;
                const operationLabel = issue.operation.operationType === 'adjust_film_stock'
                  ? t('syncIssues.adjustment')
                  : t('syncIssues.rollCreation');
                return (
                  <li key={issue.operation.id} className="sync-issue-card">
                    <div className="sync-issue-copy">
                      <span className="sync-issue-type">{operationLabel}</span>
                      <h3>{issue.targetName || t('syncIssues.unknownTarget')}</h3>
                      <p>{t(getIssueMessageKey(issue.operation.lastErrorCode))}</p>
                    </div>
                    <div className="sync-issue-actions">
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
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => void handleUndo(issue)}
                        disabled={isProcessing}
                        icon={<Undo2 size={16} />}
                      >
                        {t('syncIssues.undo')}
                      </Button>
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
