const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** $1,234.50 — the sign, if any, is left to the caller. */
export function dollars(value: number): string {
  return usd.format(Math.abs(value))
}

/** +$5,000.00 / −$2,000.00, as change-order amounts are shown. */
export function signedDollars(value: number): string {
  return `${value < 0 ? '−' : '+'}${dollars(value)}`
}
