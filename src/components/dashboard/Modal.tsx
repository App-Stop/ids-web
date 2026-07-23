import type { ReactNode } from 'react'

export default function Modal({
  onClose,
  children,
  width = 420,
}: {
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: width }}>
        {children}
      </div>
    </div>
  )
}
