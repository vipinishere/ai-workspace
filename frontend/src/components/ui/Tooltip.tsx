'use client'

import React, { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: string | React.ReactNode
  position?: TooltipPosition
  children: React.ReactNode
  delay?: number
  className?: string
  disabled?: boolean
}

function Tooltip({
  content,
  position = 'top',
  children,
  delay = 200,
  className,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = () => {
    if (disabled) return
    timeoutRef.current = setTimeout(() => setVisible(true), delay)
  }

  const hide = () => {
    clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  return (
    <>
      <style>{`
        .tooltip-container {
          position: relative;
          display: inline-flex;
        }
        .tooltip-bubble {
          position: absolute;
          z-index: var(--z-toast);
          background: var(--bg-secondary);
          border: 1px solid var(--border-strong);
          color: var(--text-primary);
          font-size: 0.75rem;
          font-weight: 500;
          line-height: 1.4;
          padding: 0.4rem 0.7rem;
          border-radius: var(--radius-md);
          white-space: nowrap;
          box-shadow: var(--shadow-md);
          pointer-events: none;
          animation: fadeIn 0.1s ease forwards;
          max-width: 240px;
          white-space: normal;
          text-align: center;
        }
        .tooltip-top {
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
        }
        .tooltip-bottom {
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
        }
        .tooltip-left {
          right: calc(100% + 8px);
          top: 50%;
          transform: translateY(-50%);
        }
        .tooltip-right {
          left: calc(100% + 8px);
          top: 50%;
          transform: translateY(-50%);
        }
        .tooltip-arrow {
          position: absolute;
          width: 6px;
          height: 6px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-strong);
          transform: rotate(45deg);
        }
        .tooltip-top .tooltip-arrow {
          bottom: -4px;
          left: 50%;
          margin-left: -3px;
          border-top: none;
          border-left: none;
        }
        .tooltip-bottom .tooltip-arrow {
          top: -4px;
          left: 50%;
          margin-left: -3px;
          border-bottom: none;
          border-right: none;
        }
        .tooltip-left .tooltip-arrow {
          right: -4px;
          top: 50%;
          margin-top: -3px;
          border-left: none;
          border-bottom: none;
        }
        .tooltip-right .tooltip-arrow {
          left: -4px;
          top: 50%;
          margin-top: -3px;
          border-right: none;
          border-top: none;
        }
      `}</style>
      <div
        className={cn('tooltip-container', className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
        {visible && content && (
          <div className={cn('tooltip-bubble', `tooltip-${position}`)}>
            <div className="tooltip-arrow" />
            {content}
          </div>
        )}
      </div>
    </>
  )
}

export { Tooltip }
