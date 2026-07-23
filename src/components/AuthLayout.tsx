import type { ReactNode } from 'react'
import heroImg from '../assets/image.png'
import './AuthLayout.css'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <img src={heroImg} alt="" className="auth-visual__img" />
        <div className="auth-visual__banner">
          Your partners for high-quality Concrete Cutting and Selective and
          Complete Demolition in Atlanta, Georgia.
        </div>
      </div>
      <div className="auth-panel">{children}</div>
    </div>
  )
}
