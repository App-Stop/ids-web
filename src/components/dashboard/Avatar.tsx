const COLORS = ['#e0399f', '#22c55e', '#14b8a6', '#ef4444', '#f97316', '#3b82f6', '#8b5cf6']

function colorFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export default function Avatar({
  name,
  size = 32,
  src,
  background,
}: {
  name: string
  size?: number
  src?: string | null
  background?: string
}) {
  if (src) {
    return (
      <img
        className="avatar avatar--photo"
        src={src}
        alt=""
        style={{
          width: size,
          height: size,
        }}
      />
    )
  }

  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: background || colorFor(name || '?'),
      }}
    >
      {initials || '?'}
    </span>
  )
}
