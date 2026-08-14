interface ResponsiveHeaderSubtitleProps {
  desktop: string;
  mobile: string;
}

/** Keeps full desktop guidance while providing concise, intentional mobile copy. */
export function ResponsiveHeaderSubtitle({ desktop, mobile }: ResponsiveHeaderSubtitleProps) {
  return (
    <p className="view-header-subtitle">
      <span className="view-header-subtitle-desktop">{desktop}</span>
      <span className="view-header-subtitle-mobile">{mobile}</span>
    </p>
  );
}
