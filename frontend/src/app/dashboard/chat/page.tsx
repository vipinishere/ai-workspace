'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { useChat } from '@/lib/hooks/useChat'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { api } from '@/lib/api'
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  AlertTriangle,
  BrainCircuit,
  Key,
  Info,
  Settings,
  X,
  History,
  Terminal,
} from 'lucide-react'
import { ModelSelector } from '@/components/chat/ModelSelector'
import { MessageItem } from '@/components/chat/MessageItem'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Conversation, ApiResponse, ApiKey } from '@/lib/types'
import { formatCost, formatNumber } from '@/lib/utils'

export default function ChatPage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeParamId = searchParams.get('id')

  const { subscription, models, hasModelAccess } = useSubscription()
  const [selectedModelId, setSelectedModelId] = useState('gpt-4o-mini')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [inputMessage, setInputMessage] = useState('')

  // Conversations history list
  const [historyList, setHistoryList] = useState<Conversation[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // API keys to check BYOK alerts
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [hasLoadedKeys, setHasLoadedKeys] = useState(false)

  // useChat hook
  const {
    messages,
    isStreaming,
    currentTokens,
    totalTokens,
    conversationId,
    sendMessage,
    clearMessages,
    setMessages,
    error: chatError,
  } = useChat({
    conversationId: activeParamId || undefined,
    modelId: selectedModelId,
    systemPrompt: systemPrompt || undefined,
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming])

  // Update model ID if active param ID changes and loads model
  useEffect(() => {
    if (activeParamId) {
      loadConversationDetails(activeParamId)
    } else {
      clearMessages()
      // Default model
      setSelectedModelId('gpt-4o-mini')
      setSystemPrompt('')
    }
  }, [activeParamId])

  // If conversation ID becomes set inside useChat (e.g. from starting a new chat)
  // and we don't have activeParamId in URL, redirect URL
  useEffect(() => {
    if (conversationId && conversationId !== activeParamId) {
      router.push(`/dashboard/chat?id=${conversationId}`)
      loadHistory()
    }
  }, [conversationId, activeParamId, router])

  // Load chat history & api keys
  const loadHistory = async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.getConversations(token, 1, 30)
      if (res?.items) {
        setHistoryList(res.items)
      }
    } catch (e) {
      console.error('Failed to load conversations', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadApiKeys = async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.getApiKeys(token)
      if (res?.data) {
        setApiKeys(res.data)
      }
    } catch (e) {
      console.error('Failed to load API keys', e)
    } finally {
      setHasLoadedKeys(true)
    }
  }

  useEffect(() => {
    loadHistory()
    loadApiKeys()
  }, [getToken])

  const loadConversationDetails = async (id: string) => {
    try {
      const token = await getToken()
      if (!token) return
      
      const convRes = await api.getConversation(id, token)
      if (convRes?.data) {
        setSelectedModelId(convRes.data.modelId)
        setSystemPrompt(convRes.data.systemPrompt || '')
      }

      const msgRes = await api.getMessages(id, token)
      if (msgRes?.data) {
        setMessages(msgRes.data)
      }
    } catch (e) {
      console.error('Failed to load conversation details', e)
    }
  }

  const handleStartNewChat = () => {
    router.push('/dashboard/chat')
    clearMessages()
    setSelectedModelId('gpt-4o-mini')
    setSystemPrompt('')
  }

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this chat session?')) return

    try {
      const token = await getToken()
      if (!token) return
      await api.deleteConversation(id, token)
      
      // Update UI state
      setHistoryList(prev => prev.filter(c => c.id !== id))
      if (activeParamId === id) {
        handleStartNewChat()
      }
    } catch (err) {
      console.error('Failed to delete chat', err)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || isStreaming) return

    const messageContent = inputMessage
    setInputMessage('')
    await sendMessage(messageContent, selectedModelId)
    // Reload history to capture new conversation title / state
    loadHistory()
  }

  // Determine if active model provider requires BYOK key but has none configured
  const getBYOKAlertMessage = () => {
    if (!selectedModelId) return null
    const model = models.find(m => m.id === selectedModelId)
    if (!model) return null
    
    const provider = model.provider
    // Free models don't require keys
    if (subscription?.plan === 'free') {
      if (!['gpt-4o-mini', 'gemini-1.5-flash'].includes(selectedModelId)) {
        return `Your Free tier is limited to lightweight models. Please upgrade your subscription plan or add a valid ${provider.toUpperCase()} API key in settings.`
      }
    }

    const hasKey = apiKeys.some(k => k.provider === provider && k.isActive)
    
    // If user is pro/team/enterprise, the server provides base routing keys automatically, 
    // but they can override using BYOK. If they are in BYOK mode, this is a notice.
    if (!hasKey) {
      // Explain that it is running on platform keys but can configure BYOK to bypass platform quotas
      return `Running via Platform Shared Route. You can bind your own ${provider.toUpperCase()} API Key in the API Keys panel to bypass limits.`
    }
    
    return null
  }

  const alertMsg = getBYOKAlertMessage()
  const activeModel = models.find(m => m.id === selectedModelId)

  return (
    <>
      <style>{`
        .chat-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          height: calc(100vh - var(--topbar-height) - 4rem);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          background: var(--bg-secondary);
        }
        .chat-sidebar {
          border-right: 1px solid var(--border);
          background: var(--bg-sidebar);
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .sidebar-header {
          padding: 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .sidebar-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem;
        }
        .history-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 0.875rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
          margin-bottom: 0.375rem;
          color: var(--text-secondary);
          position: relative;
          group: true;
        }
        .history-item:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }
        .history-item.active {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-left: 3px solid var(--accent-primary);
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
        .history-trash {
          opacity: 0;
          color: var(--text-muted);
          transition: var(--transition);
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem;
          border-radius: var(--radius-xs);
        }
        .history-item:hover .history-trash {
          opacity: 1;
        }
        .history-trash:hover {
          color: var(--error);
          background: var(--error-bg);
        }
        .chat-workspace {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-secondary);
        }
        .chat-workspace-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-secondary);
          z-index: 10;
        }
        .chat-messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .chat-messages-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          padding: 2rem;
        }
        .chat-input-area {
          padding: 1.5rem 2rem;
          border-top: 1px solid var(--border);
          background: var(--bg-secondary);
        }
        .chat-input-container {
          position: relative;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          transition: var(--transition);
          display: flex;
          flex-direction: column;
          padding: 0.5rem;
        }
        .chat-input-container:focus-within {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        .chat-textarea {
          resize: none;
          background: transparent;
          border: none;
          width: 100%;
          outline: none;
          padding: 0.5rem 0.75rem;
          color: var(--text-primary);
          font-family: inherit;
          font-size: 0.9375rem;
          line-height: 1.5;
          min-height: 48px;
          max-height: 160px;
        }
        .chat-input-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.25rem 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.02);
          margin-top: 0.25rem;
        }
        .config-overlay {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border);
          background: var(--bg-sidebar);
          animation: fadeIn 0.2s ease forwards;
        }
        .alert-banner {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.75rem 1.25rem;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
          font-size: 0.8125rem;
          color: var(--text-secondary);
        }
        @media (max-width: 900px) {
          .chat-layout {
            grid-template-columns: 1fr;
          }
          .chat-sidebar {
            display: none;
          }
        }
      `}</style>

      <div className="chat-layout animate-fadeIn">
        {/* Left Side: Historical Conversations */}
        <div className="chat-sidebar">
          <div className="sidebar-header">
            <Button
              className="w-full flex items-center justify-center gap-2"
              onClick={handleStartNewChat}
              style={{ background: 'var(--accent-gradient)', border: 'none', color: 'white' }}
            >
              <Plus size={16} />
              New Conversation
            </Button>
          </div>
          <div className="sidebar-scroll scroll-container">
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Loading history...
              </div>
            ) : historyList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No past conversations
              </div>
            ) : (
              historyList.map(item => {
                const isActive = activeParamId === item.id
                return (
                  <div
                    key={item.id}
                    className={`history-item ${isActive ? 'active' : ''}`}
                    onClick={() => router.push(`/dashboard/chat?id=${item.id}`)}
                  >
                    <div className="flex items-center gap-2.5 truncate" style={{ flex: 1, minWidth: 0 }}>
                      <MessageSquare size={15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                      <span className="truncate" style={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 400 }}>
                        {item.title}
                      </span>
                    </div>
                    <button
                      className="history-trash"
                      onClick={e => handleDeleteConversation(item.id, e)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Side: Chat Workspace */}
        <div className="chat-workspace">
          {/* Header Panel */}
          <div className="chat-workspace-header">
            <div className="flex items-center gap-3">
              <ModelSelector
                selectedModelId={selectedModelId}
                onSelect={modelId => setSelectedModelId(modelId)}
              />
              
              {activeModel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }} className="hidden sm:flex">
                  <Badge variant="default" size="sm">
                    {activeModel.contextLength.toLocaleString()} context
                  </Badge>
                  <Badge variant="default" size="sm" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: 'none' }}>
                    {formatCost(activeModel.pricePrompt)} / 1k tokens
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={showConfig ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
                style={{ gap: '0.4rem' }}
              >
                <Settings size={15} />
                <span>System Prompt</span>
              </Button>
            </div>
          </div>

          {/* Config Panel overlay */}
          {showConfig && (
            <div className="config-overlay">
              <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  System Instructions
                </div>
                <button
                  onClick={() => setShowConfig(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="E.g. 'You are a Senior Typescript Engineer. Keep code concise and follow architectural guidelines...'"
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                Overrides default model directives for this session.
              </div>
            </div>
          )}

          {/* BYOK Warning / Platform Route Notice */}
          {alertMsg && (
            <div className="alert-banner">
              <Info size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>{alertMsg}</div>
            </div>
          )}

          {/* Messages Listing */}
          <div className="chat-messages-area scroll-container">
            {messages.length === 0 ? (
              <div className="chat-messages-empty animate-fadeIn">
                <BrainCircuit size={48} style={{ color: 'var(--accent-primary)', opacity: 0.7, marginBottom: '1.25rem' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Ask Workspace Models Anything</h3>
                <p style={{ maxWidth: '420px', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                  Choose a model above, customize prompt instructions, and start typing. 
                  Token tracking calculations broadcast immediately in real-time.
                </p>
                {subscription?.plan === 'free' && (
                  <Card style={{ marginTop: '1.5rem', padding: '1rem', borderStyle: 'dashed', maxWidth: '380px' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <AlertTriangle size={14} />
                      Free Tier Active
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Access is enabled for lightweight model engines. Subscribe to a Pro/Team plan for premium large context models.
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              <>
                {messages.map((message, idx) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isLast={idx === messages.length - 1}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Panel */}
          <div className="chat-input-area">
            {chatError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
                  background: 'var(--error-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--error)',
                  fontSize: '0.8125rem',
                  marginBottom: '0.75rem',
                }}
              >
                <AlertTriangle size={14} />
                <span>{chatError}</span>
              </div>
            )}

            <form onSubmit={handleSend}>
              <div className="chat-input-container">
                <textarea
                  className="chat-textarea"
                  placeholder={`Message ${activeModel ? activeModel.name : 'model'}...`}
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend(e)
                    }
                  }}
                  disabled={isStreaming}
                />
                <div className="chat-input-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isStreaming && (
                      <div className="flex items-center gap-1.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Terminal size={12} className="animate-pulse" />
                        <span>Streaming Completion...</span>
                      </div>
                    )}
                    {!isStreaming && totalTokens > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Session Usage: {formatNumber(totalTokens)} tokens
                      </span>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    style={{
                      background: 'var(--accent-gradient)',
                      border: 'none',
                      color: 'white',
                      height: '32px',
                      width: '32px',
                      padding: 0,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    disabled={isStreaming || !inputMessage.trim()}
                  >
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
