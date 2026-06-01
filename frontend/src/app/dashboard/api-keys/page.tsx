'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@/lib/api'
import {
  Key,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Activity,
  Lock,
  Eye,
  EyeOff,
  Server,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { ApiKey } from '@/lib/types'
import { maskKey, getProviderColor, getProviderName } from '@/lib/utils'

export default function ApiKeysPage() {
  const { getToken } = useAuth()

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)

  // Form State
  const [provider, setProvider] = useState('openai')
  const [name, setName] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [showKeyText, setShowKeyText] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Feedback Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Key-specific loading states (ID -> status string)
  const [testResults, setTestResults] = useState<Record<string, { testing: boolean; isValid?: boolean; message?: string }>>({})

  const loadKeys = async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.getApiKeys(token)
      if (res?.data) {
        setKeys(res.data)
      }
    } catch (e) {
      console.error('Failed to load keys', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeys()
  }, [getToken])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !keyInput.trim() || submitting) return

    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const token = await getToken()
      if (!token) return

      await api.createApiKey(
        {
          name: name.trim(),
          provider,
          key: keyInput.trim(),
        },
        token
      )

      setSuccessMessage(`${getProviderName(provider)} API key saved and encrypted successfully!`)
      setName('')
      setKeyInput('')
      setFormOpen(false)
      loadKeys()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to register API key')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, keyName: string) => {
    if (!confirm(`Are you sure you want to delete "${keyName}" key? Models relying on this provider will fall back to platform routes.`)) return

    try {
      const token = await getToken()
      if (!token) return
      await api.deleteApiKey(id, token)
      setSuccessMessage(`Key "${keyName}" removed.`)
      setKeys(prev => prev.filter(k => k.id !== id))
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  const handleTestKey = async (id: string) => {
    setTestResults(prev => ({
      ...prev,
      [id]: { testing: true },
    }))

    try {
      const token = await getToken()
      if (!token) return
      const res = await api.testApiKey(id, token)

      setTestResults(prev => ({
        ...prev,
        [id]: {
          testing: false,
          isValid: res.data?.isValid ?? false,
          message: res.data?.message || (res.data?.isValid ? 'Connection operational' : 'Verification failed'),
        },
      }))
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [id]: {
          testing: false,
          isValid: false,
          message: err instanceof Error ? err.message : 'Connection request failed',
        },
      }))
    }
  }

  return (
    <>
      <style>{`
        .keys-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
        }
        .keys-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }
        .key-card {
          padding: 1.5rem;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 200px;
        }
        .form-row {
          margin-bottom: 1.25rem;
        }
        .form-row label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form-select, .form-text-input {
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
        }
        .input-with-eye {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-eye-btn {
          position: absolute;
          right: 0.875rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .input-eye-btn:hover {
          color: var(--text-secondary);
        }
        .test-result-box {
          margin-top: 1rem;
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-md);
          font-size: 0.8125rem;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          animation: scaleIn 0.15s ease forwards;
        }
        .test-success {
          background: var(--success-bg);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: var(--success);
        }
        .test-failure {
          background: var(--error-bg);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: var(--error);
        }
      `}</style>

      {/* Header section */}
      <div className="keys-header">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Bring Your Own Key (BYOK)</h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            Securely register your API keys. Keys are AES-256 encrypted at rest.
          </p>
        </div>
        {!formOpen && (
          <Button onClick={() => setFormOpen(true)} style={{ gap: '0.4rem', background: 'var(--accent-gradient)', border: 'none', color: 'white' }}>
            <Plus size={16} />
            <span>Add API Key</span>
          </Button>
        )}
      </div>

      {/* Success/Error Alerts */}
      {successMessage && (
        <div
          style={{
            padding: '1rem',
            background: 'var(--success-bg)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <CheckCircle size={18} />
          <div>{successMessage}</div>
        </div>
      )}

      {errorMessage && (
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
          <AlertTriangle size={18} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* New Key Form */}
      {formOpen && (
        <Card style={{ padding: '2rem', marginBottom: '2rem', maxWidth: '560px', animation: 'fadeInDown 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={16} style={{ color: 'var(--accent-primary)' }} />
              Register Secure API Key
            </h2>
            <button
              onClick={() => setFormOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleCreate}>
            <div className="form-row">
              <label>AI Provider</label>
              <select
                className="form-select"
                value={provider}
                onChange={e => setProvider(e.target.value)}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="google">Google Gemini</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>

            <div className="form-row">
              <label>Key Name / Label</label>
              <input
                type="text"
                className="form-text-input"
                placeholder="e.g. Production Main Key"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <label>API Key Value</label>
              <div className="input-with-eye">
                <input
                  type={showKeyText ? 'text' : 'password'}
                  className="form-text-input"
                  placeholder={`Paste ${getProviderName(provider)} key value`}
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                  required
                />
                <button
                  type="button"
                  className="input-eye-btn"
                  onClick={() => setShowKeyText(!showKeyText)}
                >
                  {showKeyText ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button type="submit" disabled={submitting} style={{ background: 'var(--accent-gradient)', border: 'none', color: 'white' }}>
                {submitting ? 'Encrypting and saving...' : 'Save Encrypted Key'}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Keys List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
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
          Loading encrypted keys...
        </div>
      ) : keys.length === 0 ? (
        <Card style={{ padding: '3rem 1.5rem', textAlign: 'center', borderStyle: 'dashed' }}>
          <Key size={36} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>No custom keys configured</h3>
          <p style={{ maxWidth: '380px', margin: '0.5rem auto 1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            By default, calls will route through our platform's shared API keys. Save your own credentials to bypass usage rates.
          </p>
          <Button onClick={() => setFormOpen(true)} size="sm">
            Configure BYOK Key
          </Button>
        </Card>
      ) : (
        <div className="keys-grid">
          {keys.map(key => {
            const result = testResults[key.id]
            return (
              <Card key={key.id} className="key-card">
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <Badge variant="default" style={{ color: 'white', background: getProviderColor(key.provider), border: 'none' }}>
                      {getProviderName(key.provider)}
                    </Badge>
                    <button
                      onClick={() => handleDelete(key.id, key.name)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                    >
                      <Trash2 size={14} className="hover:text-red-500" style={{ transition: 'color 0.2s' }} />
                    </button>
                  </div>
                  
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {key.name}
                  </h3>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Server size={12} />
                    <span>{maskKey(key.keyPreview)}</span>
                  </div>
                  <div style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Added on: {new Date(key.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div>
                  {/* Test Connection Result Box */}
                  {result && !result.testing && (
                    <div className={`test-result-box ${result.isValid ? 'test-success' : 'test-failure'}`}>
                      {result.isValid ? <ShieldCheck size={14} style={{ marginTop: '2px' }} /> : <AlertTriangle size={14} style={{ marginTop: '2px' }} />}
                      <span>{result.message}</span>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    style={{ marginTop: '0.875rem', gap: '0.375rem', fontSize: '0.8125rem' }}
                    onClick={() => handleTestKey(key.id)}
                    disabled={result?.testing}
                  >
                    <Activity size={12} className={result?.testing ? 'animate-pulse' : ''} />
                    <span>{result?.testing ? 'Checking connection...' : 'Test Connection'}</span>
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
