import React, { useState, useEffect, useRef } from 'react';
import { Columns, Split, UploadCloud, X, Image as ImageIcon, MoveHorizontal } from 'lucide-react';
import { useLanguage } from '../../contexts/useLanguage';
import { ResponsiveHeaderSubtitle } from '../../components/ui/ResponsiveHeaderSubtitle';
import './CompareView.css';

interface FileDropzoneProps {
  target: 'A' | 'B';
  file: File | null;
  url: string | null;
  onDropFile: (e: React.DragEvent<HTMLDivElement>, target: 'A' | 'B') => void;
  onSelectFile: (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B') => void;
  onClearFile: (target: 'A' | 'B') => void;
  copy: {
    dropTitle: string;
    dropHint: string;
    clearTitle: string;
    previewAlt: string;
  };
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ target, file, url, onDropFile, onSelectFile, onClearFile, copy }) => (
  <div
    className={`local-dropzone ${file ? 'has-file' : ''}`}
    onDragOver={e => e.preventDefault()}
    onDrop={e => onDropFile(e, target)}
  >
    {url ? (
      <div className="dropzone-preview">
        <img src={url} alt={copy.previewAlt} />
        <div className="dropzone-overlay">
          <span>{file?.name}</span>
          <button className="compare-clear-btn" type="button" onClick={() => onClearFile(target)} aria-label={copy.clearTitle} title={copy.clearTitle}>
            <X size={14} />
          </button>
        </div>
      </div>
    ) : (
      <label className="dropzone-empty">
        <UploadCloud size={32} />
        <h4>{copy.dropTitle}</h4>
        <p>{copy.dropHint}</p>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => onSelectFile(e, target)}
        />
      </label>
    )}
  </div>
);

