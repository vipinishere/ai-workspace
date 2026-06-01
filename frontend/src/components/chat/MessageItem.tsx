'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, User, Sparkles } from 'lucide-react'
import { formatDate, formatCost, copyToClipboard } from '@/lib/utils'
import type { Message } from '@/lib/types'

interface MessageItemProps {
  message: Message
  isLast?: boolean
}

function CodeBlock({
  language,
  code,
}: {
  language: string
  code: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(code)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ position: 'relative', margin: '0.75rem 0', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0.75rem',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontSize: '0.75rem', color: '#8888a0', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.2rem 0.5rem',
            fontSize: '0.75rem',
            color: copied ? '#10b981' : '#8888a0',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'color 0.2s ease',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          background: 'rgba(0,0,0,0.4)',
          padding: '1rem 1.25rem',
          fontSize: '0.8125rem',
          lineHeight: '1.6',
          borderRadius: 0,
        }}
        showLineNumbers={code.split('\n').length > 5}
        lineNumberStyle={{ color: '#555566', minWidth: '2rem', paddingRight: '1rem', userSelect: 'none' }}
        PreTag="div"
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  )
}

function StreamingCursor() {
  return (
    <span style={{
      display: 'inline-block',
      width: '2px',
      height: '1.1em',
      background: 'var(--accent-primary)',
      verticalAlign: 'text-bottom',
      marginLeft: '2px',
      animation: 'cursorBlink 1s ease-in-out infinite',
      borderRadius: '1px',
    }} />
  )
}

function MessageItem({ message, isLast }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const [copied, setCopied] = useState(false)

  const handleCopyMessage = async () => {
    const success = await copyToClipboard(message.content)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (message.role === 'system') return null

  return (
    <>
      <style>{`
        .message-item {
          display: flex;
          gap: 0.875rem;
          padding: 0.5rem 0;
          animation: fadeInUp 0.3s ease forwards;
        }
        .message-user {
          flex-direction: row-reverse;
        }
        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .message-avatar-user {
          background: var(--accent-gradient);
          color: white;
        }
        .message-avatar-assistant {
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          color: var(--accent-primary);
        }
        .message-content-wrapper {
          flex: 1;
          max-width: 80%;
        }
        .message-user .message-content-wrapper {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .message-bubble {
          padding: 0.75rem 1rem;
          border-radius: var(--radius-lg);
          line-height: 1.65;
          font-size: 0.9375rem;
          position: relative;
          word-break: break-word;
        }
        .message-bubble-user {
          background: linear-gradient(135deg, #7c3aed, #5b21b6);
          color: white;
          border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg);
          box-shadow: 0 2px 16px rgba(124, 58, 237, 0.3);
        }
        .message-bubble-assistant {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg);
          color: var(--text-primary);
          backdrop-filter: blur(10px);
        }
        .message-bubble-assistant.streaming {
          border-color: rgba(124, 58, 237, 0.2);
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.05);
        }
        .message-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.375rem;
          padding: 0 0.25rem;
          flex-wrap: wrap;
        }
        .message-user .message-meta {
          justify-content: flex-end;
        }
        .message-timestamp {
          font-size: 0.71875rem;
          color: var(--text-muted);
        }
        .message-tokens {
          font-size: 0.71875rem;
          color: var(--text-muted);
          background: var(--bg-tertiary);
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-full);
        }
        .message-copy-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.71875rem;
          color: var(--text-muted);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.1rem 0.35rem;
          border-radius: var(--radius-sm);
          opacity: 0;
          transition: var(--transition);
        }
        .message-item:hover .message-copy-btn {
          opacity: 1;
        }
        .message-copy-btn:hover {
          color: var(--text-secondary);
          background: var(--bg-card);
        }
        .streaming-indicator {
          display: inline-flex;
          gap: 4px;
          align-items: center;
          padding: 4px 0;
        }
        .streaming-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-primary);
          animation: streamingDot 1.4s ease-in-out infinite;
        }
        .streaming-dot:nth-child(2) { animation-delay: 0.2s; }
        .streaming-dot:nth-child(3) { animation-delay: 0.4s; }
        @media (max-width: 768px) {
          .message-content-wrapper {
            max-width: 90%;
          }
        }
      `}</style>
      <div className={`message-item ${isUser ? 'message-user' : ''}`}>
        <div className={`message-avatar ${isUser ? 'message-avatar-user' : 'message-avatar-assistant'}`}>
          {isUser ? <User size={16} /> : <Sparkles size={16} />}
        </div>
        <div className="message-content-wrapper">
          <div
            className={`message-bubble ${
              isUser
                ? 'message-bubble-user'
                : `message-bubble-assistant${message.isStreaming ? ' streaming' : ''}`
            }`}
          >
            {isUser ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
            ) : message.isStreaming && !message.content ? (
              <div className="streaming-indicator">
                <div className="streaming-dot" />
                <div className="streaming-dot" />
                <div className="streaming-dot" />
              </div>
            ) : (
              <div className="markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const codeString = String(children).replace(/\n$/, '')
                      const isBlock = codeString.includes('\n') || (match && match[1])

                      if (isBlock) {
                        return (
                          <CodeBlock
                            language={match ? match[1] : ''}
                            code={codeString}
                          />
                        )
                      }

                      return (
                        <code
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            padding: '0.1em 0.35em',
                            borderRadius: '4px',
                            fontSize: '0.875em',
                            fontFamily: 'JetBrains Mono, monospace',
                            color: '#7dd3fc',
                          }}
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    },
                    p({ children }) {
                      return <p style={{ marginBottom: '0.5em', color: 'var(--text-primary)', lineHeight: 1.7 }}>{children}</p>
                    },
                    a({ href, children }) {
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                          {children}
                        </a>
                      )
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                {message.isStreaming && <StreamingCursor />}
              </div>
            )}
          </div>
          <div className="message-meta">
            <span className="message-timestamp">
              {formatDate(message.createdAt)}
            </span>
            {isAssistant && message.totalTokens && !message.isStreaming && (
              <span className="message-tokens">
                {message.totalTokens.toLocaleString()} tokens
                {message.cost ? ` · ${formatCost(message.cost)}` : ''}
              </span>
            )}
            {!isUser && message.content && (
              <button className="message-copy-btn" onClick={handleCopyMessage}>
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export { MessageItem }
