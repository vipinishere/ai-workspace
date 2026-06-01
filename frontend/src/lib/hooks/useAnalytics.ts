'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@/lib/api'
import type { UsageStats, DateRange } from '@/lib/types'

interface UseAnalyticsReturn {
  stats: UsageStats | null
  isLoading: boolean
  error: string | null
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  refresh: () => void
}

const DEFAULT_STATS: UsageStats = {
  totalTokens: 0,
  totalCost: 0,
  totalRequests: 0,
  avgCostPer1k: 0,
  byModel: [],
  byDay: [],
  byProvider: [],
}

export function useAnalytics(): UseAnalyticsReturn {
  const { getToken } = useAuth()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const response = await api.getUsageStats(token, dateRange)
      setStats(response.data || DEFAULT_STATS)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics'
      setError(message)
      // Use mock data for demo
      setStats(getMockStats(dateRange))
    } finally {
      setIsLoading(false)
    }
  }, [getToken, dateRange, refreshKey])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  return {
    stats,
    isLoading,
    error,
    dateRange,
    setDateRange,
    refresh,
  }
}

function getMockStats(range: DateRange): UsageStats {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const multiplier = days / 30

  const byDay = Array.from({ length: days }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (days - i - 1))
    const baseTokens = Math.floor(Math.random() * 50000 + 10000)
    const tokens = baseTokens * multiplier
    return {
      date: date.toISOString().split('T')[0],
      tokens: Math.floor(tokens),
      cost: parseFloat((tokens * 0.000002).toFixed(4)),
      requests: Math.floor(Math.random() * 100 + 20),
    }
  })

  const totalTokens = byDay.reduce((sum, d) => sum + d.tokens, 0)
  const totalCost = byDay.reduce((sum, d) => sum + d.cost, 0)
  const totalRequests = byDay.reduce((sum, d) => sum + d.requests, 0)

  return {
    totalTokens,
    totalCost,
    totalRequests,
    avgCostPer1k: totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0,
    byModel: [
      { modelId: 'gpt-4o', modelName: 'GPT-4o', provider: 'openai', tokens: Math.floor(totalTokens * 0.4), cost: totalCost * 0.45, requests: Math.floor(totalRequests * 0.4) },
      { modelId: 'claude-3-5-sonnet', modelName: 'Claude 3.5 Sonnet', provider: 'anthropic', tokens: Math.floor(totalTokens * 0.3), cost: totalCost * 0.35, requests: Math.floor(totalRequests * 0.3) },
      { modelId: 'gemini-1.5-pro', modelName: 'Gemini 1.5 Pro', provider: 'google', tokens: Math.floor(totalTokens * 0.2), cost: totalCost * 0.15, requests: Math.floor(totalRequests * 0.2) },
      { modelId: 'gpt-4o-mini', modelName: 'GPT-4o Mini', provider: 'openai', tokens: Math.floor(totalTokens * 0.1), cost: totalCost * 0.05, requests: Math.floor(totalRequests * 0.1) },
    ],
    byDay,
    byProvider: [
      { provider: 'openai', tokens: Math.floor(totalTokens * 0.5), cost: totalCost * 0.5, percentage: 50 },
      { provider: 'anthropic', tokens: Math.floor(totalTokens * 0.3), cost: totalCost * 0.35, percentage: 30 },
      { provider: 'google', tokens: Math.floor(totalTokens * 0.2), cost: totalCost * 0.15, percentage: 20 },
    ],
  }
}
