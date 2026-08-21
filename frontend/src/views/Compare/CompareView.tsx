import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Columns, Split, UploadCloud, X, Image as ImageIcon, MoveHorizontal } from 'lucide-react';
import { useLanguage } from '../../contexts/useLanguage';
import { EmptyState } from '../../components/EmptyState';
import { ResponsiveHeaderSubtitle } from '../../components/ui/ResponsiveHeaderSubtitle';
import './CompareView.css';

type CompareTarget = 'A' | 'B';

interface FileDropzoneProps {
  target: CompareTarget;
  file: File | null;
  url: string | null;
  onDropFile: (e: React.DragEvent<HTMLDivElement>, target: CompareTarget) => void;
  onSelectFile: (e: React.ChangeEvent<HTMLInputElement>, target: CompareTarget) => void;
  onClearFile: (target: CompareTarget) => void;
  onImageError: (target: CompareTarget) => void;
  copy: {
    dropTitle: string;
    dropHint: string;
    clearTitle: string;
    inputLabel: string;
    previewAlt: string;
  };
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ target, file, url, onDropFile, onSelectFile, onClearFile, onImageError, copy }) => (
  <div
    className={`local-dropzone ${file ? 'has-file' : ''}`}
    onDragOver={e => e.preventDefault()}
    onDrop={e => onDropFile(e, target)}
  >
    {url ? (
      <div className="dropzone-preview">
        <img src={url} alt={copy.previewAlt} onError={() => onImageError(target)} />
        <div className="dropzone-overlay">
          <span>{file?.name}</span>
          <button className="compare-clear-btn" type="button" onClick={() => onClearFile(target)} aria-label={copy.clearTitle} title={copy.clearTitle}>
            <X size={14} />
          </button>
        </div>
      </div>
    ) : (
      <div className="dropzone-empty" aria-hidden="true">
        <UploadCloud size={32} />
        <h4>{copy.dropTitle}</h4>
        <p>{copy.dropHint}</p>
      </div>
    )}
    {!url && (
      <input
        className="dropzone-file-input"
        type="file"
        accept="image/*"
        aria-label={copy.inputLabel}
        onChange={e => onSelectFile(e, target)}
      />
    )}
  </div>
);

export const CompareView: React.FC = () => {
  const { t } = useLanguage();
  const [sourceA, setSourceA] = useState<{ file: File; url: string } | null>(null);
  const [sourceB, setSourceB] = useState<{ file: File; url: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const sourceAUrlRef = useRef<string | null>(null);
  const sourceBUrlRef = useRef<string | null>(null);

  const [viewMode, setViewMode] = useState<'split' | 'sideBySide'>('split');

  useEffect(() => () => {
    if (sourceAUrlRef.current) URL.revokeObjectURL(sourceAUrlRef.current);
    if (sourceBUrlRef.current) URL.revokeObjectURL(sourceBUrlRef.current);
  }, []);

  const replaceSource = (target: CompareTarget, file: File | null) => {
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

  const acceptFile = (file: File, target: CompareTarget) => {
    if (!file.type.startsWith('image/')) {
      setFileError(t('compare.invalidFile', { target }));
      return;
    }

    try {
      replaceSource(target, file);
      setFileError(null);
    } catch {
      setFileError(t('compare.readError', { target }));
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>, target: CompareTarget) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) acceptFile(file, target);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: CompareTarget) => {
    const file = e.target.files?.[0];
    if (file) acceptFile(file, target);
    e.target.value = '';
  };

  const handleClearFile = (target: CompareTarget) => {
    replaceSource(target, null);
    setFileError(null);
  };

  const handleImageError = (target: CompareTarget) => {
    replaceSource(target, null);
    setFileError(t('compare.readError', { target }));
  };

  const getDropzoneCopy = (target: CompareTarget) => ({
    dropTitle: t('compare.dropTitle'),
    dropHint: t('compare.dropHint', { target }),
    clearTitle: t('compare.clearPhoto', { target }),
    inputLabel: t('compare.choosePhoto', { target }),
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

      <div className="view-body compare-workspace-body">
        <p className="compare-intro">{t('compare.intro')}</p>

        {/* Uploader Bar */}
        <div className="compare-uploaders-container">
          <FileDropzone target="A" file={fileA} url={urlA} onDropFile={handleFileDrop} onSelectFile={handleFileSelect} onClearFile={handleClearFile} onImageError={handleImageError} copy={getDropzoneCopy('A')} />
          <FileDropzone target="B" file={fileB} url={urlB} onDropFile={handleFileDrop} onSelectFile={handleFileSelect} onClearFile={handleClearFile} onImageError={handleImageError} copy={getDropzoneCopy('B')} />
        </div>

        {fileError && (
          <div className="compare-file-alert" role="alert" aria-live="assertive">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{fileError}</span>
          </div>
        )}

        <div className="compare-viewer-container">
          {(!urlA || !urlB) ? (
            <div className="compare-empty-state">
              <EmptyState icon={ImageIcon} title={t('compare.emptyTitle')} description={t('compare.emptyDesc')} />
            </div>
          ) : (
            <>
              {viewMode === 'split' && <ImageSlider imgA={urlA} imgB={urlB} altA={t('compare.imageAlt', { target: 'A' })} altB={t('compare.imageAlt', { target: 'B' })} label={t('compare.splitPosition')} valueText={position => t('compare.sliderValue', { a: position, b: 100 - position })} onImageError={handleImageError} />}
              {viewMode === 'sideBySide' && (
                <div className="compare-side-by-side">
                  <div className="compare-side-by-side-pane">
                    <img src={urlA} alt={t('compare.imageAlt', { target: 'A' })} onError={() => handleImageError('A')} />
                    <span className="compare-lane-label">{t('compare.laneA')}</span>
                  </div>
                  <div className="compare-side-by-side-pane">
                    <img src={urlB} alt={t('compare.imageAlt', { target: 'B' })} onError={() => handleImageError('B')} />
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
  valueText: (position: number) => string;
  onImageError: (target: CompareTarget) => void;
}

const ImageSlider: React.FC<ImageSliderProps> = ({ imgA, imgB, altA, altB, label, valueText, onImageError }) => {
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

  const roundedPosition = Math.round(sliderPosition);

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
      aria-valuenow={roundedPosition}
      aria-valuetext={valueText(roundedPosition)}
      style={{ '--compare-position': `${sliderPosition}%` } as React.CSSProperties}
    >
      <img src={imgB} className="image-slider-bg" alt={altB} draggable={false} onError={() => onImageError('B')} />
      
      <img 
        src={imgA} 
        className="image-slider-fg" 
        alt={altA}
        draggable={false}
        onError={() => onImageError('A')}
      />

      <div className="image-slider-handle">
        <div className="handle-button">
          <MoveHorizontal size={16} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};
