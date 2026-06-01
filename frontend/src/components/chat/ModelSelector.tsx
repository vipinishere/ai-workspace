'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, Lock, Check, Zap, Eye, Code2, Brain, AlignLeft } from 'lucide-react'
import { cn, formatCost, getProviderColor, getProviderName } from '@/lib/utils'
import { useSubscription } from '@/lib/hooks/useSubscription'
import type { ModelInfo, AIProvider } from '@/lib/types'

interface ModelSelectorProps {
  selectedModelId: string
  onSelect: (modelId: string) => void
  className?: string
}

const PROVIDER_ORDER: AIProvider[] = ['openai', 'anthropic', 'google', 'mistral', 'openrouter', 'cohere']

const capabilityIcons: Record<string, React.ReactNode> = {
  vision: <Eye size={10} />,
  code: <Code2 size={10} />,
  reasoning: <Brain size={10} />,
  'long-context': <AlignLeft size={10} />,
}

function ModelSelector({ selectedModelId, onSelect, className }: ModelSelectorProps) {
  const { models, hasModelAccess } = useSubscription()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedModel = models.find(m => m.id === selectedModelId)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50)
    } else {
      setSearch('')
    }
  }, [isOpen])

  const filteredModels = models.filter(
    m =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase())
  )

  const groupedModels = PROVIDER_ORDER.reduce<Record<string, ModelInfo[]>>((acc, provider) => {
    const group = filteredModels.filter(m => m.provider === provider)
    if (group.length > 0) acc[provider] = group
    return acc
  }, {})

  return (
    <>
      <style>{`
        .model-selector-wrapper {
          position: relative;
        }
        .model-trigger {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
          max-width: 240px;
          font-family: inherit;
          color: var(--text-primary);
        }
        .model-trigger:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-strong);
        }
        .model-trigger-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .model-trigger-name {
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }
        .model-trigger-chevron {
          color: var(--text-muted);
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }
        .model-trigger-chevron.open {
          transform: rotate(180deg);
        }
        .model-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: var(--z-dropdown);
          background: var(--bg-secondary);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-xl);
          width: 340px;
          max-height: 480px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: fadeInDown 0.15s ease forwards;
        }
        .model-search {
          padding: 0.75rem;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .model-search-input {
          width: 100%;
          padding: 0.5rem 0.75rem 0.5rem 2rem;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          color: var(--text-primary);
          outline: none;
          position: relative;
        }
        .model-search-input:focus {
          border-color: var(--border-focus);
        }
        .model-search-icon {
          position: absolute;
          left: 1.25rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .model-search-wrapper {
          position: relative;
        }
        .model-list {
          overflow-y: auto;
          flex: 1;
          padding: 0.5rem;
        }
        .model-provider-group {
          margin-bottom: 0.25rem;
        }
        .model-provider-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .model-provider-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .model-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.625rem 0.625rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
          position: relative;
        }
        .model-item:hover:not(.locked) {
          background: var(--bg-card-hover);
        }
        .model-item.selected {
          background: rgba(124, 58, 237, 0.08);
        }
        .model-item.locked {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .model-item-info {
          flex: 1;
          min-width: 0;
        }
        .model-item-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 0.125rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }
        .model-item-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 0.25rem;
        }
        .model-item-stats {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .model-stat {
          display: flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.6875rem;
          color: var(--text-muted);
          background: var(--bg-tertiary);
          padding: 0.1rem 0.35rem;
          border-radius: var(--radius-full);
        }
        .model-capability {
          display: flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.6875rem;
          color: var(--text-muted);
          background: var(--bg-tertiary);
          padding: 0.1rem 0.35rem;
          border-radius: var(--radius-full);
          text-transform: capitalize;
        }
        .model-check {
          color: var(--accent-primary);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .model-lock {
          color: var(--text-muted);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .model-empty {
          padding: 2rem 1rem;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.875rem;
        }
      `}</style>
      <div className={cn('model-selector-wrapper', className)} ref={dropdownRef}>
        <button
          className="model-trigger"
          onClick={() => setIsOpen(v => !v)}
          type="button"
        >
          <div
            className="model-trigger-dot"
            style={{ background: getProviderColor(selectedModel?.provider || '') }}
          />
          <span className="model-trigger-name">
            {selectedModel?.name || 'Select Model'}
          </span>
          <svg
            className={cn('model-trigger-chevron', isOpen && 'open')}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {isOpen && (
          <div className="model-dropdown">
            <div className="model-search">
              <div className="model-search-wrapper">
                <Search size={14} className="model-search-icon" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  type="text"
                  className="model-search-input"
                  placeholder="Search models..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: '2rem' }}
                />
              </div>
            </div>
            <div className="model-list">
              {Object.keys(groupedModels).length === 0 ? (
                <div className="model-empty">No models found</div>
              ) : (
                Object.entries(groupedModels).map(([provider, providerModels]) => (
                  <div key={provider} className="model-provider-group">
                    <div className="model-provider-header">
                      <div
                        className="model-provider-dot"
                        style={{ background: getProviderColor(provider) }}
                      />
                      {getProviderName(provider)}
                    </div>
                    {providerModels.map(model => {
                      const hasAccess = hasModelAccess(model.id)
                      const isSelected = model.id === selectedModelId

                      return (
                        <div
                          key={model.id}
                          className={cn(
                            'model-item',
                            isSelected && 'selected',
                            !hasAccess && 'locked'
                          )}
                          onClick={() => {
                            if (hasAccess) {
                              onSelect(model.id)
                              setIsOpen(false)
                            }
                          }}
                        >
                          <div className="model-item-info">
                            <div className="model-item-name">
                              {model.name}
                              {!hasAccess && <Lock size={11} style={{ color: 'var(--text-muted)' }} />}
                            </div>
                            <div className="model-item-desc">{model.description}</div>
                            <div className="model-item-stats">
                              <span className="model-stat">
                                <Zap size={9} />
                                {(model.contextLength / 1000).toFixed(0)}k ctx
                              </span>
                              <span className="model-stat">
                                {formatCost(model.pricePrompt)}/1k in
                              </span>
                              {model.capabilities.filter(c => c !== 'chat').map(cap => (
                                <span key={cap} className="model-capability">
                                  {capabilityIcons[cap]}
                                  {cap}
                                </span>
                              ))}
                            </div>
                          </div>
                          {isSelected ? (
                            <Check size={14} className="model-check" />
                          ) : !hasAccess ? (
                            <Lock size={14} className="model-lock" />
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export { ModelSelector }
