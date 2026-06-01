'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useAnalytics } from '@/lib/hooks/useAnalytics'
import { api } from '@/lib/api'
import {
  TrendingUp,
  Zap,
  DollarSign,
  Layers,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { UsageLog, DateRange } from '@/lib/types'
import {
  formatCost,
  formatNumber,
  formatDate,
  getProviderColor,
  getProviderName,
  formatLatency,
  downloadCSV,
} from '@/lib/utils'

// Recharts imports inside dynamic-safe wrappers or standard imports if they are SSR-safe in Next
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'

export default function AnalyticsPage() {
  const { getToken } = useAuth()
  const { stats, isLoading, error, dateRange, setDateRange, refresh } = useAnalytics()

  // Paginated Logs
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const pageSize = 10

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.getUsageLogs(token, page, pageSize)
      if (res?.items) {
        setLogs(res.items)
        setHasMore(res.hasMore)
      }
    } catch (e) {
      console.error('Failed to load logs', e)
      // Fallback mock logs
      setLogs(getMockLogs(page, pageSize))
      setHasMore(page < 3)
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [getToken, page])

  const handleExport = () => {
    if (!stats) return
    const exportData = logs.map(l => ({
      Date: l.date,
      Model: l.modelName,
      Provider: l.provider,
      PromptTokens: l.promptTokens,
      CompletionTokens: l.completionTokens,
      TotalTokens: l.totalTokens,
      CostUSD: l.cost,
      LatencyMs: l.latencyMs,
      Status: l.status,
    }))
    downloadCSV(exportData, `workspace_usage_logs_${dateRange}`)
  }

  if (isLoading && !stats) {
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
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading analytics charts...</p>
      </div>
    )
  }

  const kpis = [
    {
      title: 'Total Cost',
      value: formatCost(stats?.totalCost || 0),
      subtitle: 'Estimated cost',
      icon: <DollarSign size={16} style={{ color: 'var(--success)' }} />,
    },
    {
      title: 'Total Tokens',
      value: formatNumber(stats?.totalTokens || 0),
      subtitle: 'Prompt + Completion',
      icon: <Zap size={16} style={{ color: 'var(--accent-primary)' }} />,
    },
    {
      title: 'Requests Logged',
      value: (stats?.totalRequests || 0).toLocaleString(),
      subtitle: 'Total API requests',
      icon: <TrendingUp size={16} style={{ color: 'var(--info)' }} />,
    },
    {
      title: 'Avg. Cost / 1k Tokens',
      value: formatCost(stats?.avgCostPer1k || 0),
      subtitle: 'Across all models',
      icon: <Layers size={16} style={{ color: 'var(--warning)' }} />,
    },
  ]

  // Formatted date string for Recharts
  const chartData = (stats?.byDay || []).map(day => ({
    ...day,
    formattedDate: new Date(day.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }))

  return (
    <>
      <style>{`
        .header-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .range-picker {
          display: flex;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 2px;
        }
        .range-btn {
          padding: 0.375rem 0.875rem;
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: var(--transition);
        }
        .range-btn.active {
          background: var(--bg-secondary);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }
        .analytics-grid-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }
        .chart-section {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .chart-box {
          height: 320px;
          margin-top: 1rem;
        }
        .breakdown-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.875rem;
          font-size: 0.875rem;
        }
        .breakdown-bar-bg {
          height: 6px;
          background: var(--border);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-top: 0.25rem;
        }
        .breakdown-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
        }
        .logs-table-container {
          width: 100%;
          overflow-x: auto;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          margin-bottom: 1rem;
        }
        .logs-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.875rem;
        }
        .logs-table th, .logs-table td {
          padding: 0.875rem 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .logs-table th {
          background: rgba(255, 255, 255, 0.01);
          color: var(--text-secondary);
          font-weight: 600;
        }
        .logs-table tr:last-child td {
          border-bottom: none;
        }
        .table-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 1rem;
        }
        @media (max-width: 1024px) {
          .chart-section {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Title block */}
      <div className="header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Usage Analytics</h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            Real-time visual token weights and dollar tracking metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="range-picker">
            {(['7d', '30d', '90d'] as DateRange[]).map(r => (
              <button
                key={r}
                className={`range-btn ${dateRange === r ? 'active' : ''}`}
                onClick={() => setDateRange(r)}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" style={{ padding: '0.5rem' }} onClick={refresh}>
            <RefreshCw size={15} />
          </Button>
          <Button size="sm" style={{ gap: '0.4rem' }} onClick={handleExport}>
            <Download size={15} />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'var(--error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--error)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <AlertCircle size={18} />
          <div>
            <strong>Analytics Notice:</strong> {error}. Using developer mock fallback data.
          </div>
        </div>
      )}

      {/* KPI stats box */}
      <div className="analytics-grid-kpis">
        {kpis.map((kpi, idx) => (
          <Card key={idx} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {kpi.title}
              </span>
              {kpi.icon}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {kpi.subtitle}
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="chart-section">
        {/* Daily Area Chart */}
        <Card style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Daily Cost & Usage</h3>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
              <span className="flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
                Tokens
              </span>
              <span className="flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                Cost ($)
              </span>
            </div>
          </div>
          <div className="chart-box">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis
                    dataKey="formattedDate"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-tertiary)',
                      borderColor: 'var(--border-strong)',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    name="Tokens"
                    stroke="var(--accent-primary)"
                    fillOpacity={1}
                    fill="url(#colorTokens)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    name="Cost ($)"
                    stroke="var(--success)"
                    fillOpacity={1}
                    fill="url(#colorCost)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Model distribution */}
        <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Model Distribution</h3>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {(!stats?.byModel || stats.byModel.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data</div>
            ) : (
              stats.byModel.map(model => {
                const percent = stats.totalTokens > 0 ? (model.tokens / stats.totalTokens) * 100 : 0
                return (
                  <div key={model.modelId} style={{ marginBottom: '1rem' }}>
                    <div className="breakdown-row">
                      <div className="truncate" style={{ fontWeight: 500, color: 'var(--text-primary)', marginRight: '0.5rem' }}>
                        {model.modelName}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                        {percent.toFixed(0)}% ({formatNumber(model.tokens)} tkn)
                      </div>
                    </div>
                    <div className="breakdown-bar-bg">
                      <div
                        className="breakdown-bar-fill"
                        style={{
                          width: `${percent}%`,
                          background: getProviderColor(model.provider),
                        }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      {/* Logs Table */}
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Recent Completion Logs</h2>
      
      <div className="logs-table-container">
        {logsLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <div
              className="animate-spin"
              style={{
                width: '24px',
                height: '24px',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--accent-primary)',
                borderRadius: '50%',
                margin: '0 auto 1rem',
              }}
            />
            Loading raw query logs...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
            No records of completions log found.
          </div>
        ) : (
          <table className="logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Model</th>
                <th>Provider</th>
                <th>Cost</th>
                <th>Latency</th>
                <th>Tokens</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                    {new Date(log.date).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{log.modelName}</td>
                  <td>
                    <Badge variant="ghost" style={{ background: 'var(--bg-tertiary)', border: 'none', color: getProviderColor(log.provider) }}>
                      {getProviderName(log.provider)}
                    </Badge>
                  </td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--success)' }}>
                    {formatCost(log.cost)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{formatLatency(log.latencyMs)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '0.8125rem' }}>
                      <strong>{log.totalTokens.toLocaleString()}</strong> total
                    </div>
                    <div style={{ fontSize: '0.6875rem', opacity: 0.6 }}>
                      {log.promptTokens} in / {log.completionTokens} out
                    </div>
                  </td>
                  <td>
                    <Badge variant={log.status === 'success' ? 'success' : 'error'}>
                      {log.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      <div className="table-nav">
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Page {page} of query logs
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            style={{ gap: '0.25rem' }}
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <ChevronLeft size={14} />
            Prev
          </Button>
          <Button
            size="sm"
            variant="ghost"
            style={{ gap: '0.25rem' }}
            disabled={!hasMore}
            onClick={() => setPage(p => p + 1)}
          >
            Next
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </>
  )
}

function getMockLogs(page: number, size: number): UsageLog[] {
  const providers = ['openai', 'anthropic', 'google', 'mistral']
  const models = [
    { name: 'GPT-4o', provider: 'openai', cost: 0.0035 },
    { name: 'Claude 3.5 Sonnet', provider: 'anthropic', cost: 0.0048 },
    { name: 'Gemini 1.5 Pro', provider: 'google', cost: 0.0016 },
    { name: 'GPT-4o Mini', provider: 'openai', cost: 0.0002 },
  ]

  return Array.from({ length: size }, (_, i) => {
    const model = models[Math.floor(Math.random() * models.length)]
    const prompt = Math.floor(Math.random() * 800 + 100)
    const completion = Math.floor(Math.random() * 400 + 50)
    const total = prompt + completion

    return {
      id: `log-${page}-${i}-${Math.random()}`,
      date: new Date(Date.now() - (i + (page - 1) * size) * 30 * 60 * 1000).toISOString(),
      modelId: model.name.toLowerCase().replace(/ /g, '-'),
      modelName: model.name,
      provider: model.provider as import('@/lib/types').AIProvider,
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: total,
      cost: total * model.cost * 0.0001,
      latencyMs: Math.floor(Math.random() * 1200 + 400),
      status: 'success' as const,
      userId: 'mock_user',
    }
  })
}
