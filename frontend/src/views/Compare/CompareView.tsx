import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Columns, Split, UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import './CompareView.css';

interface FileDropzoneProps {
  target: 'A' | 'B';
  file: File | null;
  url: string | null;
  onDropFile: (e: React.DragEvent<HTMLDivElement>, target: 'A' | 'B') => void;
  onSelectFile: (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B') => void;
  onClearFile: (target: 'A' | 'B') => void;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ target, file, url, onDropFile, onSelectFile, onClearFile }) => (
  <div
    className={`local-dropzone ${file ? 'has-file' : ''}`}
    onDragOver={e => e.preventDefault()}
    onDrop={e => onDropFile(e, target)}
  >
    {url ? (
      <div className="dropzone-preview">
        <img src={url} alt={`Preview ${target}`} />
        <div className="dropzone-overlay">
          <span>{file?.name}</span>
          <button className="icon-btn btn-sm" onClick={() => onClearFile(target)}>
            <X size={14} />
          </button>
        </div>
      </div>
    ) : (
      <label className="dropzone-empty">
        <UploadCloud size={32} />
        <h4>拖拽本地原图到此处</h4>
        <p>或点击选择文件 ({target}路)</p>
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
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);

  const [viewMode, setViewMode] = useState<'split' | 'sideBySide'>('split');

  const urlA = useMemo(() => fileA ? URL.createObjectURL(fileA) : null, [fileA]);
  const urlB = useMemo(() => fileB ? URL.createObjectURL(fileB) : null, [fileB]);

  useEffect(() => {
    return () => {
      if (urlA) URL.revokeObjectURL(urlA);
      if (urlB) URL.revokeObjectURL(urlB);
    };
  }, [urlA, urlB]);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>, target: 'A' | 'B') => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        if (target === 'A') {
          setFileA(file);
        } else {
          setFileB(file);
        }
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B') => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (target === 'A') {
        setFileA(file);
      } else {
        setFileB(file);
      }
    }
  };

  const handleClearFile = (target: 'A' | 'B') => {
    if (target === 'A') {
      setFileA(null);
    } else {
      setFileB(null);
    }
  };

  return (
    <div className="main-content">
      <header className="view-header">
        <h1>纯本地极速对比 (Zero-Cost)</h1>
        <div className="view-header-actions">
          <div className="compare-mode-toggle">
            <button 
              className={viewMode === 'sideBySide' ? 'primary' : ''}
              onClick={() => setViewMode('sideBySide')}
              disabled={!urlA || !urlB}
            >
              <Columns size={16} />
              <span>左右双列</span>
            </button>
            <button 
              className={viewMode === 'split' ? 'primary' : ''}
              onClick={() => setViewMode('split')}
              disabled={!urlA || !urlB}
            >
              <Split size={16} />
              <span>滑尺对比</span>
            </button>
          </div>
        </div>
      </header>

      <div className="view-body compare-workspace-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Intro */}
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '13px' }}>
          此工具 100% 在您的浏览器本地内存中运行。无需上传即可直接拖拽 30MB 以上的 TIFF 高清原图进行极限画质比对，无带宽消耗，断网可用。
        </p>

        {/* Uploader Bar */}
        <div className="compare-uploaders-container">
          <FileDropzone target="A" file={fileA} url={urlA} onDropFile={handleFileDrop} onSelectFile={handleFileSelect} onClearFile={handleClearFile} />
          <FileDropzone target="B" file={fileB} url={urlB} onDropFile={handleFileDrop} onSelectFile={handleFileSelect} onClearFile={handleClearFile} />
        </div>

        {/* Viewer */}
        <div className="compare-viewer-container" style={{ flex: 1, minHeight: 0, marginTop: '16px', position: 'relative', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {(!urlA || !urlB) ? (
            <div className="empty-state" style={{ height: '100%' }}>
              <ImageIcon size={48} />
              <h3>等待载入对比图</h3>
              <p>请在上方分别放入需要对比的两张本地照片。</p>
            </div>
          ) : (
            <>
              {viewMode === 'split' && <ImageSlider imgA={urlA} imgB={urlB} />}
              {viewMode === 'sideBySide' && (
                <div style={{ display: 'flex', width: '100%', height: '100%', gap: '4px' }}>
                  <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                    <img src={urlA} alt="A" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>A路</span>
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                    <img src={urlB} alt="B" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>B路</span>
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
}

const ImageSlider: React.FC<ImageSliderProps> = ({ imgA, imgB }) => {
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

  return (
    <div 
      className="image-slider-container" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onTouchMove={handleTouchMove}
      style={{ height: '100%', width: '100%', position: 'relative', cursor: 'ew-resize', touchAction: 'none' }}
    >
      <img src={imgB} className="image-slider-bg" alt="Image B" draggable={false} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
      
      <img 
        src={imgA} 
        className="image-slider-fg" 
        alt="Image A" 
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
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>↔</div>
      </div>
    </div>
  );
};
