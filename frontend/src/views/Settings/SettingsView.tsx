import React, { useState } from 'react';
import { BackupService } from '../../services/backupService';
import { Shield, Download, X, LogOut, UserX, Sun, Moon, Monitor, Coins, Film, BadgeCheck, ArrowUp, ArrowDown, Folder, Crown, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useTheme } from '../../contexts/useTheme';
import { supabase } from '../../services/supabaseClient';
import { Modal } from '../../components/Modal';
import { useConfirm } from '../../contexts/useConfirm';
import { useFeedback } from '../../contexts/useFeedback';
import { useCurrency } from '../../contexts/useCurrency';
import { CURRENCY_OPTIONS, type CurrencyCode } from '../../contexts/currencyContextCore';
import { convertCurrentUserMoney } from '../../services/currencyConversionService';
import {
  readRollsCollectionsTabEnabled,
  readRollsTabOrder,
  writeRollsCollectionsTabEnabled,
  writeRollsTabOrder,
  type RollsTabId,
} from '../../services/workspacePreferences';
import { useUserProfile } from '../../hooks/useData';
import { useUserTier } from '../../hooks/useUserTier';
import { UpgradeModal } from '../../components/UpgradeModal';
import { formatMembershipRequestTime } from '../../services/membershipUpgrade';
import { getActiveRollLimitLabel } from '../../services/membershipPolicy';
import './SettingsView.css';

