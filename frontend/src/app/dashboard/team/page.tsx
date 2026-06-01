'use client'

import React, { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { api } from '@/lib/api'
import {
  Users,
  Plus,
  Trash2,
  Mail,
  Shield,
  Clock,
  UserPlus,
  Check,
  X,
  AlertTriangle,
  UserCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { TeamMember } from '@/lib/types'

export default function TeamPage() {
  const { getToken } = useAuth()
  const { user } = useUser()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)

  // Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadMembers = async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.getTeamMembers(token)
      if (res?.data) {
        setMembers(res.data)
      }
    } catch (e) {
      console.error('Failed to load team members', e)
      // Fallback mocks
      setMembers(getMockMembers())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [getToken])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || inviting) return

    setInviting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const token = await getToken()
      if (!token) return

      await api.inviteTeamMember(
        {
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        },
        token
      )

      setSuccessMessage(`Invite sent to ${inviteEmail.trim()} successfully!`)
      setInviteEmail('')
      setInviteModalOpen(false)
      // Re-trigger history load or append mock pending user for visual check
      loadMembers()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove "${email}" from the team?`)) return

    try {
      const token = await getToken()
      if (!token) return
      await api.removeTeamMember(userId, token)
      setSuccessMessage(`Member "${email}" removed from organization workspace.`)
      setMembers(prev => prev.filter(m => m.userId !== userId))
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove team member')
    }
  }

  const handleUpdateRole = async (userId: string, currentEmail: string, role: string) => {
    try {
      const token = await getToken()
      if (!token) return
      await api.updateTeamMemberRole(userId, role, token)
      setSuccessMessage(`Role updated for ${currentEmail} to ${role.toUpperCase()}.`)
      setMembers(prev =>
        prev.map(m => (m.userId === userId ? { ...m, role: role as any } : m))
      )
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update member role')
    }
  }

  // Get active user role in workspace to check permissions
  const currentUserRecord = members.find(m => m.email === user?.primaryEmailAddress?.emailAddress)
  const isOwnerOrAdmin = currentUserRecord
    ? ['owner', 'admin'].includes(currentUserRecord.role)
    : true // fallback default permissiveness in mock

  return (
    <>
      <style>{`
        .team-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }
        .member-row-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          color: var(--accent-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.8125rem;
          border: 1px solid var(--border);
        }
        .members-table-container {
          width: 100%;
          overflow-x: auto;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .members-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .members-table th, .members-table td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.875rem;
        }
        .members-table th {
          background: rgba(255,255,255,0.01);
          color: var(--text-secondary);
          font-weight: 600;
        }
        .role-badge-owner {
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          border: 1px solid rgba(124, 58, 237, 0.2);
        }
        .role-select {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-md);
          font-size: 0.8125rem;
          outline: none;
          cursor: pointer;
        }
      `}</style>

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
          <UserCheck size={18} />
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

      {/* Title Panel */}
      <div className="team-header">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Organization Workspace</h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            Manage access controls, invites, and seat configurations.
          </p>
        </div>
        {isOwnerOrAdmin && !inviteModalOpen && (
          <Button onClick={() => setInviteModalOpen(true)} style={{ gap: '0.4rem', background: 'var(--accent-gradient)', border: 'none', color: 'white' }}>
            <Plus size={16} />
            <span>Invite Member</span>
          </Button>
        )}
      </div>

      {/* Counters Grid */}
      <div className="stats-grid">
        <Card style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-primary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Active Seats</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{members.filter(m => m.joinedAt).length} / 5 seats</div>
          </div>
        </Card>

        <Card style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-secondary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Pending Invites</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{members.filter(m => !m.joinedAt).length} pending</div>
          </div>
        </Card>
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <Card style={{ padding: '2rem', marginBottom: '2rem', maxWidth: '480px', animation: 'fadeInDown 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={16} style={{ color: 'var(--accent-primary)' }} />
              Invite Teammate
            </h2>
            <button
              onClick={() => setInviteModalOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleInvite}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Teammate Email
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={14} style={{ position: 'absolute', left: '0.875rem', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  style={{ paddingLeft: '2.25rem' }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Workspace Permission Role
              </label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                style={{ padding: '0.625rem 0.875rem', fontSize: '0.875rem' }}
              >
                <option value="admin">Admin (Key editing + invites)</option>
                <option value="member">Member (Can chat with all models)</option>
                <option value="viewer">Viewer (Read-only logs dashboard)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button type="submit" disabled={inviting} style={{ background: 'var(--accent-gradient)', border: 'none', color: 'white' }}>
                {inviting ? 'Sending Invite...' : 'Send Invitation Link'}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Roster Table */}
      <div className="members-table-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
            Loading roster...
          </div>
        ) : (
          <table className="members-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Joined</th>
                {isOwnerOrAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map(member => {
                const initials = (member.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase()
                const isCurrentUser = member.email === user?.primaryEmailAddress?.emailAddress
                const isOwner = member.role === 'owner'

                return (
                  <tr key={member.id}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="member-row-avatar">{initials}</div>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {member.name} {isCurrentUser && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(You)</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{member.email}</td>
                    <td>
                      {isOwner ? (
                        <Badge className="role-badge-owner">Workspace Owner</Badge>
                      ) : isCurrentUser || !isOwnerOrAdmin ? (
                        <Badge variant="default" style={{ textTransform: 'capitalize' }}>
                          {member.role}
                        </Badge>
                      ) : (
                        <select
                          className="role-select"
                          value={member.role}
                          onChange={e => handleUpdateRole(member.userId, member.email, e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : (
                        <Badge variant="ghost" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: 'none' }}>
                          Pending invite
                        </Badge>
                      )}
                    </td>
                    {isOwnerOrAdmin && (
                      <td>
                        {!isOwner && !isCurrentUser && (
                          <button
                            onClick={() => handleRemoveMember(member.userId, member.email)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                          >
                            <Trash2 size={14} className="hover:text-red-500" style={{ transition: 'color 0.2s' }} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function getMockMembers(): TeamMember[] {
  return [
    {
      id: 'memb-1',
      userId: 'user_owner',
      workspaceId: 'ws_demo',
      email: 'owner@company.com',
      name: 'Sarah Connor',
      role: 'owner',
      joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'memb-2',
      userId: 'user_admin',
      workspaceId: 'ws_demo',
      email: 'admin@company.com',
      name: 'John Doe',
      role: 'admin',
      joinedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'memb-3',
      userId: 'user_memb3',
      workspaceId: 'ws_demo',
      email: 'engineer@company.com',
      name: 'Devon Miles',
      role: 'member',
      joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'memb-4',
      userId: 'user_memb4',
      workspaceId: 'ws_demo',
      email: 'marketing@company.com',
      name: 'Bonnie Barstow',
      role: 'viewer',
      joinedAt: '', // pending
    },
  ]
}
