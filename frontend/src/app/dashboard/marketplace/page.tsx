'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import {
  Search,
  Plus,
  Compass,
  Star,
  Users,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  Code,
  PenTool,
  BarChart2,
  Cpu,
  BookOpen,
  Filter,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ModelSelector } from '@/components/chat/ModelSelector'
import type { AIAgent } from '@/lib/types'

const CATEGORIES = [
  { id: 'all', name: 'All Agents', icon: <Compass size={14} /> },
  { id: 'coding', name: 'Coding', icon: <Code size={14} /> },
  { id: 'writing', name: 'Writing', icon: <PenTool size={14} /> },
  { id: 'analysis', name: 'Analysis', icon: <BarChart2 size={14} /> },
  { id: 'research', name: 'Research', icon: <BookOpen size={14} /> },
  { id: 'creative', name: 'Creative', icon: <Sparkles size={14} /> },
]

export default function MarketplacePage() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [agents, setAgents] = useState<AIAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Wizard modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [category, setCategory] = useState('coding')
  const [iconEmoji, setIconEmoji] = useState('🤖')
  const [modelId, setModelId] = useState('gpt-4o-mini')
  const [isPublic, setIsPublic] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Feedback alerts
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const loadAgents = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      
      const catParam = selectedCategory === 'all' ? undefined : selectedCategory
      const res = await api.getAgents(token, catParam)
      if (res?.data) {
        setAgents(res.data)
      }
    } catch (e) {
      console.error('Failed to load agents', e)
      // Fallback mocks
      setAgents(getMockAgents())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAgents()
  }, [getToken, selectedCategory])

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !description.trim() || !systemPrompt.trim() || submitting) return

    setSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const token = await getToken()
      if (!token) return

      await api.createAgent(
        {
          name: name.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          category: category as any,
          iconEmoji: iconEmoji.trim(),
          modelId,
          isPublic,
          tags: [category, modelId.split('-')[0]],
        },
        token
      )

      setSuccessMsg(`Agent "${name.trim()}" compiled and deployed to marketplace!`)
      setName('')
      setDescription('')
      setSystemPrompt('')
      setIconEmoji('🤖')
      setModalOpen(false)
      loadAgents()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to publish agent')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLaunchAgent = (agent: AIAgent) => {
    // Redirect directly to chat page with preset query string options
    router.push(
      `/dashboard/chat?model=${agent.modelId}&systemPrompt=${encodeURIComponent(
        agent.systemPrompt
      )}&title=${encodeURIComponent(agent.name)}`
    )
  }

  const filteredAgents = agents.filter(
    a =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      <style>{`
        .market-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .filter-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
          margin-bottom: 1.5rem;
        }
        .filter-tab {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.875rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          font-size: 0.8125rem;
          cursor: pointer;
          transition: var(--transition);
          white-space: nowrap;
        }
        .filter-tab:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
        }
        .filter-tab.active {
          background: var(--bg-card-hover);
          border-color: var(--accent-primary);
          color: var(--text-primary);
          box-shadow: var(--accent-glow-sm);
        }
        .search-row {
          position: relative;
          margin-bottom: 2rem;
          max-width: 420px;
        }
        .search-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .agent-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.25rem;
        }
        .agent-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          transition: var(--transition-spring);
        }
        .agent-card:hover {
          border-color: var(--border-strong);
          background: var(--bg-card-hover);
          transform: translateY(-3px);
        }
        .emoji-circle {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          border: 1px solid var(--border);
        }
        .form-grid-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .switch-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-md);
        }
      `}</style>

      {/* Titleblock */}
      <div className="market-header">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Agent Tools Marketplace</h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            Discover and integrate specialized custom prompt-engineered AI assistants.
          </p>
        </div>
        {!modalOpen && (
          <Button onClick={() => setModalOpen(true)} style={{ gap: '0.4rem', background: 'var(--accent-gradient)', border: 'none', color: 'white' }}>
            <Plus size={16} />
            <span>Create Custom Agent</span>
          </Button>
        )}
      </div>

      {successMsg && (
        <div style={{ padding: '1rem', background: 'var(--success-bg)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-lg)', color: 'var(--success)', display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Sparkles size={18} />
          <div>{successMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '1rem', background: 'var(--error-bg)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-lg)', color: 'var(--error)', display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <X size={18} />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="filter-bar scroll-x">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`filter-tab ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.icon}
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Search panel */}
      <div className="search-row">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search agents by name or capability..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ paddingLeft: '2.25rem' }}
        />
      </div>

      {/* Wizard Create Agent Modal */}
      {modalOpen && (
        <Card style={{ padding: '2rem', marginBottom: '2.5rem', maxWidth: '640px', animation: 'fadeInDown 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
              Create Custom Workspace Agent
            </h2>
            <button
              onClick={() => setModalOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleCreateAgent}>
            <div className="form-grid-row">
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Agent Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Python refactor wizard"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Emoji Icon
                </label>
                <input
                  type="text"
                  placeholder="🤖, 🐍, ✍️"
                  value={iconEmoji}
                  onChange={e => setIconEmoji(e.target.value)}
                  maxLength={4}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                Brief Description
              </label>
              <input
                type="text"
                placeholder="E.g. Optimized for formatting complex Python logic blocks..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="form-grid-row">
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                >
                  <option value="coding">Coding</option>
                  <option value="writing">Writing</option>
                  <option value="analysis">Analysis</option>
                  <option value="research">Research</option>
                  <option value="creative">Creative</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Default LLM Model Engine
                </label>
                <ModelSelector
                  selectedModelId={modelId}
                  onSelect={id => setModelId(id)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                System Instructions (System Prompt)
              </label>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="E.g. 'You are an advanced python formatting assistant...'"
                rows={4}
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
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div className="switch-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isPublic ? 'Publicly Visible in Marketplace' : 'Private to Workspace'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button type="submit" disabled={submitting} style={{ background: 'var(--accent-gradient)', border: 'none', color: 'white' }}>
                {submitting ? 'Compiling Agent...' : 'Publish Agent'}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Agents Catalog Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          Loading agents catalog...
        </div>
      ) : filteredAgents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
          No agents found matching search criteria.
        </div>
      ) : (
        <div className="agent-grid">
          {filteredAgents.map(agent => (
            <Card key={agent.id} className="agent-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div className="emoji-circle">{agent.iconEmoji}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--warning)' }}>
                    <Star size={12} fill="currentColor" />
                    <span>{agent.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {agent.name}
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem', minHeight: '36px' }}>
                    {agent.description}
                  </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {agent.tags.map((tag, idx) => (
                    <Badge key={idx} variant="ghost" size="sm" style={{ border: 'none', background: 'var(--bg-tertiary)', textTransform: 'capitalize' }}>
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: '1.25rem', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Users size={12} />
                  <span>{agent.usageCount.toLocaleString()} runs</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  style={{ gap: '0.25rem', padding: '0.25rem 0.5rem', color: 'var(--accent-primary)' }}
                  onClick={() => handleLaunchAgent(agent)}
                >
                  <span>Chat Session</span>
                  <ArrowRight size={12} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

function getMockAgents(): AIAgent[] {
  return [
    {
      id: 'agent-1',
      name: 'Python Bug Squasher',
      description: 'Senior code troubleshooter, analyzes execution stack traces and refactors modules.',
      systemPrompt: 'You are an elite senior software debugger specializing in Python structures. Help squashing all bugs.',
      modelId: 'gpt-4o',
      category: 'coding',
      iconEmoji: '🐍',
      rating: 4.9,
      usageCount: 14500,
      isPublic: true,
      createdBy: 'system',
      tags: ['debugging', 'refactor', 'python'],
      createdAt: '',
    },
    {
      id: 'agent-2',
      name: 'UX Copywriting Wizard',
      description: 'Generates premium marketing text blocks, email sequences, and header slogans.',
      systemPrompt: 'You are a high-conversion UX marketing copywriter. Create premium engaging copy scripts.',
      modelId: 'gpt-4o-mini',
      category: 'writing',
      iconEmoji: '✍️',
      rating: 4.7,
      usageCount: 9320,
      isPublic: true,
      createdBy: 'system',
      tags: ['copywriting', 'marketing', 'seo'],
      createdAt: '',
    },
    {
      id: 'agent-3',
      name: 'Clinical Trial Summarizer',
      description: 'Ingests long academic FDA transcripts and outputs dense bullet-point diagnostics tables.',
      systemPrompt: 'You are a clinical trials summarization assistant. Synthesize academic documents and output structured markdown.',
      modelId: 'claude-3-5-sonnet',
      category: 'research',
      iconEmoji: '🔬',
      rating: 4.95,
      usageCount: 6200,
      isPublic: true,
      createdBy: 'system',
      tags: ['clinical', 'fda', 'summarizer'],
      createdAt: '',
    },
    {
      id: 'agent-4',
      name: 'SQL Query Optimizer',
      description: 'Translates natural query logic to highly optimized indexes and explain statements.',
      systemPrompt: 'You are a database tuning engineer. Optimize input SQL queries and explain index improvements.',
      modelId: 'gemini-1.5-pro',
      category: 'coding',
      iconEmoji: '🗄️',
      rating: 4.8,
      usageCount: 11050,
      isPublic: true,
      createdBy: 'system',
      tags: ['sql', 'postgres', 'tuning'],
      createdAt: '',
    },
  ]
}
