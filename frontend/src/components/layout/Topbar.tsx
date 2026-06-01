'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  Command,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopbarProps {
  onMenuToggle?: () => void
  title?: string
}

function Topbar({ onMenuToggle, title }: TopbarProps) {
  const { user } = useUser()
  const router = useRouter()
  const [searchFocused, setSearchFocused] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [notifCount] = useState(3)

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    document.documentElement.setAttribute('data-theme', newTheme === 'light' ? 'light' : '')
  }

  return (
    <>
      <style>{`
        .topbar {
          position: fixed;
          top: 0;
          left: var(--sidebar-width);
          right: 0;
          height: var(--topbar-height);
          background: var(--bg-topbar);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0 1.5rem;
          z-index: var(--z-sticky);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transition: left 0.3s ease;
        }
        .topbar-menu-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
          flex-shrink: 0;
        }
        .topbar-menu-btn:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }
        .topbar-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
          white-space: nowrap;
          display: none;
        }
        .topbar-search {
          flex: 1;
          max-width: 420px;
          position: relative;
        }
        .topbar-search-input {
          width: 100%;
          padding: 0.5rem 1rem 0.5rem 2.25rem;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          font-size: 0.875rem;
          color: var(--text-primary);
          outline: none;
          transition: var(--transition);
          font-family: inherit;
        }
        .topbar-search-input:focus {
          border-color: var(--border-focus);
          background: var(--bg-glass);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        .topbar-search-input::placeholder {
          color: var(--text-placeholder);
        }
        .topbar-search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .topbar-search-shortcut {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.6875rem;
          color: var(--text-muted);
          background: var(--bg-tertiary);
          padding: 0.15rem 0.4rem;
          border-radius: var(--radius-xs);
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        .topbar-search-input:focus + .topbar-search-icon + .topbar-search-shortcut,
        .topbar-search-input:focus ~ .topbar-search-shortcut {
          opacity: 0;
        }
        .topbar-spacer {
          flex: 1;
        }
        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .topbar-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition);
          position: relative;
          flex-shrink: 0;
        }
        .topbar-icon-btn:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }
        .topbar-notif-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 16px;
          height: 16px;
          background: var(--error);
          color: white;
          font-size: 0.5625rem;
          font-weight: 700;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--bg-primary);
        }
        .topbar-new-chat-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.4375rem 0.875rem;
          background: var(--accent-gradient);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: 0 2px 12px rgba(124, 58, 237, 0.3);
          white-space: nowrap;
        }
        .topbar-new-chat-btn:hover {
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.5);
          transform: translateY(-1px);
        }
        @media (max-width: 768px) {
          .topbar {
            left: 0;
            padding: 0 1rem;
          }
          .topbar-menu-btn {
            display: flex;
          }
          .topbar-title {
            display: block;
          }
          .topbar-search {
            display: none;
          }
          .topbar-new-chat-btn {
            display: none;
          }
        }
      `}</style>
      <header className="topbar">
        {/* Mobile menu button */}
        <button className="topbar-menu-btn" onClick={onMenuToggle} aria-label="Toggle sidebar">
          <Menu size={18} />
        </button>

        {/* Title (mobile) */}
        {title && <span className="topbar-title">{title}</span>}

        {/* Search */}
        <div className="topbar-search">
          <Search size={14} className="topbar-search-icon" />
          <input
            type="text"
            className="topbar-search-input"
            placeholder="Search conversations, models..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {!searchFocused && (
            <div className="topbar-search-shortcut">
              <Command size={10} />K
            </div>
          )}
        </div>

        <div className="topbar-spacer" />

        <div className="topbar-actions">
          {/* New Chat */}
          <button
            className="topbar-new-chat-btn"
            onClick={() => router.push('/dashboard/chat')}
          >
            <Plus size={14} />
            New Chat
          </button>

          {/* Notifications */}
          <button className="topbar-icon-btn" aria-label="Notifications">
            <Bell size={16} />
            {notifCount > 0 && (
              <span className="topbar-notif-badge">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button
            className="topbar-icon-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* User button (Clerk) */}
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: {
                  width: 32,
                  height: 32,
                },
              },
            }}
          />
        </div>
      </header>
    </>
  )
}

export { Topbar }
