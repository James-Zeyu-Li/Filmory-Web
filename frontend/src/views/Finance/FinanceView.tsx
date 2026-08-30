import { db } from "../../db/schema";
import React, { useState } from 'react';
import type { LedgerTransaction } from '../../db/schema';
import { useAuth } from '../../contexts/useAuth';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { useLanguage } from '../../contexts/useLanguage';
import { useLiveQuery } from 'dexie-react-hooks';
import { requestImmediateSync } from '../../services/syncEvents';
import { useCameras, useLenses, useRolls } from '../../hooks/useData';
import { Wallet, TrendingUp, TrendingDown, Plus, Camera as CameraIcon, AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { StatCard } from '../../components/ui/StatCard';
import './FinanceView.css';

interface FinanceViewProps {
  isEmbedded?: boolean;
}

const createEmptyTransactionDraft = (): Partial<LedgerTransaction> => ({
  type: 'expense',
  category: 'repair',
  amount: '' as any,
  notes: '',
  date: Date.now()
});

export const FinanceView: React.FC<FinanceViewProps> = ({ isEmbedded }) => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  const { currencySymbol, formatCurrency } = useCurrency();
  const { language, t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTx, setNewTx] = useState<Partial<LedgerTransaction>>(createEmptyTransactionDraft);

  const transactions = useLiveQuery(
    () => user?.id
      ? db.ledgerTransactions.where('userId').equals(user.id).toArray()
      : Promise.resolve([] as LedgerTransaction[]),
    [user?.id]
  )?.slice().sort((a, b) => b.date - a.date) || [];

  const cameras = useCameras();
  const lenses = useLenses();
  const rolls = useRolls();
  const formatTransactionDate = (date: number) => new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));

  // Missing Prices Logic
  const missingCameras = cameras.filter(c => c.status !== 'archived' && (c.purchasePrice === undefined || c.purchasePrice === null));
  const missingLenses = lenses.filter(l => l.status !== 'archived' && (l.purchasePrice === undefined || l.purchasePrice === null));
  const missingRollsFilm = rolls.filter(r => r.status !== 'archived' && (r.filmPrice === undefined || r.filmPrice === null));
  const missingRollsDev = rolls.filter(r => r.status !== 'archived' && r.endDate !== undefined && (r.developPrice === undefined || r.developPrice === null));
  
  const totalMissing = missingCameras.length + missingLenses.length + missingRollsFilm.length + missingRollsDev.length;

	  // Aggregations
	  let totalGearAssets = 0; // Camera + Lens + Accessory (Expense - Income)
	  let totalFilmBurned = 0; // Film + Develop + Chemical (Expense)
	  let totalServiceIncome = 0; // Service (Income)

	  transactions.forEach((tx: any) => {
    const isExpense = tx.type === 'expense';
    const amt = Math.abs(tx.amount);

    if (tx.category === 'camera' || tx.category === 'lens' || tx.category === 'accessory') {
      if (isExpense) totalGearAssets += amt;
      else totalGearAssets -= amt;
    } else if (tx.category === 'film' || tx.category === 'develop' || tx.category === 'chemical') {
      if (isExpense) totalFilmBurned += amt;
      else totalFilmBurned -= amt; // e.g. selling unused film
	    } else if (tx.category === 'service') {
	      if (!isExpense) totalServiceIncome += amt;
	    } else {
	      if (!isExpense) totalServiceIncome += amt; // Any other unexpected income
	    }
	  });

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.amount || !newTx.category) return;
    
    const amt = Number(newTx.amount);
    if (isNaN(amt) || amt <= 0) {
      notify({
        type: 'error',
        title: t('finance.invalidAmountTitle'),
        message: t('finance.invalidAmountMessage')
      });
      return;
    }

    const finalAmount = newTx.type === 'expense' ? -amt : amt;

    await db.ledgerTransactions.add({
      id: crypto.randomUUID(),
      userId: user?.id || 'offline',
      amount: finalAmount,
      date: newTx.date || Date.now(),
      type: newTx.type as 'expense' | 'income',
      category: newTx.category as any,
      notes: newTx.notes,
      addedAt: Date.now()
    });
    requestImmediateSync('finance-transaction-create');

    setNewTx(createEmptyTransactionDraft());
    setIsModalOpen(false);
  };

  const handleDeleteTx = async (id: string) => {
    const confirmed = await confirm({
      title: t('finance.deleteTitle'),
      message: t('finance.deleteMessage'),
      confirmText: t('finance.confirmDelete'),
      isDanger: true
    });
    if (confirmed) {
      const target = await db.ledgerTransactions.get(id);
      if (target?.userId !== (user?.id || 'offline')) {
        return;
      }
      await db.ledgerTransactions.delete(id);
      requestImmediateSync('finance-transaction-delete');
    }
  };

  const catLabelMap: Record<string, string> = {
    camera: t('finance.catCamera'),
    lens: t('finance.catLens'),
    film: t('finance.catFilm'),
    develop: t('finance.catDevelop'),
    chemical: t('finance.catChemical'),
    repair: t('finance.catRepair'),
    accessory: t('finance.catAccessory'),
    service: t('finance.catService'),
    other: t('finance.catOther')
  };

  const getEntityName = (tx: LedgerTransaction) => {
    if (!tx.relatedEntityId) return null;
    if (tx.category === 'camera') return cameras.find(c => c.id === tx.relatedEntityId)?.name;
    if (tx.category === 'lens') return lenses.find(l => l.id === tx.relatedEntityId)?.name;
    if (tx.category === 'film' || tx.category === 'develop') return rolls.find(r => r.id === tx.relatedEntityId)?.name;
    return null;
  };

  return (
    <div className={isEmbedded ? "" : "main-content"}>
      {!isEmbedded && (
        <header className="view-header">
          <h1>{t('finance.title')}</h1>
          <div className="view-header-actions">
            <button className="primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> {t('finance.addEntry')}
            </button>
          </div>
        </header>
      )}

      <div className={`finance-dashboard ${isEmbedded ? 'finance-dashboard--embedded' : ''}`}>
        {isEmbedded && (
          <div className="finance-embedded-action">
            <button className="primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> {t('finance.addEntry')}
            </button>
          </div>
        )}
        {/* KPI Cards */}
        <div className="stat-card-grid">
          <StatCard
            tone="sky"
            icon={CameraIcon}
            label={t('finance.gearInvestment')}
            value={formatCurrency(totalGearAssets)}
            description={t('finance.gearInvestmentDesc')}
          />
          <StatCard
            tone="red"
            icon={TrendingDown}
            label={t('finance.filmLabCost')}
            value={formatCurrency(totalFilmBurned)}
            description={t('finance.filmLabCostDesc')}
          />
          <StatCard
            tone="emerald"
            icon={TrendingUp}
            label={t('finance.income')}
            value={formatCurrency(totalServiceIncome)}
            description={t('finance.incomeDesc')}
          />
        </div>

        {/* Missing Prices Alert Panel */}
        {totalMissing > 0 && (
          <div className="finance-alert-panel">
            <h3>
              <AlertTriangle size={18} />
              {t('finance.missingPricesTitle', { count: totalMissing })}
            </h3>
            <p>
              {t('finance.missingPricesDesc')}
            </p>
            <div className="finance-alert-tags">
              {missingCameras.map(c => (
                <span key={c.id} className="finance-alert-tag">[{t('finance.tagCamera')}] {c.name}</span>
              ))}
              {missingLenses.map(l => (
                <span key={l.id} className="finance-alert-tag">[{t('finance.tagLens')}] {l.name}</span>
              ))}
              {missingRollsFilm.map(r => (
                <span key={`f-${r.id}`} className="finance-alert-tag">[{t('finance.tagFilmCost')}] {r.name}</span>
              ))}
              {missingRollsDev.map(r => (
                <span key={`d-${r.id}`} className="finance-alert-tag">[{t('finance.tagLabCost')}] {r.name}</span>
              ))}
            </div>
          </div>
        )}

        {/* Ledger Table */}
        <div className="finance-ledger">
          <div className="ledger-header-row">
            <h2>{t('finance.ledgerTitle')}</h2>
            <span className="ledger-count">{t('finance.ledgerCount', { count: transactions.length })}</span>
          </div>
          
          <div className="ledger-table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>{t('finance.date')}</th>
                  <th>{t('finance.flow')}</th>
                  <th>{t('finance.category')}</th>
                  <th>{t('finance.entity')}</th>
                  <th>{t('finance.notes')}</th>
                  <th className="ledger-align-end">{t('finance.amount')}</th>
                  <th className="ledger-align-end">{t('finance.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="ledger-empty-cell">
                      <Wallet size={48} />
                      <p>{t('finance.noRecords')}</p>
                      <p>{t('finance.noRecordsDesc')}</p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="ledger-date-cell">
                        {formatTransactionDate(tx.date)}
                      </td>
                      <td>
                        {tx.type === 'expense' ? (
                          <span className="tx-badge expense">{t('finance.expense')}</span>
                        ) : (
                          <span className="tx-badge income">{t('finance.incomeBadge')}</span>
                        )}
                      </td>
                      <td>{catLabelMap[tx.category] || tx.category}</td>
                      <td>
                        {getEntityName(tx) ? (
                          <span className="ledger-entity-name">{getEntityName(tx)}</span>
                        ) : (
                          <span className="ledger-empty-value">-</span>
                        )}
                      </td>
                      <td className="ledger-notes-cell">
                        {tx.notes || '-'}
                      </td>
                      <td className={`ledger-align-end ledger-amount-cell ${tx.type === 'expense' ? 'is-expense' : 'is-income'}`}>
                        {tx.type === 'expense' ? '-' : '+'} {formatCurrency(Math.abs(tx.amount))}
                      </td>
                      <td className="ledger-align-end">
                        <button className="icon-btn danger" onClick={() => handleDeleteTx(tx.id!)}>
                          {t('finance.delete')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="ledger-mobile-list" aria-label={t('finance.ledgerTitle')}>
            {transactions.length === 0 ? (
              <div className="ledger-mobile-empty">
                <Wallet size={32} aria-hidden="true" />
                <p>{t('finance.noRecords')}</p>
                <span>{t('finance.noRecordsDesc')}</span>
              </div>
            ) : (
              transactions.map((tx: any) => {
                const entityName = getEntityName(tx);
                const isExpense = tx.type === 'expense';

                return (
                  <article className="ledger-mobile-card" key={tx.id}>
                    <div className="ledger-mobile-card-header">
                      <div>
                        <span className={`tx-badge ${isExpense ? 'expense' : 'income'}`}>
                          {isExpense ? t('finance.expense') : t('finance.incomeBadge')}
                        </span>
                        <time dateTime={new Date(tx.date).toISOString()}>{formatTransactionDate(tx.date)}</time>
                      </div>
                      <strong className={isExpense ? 'ledger-amount-expense' : 'ledger-amount-income'}>
                        {isExpense ? '-' : '+'} {formatCurrency(Math.abs(tx.amount))}
                      </strong>
                    </div>
                    <div className="ledger-mobile-card-summary">
                      <strong>{catLabelMap[tx.category] || tx.category}</strong>
                      {entityName && <span>{entityName}</span>}
                    </div>
                    {tx.notes && <p className="ledger-mobile-card-notes">{tx.notes}</p>}
                    <button
                      type="button"
                      className="icon-btn danger ledger-mobile-delete"
                      onClick={() => handleDeleteTx(tx.id!)}
                      aria-label={`${t('finance.delete')} ${formatTransactionDate(tx.date)}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <h3>{t('finance.modalTitle')}</h3>
            <form onSubmit={handleAddTx}>
              <div className="form-group">
                <label>{t('finance.flowLabel')}</label>
                <div className="toggle-group finance-flow-toggle">
                  <button 
                    type="button" 
                    className={`toggle-btn finance-flow-option finance-flow-option--expense ${newTx.type === 'expense' ? 'active' : ''}`}
                    onClick={() => setNewTx({...newTx, type: 'expense'})}
                  >
                    {t('finance.expense')}
                  </button>
                  <button 
                    type="button" 
                    className={`toggle-btn finance-flow-option finance-flow-option--income ${newTx.type === 'income' ? 'active' : ''}`}
                    onClick={() => setNewTx({...newTx, type: 'income'})}
                  >
                    {t('finance.incomeOption')}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>{t('finance.category')}</label>
                <select 
                  className="form-control"
                  value={newTx.category}
                  onChange={e => setNewTx({...newTx, category: e.target.value as any})}
                  required
                >
                  <option value="repair">{t('finance.optionRepair')}</option>
                  <option value="camera">{t('finance.optionCamera')}</option>
                  <option value="lens">{t('finance.optionLens')}</option>
                  <option value="film">{t('finance.optionFilm')}</option>
                  <option value="develop">{t('finance.optionDevelop')}</option>
                  <option value="chemical">{t('finance.optionChemical')}</option>
                  <option value="accessory">{t('finance.optionAccessory')}</option>
                  <option value="service">{t('finance.optionService')}</option>
                  <option value="other">{t('finance.optionOther')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('finance.amountLabel', { symbol: currencySymbol })}</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder={t('finance.amountPlaceholder')}
                  value={newTx.amount as any}
                  onChange={e => setNewTx({...newTx, amount: e.target.value as any})}
                  required 
                />
              </div>

              <div className="form-group">
                <label>{t('finance.entryDate')}</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={newTx.date ? new Date(newTx.date).toISOString().substring(0, 10) : ''}
                  onChange={e => setNewTx({...newTx, date: e.target.value ? new Date(e.target.value).getTime() : Date.now()})}
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('finance.notesLabel')}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder={t('finance.notesPlaceholder')}
                  value={newTx.notes}
                  onChange={e => setNewTx({...newTx, notes: e.target.value})}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</button>
                <button type="submit" className="primary">{t('finance.saveEntry')}</button>
              </div>
            </form>
      </Modal>
    </div>
  );
};
