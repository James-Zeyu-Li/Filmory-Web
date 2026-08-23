import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RollCoverImage } from '../RollCoverImage';

describe('RollCoverImage', () => {
  let intersectionCallback: IntersectionObserverCallback;

  beforeEach(() => {
    class MockIntersectionObserver {
      root = null;
      rootMargin = '160px';
      thresholds = [0];

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  it('loads the fallback lazily and requests the full source near the viewport', () => {
    const onVisible = vi.fn();
    const { container } = render(
      <RollCoverImage
        photoId="cover-1"
        fallbackSrc="data:image/webp;base64,thumb"
        className="test-cover"
        onVisible={onVisible}
      />
    );

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', 'data:image/webp;base64,thumb');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');

    intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(onVisible).toHaveBeenCalledWith('cover-1');
  });

  it('falls back when the preferred full source cannot load', () => {
    const { container } = render(
      <RollCoverImage
        photoId="cover-2"
        src="https://signed.example/cover.webp"
        fallbackSrc="data:image/webp;base64,thumb"
        className="test-cover"
        onVisible={vi.fn()}
      />
    );

    const image = container.querySelector('img')!;
    fireEvent.error(image);
    expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/webp;base64,thumb');
  });
});
