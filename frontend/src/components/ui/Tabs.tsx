'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
  variant?: 'default' | 'pills'
}

function Tabs({ tabs, activeTab, onTabChange, className, variant = 'default' }: TabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  useEffect(() => {
    if (variant !== 'default') return
    const container = tabsRef.current
    if (!container) return

    const activeEl = container.querySelector(`[data-tab="${activeTab}"]`) as HTMLButtonElement
    if (!activeEl) return

    setIndicatorStyle({
      left: activeEl.offsetLeft,
      width: activeEl.offsetWidth,
    })
  }, [activeTab, tabs, variant])

  return (
    <>
      <style>{`
        .tabs {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.125rem;
        }
        .tabs-default {
          border-bottom: 1px solid var(--border);
          padding-bottom: 0;
          gap: 0;
        }
        .tabs-pills {
          background: var(--bg-tertiary);
          border-radius: var(--radius-lg);
          padding: 0.25rem;
          gap: 0.25rem;
        }
        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          border-radius: var(--radius-md);
          transition: var(--transition);
          white-space: nowrap;
          position: relative;
        }
        .tab-btn:hover {
          color: var(--text-primary);
        }
        .tabs-default .tab-btn {
          border-radius: 0;
          padding-bottom: 0.875rem;
        }
        .tab-btn.active {
          color: var(--text-primary);
        }
        .tabs-pills .tab-btn.active {
          background: var(--bg-glass-strong);
          box-shadow: var(--shadow-sm);
        }
        .tab-indicator {
          position: absolute;
          bottom: -1px;
          height: 2px;
          background: var(--accent-gradient);
          border-radius: 2px 2px 0 0;
          transition: left 0.2s ease, width 0.2s ease;
        }
        .tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 0.3rem;
          font-size: 0.6875rem;
          font-weight: 600;
          background: var(--accent-primary);
          color: white;
          border-radius: var(--radius-full);
        }
        .tabs-default .tab-btn .tab-badge {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }
        .tabs-default .tab-btn.active .tab-badge {
          background: rgba(124, 58, 237, 0.15);
          color: var(--accent-primary);
        }
      `}</style>
      <div
        ref={tabsRef}
        className={cn('tabs', variant === 'default' ? 'tabs-default' : 'tabs-pills', className)}
        role="tablist"
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-tab={tab.id}
            className={cn('tab-btn', activeTab === tab.id && 'active')}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.icon && tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span className="tab-badge">{tab.badge}</span>
            )}
          </button>
        ))}
        {variant === 'default' && (
          <div
            className="tab-indicator"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </>
  )
}

export { Tabs }
export type { Tab }
