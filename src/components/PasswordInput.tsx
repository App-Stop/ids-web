import React, { useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string
  containerStyle?: React.CSSProperties
}

export function PasswordInput({
  className = '',
  containerClassName = '',
  containerStyle,
  style,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div
      className={`password-input-wrap ${containerClassName}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        ...containerStyle,
      }}
    >
      <input
        {...props}
        type={showPassword ? 'text' : 'password'}
        className={className}
        style={{
          paddingRight: '2.5rem',
          width: '100%',
          ...style,
        }}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        style={{
          position: 'absolute',
          right: '0.75rem',
          border: 'none',
          background: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px',
          borderRadius: '4px',
          zIndex: 2,
        }}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

export default PasswordInput
