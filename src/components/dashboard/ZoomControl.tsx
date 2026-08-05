import { MagnifyingGlassPlus, MagnifyingGlassMinus } from '@phosphor-icons/react'

export default function ZoomControl({
  zoom,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  const pct = Math.round(zoom * 100)

  return (
    <div className="zoom-control" role="group" aria-label="Zoom">
      {<span className="zoom-control__pct">{pct}%</span>}
      <div className="zoom-control__group">
        <button type="button" className="zoom-control__btn" onClick={onZoomIn} aria-label="Zoom in">
          <MagnifyingGlassPlus size={18} weight="regular" />
        </button>
        <span className="zoom-control__divider" aria-hidden />
        <button type="button" className="zoom-control__btn" onClick={onZoomOut} aria-label="Zoom out">
          <MagnifyingGlassMinus size={18} weight="regular" />
        </button>
      </div>
    </div>
  )
}
