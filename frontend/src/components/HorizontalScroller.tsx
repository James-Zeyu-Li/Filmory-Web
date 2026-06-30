import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './HorizontalScroller.css';

interface HorizontalScrollerProps {
  children: React.ReactNode;
  className?: string;
}

export const HorizontalScroller: React.FC<HorizontalScrollerProps> = ({ children, className = '' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 1); // -1 for rounding errors
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    // Initial check might need a small delay for images/content to render
    setTimeout(handleScroll, 100);
    return () => window.removeEventListener('resize', handleScroll);
  }, [children]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const clientWidth = scrollRef.current.clientWidth;
    const scrollAmount = clientWidth * 0.75; // Scroll by 75% of container width
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  return (
    <div className={`horizontal-scroller-wrapper ${className}`}>
      {showLeft && (
        <button className="scroll-btn scroll-btn-left" onClick={() => scroll('left')} aria-label="向左滑动">
          <ChevronLeft size={20} />
        </button>
      )}
      
      <div 
        className="horizontal-scroller-content" 
        ref={scrollRef} 
        onScroll={handleScroll}
      >
        {children}
      </div>

      {showRight && (
        <button className="scroll-btn scroll-btn-right" onClick={() => scroll('right')} aria-label="向右滑动">
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
};
