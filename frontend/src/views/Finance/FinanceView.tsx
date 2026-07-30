import { db } from "../../db/schema";
import React, { useState } from 'react';
import type { LedgerTransaction } from '../../db/schema';
import { useAuth } from '../../contexts/useAuth';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { useLanguage } from '../../contexts/useLanguage';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCameras, useLenses, useRolls } from '../../hooks/useData';
import { Wallet, TrendingUp, TrendingDown, Plus, Camera as CameraIcon, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/Modal';
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
  const { t } = useLanguage();
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

      <div className="finance-dashboard" style={isEmbedded ? { padding: '24px 0 0 0' } : {}}>
        {isEmbedded && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> {t('finance.addEntry')}
            </button>
          </div>
        )}
        {/* KPI Cards */}
        <div className="stats-kpi-grid" style={{ marginBottom: '24px' }}>
          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(56, 189, 248, 0.05) 100%)', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
            <div className="kpi-icon" style={{ color: '#38bdf8' }}><CameraIcon size={24} /></div>
            <div className="kpi-content">
              <h3>{t('finance.gearInvestment')}</h3>
              <div className="kpi-value">{formatCurrency(totalGearAssets)}</div>
              <span className="kpi-subtext">{t('finance.gearInvestmentDesc')}</span>
            </div>
          </div>
          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, rgba(248, 113, 113, 0.1) 0%, rgba(248, 113, 113, 0.05) 100%)', borderColor: 'rgba(248, 113, 113, 0.2)' }}>
            <div className="kpi-icon" style={{ color: '#f87171' }}><TrendingDown size={24} /></div>
            <div className="kpi-content">
              <h3>{t('finance.filmLabCost')}</h3>
              <div className="kpi-value">{formatCurrency(totalFilmBurned)}</div>
              <span className="kpi-subtext">{t('finance.filmLabCostDesc')}</span>
            </div>
          </div>
          <div className="kpi-card" style={{ background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.1) 0%, rgba(52, 211, 153, 0.05) 100%)', borderColor: 'rgba(52, 211, 153, 0.2)' }}>
            <div className="kpi-icon" style={{ color: '#34d399' }}><TrendingUp size={24} /></div>
            <div className="kpi-content">
              <h3>{t('finance.income')}</h3>
              <div className="kpi-value">{formatCurrency(totalServiceIncome)}</div>
              <span className="kpi-subtext">{t('finance.incomeDesc')}</span>
            </div>
          </div>
        </div>

        {/* Missing Prices Alert Panel */}
        {totalMissing > 0 && (
          <div className="finance-alert-panel" style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', marginTop: 0, marginBottom: '12px', fontSize: '15px' }}>
              <AlertTriangle size={18} />
              {t('finance.missingPricesTitle', { count: totalMissing })}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>
              {t('finance.missingPricesDesc')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {missingCameras.map(c => (
                <span key={c.id} style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>[{t('finance.tagCamera')}] {c.name}</span>
              ))}
              {missingLenses.map(l => (
                <span key={l.id} style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>[{t('finance.tagLens')}] {l.name}</span>
              ))}
              {missingRollsFilm.map(r => (
                <span key={`f-${r.id}`} style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>[{t('finance.tagFilmCost')}] {r.name}</span>
              ))}
              {missingRollsDev.map(r => (
                <span key={`d-${r.id}`} style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>[{t('finance.tagLabCost')}] {r.name}</span>
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
                  <th style={{ textAlign: 'right' }}>{t('finance.amount')}</th>
                  <th style={{ textAlign: 'right' }}>{t('finance.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      <Wallet size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                      <p>{t('finance.noRecords')}</p>
                      <p style={{ fontSize: '13px' }}>{t('finance.noRecordsDesc')}</p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx: any) => (
                    <tr key={tx.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(tx.date).toLocaleDateString()}
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
                          <span style={{ fontWeight: 500, color: '#38bdf8' }}>{getEntityName(tx)}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tx.notes || '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: tx.type === 'expense' ? 'var(--text-color)' : '#34d399' }}>
                        {tx.type === 'expense' ? '-' : '+'} {formatCurrency(Math.abs(tx.amount))}
                      </td>
                      <td style={{ textAlign: 'right' }}>
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
        </div>
      </div>

      {/* Add Transaction Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <h3>{t('finance.modalTitle')}</h3>
            <form onSubmit={handleAddTx}>
              <div className="form-group">
                <label>{t('finance.flowLabel')}</label>
                <div className="toggle-group" style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className={`toggle-btn ${newTx.type === 'expense' ? 'active' : ''}`}
                    onClick={() => setNewTx({...newTx, type: 'expense'})}
                    style={{ flex: 1, padding: '8px', border: '1px solid var(--border-color)', background: newTx.type === 'expense' ? 'rgba(255,255,255,0.1)' : 'transparent', color: newTx.type === 'expense' ? '#fff' : 'var(--text-secondary)', borderRadius: '6px' }}
                  >
                    {t('finance.expense')}
                  </button>
                  <button 
                    type="button" 
                    className={`toggle-btn ${newTx.type === 'income' ? 'active' : ''}`}
                    onClick={() => setNewTx({...newTx, type: 'income'})}
                    style={{ flex: 1, padding: '8px', border: '1px solid var(--border-color)', background: newTx.type === 'income' ? 'rgba(52, 211, 153, 0.1)' : 'transparent', color: newTx.type === 'income' ? '#34d399' : 'var(--text-secondary)', borderRadius: '6px' }}
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
