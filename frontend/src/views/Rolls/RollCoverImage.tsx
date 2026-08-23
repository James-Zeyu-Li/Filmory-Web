import { useEffect, useEffectEvent, useRef, useState } from 'react';

interface RollCoverImageProps {
  photoId: string;
  src?: string;
  fallbackSrc?: string;
  alt?: string;
  className: string;
  onVisible: (photoId: string) => void;
}

export const RollCoverImage = ({
  photoId,
  src,
  fallbackSrc,
  alt = '',
  className,
  onVisible,
}: RollCoverImageProps) => {
  const frameRef = useRef<HTMLSpanElement>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const reportVisible = useEffectEvent(() => onVisible(photoId));
  const resolvedSrc = src && src !== failedSource
    ? src
    : fallbackSrc && fallbackSrc !== failedSource
      ? fallbackSrc
      : undefined;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof IntersectionObserver === 'undefined') {
      reportVisible();
      return;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        reportVisible();
        observer.disconnect();
      }
    }, { rootMargin: '160px' });

    observer.observe(frame);
    return () => observer.disconnect();
  }, [photoId]);

  return (
    <span ref={frameRef} className={className}>
      {resolvedSrc ? (
        <img
          className="roll-cover-image"
          src={resolvedSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(resolvedSrc)}
        />
      ) : null}
    </span>
  );
};
