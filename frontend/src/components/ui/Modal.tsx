'use client'

import React, { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: ModalSize
  showCloseButton?: boolean
  closeOnBackdrop?: boolean
  footer?: React.ReactNode
}

const sizeMap: Record<ModalSize, string> = {
  sm: '400px',
  md: '560px',
  lg: '720px',
  xl: '900px',
  full: '95vw',
}

function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  footer,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (typeof window === 'undefined') return null

  return createPortal(
    <>
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: var(--z-modal);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          animation: fadeIn 0.15s ease forwards;
        }
        .modal-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .modal-panel {
          position: relative;
          z-index: 1;
          background: var(--bg-secondary);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          animation: scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.5rem 1.5rem 1rem;
          gap: 1rem;
          flex-shrink: 0;
        }
        .modal-header-content {}
        .modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin-bottom: 0;
        }
        .modal-description {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
          line-height: 1.5;
        }
        .modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition);
          flex-shrink: 0;
        }
        .modal-close:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }
        .modal-body {
          padding: 0 1.5rem 1.5rem;
          overflow-y: auto;
          flex: 1;
        }
        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          flex-shrink: 0;
        }
        @media (max-width: 600px) {
          .modal-panel {
            border-radius: var(--radius-lg);
            max-height: 95vh;
          }
          .modal-overlay {
            align-items: flex-end;
            padding: 0;
          }
          .modal-panel {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
          }
        }
      `}</style>
      {isOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
          <div
            className="modal-backdrop"
            onClick={closeOnBackdrop ? onClose : undefined}
            ref={overlayRef}
          />
          <div
            className="modal-panel"
            style={{ maxWidth: sizeMap[size] }}
          >
            {(title || showCloseButton) && (
              <div className="modal-header">
                <div className="modal-header-content">
                  {title && (
                    <h2 id="modal-title" className="modal-title">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="modal-description">{description}</p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    className="modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      )}
    </>,
    document.body
  )
}

export { Modal }
