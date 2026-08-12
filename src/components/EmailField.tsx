const DOMAIN = '@ids-demo.com'

export default function EmailField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="auth-field">
      <label htmlFor="email">Email address</label>
      <div className="auth-email">
        <input
          id="email"
          type="text"
          placeholder="yourname"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="username"
          required
        />
        <span>{DOMAIN}</span>
      </div>
    </div>
  )
}

export { DOMAIN }
