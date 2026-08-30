import type { TranslationKey } from '../../i18n/translations';
import './UsageChipList.css';

export interface UsageChipItem {
  id: string;
  label: string;
  count: number;
}

interface UsageChipListProps {
  items: UsageChipItem[];
  maxVisible?: number;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
}

export const UsageChipList: React.FC<UsageChipListProps> = ({ items, maxVisible = 6, t }) => {
  const visible = items.slice(0, maxVisible);
  const overflowCount = items.length - visible.length;

  return (
    <div className="usage-chip-list">
      {visible.map(item => (
        <span key={item.id} className="usage-chip">
          {item.label}
          <span className="usage-chip-count">{t('common.usageCount', { count: item.count })}</span>
        </span>
      ))}
      {overflowCount > 0 && (
        <span className="usage-chip usage-chip-overflow">{t('common.plusCount', { count: overflowCount })}</span>
      )}
    </div>
  );
};
