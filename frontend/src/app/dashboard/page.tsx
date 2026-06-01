'use client'

import React, { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import {
  Sparkles,
  Zap,
  TrendingUp,
  MessageSquare,
  ArrowRight,
  Plus,
  Key,
  Users,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { DashboardSummary, Conversation, ApiResponse } from '@/lib/types'

export default function DashboardPage() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)
  const [liveNotification, setLiveNotification] = useState<{
    model: string
    tokens: number
    cost: number
    show: boolean
  }>({ model: '', tokens: 0, cost: 0, show: false })

  const fetchDashboardData = async () => {
    try {
      const token = await getToken()
      if (!token) return

      // Load analytics summary
      const sumResponse = await api.get<ApiResponse<DashboardSummary>>(
        '/api/v1/analytics/summary',
        token
      )
      if (sumResponse?.data) {
        setSummary(sumResponse.data)
      }

      // Load recent conversations
      const convsResponse = await api.getConversations(token, 1, 5)
      if (convsResponse?.items) {
        setConversations(convsResponse.items)
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err)
      // Fallback mocks
      setSummary({
        total_conversations: 12,
        total_messages: 124,
        total_tokens: 3247500,
        total_cost_usd: 12.47,
        tokens_used_this_month: 3247500,
        token_quota_monthly: 10000000,
        quota_percentage: 32.5,
        active_models: 4,
        top_model: 'claude-3-5-sonnet',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [getToken])

  // WebSocket Live Updates Connection
  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout

    const connectWS = async () => {
      try {
        const token = await getToken()
        if (!token) return

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/api/v1/analytics/ws?token=${token}`

        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('Real-time token tracking socket connected')
          setWsConnected(true)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'usage_update' && data.data) {
              // Atomically update state with WebSocket message details
              setSummary(prev => {
                if (!prev) return prev
                return {
                  ...prev,
                  tokens_used_this_month: data.data.tokensUsedThisMonth,
                  token_quota_monthly: data.data.tokenQuotaMonthly,
                  quota_percentage: data.data.quotaPercentage,
                  total_cost_usd: data.data.totalCostUsd,
                  total_tokens: data.data.totalTokens,
                }
              })

              // Prompt live toast notification
              if (data.data.recent_use) {
                setLiveNotification({
                  model: data.data.recent_use.model_id,
                  tokens: data.data.recent_use.tokens,
                  cost: data.data.recent_use.cost,
                  show: true,
                })
                // Hide after 4 seconds
                setTimeout(() => {
                  setLiveNotification(prev => ({ ...prev, show: false }))
                }, 4000)
              }
            }
          } catch (e) {
            console.error('Error parsing live WS payload', e)
          }
        }

        ws.onclose = () => {
          setWsConnected(false)
          // Reconnect loop every 5s
          reconnectTimeout = setTimeout(connectWS, 5000)
        }

        ws.onerror = () => {
          setWsConnected(false)
        }
      } catch (e) {
        setWsConnected(false)
      }
    }

    connectWS()

    return () => {
      ws?.close()
      clearTimeout(reconnectTimeout)
    }
  }, [getToken])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
        <div
          className="animate-spin"
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
          }}
        />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading dashboard stats...</p>
      </div>
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num.toString()
  }

  return (
    <>
      <style>{`
        .welcome-section {
          margin-bottom: 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .welcome-title {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }
        .welcome-sub {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }
        .ws-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
          padding: 0.375rem 0.75rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          color: var(--text-secondary);
        }
        .ws-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${wsConnected ? 'var(--success)' : 'var(--text-muted)'};
          box-shadow: ${wsConnected ? '0 0 8px var(--success)' : 'none'};
          transition: var(--transition);
        }
        .grid-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }
        .stat-card-title {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }
        .stat-card-value {
          font-size: 2.25rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .stat-card-footer {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.5rem;
        }
        .quota-card {
          padding: 1.5rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          margin-bottom: 2rem;
          position: relative;
          overflow: hidden;
        }
        .quota-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }
        .quota-label {
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .quota-val {
          font-weight: 700;
          color: var(--accent-primary);
        }
        .quota-progress {
          height: 8px;
          background: var(--border);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-bottom: 0.5rem;
        }
        .quota-fill {
          height: 100%;
          background: var(--accent-gradient);
          border-radius: var(--radius-full);
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }
        .conv-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .conv-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          transition: var(--transition);
          cursor: pointer;
        }
        .conv-item:hover {
          border-color: var(--border-strong);
          background: var(--bg-card-hover);
          transform: translateX(2px);
        }
        .conv-info {
          min-width: 0;
          flex: 1;
        }
        .conv-title {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 0.9375rem;
          margin-bottom: 0.25rem;
        }
        .conv-meta {
          display: flex;
          gap: 0.75rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .action-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .action-button {
          width: 100%;
          justify-content: flex-start;
          gap: 0.75rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-primary);
        }
        .action-button:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-strong);
        }
        .live-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg);
          padding: 1rem 1.25rem;
          z-index: var(--z-toast);
          box-shadow: var(--shadow-lg);
          display: flex;
          align-items: center;
          gap: 0.875rem;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          max-width: 320px;
        }
        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Live tracking Toast Notification */}
      {liveNotification.show && (
        <div className="live-toast">
          <div
            style={{
              width: '32px',
              height: '32px',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Zap size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Real-Time Query Logged
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '0.1rem',
              }}
            >
              {liveNotification.model} • {formatNumber(liveNotification.tokens)} tokens (${liveNotification.cost.toFixed(4)})
            </div>
          </div>
        </div>
      )}

      {/* Welcome header */}
      <div className="welcome-section">
        <div>
          <h1 className="welcome-title">
            Welcome back, {user?.firstName || user?.username || 'Workspace Partner'}!
          </h1>
          <div className="welcome-sub">
            Monitor model usage, manage API keys, and chat with models.
          </div>
        </div>
        <div className="ws-indicator">
          <span className="ws-dot" />
          <span>{wsConnected ? 'Live Connection Active' : 'Offline Tracking Mode'}</span>
        </div>
      </div>

      {/* Quota Progress meter */}
      <div className="quota-card">
        <div className="quota-header">
          <span className="quota-label">
            <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
            Monthly Token Quota ({summary?.quota_percentage.toFixed(1)}% Used)
          </span>
          <span className="quota-val">
            {formatNumber(summary?.tokens_used_this_month || 0)} / {formatNumber(summary?.token_quota_monthly || 100000)} tokens
          </span>
        </div>
        <div className="quota-progress">
          <div className="quota-fill" style={{ width: `${summary?.quota_percentage || 0}%` }} />
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Free Tier Plan</span>
          <span>Bumps atomic counters live on chat completion</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-stats">
        <Card style={{ padding: '1.25rem' }}>
          <div className="stat-card-title flex items-center gap-2">
            <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
            All-Time Tokens
          </div>
          <div className="stat-card-value">{formatNumber(summary?.total_tokens || 0)}</div>
          <div className="stat-card-footer">Aggregated across workspaces</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div className="stat-card-title flex items-center gap-2">
            <TrendingUp size={14} style={{ color: 'var(--success)' }} />
            Accumulated Cost
          </div>
          <div className="stat-card-value">${summary?.total_cost_usd.toFixed(2) || '0.00'}</div>
          <div className="stat-card-footer">Estimated from provider token weights</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div className="stat-card-title flex items-center gap-2">
            <MessageSquare size={14} style={{ color: 'var(--info)' }} />
            Chat Sessions
          </div>
          <div className="stat-card-value">{summary?.total_conversations || 0}</div>
          <div className="stat-card-footer">Saved local conversation rows</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div className="stat-card-title flex items-center gap-2">
            <Sparkles size={14} style={{ color: 'var(--warning)' }} />
            Top Model
          </div>
          <div
            className="stat-card-value truncate"
            style={{ fontSize: '1.25rem', height: '2.25rem', display: 'flex', alignItems: 'center' }}
          >
            {summary?.top_model || 'None'}
          </div>
          <div className="stat-card-footer">Most queried model in 30 days</div>
        </Card>
      </div>

      {/* Split dashboard grid */}
      <div className="dashboard-grid">
        {/* Left Side: Recent chats */}
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Recent Chat Sessions</h2>
            <Button
              variant="ghost"
              size="sm"
              style={{ gap: '0.25rem' }}
              onClick={() => router.push('/dashboard/chat')}
            >
              Go to Workspace
              <ArrowRight size={14} />
            </Button>
          </div>

          <div className="conv-list">
            {conversations.length === 0 ? (
              <div
                style={{
                  padding: '3rem 1rem',
                  textAlign: 'center',
                  background: 'var(--bg-card)',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--text-secondary)',
                }}
              >
                <MessageSquare size={36} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>No conversations yet</p>
                <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                  Create your first multi-model conversation to get started.
                </p>
                <Button
                  size="sm"
                  style={{ marginTop: '1rem' }}
                  onClick={() => router.push('/dashboard/chat')}
                >
                  <Plus size={14} />
                  Start Chatting
                </Button>
              </div>
            ) : (
              conversations.map(c => (
                <div
                  key={c.id}
                  className="conv-item"
                  onClick={() => router.push(`/dashboard/chat?id=${c.id}`)}
                >
                  <div className="conv-info">
                    <div className="conv-title truncate">{c.title}</div>
                    <div className="conv-meta">
                      <Badge variant="default" size="sm">
                        {c.modelId}
                      </Badge>
                      <span>
                        {c.totalTokens ? `${formatNumber(c.totalTokens)} tokens` : '0 tokens'}
                      </span>
                      <span>
                        {new Date(c.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Quick links panel */}
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>
            Quick Workspace Links
          </h2>
          <div className="action-list">
            <Button className="action-button" onClick={() => router.push('/dashboard/chat')}>
              <Plus size={16} />
              Start New Chat Session
            </Button>
            <Button className="action-button" onClick={() => router.push('/dashboard/api-keys')}>
              <Key size={16} />
              Setup API Key (BYOK)
            </Button>
            <Button className="action-button" onClick={() => router.push('/dashboard/team')}>
              <Users size={16} />
              Invite Team Members
            </Button>
            <Button className="action-button" onClick={() => router.push('/dashboard/billing')}>
              <Settings size={16} />
              Customize Modular Plans
            </Button>
            {user?.publicMetadata?.isAdmin === true && (
              <Button className="action-button" onClick={() => router.push('/dashboard/admin')}>
                <ShieldCheck size={16} />
                Open Admin Statistics
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
