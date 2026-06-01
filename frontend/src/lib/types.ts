export interface User {
  id: string
  clerkId: string
  email: string
  name: string
  avatarUrl?: string
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  role: 'user' | 'admin'
  workspaceId: string
  createdAt: string
  updatedAt: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  avatarUrl?: string
  ownerId: string
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  createdAt: string
}

export interface Conversation {
  id: string
  title: string
  modelId: string
  systemPrompt?: string
  totalTokens: number
  totalCost: number
  messageCount: number
  userId: string
  workspaceId: string
  createdAt: string
  updatedAt: string
  lastMessage?: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  totalTokens?: number
  promptTokens?: number
  completionTokens?: number
  cost?: number
  modelId?: string
  latencyMs?: number
  createdAt: string
  isStreaming?: boolean
}

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'cohere' | 'mistral'

export interface ModelInfo {
  id: string
  name: string
  provider: AIProvider
  description: string
  contextLength: number
  pricePrompt: number
  priceCompletion: number
  isAvailable: boolean
  capabilities: ('chat' | 'vision' | 'code' | 'reasoning' | 'long-context')[]
  maxOutputTokens?: number
}

export interface ApiKey {
  id: string
  name: string
  provider: AIProvider
  keyPreview: string
  isActive: boolean
  lastUsed?: string
  createdAt: string
  workspaceId: string
}

export interface Subscription {
  id: string
  workspaceId: string
  plan: 'free' | 'pro' | 'team' | 'enterprise'
  selectedModels: string[]
  tokenQuota: number
  tokenUsed: number
  billingCycleStart: string
  billingCycleEnd: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  status: 'active' | 'past_due' | 'canceled' | 'trialing'
}

export interface UsageStats {
  totalTokens: number
  totalCost: number
  totalRequests: number
  avgCostPer1k: number
  byModel: ModelUsage[]
  byDay: DailyUsage[]
  byProvider: ProviderUsage[]
}

export interface ModelUsage {
  modelId: string
  modelName: string
  provider: AIProvider
  tokens: number
  cost: number
  requests: number
}

export interface DailyUsage {
  date: string
  tokens: number
  cost: number
  requests: number
}

export interface ProviderUsage {
  provider: AIProvider
  tokens: number
  cost: number
  percentage: number
}

export interface TeamMember {
  id: string
  userId: string
  workspaceId: string
  email: string
  name: string
  avatarUrl?: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joinedAt: string
  invitedBy?: string
}

export interface TeamInvite {
  id: string
  email: string
  role: 'admin' | 'member' | 'viewer'
  workspaceId: string
  invitedBy: string
  expiresAt: string
  createdAt: string
  status: 'pending' | 'accepted' | 'expired'
}

export interface AIAgent {
  id: string
  name: string
  description: string
  systemPrompt: string
  modelId: string
  category: 'coding' | 'writing' | 'analysis' | 'research' | 'creative' | 'productivity'
  iconEmoji: string
  rating: number
  usageCount: number
  isPublic: boolean
  createdBy: string
  workspaceId?: string
  tags: string[]
  createdAt: string
}

export interface Invoice {
  id: string
  amount: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  description: string
  createdAt: string
  pdfUrl?: string
  hostedUrl?: string
}

export interface BillingEvent {
  id: string
  type: string
  amount?: number
  description: string
  userId: string
  userEmail: string
  createdAt: string
}

export interface ProviderHealth {
  provider: AIProvider
  status: 'operational' | 'degraded' | 'down'
  latencyMs?: number
  lastChecked: string
  message?: string
}

export interface ChatRequest {
  conversationId?: string
  modelId: string
  message: string
  systemPrompt?: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  conversationId?: string
}

export interface DashboardSummary {
  total_conversations: number
  total_messages: number
  total_tokens: number
  total_cost_usd: number
  tokens_used_this_month: number
  token_quota_monthly: number
  quota_percentage: number
  active_models: number
  top_model: string
}

export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface AdminStats {
  totalUsers: number
  totalWorkspaces: number
  mrr: number
  totalTokensToday: number
  activeSubscriptions: number
  newUsersThisMonth: number
  totalRevenue: number
}

export interface UsageLog {
  id: string
  date: string
  modelId: string
  modelName: string
  provider: AIProvider
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  latencyMs: number
  status: 'success' | 'error'
  userId: string
}

export type DateRange = '7d' | '30d' | '90d' | 'custom'

export interface NotificationPreferences {
  emailOnLowBalance: boolean
  emailOnQuotaExceeded: boolean
  emailWeeklyReport: boolean
  emailNewFeatures: boolean
  emailBilling: boolean
}

export interface WorkspaceSettings {
  name: string
  slug: string
  description: string
  defaultModel: string
  defaultSystemPrompt: string
  notifications: NotificationPreferences
}
