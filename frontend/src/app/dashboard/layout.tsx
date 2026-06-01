'use client'

import React, { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { useAuth } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in')
    }
  }, [isLoaded, userId, router])

  if (!isLoaded || !userId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="animate-spin"
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
          }}
        />
      </div>
    )
  }

  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard'
    if (pathname.startsWith('/dashboard/chat')) return 'Chat'
    if (pathname.startsWith('/dashboard/analytics')) return 'Analytics'
    if (pathname.startsWith('/dashboard/billing')) return 'Billing'
    if (pathname.startsWith('/dashboard/api-keys')) return 'API Keys'
    if (pathname.startsWith('/dashboard/team')) return 'Team'
    if (pathname.startsWith('/dashboard/marketplace')) return 'Marketplace'
    if (pathname.startsWith('/dashboard/settings')) return 'Settings'
    if (pathname.startsWith('/dashboard/admin')) return 'Admin Panel'
    return 'AI Workspace'
  }

  return (
    <>
      <style>{`
        .dashboard-container {
          min-height: 100vh;
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        .dashboard-main {
          margin-left: var(--sidebar-width);
          padding-top: var(--topbar-height);
          transition: margin-left 0.3s ease;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .dashboard-content {
          flex: 1;
          padding: 2rem;
          max-width: var(--content-max-width);
          width: 100%;
          margin: 0 auto;
          animation: fadeIn 0.3s ease forwards;
        }
        @media (max-width: 768px) {
          .dashboard-main {
            margin-left: 0;
          }
          .dashboard-content {
            padding: 1.25rem;
          }
        }
      `}</style>

      <div className="dashboard-container">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="dashboard-main">
          <Topbar
            title={getPageTitle()}
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          <main className="dashboard-content">{children}</main>
        </div>
      </div>
    </>
  )
}
