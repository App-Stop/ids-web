import { Icon } from './icons'

export default function ZoomControl({
  zoom,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  return (
    <div className="zoom-control">
      <span className="zoom-control__pct">{Math.round(zoom * 100)}%</span>
      <button type="button" className="icon-btn" onClick={onZoomIn} aria-label="Zoom in">
        <Icon.ZoomIn width={16} height={16} />
      </button>
      <button type="button" className="icon-btn" onClick={onZoomOut} aria-label="Zoom out">
        <Icon.ZoomOut width={16} height={16} />
      </button>
    </div>
  )
}
