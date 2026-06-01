import type { ChatRequest, TokenUsage, ApiResponse, PaginatedResponse } from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class APIClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async fetchJSON<T>(
    path: string,
    options?: RequestInit & { token?: string }
  ): Promise<T> {
    const { token, ...fetchOptions } = options || {}

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers as Record<string, string> || {}),
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers,
    })

    if (!res.ok) {
      const errorText = await res.text()
      let errorMessage = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail || errorJson.message || errorText
      } catch {
        // Use raw text
      }
      throw new Error(errorMessage || `HTTP ${res.status}`)
    }

    // Handle empty responses (204 No Content)
    if (res.status === 204) return undefined as T

    return res.json()
  }

  async get<T>(path: string, token: string): Promise<T> {
    return this.fetchJSON<T>(path, { method: 'GET', token })
  }

  async post<T>(path: string, body: unknown, token: string): Promise<T> {
    return this.fetchJSON<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    })
  }

  async put<T>(path: string, body: unknown, token: string): Promise<T> {
    return this.fetchJSON<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
      token,
    })
  }

  async patch<T>(path: string, body: unknown, token: string): Promise<T> {
    return this.fetchJSON<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    })
  }

  async delete<T>(path: string, token: string): Promise<T> {
    return this.fetchJSON<T>(path, { method: 'DELETE', token })
  }

  /**
   * Stream a chat completion via SSE
   * Calls onChunk for each text chunk, onDone when finished
   */
  async streamChat(
    request: ChatRequest,
    token: string,
    onChunk: (chunk: string) => void,
    onDone: (usage: TokenUsage) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()

            if (data === '[DONE]') {
              continue
            }

            try {
              const parsed = JSON.parse(data)

              // Handle different SSE event types
              if (parsed.content && parsed.done === false) {
                onChunk(parsed.content)
              } else if (parsed.done === true) {
                onDone({
                  promptTokens: parsed.prompt_tokens || 0,
                  completionTokens: parsed.completion_tokens || 0,
                  totalTokens: parsed.tokens || 0,
                  cost: parsed.cost_usd || 0,
                  conversationId: parsed.conversation_id,
                })
              } else if (parsed.type === 'chunk' && parsed.content) {
                onChunk(parsed.content)
              } else if (parsed.type === 'done' && parsed.usage) {
                onDone(parsed.usage as TokenUsage)
              } else if (parsed.type === 'error') {
                throw new Error(parsed.message || 'Stream error')
              } else if (parsed.choices?.[0]?.delta?.content) {
                // OpenAI-compatible format
                onChunk(parsed.choices[0].delta.content)
              } else if (parsed.usage && !parsed.choices) {
                // Final usage event
                onDone({
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0,
                  cost: parsed.usage.cost || 0,
                })
              }
            } catch (parseError) {
              // If data is plain text, treat as chunk
              if (data && data !== '[DONE]') {
                onChunk(data)
              }
            }
          }
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown streaming error')
      if (onError) {
        onError(err)
      } else {
        throw err
      }
    }
  }

  // ============================================================
  // USER & AUTH
  // ============================================================

  async getCurrentUser(token: string) {
    return this.get<ApiResponse<import('@/lib/types').User>>('/api/v1/users/me', token)
  }

  async updateUser(body: Partial<import('@/lib/types').User>, token: string) {
    return this.patch<ApiResponse<import('@/lib/types').User>>('/api/v1/users/me', body, token)
  }

  // ============================================================
  // CONVERSATIONS
  // ============================================================

  async getConversations(token: string, page = 1, pageSize = 20) {
    return this.get<PaginatedResponse<import('@/lib/types').Conversation>>(
      `/api/v1/conversations?page=${page}&page_size=${pageSize}`,
      token
    )
  }

  async getConversation(id: string, token: string) {
    return this.get<ApiResponse<import('@/lib/types').Conversation>>(
      `/api/v1/conversations/${id}`,
      token
    )
  }

  async createConversation(
    body: { title?: string; modelId: string; systemPrompt?: string },
    token: string
  ) {
    return this.post<ApiResponse<import('@/lib/types').Conversation>>(
      '/api/v1/conversations',
      body,
      token
    )
  }

  async updateConversation(
    id: string,
    body: Partial<import('@/lib/types').Conversation>,
    token: string
  ) {
    return this.patch<ApiResponse<import('@/lib/types').Conversation>>(
      `/api/v1/conversations/${id}`,
      body,
      token
    )
  }

  async deleteConversation(id: string, token: string) {
    return this.delete<ApiResponse<void>>(`/api/v1/conversations/${id}`, token)
  }

  // ============================================================
  // MESSAGES
  // ============================================================

  async getMessages(conversationId: string, token: string) {
    return this.get<ApiResponse<import('@/lib/types').Message[]>>(
      `/api/v1/conversations/${conversationId}/messages`,
      token
    )
  }

  // ============================================================
  // ANALYTICS
  // ============================================================

  async getUsageStats(token: string, dateRange: string = '30d') {
    return this.get<ApiResponse<import('@/lib/types').UsageStats>>(
      `/api/v1/analytics/usage?range=${dateRange}`,
      token
    )
  }

  async getUsageLogs(token: string, page = 1, pageSize = 50) {
    return this.get<PaginatedResponse<import('@/lib/types').UsageLog>>(
      `/api/v1/analytics/logs?page=${page}&page_size=${pageSize}`,
      token
    )
  }

  // ============================================================
  // API KEYS
  // ============================================================

  async getApiKeys(token: string) {
    return this.get<ApiResponse<import('@/lib/types').ApiKey[]>>('/api/v1/api-keys', token)
  }

  async createApiKey(
    body: { name: string; provider: string; key: string },
    token: string
  ) {
    return this.post<ApiResponse<import('@/lib/types').ApiKey>>('/api/v1/api-keys', body, token)
  }

  async testApiKey(id: string, token: string) {
    return this.post<ApiResponse<{ isValid: boolean; message: string }>>(
      `/api/v1/api-keys/${id}/test`,
      {},
      token
    )
  }

  async deleteApiKey(id: string, token: string) {
    return this.delete<ApiResponse<void>>(`/api/v1/api-keys/${id}`, token)
  }

  // ============================================================
  // SUBSCRIPTION & BILLING
  // ============================================================

  async getSubscription(token: string) {
    return this.get<ApiResponse<import('@/lib/types').Subscription>>(
      '/api/v1/billing/subscription',
      token
    )
  }

  async updateSelectedModels(modelIds: string[], token: string) {
    return this.patch<ApiResponse<import('@/lib/types').Subscription>>(
      '/api/v1/billing/subscription/models',
      { selectedModels: modelIds },
      token
    )
  }

  async getInvoices(token: string) {
    return this.get<ApiResponse<import('@/lib/types').Invoice[]>>(
      '/api/v1/billing/invoices',
      token
    )
  }

  async createBillingPortalSession(token: string) {
    return this.post<ApiResponse<{ url: string }>>(
      '/api/v1/billing/portal',
      {},
      token
    )
  }

  // ============================================================
  // TEAM
  // ============================================================

  async getTeamMembers(token: string) {
    return this.get<ApiResponse<import('@/lib/types').TeamMember[]>>(
      '/api/v1/team/members',
      token
    )
  }

  async inviteTeamMember(
    body: { email: string; role: string },
    token: string
  ) {
    return this.post<ApiResponse<import('@/lib/types').TeamInvite>>(
      '/api/v1/team/invites',
      body,
      token
    )
  }

  async removeTeamMember(userId: string, token: string) {
    return this.delete<ApiResponse<void>>(`/api/v1/team/members/${userId}`, token)
  }

  async updateTeamMemberRole(userId: string, role: string, token: string) {
    return this.patch<ApiResponse<import('@/lib/types').TeamMember>>(
      `/api/v1/team/members/${userId}/role`,
      { role },
      token
    )
  }

  // ============================================================
  // MARKETPLACE
  // ============================================================

  async getAgents(token: string, category?: string) {
    const query = category ? `?category=${category}` : ''
    return this.get<ApiResponse<import('@/lib/types').AIAgent[]>>(
      `/api/v1/agents${query}`,
      token
    )
  }

  async createAgent(body: Partial<import('@/lib/types').AIAgent>, token: string) {
    return this.post<ApiResponse<import('@/lib/types').AIAgent>>(
      '/api/v1/agents',
      body,
      token
    )
  }

  async updateAgent(id: string, body: Partial<import('@/lib/types').AIAgent>, token: string) {
    return this.patch<ApiResponse<import('@/lib/types').AIAgent>>(
      `/api/v1/agents/${id}`,
      body,
      token
    )
  }

  async deleteAgent(id: string, token: string) {
    return this.delete<ApiResponse<void>>(`/api/v1/agents/${id}`, token)
  }

  // ============================================================
  // MODELS
  // ============================================================

  async getModels(token: string) {
    return this.get<ApiResponse<import('@/lib/types').ModelInfo[]>>(
      '/api/v1/models',
      token
    )
  }

  // ============================================================
  // ADMIN
  // ============================================================

  async getAdminStats(token: string) {
    return this.get<ApiResponse<import('@/lib/types').AdminStats>>(
      '/api/v1/admin/stats',
      token
    )
  }

  async getAdminUsers(token: string, page = 1, search?: string) {
    const query = new URLSearchParams({ page: String(page) })
    if (search) query.set('search', search)
    return this.get<PaginatedResponse<import('@/lib/types').User>>(
      `/api/v1/admin/users?${query}`,
      token
    )
  }

  async getProviderHealth(token: string) {
    return this.get<ApiResponse<import('@/lib/types').ProviderHealth[]>>(
      '/api/v1/admin/provider-health',
      token
    )
  }

  // ============================================================
  // WORKSPACE
  // ============================================================

  async getWorkspace(token: string) {
    return this.get<ApiResponse<import('@/lib/types').Workspace>>(
      '/api/v1/workspace',
      token
    )
  }

  async updateWorkspace(body: Partial<import('@/lib/types').Workspace>, token: string) {
    return this.patch<ApiResponse<import('@/lib/types').Workspace>>(
      '/api/v1/workspace',
      body,
      token
    )
  }
}

export const api = new APIClient(API_BASE)
