import type { LucideIcon } from 'lucide-react';
import './StatCard.css';

export type StatCardTone = 'gold' | 'sky' | 'emerald' | 'red';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description?: string;
  tone?: StatCardTone;
}

export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, description, tone }) => (
  <div className={`stat-card${tone ? ` stat-card--${tone}` : ''}`}>
    <div className="stat-card-icon"><Icon size={22} /></div>
    <div className="stat-card-content">
      <span>{label}</span>
      <h2 title={value}>{value}</h2>
      {description && <p>{description}</p>}
    </div>
  </div>
);
