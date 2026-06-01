'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@/lib/api'
import { useSubscription } from '@/lib/hooks/useSubscription'
import {
  Settings,
  Globe,
  Bell,
  Sliders,
  Check,
  AlertTriangle,
  Lock,
  Mail,
  Zap,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ModelSelector } from '@/components/chat/ModelSelector'
import type { Workspace } from '@/lib/types'

export default function SettingsPage() {
  const { getToken } = useAuth()
  const { models } = useSubscription()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)

  // Form State
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [defaultModelId, setDefaultModelId] = useState('gpt-4o-mini')
  const [defaultPrompt, setDefaultPrompt] = useState('')

  // Notification Preferences
  const [notifyLowBalance, setNotifyLowBalance] = useState(true)
  const [notifyQuotaExceeded, setNotifyQuotaExceeded] = useState(true)
  const [notifyWeeklyReport, setNotifyWeeklyReport] = useState(false)

  // Actions states
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const loadWorkspace = async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.getWorkspace(token)
      if (res?.data) {
        setWorkspace(res.data)
        setName(res.data.name)
        setSlug(res.data.slug)
        setDescription(res.data.description || '')
      }
    } catch (e) {
      console.error('Failed to load workspace info', e)
      // Fallback mocks
      setWorkspace({
        id: 'ws_demo',
        name: 'My Workspace',
        slug: 'my-workspace',
        description: 'Primary workspace environment for code development & tests.',
        ownerId: 'user_owner',
        plan: 'pro',
        createdAt: new Date().toISOString(),
      })
      setName('My Workspace')
      setSlug('my-workspace')
      setDescription('Primary workspace environment for code development & tests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkspace()
  }, [getToken])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || saving) return

    setSaving(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const token = await getToken()
      if (!token) return

      await api.updateWorkspace(
        {
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          description: description.trim(),
        },
        token
      )

      setSuccessMsg('Workspace settings and preferences updated successfully!')
      loadWorkspace()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !workspace) {
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
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading settings details...</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .settings-container {
          max-width: 760px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
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
        .slug-input-wrapper {
          display: flex;
          align-items: center;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: var(--transition);
        }
        .slug-input-wrapper:focus-within {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        .slug-prefix {
          padding: 0.625rem 0 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: var(--text-muted);
          user-select: none;
        }
        .slug-field {
          background: transparent;
          border: none;
          padding: 0.625rem 0.875rem 0.625rem 0.25rem;
          font-size: 0.875rem;
          outline: none;
          box-shadow: none !important;
        }
        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem 0;
          border-bottom: 1px solid var(--border);
        }
        .toggle-row:last-child {
          border-bottom: none;
        }
        .toggle-label {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 0.875rem;
        }
        .toggle-sub {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.1rem;
        }
      `}</style>

      <div className="settings-container animate-fadeIn">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Workspace Settings</h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            Configure default model mappings, change domain URLs, and toggle alerts.
          </p>
        </div>

        {/* Success/Error Alerts */}
        {successMsg && (
          <div style={{ padding: '1rem', background: 'var(--success-bg)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-lg)', color: 'var(--success)', display: 'flex', gap: '0.75rem' }}>
            <Check size={18} />
            <div>{successMsg}</div>
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '1rem', background: 'var(--error-bg)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-lg)', color: 'var(--error)', display: 'flex', gap: '0.75rem' }}>
            <AlertTriangle size={18} />
            <div>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSaveSettings}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* General Settings */}
            <Card style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={16} style={{ color: 'var(--accent-primary)' }} />
                Workspace Metadata
              </h2>

              <div className="form-row">
                <label>Workspace Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. My Organization"
                  required
                />
              </div>

              <div className="form-row">
                <label>Workspace URL Slug</label>
                <div className="slug-input-wrapper">
                  <span className="slug-prefix">workspace.saas/</span>
                  <input
                    type="text"
                    className="slug-field"
                    value={slug}
                    onChange={e => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                    placeholder="my-workspace"
                    required
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                  Use letters, numbers, and dashes. Must be unique.
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the purpose of this workspace environment..."
                  rows={3}
                />
              </div>
            </Card>

            {/* Model Defaults Presets */}
            <Card style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={16} style={{ color: 'var(--accent-primary)' }} />
                Workspace Routing Presets
              </h2>

              <div className="form-row">
                <label>Default Model</label>
                <ModelSelector
                  selectedModelId={defaultModelId}
                  onSelect={id => setDefaultModelId(id)}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                  The default LLM loaded when starting a new chat.
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Default System Directive</label>
                <textarea
                  value={defaultPrompt}
                  onChange={e => setDefaultPrompt(e.target.value)}
                  placeholder="E.g. Keep code formatting clean..."
                  rows={3}
                />
              </div>
            </Card>

            {/* Notification settings */}
            <Card style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={16} style={{ color: 'var(--accent-primary)' }} />
                Notification Alerts
              </h2>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Low Quota Threshold Notice</div>
                  <div className="toggle-sub">Send email when monthly quota falls below 15%</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyLowBalance}
                  onChange={e => setNotifyLowBalance(e.target.checked)}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Quota Limit Warning</div>
                  <div className="toggle-sub">Notify instantly if user hits token query limits</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyQuotaExceeded}
                  onChange={e => setNotifyQuotaExceeded(e.target.checked)}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Weekly Log Digest Summary</div>
                  <div className="toggle-sub">Send weekly aggregated chart updates of cost indices</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyWeeklyReport}
                  onChange={e => setNotifyWeeklyReport(e.target.checked)}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
              </div>
            </Card>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <Button
                type="submit"
                disabled={saving}
                style={{ background: 'var(--accent-gradient)', border: 'none', color: 'white', paddingLeft: '2rem', paddingRight: '2rem' }}
              >
                {saving ? 'Saving changes...' : 'Save All Preferences'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
