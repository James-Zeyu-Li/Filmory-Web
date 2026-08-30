import { memo } from 'react';
import { Edit2, Film, Minus, Plus, Search, Trash2, Upload } from 'lucide-react';
import type { FilmStock } from '../../../../db/schema';
import type { TranslationKey } from '../../../../i18n/translations';
import { EmptyState } from '../../../../components/EmptyState';
import { IconButton } from '../../../../components/ui/IconButton';
import { FilmSvgAvatar } from '../../../../components/FilmSvgAvatar';
import type { GearSort } from '../shared/gearListUtils';
import { useFilteredGearItems } from '../shared/gearListUtils';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;
interface FilmStocksTabProps { filmStocks: readonly FilmStock[]; searchQuery: string; sortBy: GearSort; t: Translate; uploadingEntityId: string | null; onAdd: () => void; onView: (film: FilmStock) => void; onEdit: (film: FilmStock) => void; onDelete: (id: string) => void; onUpload: (id: string) => void; onPreview: (url: string) => void; onAdjustStock: (id: string, delta: number) => void; }
const getAvatarUrl = (url?: string | null) => url && (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) ? url : null;

export const FilmStocksTab = memo(({ filmStocks, searchQuery, sortBy, t, uploadingEntityId, onAdd, onView, onEdit, onDelete, onUpload, onPreview, onAdjustStock }: FilmStocksTabProps) => {
  const displayFilms = useFilteredGearItems(filmStocks, searchQuery, sortBy);
  if (filmStocks.length === 0 || displayFilms.length === 0) return <div className="lenses-grid-layout"><div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center' }}><EmptyState icon={Film} title={filmStocks.length === 0 ? t('gear.noFilmTitle') : t('gear.noFilmMatch')} description={filmStocks.length === 0 ? t('gear.noFilmDesc') : t('gear.noMatchDesc')} action={filmStocks.length === 0 ? <button className="primary" onClick={onAdd}><Plus size={16} /> {t('gear.addFilmStock')}</button> : undefined} /></div></div>;
  return (
    <div className="lenses-grid-layout">
      {displayFilms.map(film => {
        const avatarUrl = getAvatarUrl(film.avatarUrl);
        const isUploading = uploadingEntityId === film.id;

        return (
          <article key={film.id} className="gear-card gear-row-card film-stock-card" onClick={() => onView(film)}>
            <button
              type="button"
              className="gear-card-open-action"
              onClick={event => { event.stopPropagation(); onView(film); }}
              aria-label={t('gear.viewFilmHistory', { name: `${film.brand} ${film.name}` })}
            />
            <div className="camera-avatar-container film-stock-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={film.name} className="camera-avatar-img" onClick={event => { event.stopPropagation(); onPreview(avatarUrl); }} title={t('gear.previewCover')} />
              ) : (
                <div className="lens-card-avatar film-stock-placeholder">
                  <FilmSvgAvatar brand={film.brand} name={film.name} format={film.format} size={72} />
                </div>
              )}
              <button
                type="button"
                className="camera-avatar-upload-overlay"
                onClick={event => { event.stopPropagation(); if (avatarUrl) onPreview(avatarUrl); else onUpload(film.id!); }}
                disabled={isUploading}
                title={avatarUrl ? t('gear.previewCover') : t('gear.uploadFilmCover')}
              >
                {isUploading ? (
                  <span className="avatar-loading-spinner" />
                ) : (
                  <>
                    {avatarUrl ? <Search size={14} /> : <Upload size={14} />}
                    <span className="camera-avatar-action-label">{avatarUrl ? t('gear.viewCover') : t('gear.uploadCover')}</span>
                  </>
                )}
              </button>
            </div>
            <div className="lens-card-content film-stock-card-content">
              <div className="gear-card-header">
                <span className={`tag ${film.colorType === 'color' ? 'color' : 'bw'}`}>{film.colorType === 'color' ? t('gear.color') : t('gear.bw')}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <IconButton icon={<Edit2 size={16} />} title={t('gear.editFilmStock')} onClick={event => { event.stopPropagation(); onEdit(film); }} />
                  <IconButton variant="danger" icon={<Trash2 size={16} />} title={t('gear.deletePermanently')} onClick={event => { event.stopPropagation(); onDelete(film.id!); }} />
                </div>
              </div>
              <h3>{film.brand} {film.name}</h3>
              <div className="film-stock-specs" aria-label={t('gear.filmStocksTitle')}>
                <span><strong>ISO</strong> {film.iso}</span>
                <span><strong>{t('gear.format')}</strong> {film.format}</span>
              </div>
            </div>
            <div className="film-stock-inventory-row">
              <div className="film-stock-count">
                <span>{t('gear.stockCount')}</span>
                <strong>{t('gear.rollsInStock', { count: film.stockCount || 0 })}</strong>
              </div>
              <div className="stock-stepper-group">
                <button type="button" className="stock-stepper-btn" title={t('gear.decreaseStock')} aria-label={t('gear.decreaseStock')} onClick={event => { event.stopPropagation(); onAdjustStock(film.id!, -1); }}><Minus size={14} /></button>
                <button type="button" className="stock-stepper-btn" title={t('gear.increaseStock')} aria-label={t('gear.increaseStock')} onClick={event => { event.stopPropagation(); onAdjustStock(film.id!, 1); }}><Plus size={14} /></button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
});
