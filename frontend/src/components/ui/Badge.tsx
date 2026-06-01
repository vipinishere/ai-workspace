'use client'

import React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'outline' | 'ghost'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
}

function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
  ...props
}: BadgeProps) {
  return (
    <>
      <style>{`
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-weight: 500;
          border-radius: var(--radius-full);
          border: 1px solid transparent;
          white-space: nowrap;
          letter-spacing: 0.01em;
        }
        .badge-sm {
          padding: 0.1rem 0.5rem;
          font-size: 0.6875rem;
        }
        .badge-md {
          padding: 0.2rem 0.65rem;
          font-size: 0.75rem;
        }
        .badge-default {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border-color: var(--border);
        }
        .badge-success {
          background: var(--success-bg);
          color: var(--success);
          border-color: rgba(16, 185, 129, 0.2);
        }
        .badge-warning {
          background: var(--warning-bg);
          color: var(--warning);
          border-color: rgba(245, 158, 11, 0.2);
        }
        .badge-error {
          background: var(--error-bg);
          color: var(--error);
          border-color: rgba(239, 68, 68, 0.2);
        }
        .badge-info {
          background: var(--info-bg);
          color: var(--info);
          border-color: rgba(59, 130, 246, 0.2);
        }
        .badge-purple {
          background: rgba(124, 58, 237, 0.12);
          color: #a78bfa;
          border-color: rgba(124, 58, 237, 0.2);
        }
        .badge-outline {
          background: transparent;
          color: var(--text-secondary);
          border-color: var(--border-strong);
        }
        .badge-ghost {
          background: transparent;
          color: var(--text-secondary);
          border-color: transparent;
        }
        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }
        .badge-dot-sm {
          width: 5px;
          height: 5px;
        }
      `}</style>
      <span className={cn('badge', `badge-${variant}`, `badge-${size}`, className)} {...props}>
        {dot && (
          <span
            className={cn('badge-dot', size === 'sm' && 'badge-dot-sm')}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    </>
  )
}

export { Badge }
export type { BadgeVariant }
