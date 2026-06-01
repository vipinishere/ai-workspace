'use client'

import React, { forwardRef, useState, useId } from 'react'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
  showPasswordToggle?: boolean
  containerClassName?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      iconLeft,
      iconRight,
      showPasswordToggle = false,
      containerClassName,
      className,
      type = 'text',
      value,
      defaultValue,
      placeholder,
      ...props
    },
    ref
  ) => {
    const id = useId()
    const [showPassword, setShowPassword] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const [hasValue, setHasValue] = useState(
      Boolean(value || defaultValue)
    )

    const inputType =
      type === 'password' && showPasswordToggle
        ? showPassword
          ? 'text'
          : 'password'
        : type

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(Boolean(e.target.value))
      props.onChange?.(e)
    }

    const isFloating = isFocused || hasValue || Boolean(value)

    return (
      <>
        <style>{`
          .input-container {
            position: relative;
            width: 100%;
          }
          .input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
          }
          .input-field {
            width: 100%;
            background: var(--bg-input);
            border: 1px solid var(--border);
            color: var(--text-primary);
            border-radius: var(--radius-md);
            padding: 0.75rem 0.875rem;
            font-size: 0.9375rem;
            font-family: inherit;
            transition: var(--transition);
            outline: none;
            line-height: 1.5;
          }
          .input-field:focus {
            border-color: var(--border-focus);
            background: var(--bg-input);
            box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
          }
          .input-field.has-error {
            border-color: var(--error);
          }
          .input-field.has-error:focus {
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
          }
          .input-field.has-icon-left {
            padding-left: 2.5rem;
          }
          .input-field.has-icon-right {
            padding-right: 2.5rem;
          }
          .input-field.has-label {
            padding-top: 1.25rem;
            padding-bottom: 0.375rem;
          }
          .input-label {
            position: absolute;
            left: 0.875rem;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.9375rem;
            color: var(--text-placeholder);
            pointer-events: none;
            transition: all 0.15s ease;
            transform-origin: left top;
            z-index: 1;
          }
          .input-label.has-icon-left {
            left: 2.5rem;
          }
          .input-label.floating {
            transform: translateY(-130%) scale(0.75);
            color: var(--accent-primary);
            top: 50%;
          }
          .input-label.error {
            color: var(--error);
          }
          .input-icon {
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            pointer-events: none;
            z-index: 2;
          }
          .input-icon-left {
            left: 0.75rem;
          }
          .input-icon-right {
            right: 0.75rem;
          }
          .input-icon-btn {
            position: absolute;
            right: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            background: none;
            border: none;
            cursor: pointer;
            padding: 0.25rem;
            border-radius: var(--radius-sm);
            z-index: 2;
          }
          .input-icon-btn:hover {
            color: var(--text-secondary);
          }
          .input-error-text {
            font-size: 0.8125rem;
            color: var(--error);
            margin-top: 0.375rem;
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }
          .input-hint-text {
            font-size: 0.8125rem;
            color: var(--text-muted);
            margin-top: 0.375rem;
          }
        `}</style>
        <div className={cn('input-container', containerClassName)}>
          <div className="input-wrapper">
            {iconLeft && (
              <span className="input-icon input-icon-left">{iconLeft}</span>
            )}
            <input
              ref={ref}
              id={id}
              type={inputType}
              value={value}
              defaultValue={defaultValue}
              placeholder={label ? undefined : placeholder}
              className={cn(
                'input-field',
                error ? 'has-error' : '',
                iconLeft ? 'has-icon-left' : '',
                (iconRight || showPasswordToggle) ? 'has-icon-right' : '',
                label ? 'has-label' : '',
                className
              )}
              onFocus={e => {
                setIsFocused(true)
                props.onFocus?.(e)
              }}
              onBlur={e => {
                setIsFocused(false)
                props.onBlur?.(e)
              }}
              onChange={handleChange}
              {...props}
            />
            {label && (
              <label
                htmlFor={id}
                className={cn(
                  'input-label',
                  iconLeft ? 'has-icon-left' : '',
                  isFloating ? 'floating' : '',
                  error ? 'error' : ''
                )}
              >
                {label}
              </label>
            )}
            {showPasswordToggle && type === 'password' ? (
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            ) : iconRight ? (
              <span className="input-icon input-icon-right">{iconRight}</span>
            ) : null}
          </div>
          {error && <p className="input-error-text">{error}</p>}
          {hint && !error && <p className="input-hint-text">{hint}</p>}
        </div>
      </>
    )
  }
)

Input.displayName = 'Input'

export { Input }