interface SettingsViewProps {
  enableFilmMode: boolean;
  setEnableFilmMode: (enabled: boolean) => void;
  onClose: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ enableFilmMode, setEnableFilmMode, onClose }) => {
  const { user, logout, accountRole, isDevBypass, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency, currencySymbol } = useCurrency();
  const { confirm } = useConfirm();
  const { notify } = useFeedback();
  const { tier: userTier, isLoading: isUserTierLoading, capabilities: membershipCapabilities } = useUserTier();
  const userProfile = useUserProfile();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isCurrencyConversionOpen, setIsCurrencyConversionOpen] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>(() => (
    currency === 'CNY' ? 'USD' : 'CNY'
  ));
  const [conversionRate, setConversionRate] = useState('');
  const [rollsTabOrder, setRollsTabOrder] = useState<RollsTabId[]>(() => readRollsTabOrder());
  const [rollsCollectionsEnabled, setRollsCollectionsEnabled] = useState<boolean>(() => readRollsCollectionsTabEnabled());

  const rollsTabLabels: Record<RollsTabId, string> = {
    collections: '项目集',
    all: '全部胶卷记录',
    loose: '散卷',
  };
  const isMembershipRequestPending = userTier !== 'vip' && userProfile?.membershipRequestStatus === 'pending';
  const membershipRequestTimeLabel = formatMembershipRequestTime(userProfile?.membershipRequestedAt);

  const handleFilmModeChange = (nextEnabled: boolean) => {
    setEnableFilmMode(nextEnabled);
  };

  const moveRollsTab = (tab: RollsTabId, direction: 'up' | 'down') => {
    const currentIndex = rollsTabOrder.indexOf(tab);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rollsTabOrder.length) return;

    const nextOrder = [...rollsTabOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
    setRollsTabOrder(nextOrder);
    writeRollsTabOrder(nextOrder);
  };

  const handleRollsCollectionsEnabledChange = (enabled: boolean) => {
    const nextEnabled = !enableFilmMode ? true : enabled;
    setRollsCollectionsEnabled(nextEnabled);
    writeRollsCollectionsTabEnabled(nextEnabled);
  };

  const handleLogout = async () => {
    try {
      setIsProcessing(true);
      setProcessMessage('正在退出当前账号...');
      await logout();
      onClose();
    } catch (e) {
      console.error(e);
      notify({
        type: 'error',
        title: '退出失败',
        message: e instanceof Error ? e.message : '请稍后重试。'
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationStep === 0) {
      setDeleteConfirmationStep(1);
      setDeleteError('');
      return;
    }
    
    if (deleteConfirmationStep === 1) {
      if (deleteInput !== 'DELETE') {
        setDeleteError('请输入大写的 DELETE 以确认删除。');
        return;
      }
      
      const finalConfirm = await confirm({
        title: '最终确认注销账号',
        message: '最后一次警告：你的所有云端数据、相册和收支记录都会永久消失，且无法恢复。\n\n确认继续注销账号吗？',
        confirmText: '永久销毁账号',
        cancelText: '取消',
        isDanger: true
      });
      if (!finalConfirm) {
        setDeleteConfirmationStep(0);
        setDeleteInput('');
        setDeleteError('');
        return;
      }
      
      try {
        setIsProcessing(true);
        setProcessMessage('正在彻底销毁您的账号数据...');
        
        // Dev bypass is local-only; real Supabase users use the account deletion RPC.
        if (!isDevBypass) {
          const { error } = await supabase.rpc('delete_user');
          if (error) throw error;
        }
        
        await logout();
        window.location.reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        notify({
          type: 'error',
          title: '账号注销失败',
          message
        });
        setIsProcessing(false);
        setProcessMessage('');
      }
    }
  };

  const handleExport = async () => {
    try {
      setIsProcessing(true);
      setProcessMessage('正在打包您的照片和数据，请勿关闭页面...');
      await BackupService.exportDatabaseToExcel(user?.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      notify({
        type: 'error',
        title: '导出失败',
        message
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
    }
  };

  const handleCurrencyConversion = async (event: React.FormEvent) => {
    event.preventDefault();

    const rate = Number(conversionRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      notify({
        type: 'error',
        title: '汇率无效',
        message: '请输入大于 0 的手动换算汇率。'
      });
      return;
    }

    if (targetCurrency === currency) {
      notify({
        type: 'error',
        title: '目标货币相同',
        message: '请选择一个不同于当前记账货币的目标货币。'
      });
      return;
    }

    const targetOption = CURRENCY_OPTIONS.find(option => option.code === targetCurrency);
    const confirmed = await confirm({
      title: '批量换算现有金额',
      message: `将使用手动汇率 1 ${currency} = ${rate} ${targetCurrency}，批量换算当前账号内所有金额字段，并把全局记账货币切换为 ${targetOption?.label || targetCurrency}。\n\n此操作不会联网查询汇率，也不会保留原币种。建议确认汇率无误后继续。`,
      confirmText: '确认批量换算',
      cancelText: '取消',
      isDanger: true
    });

    if (!confirmed) return;

    const userId = user?.id || 'offline';
    try {
      setIsProcessing(true);
      setProcessMessage('正在按手动汇率换算现有金额...');
      await convertCurrentUserMoney(userId, rate);

      setCurrency(targetCurrency);
      setIsCurrencyConversionOpen(false);
      setConversionRate('');
      notify({
        type: 'success',
        title: '货币换算完成',
        message: `现有金额已按手动汇率换算为 ${targetOption?.label || targetCurrency}。`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      notify({
        type: 'error',
        title: '批量换算失败',
        message
      });
    } finally {
      setIsProcessing(false);
      setProcessMessage('');
    }
  };

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      style={{ maxWidth: '620px', width: '92%', padding: 0, overflow: 'hidden' }}
      overlayStyle={{ zIndex: 9999 }}
    >
      <header className="settings-modal-header">
        <div className="settings-modal-header-left">
          <div className="settings-modal-icon">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="settings-modal-title">设置与数据保护</h2>
            <p className="settings-modal-subtitle">{user?.email || (isDevBypass ? '开发者模式' : '未登录')}</p>
          </div>
        </div>
        <div className="settings-modal-header-right">
          <span className={`account-role-badge ${isAdmin ? 'admin' : ''}`}>
            <BadgeCheck size={12} />
            {isDevBypass ? '测试管理员' : accountRole === 'admin' ? '管理员' : '普通账号'}
          </span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      <div className="view-body settings-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
        {/* UI Preferences Card */}
        <div className="settings-section">
          <div className="section-header">
            <h3>界面偏好设定</h3>
          </div>
          <div className="settings-list-group">
            <div className="settings-list-item settings-list-item-vertical">
              <div className="settings-item-content">
                <div className="settings-item-icon safe"><Sun size={18} /></div>
                <div className="settings-item-text">
                  <h4>色彩主题</h4>
                  <p>选择工作区外观，或跟随系统偏好自动切换。</p>
                </div>
              </div>
              <div className="settings-item-action">
                <div className="theme-segmented-control">
                <button
                  className={`theme-segment-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <Sun size={16} /> 浅色
                </button>
                <button
                  className={`theme-segment-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <Moon size={16} /> 深色
                </button>
                <button
                  className={`theme-segment-btn ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => setTheme('system')}
                >
                  <Monitor size={16} /> 跟随系统
                </button>
                </div>
              </div>
            </div>

            <div className="settings-list-item">
              <div className="settings-item-content">
                <div className="settings-item-icon safe"><Film size={18} /></div>
                <div className="settings-item-text">
                  <h4>专业胶片模式</h4>
                  <p>开启胶卷库存和胶片拍摄工作流；关闭后隐藏胶片专用入口。</p>
                </div>
              </div>
              <div className="settings-item-action compact-toggle">
                <input 
                  type="checkbox" 
                  id="filmModeToggle" 
                  aria-label="专业胶片模式"
                  checked={enableFilmMode}
                  onChange={(e) => handleFilmModeChange(e.target.checked)}
                />
                <label htmlFor="filmModeToggle"></label>
              </div>
            </div>

            <div className="settings-sub-card">
              <div className="settings-sub-card-header">
                <div className="settings-item-icon safe"><Folder size={16} /></div>
                <div className="settings-item-text">
                  <h4>胶卷记录页签布局</h4>
                  <p>调整胶卷记录页面的顺序；项目集可单独隐藏，但关闭胶片模式时会强制保留项目集入口。</p>
                </div>
              </div>
              <div className="settings-sub-card-body">
                <div className="settings-rolls-toggle-row">
                  <div>
                    <strong>显示项目集页签</strong>
                    <p>{enableFilmMode ? '关闭后，胶卷记录页不再显示项目集入口。' : '胶片模式关闭时，项目集入口必须保留。'}</p>
                  </div>
                  <div className="compact-toggle">
                    <input
                      type="checkbox"
                      id="rollsCollectionsToggle"
                      aria-label="显示项目集页签"
                      checked={enableFilmMode ? rollsCollectionsEnabled : true}
                      disabled={!enableFilmMode}
                      onChange={(e) => handleRollsCollectionsEnabledChange(e.target.checked)}
                    />
                    <label htmlFor="rollsCollectionsToggle"></label>
                  </div>
                </div>

	                <div className="settings-rolls-order-list">
	                  {rollsTabOrder.map((tab, index) => {
	                    const collectionsLocked = tab === 'collections' && !enableFilmMode;
	                    const collectionsHidden = tab === 'collections' && enableFilmMode && !rollsCollectionsEnabled;
	                    return (
	                      <div key={tab} className={`settings-rolls-order-item ${collectionsLocked ? 'locked' : ''} ${collectionsHidden ? 'hidden-tab' : ''}`}>
	                        <div className="settings-rolls-order-copy">
	                          <span>{rollsTabLabels[tab]}</span>
	                          {collectionsLocked && <small>胶片模式关闭时强制保留</small>}
	                          {collectionsHidden && <small>当前已隐藏，重新开启后按此顺序显示</small>}
	                        </div>
                        <div className="settings-rolls-order-actions">
                          <button
                            type="button"
                            className="secondary btn-sm"
                            onClick={() => moveRollsTab(tab, 'up')}
                            disabled={index === 0}
                            aria-label={`${rollsTabLabels[tab]} 上移`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="secondary btn-sm"
                            onClick={() => moveRollsTab(tab, 'down')}
                            disabled={index === rollsTabOrder.length - 1}
                            aria-label={`${rollsTabLabels[tab]} 下移`}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="settings-list-item settings-list-item-vertical">
              <div className="settings-item-content">
                <div className="settings-item-icon safe"><Coins size={18} /></div>
                <div className="settings-item-text">
                  <h4>记账货币</h4>
                  <p>直接切换只改变显示标签；需要迁移旧金额时使用手动汇率批量换算。</p>
                </div>
              </div>
              <div className="settings-item-action settings-inline-actions">
                <select
                  className="form-control"
                  value={currency}
                  onChange={e => setCurrency(e.target.value as CurrencyCode)}
                >
                  {CURRENCY_OPTIONS.map(option => (
                    <option key={option.code} value={option.code}>
                      {option.symbol} {option.label}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  onClick={() => {
                    setTargetCurrency(currency === 'CNY' ? 'USD' : 'CNY');
                    setConversionRate('');
                    setIsCurrencyConversionOpen(true);
                  }}
                  disabled={isProcessing}
                >
                  批量换算
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <h3>数据主权</h3>
          </div>
          <div className="settings-list-group">
            <div className="settings-list-item">
              <div className="settings-item-content">
                <div className="settings-item-icon safe"><Download size={18} /></div>
                <div className="settings-item-text">
                  <h4>导出元数据 Excel</h4>
                  <p>导出相机、镜头、胶卷库存、胶卷记录和收支记录；不会打包原图。</p>
                </div>
              </div>
              <div className="settings-item-action">
                <button 
                  className="primary" 
                  onClick={handleExport}
                  disabled={isProcessing}
                >
                  {isProcessing ? '正在生成...' : '立即导出记录'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Membership Status Card */}
        <div className="settings-section">
          <div className="section-header"><h3>会员状态</h3></div>
          <div className="settings-list-group">
            <div className="settings-list-item">
              <div className="settings-item-content">
                <div className={`settings-item-icon ${!isUserTierLoading && userTier === 'vip' ? 'safe' : ''}`}>
                  <Crown size={18} />
                </div>
                <div className="settings-item-text">
                  {isUserTierLoading ? (
                    <>
                      <h4>正在读取会员状态</h4>
                      <p>请稍候，正在同步当前账号的会员信息。</p>
                    </>
                  ) : isMembershipRequestPending ? (
                    <>
                      <h4>VIP 升级申请已记录</h4>
                      <p>
                        {membershipRequestTimeLabel ? `最近一次申请：${membershipRequestTimeLabel}。` : ''}
                        {userProfile?.membershipContactEmail ? ` 联系邮箱：${userProfile.membershipContactEmail}。` : ''}
                        可继续打开邮件或复制申请内容。
                      </p>
                    </>
	                  ) : userTier === 'vip' ? (
	                    <>
	                      <h4>Filmory VIP</h4>
	                      <p>
	                        {getActiveRollLimitLabel(userTier)}进行中胶卷记录
	                        {membershipCapabilities.cloudSyncEnabled ? ' · 云同步可用' : ''}
	                        {membershipCapabilities.highResUploadEnabled ? ' · 高质量图片能力' : ''}
	                      </p>
	                    </>
	                  ) : (
	                    <>
	                      <h4>免费版 · 进行中胶卷记录{getActiveRollLimitLabel(userTier)}</h4>
	                      <p>器材库和胶卷库存不限量；升级后解锁无限进行中记录和后续云端能力。</p>
	                    </>
	                  )}
                </div>
              </div>
              <div className="settings-item-action">
                {isUserTierLoading ? (
                  <span className="account-role-badge">读取中</span>
                ) : isMembershipRequestPending ? (
                  <button
                    className="secondary btn-sm"
                    onClick={() => setIsUpgradeModalOpen(true)}
                  >
                    查看申请
                  </button>
                ) : userTier === 'vip' ? (
                  <span className="account-role-badge admin">
                    <Crown size={12} />
                    VIP 会员
                  </span>
                ) : (
                  <button
                    className="primary btn-sm"
                    onClick={() => setIsUpgradeModalOpen(true)}
                  >
                    <Zap size={14} />
                    升级 VIP
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Account Management Card */}
        <div className="settings-section">
          <div className="section-header">
            <h3>账号与安全</h3>
          </div>
          
          <div className="settings-list-group">
            <div className="settings-list-item">
              <div className="settings-item-content">
                <div className="settings-item-icon"><LogOut size={18} /></div>
                <div className="settings-item-text">
                  <h4>退出登录</h4>
                  <p>退出当前设备登录状态，不删除本地离线数据。</p>
                </div>
              </div>
              <div className="settings-item-action">
                <button className="secondary" onClick={handleLogout} disabled={isProcessing}>
                  退出登录
                </button>
              </div>
            </div>

            <div className={`settings-list-item danger-zone ${deleteConfirmationStep === 1 ? 'settings-list-item-vertical' : ''}`}>
              <div className="settings-item-content">
                <div className="settings-item-icon danger"><UserX size={18} /></div>
                <div className="settings-item-text">
                  <h4>永久注销账号</h4>
                  <p>彻底销毁 Filmory 账号和云端数据。此操作不可恢复。</p>
                </div>
              </div>
              <div className="settings-item-action settings-danger-action">
                {deleteConfirmationStep === 0 ? (
                    <button className="danger" onClick={handleDeleteAccount} disabled={isProcessing}>
                      注销我的账号
                    </button>
                ) : (
                  <div className="delete-account-confirm-panel">
                    <p>
                      输入大写 DELETE 以继续注销。
                    </p>
                    {deleteError && (
                      <p className="delete-account-error">
                        {deleteError}
                      </p>
                    )}
                    <input 
                      type="text" 
                      placeholder="DELETE"
                      value={deleteInput}
                      onChange={(e) => {
                        setDeleteInput(e.target.value);
                        if (deleteError) setDeleteError('');
                      }}
                    />
                    <div className="delete-account-confirm-actions">
                      <button className="danger" onClick={handleDeleteAccount} disabled={isProcessing}>
                        确认永久销毁
                      </button>
                      <button className="secondary" onClick={() => {
                        setDeleteConfirmationStep(0);
                        setDeleteInput('');
                        setDeleteError('');
                      }}>
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="processing-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '16px', color: 'white' }}>{processMessage}</p>
        </div>
      )}

      <Modal
        isOpen={isCurrencyConversionOpen}
        onClose={() => setIsCurrencyConversionOpen(false)}
        style={{ maxWidth: '520px', width: '90%' }}
        overlayStyle={{ zIndex: 10001 }}
      >
        <h3>手动汇率批量换算</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
          当前记账货币为 {currency}。请输入手动汇率，将当前账号里的器材价格、胶卷单价、胶卷记录成本、冲洗费和收支金额一次性换算到目标货币。
        </p>
        <form onSubmit={handleCurrencyConversion}>
          <div className="form-group">
            <label>目标货币</label>
            <select
              className="form-control"
              value={targetCurrency}
              onChange={e => setTargetCurrency(e.target.value as CurrencyCode)}
              required
            >
              {CURRENCY_OPTIONS.map(option => (
                <option key={option.code} value={option.code}>
                  {option.symbol} {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>手动汇率：1 {currency} = ? {targetCurrency}</label>
            <input
              type="number"
              className="form-control"
              min="0"
              step="0.000001"
              placeholder={`例如：当前 ${currencySymbol}1 换算成多少 ${targetCurrency}`}
              value={conversionRate}
              onChange={e => setConversionRate(e.target.value)}
              required
            />
          </div>
          <p style={{ color: 'var(--danger)', fontSize: '12px', lineHeight: 1.5 }}>
            注意：这是一次性批量修改现有金额数值，不会保存原币种，也不会联网获取汇率。
          </p>
          <div className="modal-actions">
            <button type="button" onClick={() => setIsCurrencyConversionOpen(false)}>取消</button>
            <button type="submit" className="warning">确认换算</button>
          </div>
        </form>
      </Modal>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        trigger="generic"
      />
    </Modal>
  );
};
