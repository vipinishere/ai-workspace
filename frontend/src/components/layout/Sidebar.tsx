'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  CreditCard,
  Key,
  Settings,
  Users,
  Store,
  Shield,
  ChevronDown,
  Sparkles,
  Plus,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { useSubscription } from '@/lib/hooks/useSubscription'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: string | number
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/dashboard/chat', label: 'Chat', icon: <MessageSquare size={18} /> },
  { href: '/dashboard/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
  { href: '/dashboard/billing', label: 'Billing', icon: <CreditCard size={18} /> },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: <Key size={18} /> },
  { href: '/dashboard/team', label: 'Team', icon: <Users size={18} /> },
  { href: '/dashboard/marketplace', label: 'Marketplace', icon: <Store size={18} /> },
  { href: '/dashboard/settings', label: 'Settings', icon: <Settings size={18} /> },
  { href: '/dashboard/admin', label: 'Admin', icon: <Shield size={18} />, adminOnly: true },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useUser()
  const { subscription, tokenQuotaPercent } = useSubscription()

  const planColors: Record<string, string> = {
    free: 'default',
    pro: 'purple',
    team: 'info',
    enterprise: 'success',
  }

  return (
    <>
      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          z-index: var(--z-sticky);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 1.25rem 1.25rem 1rem;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .sidebar-logo-icon {
          width: 32px;
          height: 32px;
          background: var(--accent-gradient);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 0 16px rgba(124, 58, 237, 0.4);
        }
        .sidebar-logo-text {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }
        .sidebar-logo-text span {
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .sidebar-workspace {
          margin: 0.75rem 0.75rem 0.25rem;
          padding: 0.5rem 0.625rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: var(--transition);
          flex-shrink: 0;
        }
        .sidebar-workspace:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-strong);
        }
        .sidebar-workspace-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .sidebar-workspace-sub {
          font-size: 0.71875rem;
          color: var(--text-muted);
          margin-top: 0.1rem;
        }
        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem 0.75rem;
        }
        .sidebar-nav-section {
          margin-bottom: 0.25rem;
        }
        .sidebar-nav-label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.5rem 0.5rem 0.25rem;
        }
        .sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5rem 0.625rem;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          transition: var(--transition);
          cursor: pointer;
          border: 1px solid transparent;
          margin-bottom: 0.125rem;
          position: relative;
          overflow: hidden;
        }
        .sidebar-nav-item:hover {
          background: var(--bg-card);
          color: var(--text-primary);
        }
        .sidebar-nav-item.active {
          background: rgba(124, 58, 237, 0.1);
          color: var(--accent-primary);
          border-color: rgba(124, 58, 237, 0.15);
        }
        .sidebar-nav-item.active .sidebar-nav-icon {
          color: var(--accent-primary);
        }
        .sidebar-nav-icon {
          flex-shrink: 0;
          opacity: 0.8;
        }
        .sidebar-nav-item.active .sidebar-nav-icon {
          opacity: 1;
        }
        .sidebar-nav-item-badge {
          margin-left: auto;
        }
        .sidebar-new-chat {
          margin: 0 0.75rem 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.625rem;
          background: var(--accent-gradient);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: 0 2px 12px rgba(124, 58, 237, 0.3);
          text-decoration: none;
          flex-shrink: 0;
        }
        .sidebar-new-chat:hover {
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.5);
          transform: translateY(-1px);
        }
        .sidebar-quota {
          margin: 0 0.75rem 0.75rem;
          padding: 0.75rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }
        .sidebar-quota-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }
        .sidebar-quota-bar {
          height: 4px;
          background: var(--border);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .sidebar-quota-fill {
          height: 100%;
          background: var(--accent-gradient);
          border-radius: var(--radius-full);
          transition: width 0.5s ease;
        }
        .sidebar-user {
          padding: 0.75rem;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 0.625rem;
          cursor: pointer;
          transition: var(--transition);
          flex-shrink: 0;
        }
        .sidebar-user:hover {
          background: var(--bg-card);
        }
        .sidebar-user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.8125rem;
          font-weight: 700;
          flex-shrink: 0;
          overflow: hidden;
        }
        .sidebar-user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .sidebar-user-info {
          flex: 1;
          min-width: 0;
        }
        .sidebar-user-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-user-email {
          font-size: 0.71875rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .sidebar.open {
            transform: translateX(0);
            box-shadow: var(--shadow-xl);
          }
          .sidebar-mobile-overlay {
            display: none;
          }
          .sidebar.open ~ .sidebar-mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: calc(var(--z-sticky) - 1);
            backdrop-filter: blur(4px);
          }
        }
      `}</style>

      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 'calc(var(--z-sticky) - 1)',
            backdropFilter: 'blur(4px)',
            display: 'none',
          }}
          onClick={onClose}
          className="sidebar-mobile-overlay"
        />
      )}

      <aside className={cn('sidebar', isOpen && 'open')}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Sparkles size={18} />
          </div>
          <div className="sidebar-logo-text">
            AI<span>Workspace</span>
          </div>
        </div>

        {/* Workspace selector */}
        <div className="sidebar-workspace">
          <div>
            <div className="sidebar-workspace-name">My Workspace</div>
            <div className="sidebar-workspace-sub">
              {subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : 'Free'} Plan
            </div>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </div>

        {/* New Chat button */}
        <Link href="/dashboard/chat" className="sidebar-new-chat">
          <Plus size={16} />
          New Chat
        </Link>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map(item => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('sidebar-nav-item', isActive && 'active')}
                onClick={onClose}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                {item.label}
                {item.badge && (
                  <span className="sidebar-nav-item-badge">
                    <Badge variant="purple" size="sm">{item.badge}</Badge>
                  </span>
                )}
                {item.adminOnly && (
                  <span className="sidebar-nav-item-badge">
                    <Badge variant="warning" size="sm">Admin</Badge>
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Token quota */}
        <div className="sidebar-quota">
          <div className="sidebar-quota-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Zap size={11} />
              Token Quota
            </span>
            <span>{tokenQuotaPercent.toFixed(0)}%</span>
          </div>
          <div className="sidebar-quota-bar">
            <div
              className="sidebar-quota-fill"
              style={{ width: `${tokenQuotaPercent}%` }}
            />
          </div>
        </div>

        {/* User profile */}
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={user.fullName || ''} />
            ) : (
              (user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || 'U').toUpperCase()
            )}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {user?.fullName || user?.firstName || 'User'}
            </div>
            <div className="sidebar-user-email">
              {user?.emailAddresses?.[0]?.emailAddress || ''}
            </div>
          </div>
          <Badge variant={planColors[subscription?.plan || 'free'] as 'default' | 'purple' | 'info' | 'success'} size="sm">
            {subscription?.plan || 'Free'}
          </Badge>
        </div>
      </aside>
    </>
  )
}

export { Sidebar }
