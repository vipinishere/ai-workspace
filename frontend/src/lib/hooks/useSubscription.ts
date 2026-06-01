'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@/lib/api'
import type { Subscription, ModelInfo } from '@/lib/types'

interface UseSubscriptionReturn {
  subscription: Subscription | null
  models: ModelInfo[]
  isLoading: boolean
  error: string | null
  hasModelAccess: (modelId: string) => boolean
  isFeatureAllowed: (feature: string) => boolean
  tokenQuotaPercent: number
  refresh: () => void
}

const ALL_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Most capable OpenAI model with vision support',
    contextLength: 128000,
    pricePrompt: 0.0025,
    priceCompletion: 0.01,
    isAvailable: true,
    capabilities: ['chat', 'vision', 'code', 'reasoning'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and affordable for simple tasks',
    contextLength: 128000,
    pricePrompt: 0.000150,
    priceCompletion: 0.000600,
    isAvailable: true,
    capabilities: ['chat', 'code'],
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Previous generation GPT-4 with large context',
    contextLength: 128000,
    pricePrompt: 0.01,
    priceCompletion: 0.03,
    isAvailable: true,
    capabilities: ['chat', 'vision', 'code', 'reasoning'],
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Anthropic\'s most intelligent model',
    contextLength: 200000,
    pricePrompt: 0.003,
    priceCompletion: 0.015,
    isAvailable: true,
    capabilities: ['chat', 'code', 'reasoning', 'long-context'],
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fastest Claude model for simple tasks',
    contextLength: 200000,
    pricePrompt: 0.00025,
    priceCompletion: 0.00125,
    isAvailable: true,
    capabilities: ['chat', 'code'],
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    description: 'Google\'s advanced multimodal model',
    contextLength: 1000000,
    pricePrompt: 0.00125,
    priceCompletion: 0.005,
    isAvailable: true,
    capabilities: ['chat', 'vision', 'code', 'long-context'],
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    description: 'Fast and efficient Gemini model',
    contextLength: 1000000,
    pricePrompt: 0.000075,
    priceCompletion: 0.0003,
    isAvailable: true,
    capabilities: ['chat', 'vision', 'code'],
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'mistral',
    description: 'Most capable Mistral model',
    contextLength: 128000,
    pricePrompt: 0.003,
    priceCompletion: 0.009,
    isAvailable: true,
    capabilities: ['chat', 'code', 'reasoning'],
  },
]

const PLAN_FEATURES: Record<string, string[]> = {
  free: ['basic_chat', 'limited_models'],
  pro: ['basic_chat', 'all_models', 'analytics', 'api_keys', 'byok'],
  team: ['basic_chat', 'all_models', 'analytics', 'api_keys', 'byok', 'team', 'admin'],
  enterprise: ['basic_chat', 'all_models', 'analytics', 'api_keys', 'byok', 'team', 'admin', 'sso', 'audit_logs'],
}

export function useSubscription(): UseSubscriptionReturn {
  const { getToken } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const fetchSubscription = async () => {
      setIsLoading(true)
      try {
        const token = await getToken()
        if (!token) throw new Error('Not authenticated')

        const response = await api.getSubscription(token)
        setSubscription(response.data)
      } catch {
        // Use mock data for demo
        setSubscription({
          id: 'sub_demo',
          workspaceId: 'ws_demo',
          plan: 'pro',
          selectedModels: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'gpt-4o-mini'],
          tokenQuota: 10_000_000,
          tokenUsed: 3_247_500,
          billingCycleStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          billingCycleEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscription()
  }, [getToken, refreshKey])

  const hasModelAccess = useCallback(
    (modelId: string): boolean => {
      if (!subscription) return false
      if (subscription.plan === 'free') {
        return ['gpt-4o-mini', 'gemini-1.5-flash'].includes(modelId)
      }
      return subscription.selectedModels.includes(modelId)
    },
    [subscription]
  )

  const isFeatureAllowed = useCallback(
    (feature: string): boolean => {
      if (!subscription) return false
      const features = PLAN_FEATURES[subscription.plan] || PLAN_FEATURES.free
      return features.includes(feature)
    },
    [subscription]
  )

  const tokenQuotaPercent = subscription
    ? Math.min(100, (subscription.tokenUsed / subscription.tokenQuota) * 100)
    : 0

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  return {
    subscription,
    models: ALL_MODELS,
    isLoading,
    error,
    hasModelAccess,
    isFeatureAllowed,
    tokenQuotaPercent,
    refresh,
  }
}

export { ALL_MODELS }
