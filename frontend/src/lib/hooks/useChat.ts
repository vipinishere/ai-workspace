'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@/lib/api'
import type { Message, TokenUsage } from '@/lib/types'
import { generateId } from '@/lib/utils'

interface UseChatOptions {
  conversationId?: string
  modelId?: string
  systemPrompt?: string
}

interface UseChatReturn {
  messages: Message[]
  isStreaming: boolean
  currentTokens: number
  totalTokens: number
  conversationId: string | null
  sendMessage: (content: string, modelId?: string) => Promise<void>
  clearMessages: () => void
  setMessages: (messages: Message[]) => void
  error: string | null
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTokens, setCurrentTokens] = useState(0)
  const [totalTokens, setTotalTokens] = useState(0)
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId || null
  )
  const [error, setError] = useState<string | null>(null)
  const streamingMessageIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const sendMessage = useCallback(
    async (content: string, modelId?: string) => {
      if (!content.trim() || isStreaming) return

      setError(null)
      const token = await getToken()
      if (!token) {
        setError('Authentication required')
        return
      }

      const activeModelId = modelId || options.modelId || 'gpt-4o'

      // Add user message immediately
      const userMessage: Message = {
        id: generateId(),
        conversationId: conversationId || '',
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      }

      setMessages(prev => [...prev, userMessage])

      // Create placeholder assistant message for streaming
      const assistantMessageId = generateId()
      streamingMessageIdRef.current = assistantMessageId

      const streamingMessage: Message = {
        id: assistantMessageId,
        conversationId: conversationId || '',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      }

      setMessages(prev => [...prev, streamingMessage])
      setIsStreaming(true)
      setCurrentTokens(0)

      try {
        await api.streamChat(
          {
            conversationId: conversationId || undefined,
            modelId: activeModelId,
            message: content.trim(),
            systemPrompt: options.systemPrompt,
          },
          token,
          (chunk: string) => {
            // Update streaming message content
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            )
          },
          (usage: TokenUsage) => {
            // Update final token count and mark as done
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      isStreaming: false,
                      totalTokens: usage.totalTokens,
                      promptTokens: usage.promptTokens,
                      completionTokens: usage.completionTokens,
                      cost: usage.cost,
                    }
                  : msg
              )
            )
            setCurrentTokens(usage.totalTokens)
            setTotalTokens(prev => prev + usage.totalTokens)
            if (usage.conversationId) {
              setConversationId(usage.conversationId)
            }
          },
          (err: Error) => {
            setError(err.message)
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      isStreaming: false,
                      content:
                        msg.content ||
                        'Sorry, an error occurred while generating the response.',
                    }
                  : msg
              )
            )
          }
        )
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  isStreaming: false,
                  content:
                    msg.content ||
                    'Sorry, an error occurred. Please try again.',
                }
              : msg
          )
        )
      } finally {
        setIsStreaming(false)
        streamingMessageIdRef.current = null
      }
    },
    [isStreaming, conversationId, options.modelId, options.systemPrompt, getToken]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setCurrentTokens(0)
    setTotalTokens(0)
    setError(null)
  }, [])

  return {
    messages,
    isStreaming,
    currentTokens,
    totalTokens,
    conversationId,
    sendMessage,
    clearMessages,
    setMessages,
    error,
  }
}
