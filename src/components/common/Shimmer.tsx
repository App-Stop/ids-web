import React from 'react'
import './Shimmer.css'

interface ShimmerProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
  style?: React.CSSProperties
}

export function Shimmer({
  width = '100%',
  height = '1rem',
  borderRadius = '6px',
  className = '',
  style,
}: ShimmerProps) {
  return (
    <span
      className={`shimmer-block ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  )
}

interface TableRowSkeletonProps {
  cols: number
  rows?: number
  height?: string
}

export function TableRowSkeleton({ cols, rows = 5, height = '20px' }: TableRowSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="shimmer-row">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} style={{ padding: '0.85rem 1rem' }}>
              <Shimmer height={height} width={cIdx === 0 ? '40%' : cIdx === 1 ? '70%' : '60%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
