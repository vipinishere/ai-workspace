import { SignUp } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up',
}

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'absolute',
        width: '700px',
        height: '700px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
        top: '-250px',
        right: '-200px',
        animation: 'blobFloat 9s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)',
        bottom: '-150px',
        left: '-100px',
        animation: 'blobFloat 11s ease-in-out infinite reverse',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, animation: 'fadeInUp 0.5s ease forwards' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.625rem',
            marginBottom: '0.5rem',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.125rem',
              boxShadow: '0 0 20px rgba(124,58,237,0.4)',
            }}>
              ✦
            </div>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}>
              AI<span style={{
                background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Workspace</span>
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Create your account — free to get started
          </p>
        </div>

        <SignUp
          appearance={{
            variables: {
              colorPrimary: '#7c3aed',
              colorBackground: '#111118',
              colorInputBackground: 'rgba(255,255,255,0.04)',
              colorInputText: '#f0f0f5',
              colorText: '#f0f0f5',
              colorTextSecondary: '#8888a0',
              colorNeutral: '#8888a0',
              borderRadius: '10px',
              fontFamily: 'Inter, sans-serif',
            },
            elements: {
              card: {
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                borderRadius: '16px',
              },
              formButtonPrimary: {
                background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                border: 'none',
              },
            },
          }}
        />
      </div>
    </div>
  )
}