export const CompareView: React.FC = () => {
  const { t } = useLanguage();
  const [sourceA, setSourceA] = useState<{ file: File; url: string } | null>(null);
  const [sourceB, setSourceB] = useState<{ file: File; url: string } | null>(null);
  const sourceAUrlRef = useRef<string | null>(null);
  const sourceBUrlRef = useRef<string | null>(null);

  const [viewMode, setViewMode] = useState<'split' | 'sideBySide'>('split');

  useEffect(() => () => {
    if (sourceAUrlRef.current) URL.revokeObjectURL(sourceAUrlRef.current);
    if (sourceBUrlRef.current) URL.revokeObjectURL(sourceBUrlRef.current);
  }, []);

  const replaceSource = (target: 'A' | 'B', file: File | null) => {
    const nextUrl = file ? URL.createObjectURL(file) : null;
    const urlRef = target === 'A' ? sourceAUrlRef : sourceBUrlRef;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = nextUrl;
    const source = file && nextUrl ? { file, url: nextUrl } : null;
    if (target === 'A') setSourceA(source);
    else setSourceB(source);
  };

  const fileA = sourceA?.file ?? null;
  const fileB = sourceB?.file ?? null;
  const urlA = sourceA?.url ?? null;
  const urlB = sourceB?.url ?? null;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>, target: 'A' | 'B') => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        if (target === 'A') {
          replaceSource('A', file);
        } else {
          replaceSource('B', file);
        }
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B') => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (target === 'A') {
        replaceSource('A', file);
      } else {
        replaceSource('B', file);
      }
    }
  };

  const handleClearFile = (target: 'A' | 'B') => {
    if (target === 'A') {
      replaceSource('A', null);
    } else {
      replaceSource('B', null);
    }
  };

  const getDropzoneCopy = (target: 'A' | 'B') => ({
    dropTitle: t('compare.dropTitle'),
    dropHint: t('compare.dropHint', { target }),
    clearTitle: t('compare.clearPhoto', { target }),
    previewAlt: t('compare.previewAlt', { target }),
  });

  return (
    <div className="main-content">
      <header className="view-header compare-page-header">
        <div className="view-header-title-container">
          <div className="view-header-icon">
            <ImageIcon size={20} />
          </div>
          <div className="view-header-text-group">
            <h1>{t('compare.title')}</h1>
            <ResponsiveHeaderSubtitle desktop={t('compare.subtitle')} mobile={t('compare.mobileSubtitle')} />
          </div>
        </div>
        <div className="view-header-actions">
          <div className="compare-mode-toggle" role="group" aria-label={t('compare.viewMode')}>
            <button 
              type="button"
              className={viewMode === 'sideBySide' ? 'primary' : ''}
              onClick={() => setViewMode('sideBySide')}
              disabled={!urlA || !urlB}
              aria-pressed={viewMode === 'sideBySide'}
            >
              <Columns size={16} />
              <span>{t('compare.sideBySide')}</span>
            </button>
            <button 
              type="button"
              className={viewMode === 'split' ? 'primary' : ''}
              onClick={() => setViewMode('split')}
              disabled={!urlA || !urlB}
              aria-pressed={viewMode === 'split'}
            >
              <Split size={16} />
              <span>{t('compare.splitSlider')}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="view-body compare-workspace-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Intro */}
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '13px' }}>
          {t('compare.intro')}
        </p>

        {/* Uploader Bar */}
        <div className="compare-uploaders-container">
          <FileDropzone target="A" file={fileA} url={urlA} onDropFile={handleFileDrop} onSelectFile={handleFileSelect} onClearFile={handleClearFile} copy={getDropzoneCopy('A')} />
          <FileDropzone target="B" file={fileB} url={urlB} onDropFile={handleFileDrop} onSelectFile={handleFileSelect} onClearFile={handleClearFile} copy={getDropzoneCopy('B')} />
        </div>

        {/* Viewer */}
        <div className="compare-viewer-container" style={{ flex: 1, minHeight: 0, marginTop: '16px', position: 'relative', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {(!urlA || !urlB) ? (
            <div className="empty-state" style={{ height: '100%' }}>
              <ImageIcon size={48} />
              <h3>{t('compare.emptyTitle')}</h3>
              <p>{t('compare.emptyDesc')}</p>
            </div>
          ) : (
            <>
              {viewMode === 'split' && <ImageSlider imgA={urlA} imgB={urlB} altA={t('compare.imageAlt', { target: 'A' })} altB={t('compare.imageAlt', { target: 'B' })} label={t('compare.splitPosition')} />}
              {viewMode === 'sideBySide' && (
                <div className="compare-side-by-side">
                  <div className="compare-side-by-side-pane">
                    <img src={urlA} alt={t('compare.imageAlt', { target: 'A' })} />
                    <span className="compare-lane-label">{t('compare.laneA')}</span>
                  </div>
                  <div className="compare-side-by-side-pane">
                    <img src={urlB} alt={t('compare.imageAlt', { target: 'B' })} />
                    <span className="compare-lane-label">{t('compare.laneB')}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Split Screen Slider implementation
interface ImageSliderProps {
  imgA: string;
  imgB: string;
  altA: string;
  altB: string;
  label: string;
}

const ImageSlider: React.FC<ImageSliderProps> = ({ imgA, imgB, altA, altB, label }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      handleMove(e.clientX);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 5;
    const nextPosition = (delta: number) => {
      setSliderPosition(current => Math.max(0, Math.min(100, current + delta)));
    };

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        nextPosition(-step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        nextPosition(step);
        break;
      case 'Home':
        event.preventDefault();
        setSliderPosition(0);
        break;
      case 'End':
        event.preventDefault();
        setSliderPosition(100);
        break;
    }
  };

  return (
    <div 
      className="image-slider-container" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onTouchMove={handleTouchMove}
      onKeyDown={handleKeyDown}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(sliderPosition)}
      aria-valuetext={`Photo A ${Math.round(sliderPosition)}%, Photo B ${Math.round(100 - sliderPosition)}%`}
      style={{ height: '100%', width: '100%', position: 'relative', cursor: 'ew-resize', touchAction: 'none' }}
    >
      <img src={imgB} className="image-slider-bg" alt={altB} draggable={false} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
      
      <img 
        src={imgA} 
        className="image-slider-fg" 
        alt={altA}
        draggable={false}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain',
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
        }} 
      />

      <div 
        className="image-slider-handle" 
        style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPosition}%`, width: '2px', background: 'var(--accent)', transform: 'translateX(-50%)', transition: 'none' }}
      >
        <div className="handle-button">
          <MoveHorizontal size={16} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};
