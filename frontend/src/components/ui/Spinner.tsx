'use client'

import React from 'react'
import { cn } from '@/lib/utils'

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface SpinnerProps {
  size?: SpinnerSize
  color?: string
  className?: string
  label?: string
}

const sizeMap: Record<SpinnerSize, number> = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 36,
  xl: 48,
}

function Spinner({ size = 'md', color, className, label = 'Loading...' }: SpinnerProps) {
  const px = sizeMap[size]

  return (
    <>
      <style>{`
        .spinner {
          border-radius: 50%;
          border: 2px solid var(--border);
          border-top-color: var(--accent-primary);
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .spinner-xs { border-width: 1.5px; }
        .spinner-sm { border-width: 2px; }
        .spinner-md { border-width: 2.5px; }
        .spinner-lg { border-width: 3px; }
        .spinner-xl { border-width: 3.5px; }
      `}</style>
      <span
        className={cn('spinner', `spinner-${size}`, className)}
        style={{
          width: px,
          height: px,
          ...(color ? { borderTopColor: color } : {}),
        }}
        role="status"
        aria-label={label}
      />
    </>
  )
}

interface LoadingOverlayProps {
  label?: string
}

function LoadingOverlay({ label = 'Loading...' }: LoadingOverlayProps) {
  return (
    <>
      <style>{`
        .loading-overlay {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          min-height: 200px;
          color: var(--text-muted);
          font-size: 0.875rem;
        }
      `}</style>
      <div className="loading-overlay">
        <Spinner size="lg" />
        <span>{label}</span>
      </div>
    </>
  )
}

export { Spinner, LoadingOverlay }
