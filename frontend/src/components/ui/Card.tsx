'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hover?: boolean
  glow?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

interface CardHeaderProps {
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

interface CardBodyProps {
  children: React.ReactNode
  className?: string
}

interface CardFooterProps {
  children: React.ReactNode
  className?: string
}

const cardStyles = `
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition: var(--transition);
    position: relative;
    overflow: hidden;
  }
  .card-hover {
    cursor: pointer;
  }
  .card-hover:hover {
    background: var(--bg-card-hover);
    border-color: var(--border-strong);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  .card-hover:active {
    transform: translateY(0);
  }
  .card-glow {
    box-shadow: var(--accent-glow-sm);
  }
  .card-glow:hover {
    box-shadow: var(--accent-glow);
  }
  .card-pad-none { padding: 0; }
  .card-pad-sm { padding: 1rem; }
  .card-pad-md { padding: 1.5rem; }
  .card-pad-lg { padding: 2rem; }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  .card-header-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .card-body {
    padding: 1.5rem;
  }
  .card-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }
`

function Card({
  children,
  className,
  hover = false,
  onClick,
  padding = 'none',
  glow = false,
  ...props
}: CardProps) {
  return (
    <>
      <style>{cardStyles}</style>
      <div
        className={cn(
          'card',
          hover && 'card-hover',
          glow && 'card-glow',
          `card-pad-${padding}`,
          className
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClick(e as any)
                }
              }
            : undefined
        }
        {...props}
      >
        {children}
      </div>
    </>
  )
}

function CardHeader({ children, className, action }: CardHeaderProps) {
  return (
    <div className={cn('card-header', className)}>
      <div className="card-header-title">{children}</div>
      {action && <div>{action}</div>}
    </div>
  )
}

function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn('card-body', className)}>{children}</div>
}

function CardFooter({ children, className }: CardFooterProps) {
  return <div className={cn('card-footer', className)}>{children}</div>
}

export { Card, CardHeader, CardBody, CardFooter }
