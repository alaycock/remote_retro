export interface ZoomControlsProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFit: () => void
}

export function ZoomControls({ scale, onZoomIn, onZoomOut, onReset, onFit }: ZoomControlsProps) {
  return (
    <div
      className="join absolute bottom-3 right-3 z-30 shadow-md"
      role="toolbar"
      aria-label="Zoom"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="btn join-item btn-sm" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out (-)">
        <span className="hero-minus size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn join-item btn-sm w-16 tabular-nums"
        onClick={onReset}
        aria-label={`Zoom ${Math.round(scale * 100)}%, reset to 100%`}
        title="Reset to 100% (0)"
      >
        {Math.round(scale * 100)}%
      </button>
      <button type="button" className="btn join-item btn-sm" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in (+)">
        <span className="hero-plus size-4" aria-hidden="true" />
      </button>
      <button type="button" className="btn join-item btn-sm" onClick={onFit} aria-label="Fit all ideas" title="Fit all (1)">
        Fit
      </button>
    </div>
  )
}
