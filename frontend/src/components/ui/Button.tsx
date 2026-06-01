'use client'

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <>
        <style>{`
          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            font-weight: 500;
            border-radius: var(--radius-md);
            transition: var(--transition);
            cursor: pointer;
            border: 1px solid transparent;
            white-space: nowrap;
            letter-spacing: -0.01em;
            position: relative;
            overflow: hidden;
          }
          .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            pointer-events: none;
          }
          .btn-primary {
            background: var(--accent-gradient);
            color: #fff;
            border-color: transparent;
            box-shadow: 0 2px 12px rgba(124, 58, 237, 0.3);
          }
          .btn-primary:hover:not(:disabled) {
            box-shadow: 0 4px 20px rgba(124, 58, 237, 0.5);
            transform: translateY(-1px);
          }
          .btn-primary:active:not(:disabled) {
            transform: translateY(0);
          }
          .btn-secondary {
            background: var(--bg-glass);
            color: var(--text-primary);
            border-color: var(--border);
            backdrop-filter: blur(20px);
          }
          .btn-secondary:hover:not(:disabled) {
            background: var(--bg-card-hover);
            border-color: var(--border-strong);
          }
          .btn-outline {
            background: transparent;
            color: var(--text-primary);
            border-color: var(--border-strong);
          }
          .btn-outline:hover:not(:disabled) {
            background: var(--bg-card);
            border-color: var(--accent-primary);
            color: var(--accent-primary);
          }
          .btn-ghost {
            background: transparent;
            color: var(--text-secondary);
            border-color: transparent;
          }
          .btn-ghost:hover:not(:disabled) {
            background: var(--bg-card);
            color: var(--text-primary);
          }
          .btn-danger {
            background: var(--error-bg);
            color: var(--error);
            border-color: rgba(239, 68, 68, 0.2);
          }
          .btn-danger:hover:not(:disabled) {
            background: var(--error);
            color: #fff;
            border-color: var(--error);
          }
          .btn-sm {
            padding: 0.375rem 0.75rem;
            font-size: 0.8125rem;
            border-radius: var(--radius-sm);
          }
          .btn-md {
            padding: 0.5625rem 1.125rem;
            font-size: 0.875rem;
          }
          .btn-lg {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            border-radius: var(--radius-lg);
          }
          .btn-full { width: 100%; }
          .btn-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
            flex-shrink: 0;
          }
          .btn-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
        `}</style>
        <button
          ref={ref}
          className={cn(
            'btn',
            `btn-${variant}`,
            `btn-${size}`,
            fullWidth && 'btn-full',
            className
          )}
          disabled={isDisabled}
          {...props}
        >
          {loading ? (
            <span className="btn-spinner" aria-hidden="true" />
          ) : icon ? (
            <span className="btn-icon">{icon}</span>
          ) : null}
          {children}
          {iconRight && !loading && (
            <span className="btn-icon">{iconRight}</span>
          )}
        </button>
      </>
    )
  }
)

Button.displayName = 'Button'

export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
