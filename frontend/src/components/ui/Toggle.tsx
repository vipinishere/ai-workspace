'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className,
}: ToggleProps) {
  return (
    <>
      <style>{`
        .toggle-wrapper {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }
        .toggle-wrapper.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .toggle-track {
          position: relative;
          flex-shrink: 0;
          border-radius: var(--radius-full);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-strong);
          transition: var(--transition);
          cursor: pointer;
        }
        .toggle-track:focus-visible {
          outline: 2px solid var(--accent-primary);
          outline-offset: 2px;
        }
        .toggle-track-md {
          width: 44px;
          height: 24px;
        }
        .toggle-track-sm {
          width: 36px;
          height: 20px;
        }
        .toggle-track.checked {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          box-shadow: 0 0 12px rgba(124, 58, 237, 0.3);
        }
        .toggle-thumb {
          position: absolute;
          top: 2px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .toggle-thumb-md {
          width: 18px;
          height: 18px;
          left: 2px;
        }
        .toggle-thumb-sm {
          width: 14px;
          height: 14px;
          left: 2px;
        }
        .toggle-track.checked .toggle-thumb-md {
          transform: translateX(20px);
        }
        .toggle-track.checked .toggle-thumb-sm {
          transform: translateX(16px);
        }
        .toggle-label-group {}
        .toggle-label {
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--text-primary);
          line-height: 1.4;
          cursor: pointer;
        }
        .toggle-label-sm {
          font-size: 0.875rem;
        }
        .toggle-description {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin-top: 0.125rem;
          line-height: 1.4;
        }
      `}</style>
      <div
        className={cn('toggle-wrapper', disabled && 'disabled', className)}
        onClick={() => !disabled && onChange(!checked)}
      >
        <div
          className={cn(
            'toggle-track',
            `toggle-track-${size}`,
            checked && 'checked'
          )}
          role="switch"
          aria-checked={checked}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={e => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onChange(!checked)
            }
          }}
        >
          <div
            className={cn('toggle-thumb', `toggle-thumb-${size}`)}
            aria-hidden="true"
          />
        </div>
        {(label || description) && (
          <div className="toggle-label-group">
            {label && (
              <div className={cn('toggle-label', size === 'sm' && 'toggle-label-sm')}>
                {label}
              </div>
            )}
            {description && (
              <div className="toggle-description">{description}</div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export { Toggle }
