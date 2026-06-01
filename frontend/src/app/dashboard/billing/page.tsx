'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { api } from '@/lib/api'
import {
  CreditCard,
  Check,
  AlertTriangle,
  TrendingUp,
  Cpu,
  Bookmark,
  DollarSign,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Invoice } from '@/lib/types'
import { formatCost, formatNumber } from '@/lib/utils'

export default function BillingPage() {
  const { getToken } = useAuth()
  const { subscription, models, isLoading, refresh } = useSubscription()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)

  // Local model checklist state
  const [selectedModelsState, setSelectedModelsState] = useState<string[]>([])
  const [savingModels, setSavingModels] = useState(false)
  const [stripeLoading, setStripeLoading] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (subscription) {
      setSelectedModelsState(subscription.selectedModels || [])
    }
  }, [subscription])

  const loadInvoices = async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.getInvoices(token)
      if (res?.data) {
        setInvoices(res.data)
      }
    } catch (e) {
      console.error('Failed to load invoices', e)
    } finally {
      setInvoicesLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [getToken])

  const handleModelToggle = (modelId: string) => {
    setSelectedModelsState(prev => {
      if (prev.includes(modelId)) {
        // Must keep at least one model
        if (prev.length === 1) return prev
        return prev.filter(id => id !== modelId)
      }
      return [...prev, modelId]
    })
  }

  const handleSaveModels = async () => {
    setSavingModels(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const token = await getToken()
      if (!token) return
      await api.updateSelectedModels(selectedModelsState, token)
      setSuccessMessage('AI models configurations updated successfully!')
      refresh()
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to update models selection')
    } finally {
      setSavingModels(false)
    }
  }

  const handleUpgradePlan = async (planName: string) => {
    setStripeLoading(planName)
    setErrorMessage(null)
    try {
      const token = await getToken()
      if (!token) return

      const origin = window.location.origin
      const res = await api.post<{ checkout_url: string; session_id?: string }>(
        '/api/v1/billing/checkout',
        {
          plan: planName.toLowerCase(),
          success_url: `${origin}/dashboard/billing?success=true`,
          cancel_url: `${origin}/dashboard/billing?canceled=true`,
        },
        token
      )

      if (res && res.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = res.checkout_url
      } else {
        // If Stripe keys are missing, backend does an instant mock upgrade
        setSuccessMessage(`Subscription upgraded to ${planName.toUpperCase()} in Mock Sandbox mode!`)
        refresh()
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Stripe checkout initialization failed')
    } finally {
      setStripeLoading(null)
    }
  }

  const handlePortalSession = async () => {
    setStripeLoading('portal')
    setErrorMessage(null)
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.createBillingPortalSession(token)
      if (res?.data?.url) {
        window.location.href = res.data.url
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Stripe billing portal initialization failed')
    } finally {
      setStripeLoading(null)
    }
  }

  if (isLoading && !subscription) {
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
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading billing status...</p>
      </div>
    )
  }

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      description: 'Lighter model accessibility for personal coding checks',
      features: ['2 lightweight model engines', '100K token/month quota limit', 'Community workspace support'],
      actionLabel: 'Active Tier',
      actionDisabled: true,
    },
    {
      name: 'Pro',
      price: '$20',
      description: 'Full advanced model sandbox access & custom BYOK limits',
      features: [
        'All premium models (GPT-4o, Claude 3.5)',
        '10M tokens/month base quota',
        'Stripe metered billing options',
        'Secure BYOK key encryption integration',
      ],
      actionLabel: subscription?.plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro',
      actionDisabled: subscription?.plan === 'pro' || subscription?.plan === 'team',
    },
    {
      name: 'Team',
      price: '$50',
      description: 'Collaborative controls for agency development clusters',
      features: [
        'Shared organization workspaces',
        '50M organization tokens quota',
        'Invite links & role access matrices',
        'Consolidated admin platform metrics',
      ],
      actionLabel: subscription?.plan === 'team' ? 'Current Plan' : 'Upgrade to Team',
      actionDisabled: subscription?.plan === 'team',
    },
  ]

  // Calculate pricing sum based on selected models
  const totalModelsPrice = selectedModelsState.reduce((sum, id) => {
    const info = models.find(m => m.id === id)
    if (!info) return sum
    // Sum model cost indices (e.g. flat rate of $2.50 per month per enabled model)
    return sum + 2.50
  }, 0)

  return (
    <>
      <style>{`
        .billing-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }
        .tiers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2.5rem;
        }
        .tier-card {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: var(--transition-spring);
        }
        .tier-card.active {
          border-color: var(--accent-primary);
          box-shadow: var(--accent-glow-sm);
        }
        .model-checklist {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 0.875rem;
          margin-top: 1rem;
        }
        .model-check-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition);
        }
        .model-check-item:hover {
          border-color: var(--border-strong);
          background: var(--bg-card-hover);
        }
        .model-check-item.active {
          border-color: var(--accent-primary);
          background: rgba(124, 58, 237, 0.04);
        }
        .checkbox-custom {
          width: 18px;
          height: 18px;
          border-radius: var(--radius-xs);
          border: 2px solid var(--border-strong);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
          transition: var(--transition);
        }
        .model-check-item.active .checkbox-custom {
          border-color: var(--accent-primary);
          background: var(--accent-primary);
          color: white;
        }
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .invoice-table th, .invoice-table td {
          padding: 0.875rem 1.25rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.875rem;
        }
        .invoice-table th {
          color: var(--text-secondary);
          font-weight: 600;
        }
        @media (max-width: 1024px) {
          .billing-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Success/Error Alerts */}
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
          <Check size={18} />
          <div>{successMessage}</div>
        </div>
      )}

      {/* Overview Billing Section */}
      <div className="billing-grid">
        {/* Current Plan Overview */}
        <Card style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                Subscription Plan
              </span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', textTransform: 'capitalize' }}>
                {subscription?.plan || 'Free'} Tier
              </h2>
            </div>
            <Badge variant="success" size="md" style={{ fontSize: '0.875rem' }}>
              Active Account
            </Badge>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Monthly Quota Usage</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {formatNumber(subscription?.tokenUsed || 0)} / {formatNumber(subscription?.tokenQuota || 100000)} tokens
              </span>
            </div>
            <div style={{ height: '8px', background: 'var(--border)', borderRadius: '9999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div
                style={{
                  height: '100%',
                  background: 'var(--accent-gradient)',
                  width: `${subscription ? Math.min(100, (subscription.tokenUsed / subscription.tokenQuota) * 100) : 0}%`,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Period cycles resets monthly</span>
              <span>
                Resets on:{' '}
                {subscription?.billingCycleEnd
                  ? new Date(subscription.billingCycleEnd).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
          </div>

          {subscription?.plan !== 'free' && (
            <Button
              variant="ghost"
              style={{ gap: '0.5rem' }}
              onClick={handlePortalSession}
              disabled={stripeLoading === 'portal'}
            >
              <CreditCard size={15} />
              <span>{stripeLoading === 'portal' ? 'Opening...' : 'Manage Invoices & Cards (Stripe)'}</span>
            </Button>
          )}
        </Card>

        {/* Billing details info box */}
        <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} style={{ color: 'var(--accent-primary)' }} />
              Metered Economy
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              We charge a base membership plan fee, plus a minor monthly maintenance fee of <strong>$2.50 per enabled model</strong>.
              This allows you to select only the LLMs you actually want to interact with, minimizing cost overhead.
            </p>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1rem', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <span>Base Tier membership:</span>
              <span>{subscription?.plan === 'free' ? '$0.00' : subscription?.plan === 'pro' ? '$20.00' : '$50.00'}/mo</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
              <span>Models maintenance ({selectedModelsState.length}):</span>
              <span>${totalModelsPrice.toFixed(2)}/mo</span>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              <span>Projected total:</span>
              <span>
                ${(totalModelsPrice + (subscription?.plan === 'free' ? 0 : subscription?.plan === 'pro' ? 20 : 50)).toFixed(2)}/mo
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Model checklist selector */}
      <Card style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Selected AI Models</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Check/uncheck models to configure your active chat router capability. Unchecked models are locked.
            </p>
          </div>
          <Button onClick={handleSaveModels} disabled={savingModels} style={{ background: 'var(--accent-gradient)', border: 'none', color: 'white' }}>
            {savingModels ? 'Saving settings...' : 'Save Models Configuration'}
          </Button>
        </div>

        <div className="model-checklist">
          {models.map(m => {
            const isActive = selectedModelsState.includes(m.id)
            const isLockedOnFree = subscription?.plan === 'free' && !['gpt-4o-mini', 'gemini-1.5-flash'].includes(m.id)
            
            return (
              <div
                key={m.id}
                className={`model-check-item ${isActive ? 'active' : ''}`}
                style={{ opacity: isLockedOnFree ? 0.5 : 1, cursor: isLockedOnFree ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                  if (!isLockedOnFree) handleModelToggle(m.id)
                }}
              >
                <div className="checkbox-custom">
                  {isActive && <Check size={12} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    {m.description}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                    <Badge variant="ghost" size="sm" style={{ border: 'none', background: 'var(--bg-tertiary)' }}>
                      ${(2.50).toFixed(2)}/mo
                    </Badge>
                    {isLockedOnFree && (
                      <Badge variant="error" size="sm">
                        Requires Pro
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Subscription plans cards */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>Subscription Upgrade Options</h2>
      <div className="tiers-grid">
        {tiers.map(tier => {
          const isCurrent = (subscription?.plan || 'free') === tier.name.toLowerCase()
          return (
            <Card key={tier.name} className={`tier-card ${isCurrent ? 'active' : ''}`}>
              {isCurrent && (
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  <Sparkles size={14} />
                  Current
                </div>
              )}
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{tier.name}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', margin: '0.75rem 0 1rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{tier.price}</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>/ month</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', minHeight: '40px', marginBottom: '1.5rem' }}>
                {tier.description}
              </p>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem', flex: 1 }}>
                {tier.features.map((feat, idx) => (
                  <li key={idx} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Check size={14} style={{ color: 'var(--success)' }} />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={isCurrent ? 'ghost' : 'primary'}
                className="w-full"
                onClick={() => handleUpgradePlan(tier.name)}
                disabled={tier.actionDisabled || stripeLoading === tier.name}
              >
                {stripeLoading === tier.name ? 'Processing Checkout...' : tier.actionLabel}
              </Button>
            </Card>
          )
        })}
      </div>

      {/* Invoice Statements */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>Invoice History</h2>
      <Card style={{ overflow: 'hidden' }}>
        {invoicesLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading invoices data...
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No invoice statements registered.
          </div>
        ) : (
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Statement Date</th>
                <th>Charge Amount</th>
                <th>Status</th>
                <th>Receipt Details</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{inv.id}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${(inv.amount / 100).toFixed(2)}</td>
                  <td>
                    <Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>
                      {inv.status}
                    </Badge>
                  </td>
                  <td>
                    {inv.pdfUrl || inv.hostedUrl ? (
                      <a
                        href={inv.pdfUrl || inv.hostedUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent-primary)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <span>Download Receipt</span>
                        <ArrowRight size={12} />
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Receipt unavailable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
