import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Workspace — The Unified AI Platform",
};

export default function LandingPage() {
  return (
    <>
      <style>{`
        /* ===== NAV ===== */
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 5%;
          height: 64px;
          background: rgba(10, 10, 15, 0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          text-decoration: none;
        }
        .nav-logo-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #7c3aed, #3b82f6);
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          box-shadow: 0 0 16px rgba(124,58,237,0.4);
        }
        .nav-logo-text {
          font-size: 1.0625rem;
          font-weight: 800;
          color: #f0f0f5;
          letter-spacing: -0.02em;
        }
        .nav-logo-text span {
          background: linear-gradient(135deg, #7c3aed, #3b82f6, #06b6d4);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          list-style: none;
        }
        .nav-links a {
          padding: 0.4rem 0.875rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #8888a0;
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        .nav-links a:hover {
          color: #f0f0f5;
          background: rgba(255,255,255,0.06);
        }
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .btn-ghost-nav {
          padding: 0.4375rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #8888a0;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .btn-ghost-nav:hover { color: #f0f0f5; }
        .btn-nav-primary {
          padding: 0.4375rem 1.125rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #7c3aed, #3b82f6);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 2px 12px rgba(124,58,237,0.35);
          transition: all 0.2s ease;
        }
        .btn-nav-primary:hover {
          box-shadow: 0 4px 20px rgba(124,58,237,0.5);
          transform: translateY(-1px);
        }

        /* ===== HERO ===== */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 120px 5% 80px;
          position: relative;
          overflow: hidden;
        }
        .hero-blob-1 {
          position: absolute;
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%);
          top: -200px;
          left: -300px;
          animation: blobFloat 12s ease-in-out infinite;
          pointer-events: none;
        }
        .hero-blob-2 {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%);
          top: 100px;
          right: -200px;
          animation: blobFloat 10s ease-in-out infinite reverse;
          pointer-events: none;
        }
        .hero-blob-3 {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%);
          bottom: 0;
          left: 30%;
          animation: blobFloat 14s ease-in-out infinite;
          pointer-events: none;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.875rem;
          background: rgba(124,58,237,0.12);
          border: 1px solid rgba(124,58,237,0.25);
          border-radius: 100px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #a78bfa;
          margin-bottom: 1.75rem;
          animation: fadeInUp 0.6s ease forwards;
        }
        .hero-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a78bfa;
          animation: pulseGlow 2s ease-in-out infinite;
        }
        .hero-headline {
          font-size: clamp(2.5rem, 6vw, 5rem);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -0.04em;
          color: #f0f0f5;
          margin-bottom: 1.25rem;
          max-width: 900px;
          animation: fadeInUp 0.6s ease 0.1s both forwards;
        }
        .hero-headline .gradient-word {
          background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 50%, #06b6d4 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          background-size: 200% 200%;
          animation: gradientShift 4s ease infinite;
        }
        .hero-subtitle {
          font-size: clamp(1rem, 2vw, 1.25rem);
          color: #8888a0;
          max-width: 600px;
          line-height: 1.6;
          margin-bottom: 2.5rem;
          animation: fadeInUp 0.6s ease 0.2s both forwards;
        }
        .hero-cta {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 3.5rem;
          flex-wrap: wrap;
          justify-content: center;
          animation: fadeInUp 0.6s ease 0.3s both forwards;
        }
        .btn-hero-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 2rem;
          font-size: 1rem;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #7c3aed, #3b82f6);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 4px 24px rgba(124,58,237,0.4);
          transition: all 0.2s ease;
          letter-spacing: -0.01em;
        }
        .btn-hero-primary:hover {
          box-shadow: 0 8px 40px rgba(124,58,237,0.6);
          transform: translateY(-2px);
        }
        .btn-hero-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          color: #f0f0f5;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          cursor: pointer;
          text-decoration: none;
          backdrop-filter: blur(10px);
          transition: all 0.2s ease;
          letter-spacing: -0.01em;
        }
        .btn-hero-secondary:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
        }
        .hero-stats {
          display: flex;
          align-items: center;
          gap: 2rem;
          animation: fadeInUp 0.6s ease 0.4s both forwards;
          flex-wrap: wrap;
          justify-content: center;
        }
        .hero-stat {
          text-align: center;
        }
        .hero-stat-number {
          font-size: 1.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, #f0f0f5, #8888a0);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.03em;
        }
        .hero-stat-label {
          font-size: 0.8125rem;
          color: #555566;
          margin-top: 0.125rem;
        }
        .hero-divider {
          width: 1px;
          height: 32px;
          background: rgba(255,255,255,0.1);
        }

        /* ===== FLOATING CARDS ===== */
        .hero-floating-cards {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .float-card {
          position: absolute;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 0.75rem 1rem;
          backdrop-filter: blur(20px);
          font-size: 0.8125rem;
          color: #8888a0;
          animation: float 4s ease-in-out infinite;
          white-space: nowrap;
        }
        .float-card-1 { top: 25%; left: 5%; animation-delay: 0s; }
        .float-card-2 { top: 35%; right: 5%; animation-delay: -1.5s; }
        .float-card-3 { bottom: 30%; left: 8%; animation-delay: -2.5s; }
        .float-card-4 { bottom: 25%; right: 7%; animation-delay: -0.8s; }
        .float-card-title { font-weight: 600; color: #f0f0f5; margin-bottom: 0.25rem; font-size: 0.875rem; }
        .float-card-value { color: #a78bfa; font-weight: 700; font-size: 1rem; }

        /* ===== PROVIDERS STRIP ===== */
        .providers-strip {
          padding: 3rem 5%;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.05);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          overflow: hidden;
        }
        .providers-label {
          font-size: 0.8125rem;
          color: #555566;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 1.5rem;
          font-weight: 500;
        }
        .providers-logos {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2.5rem;
          flex-wrap: wrap;
        }
        .provider-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 100px;
          color: #8888a0;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .provider-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        /* ===== FEATURES ===== */
        .features {
          padding: 100px 5%;
          max-width: 1280px;
          margin: 0 auto;
        }
        .section-header {
          text-align: center;
          margin-bottom: 4rem;
        }
        .section-eyebrow {
          display: inline-block;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #a78bfa;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 1rem;
        }
        .section-title {
          font-size: clamp(1.75rem, 4vw, 3rem);
          font-weight: 800;
          color: #f0f0f5;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: 1rem;
        }
        .section-subtitle {
          font-size: 1.0625rem;
          color: #8888a0;
          max-width: 520px;
          margin: 0 auto;
          line-height: 1.6;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        .feature-card {
          padding: 2rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(124,58,237,0.05), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .feature-card:hover {
          border-color: rgba(124,58,237,0.2);
          transform: translateY(-4px);
          box-shadow: 0 12px 48px rgba(0,0,0,0.4);
        }
        .feature-card:hover::before { opacity: 1; }
        .feature-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          margin-bottom: 1.25rem;
          position: relative;
        }
        .feature-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: #f0f0f5;
          margin-bottom: 0.625rem;
          letter-spacing: -0.01em;
        }
        .feature-desc {
          font-size: 0.9375rem;
          color: #8888a0;
          line-height: 1.6;
        }
        .feature-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          margin-top: 1rem;
          padding: 0.2rem 0.6rem;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: 100px;
        }

        /* ===== PRICING ===== */
        .pricing {
          padding: 100px 5%;
          background: linear-gradient(180deg, transparent, rgba(124,58,237,0.03), transparent);
        }
        .pricing-inner {
          max-width: 1200px;
          margin: 0 auto;
        }
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 3.5rem;
          align-items: start;
        }
        .pricing-card {
          padding: 2rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          position: relative;
          transition: all 0.3s ease;
        }
        .pricing-card:hover {
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-4px);
          box-shadow: 0 12px 48px rgba(0,0,0,0.4);
        }
        .pricing-card.popular {
          border-color: rgba(124,58,237,0.4);
          background: rgba(124,58,237,0.06);
        }
        .pricing-popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 0.2rem 0.875rem;
          background: linear-gradient(135deg, #7c3aed, #3b82f6);
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          border-radius: 100px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .pricing-plan {
          font-size: 0.875rem;
          font-weight: 600;
          color: #8888a0;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.75rem;
        }
        .pricing-price {
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
          margin-bottom: 0.5rem;
        }
        .pricing-currency {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f0f0f5;
        }
        .pricing-amount {
          font-size: 3.5rem;
          font-weight: 900;
          color: #f0f0f5;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .pricing-period {
          font-size: 0.9375rem;
          color: #8888a0;
          font-weight: 400;
        }
        .pricing-desc {
          font-size: 0.9375rem;
          color: #555566;
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }
        .pricing-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 1.5rem 0;
        }
        .pricing-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }
        .pricing-feature {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          font-size: 0.9375rem;
          color: #8888a0;
        }
        .pricing-feature-check {
          color: #10b981;
          flex-shrink: 0;
          margin-top: 1px;
          font-size: 0.875rem;
        }
        .pricing-feature-x {
          color: #555566;
          flex-shrink: 0;
          margin-top: 1px;
          font-size: 0.875rem;
        }
        .pricing-feature.included { color: #c4c4d4; }
        .btn-pricing-primary {
          width: 100%;
          padding: 0.75rem;
          font-size: 0.9375rem;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #7c3aed, #3b82f6);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          text-decoration: none;
          display: block;
          text-align: center;
          box-shadow: 0 4px 16px rgba(124,58,237,0.3);
          transition: all 0.2s ease;
        }
        .btn-pricing-primary:hover {
          box-shadow: 0 6px 24px rgba(124,58,237,0.5);
          transform: translateY(-1px);
        }
        .btn-pricing-secondary {
          width: 100%;
          padding: 0.75rem;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #f0f0f5;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          cursor: pointer;
          text-decoration: none;
          display: block;
          text-align: center;
          transition: all 0.2s ease;
        }
        .btn-pricing-secondary:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.2);
        }

        /* ===== TESTIMONIALS ===== */
        .testimonials {
          padding: 100px 5%;
          max-width: 1280px;
          margin: 0 auto;
        }
        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 3.5rem;
        }
        .testimonial-card {
          padding: 1.75rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          transition: all 0.3s ease;
        }
        .testimonial-card:hover {
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .testimonial-stars {
          display: flex;
          gap: 0.2rem;
          margin-bottom: 1rem;
          color: #f59e0b;
          font-size: 0.875rem;
        }
        .testimonial-text {
          font-size: 0.9375rem;
          color: #c4c4d4;
          line-height: 1.7;
          margin-bottom: 1.25rem;
          font-style: italic;
        }
        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .testimonial-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        .testimonial-name {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #f0f0f5;
        }
        .testimonial-role {
          font-size: 0.8125rem;
          color: #555566;
        }

        /* ===== CTA SECTION ===== */
        .cta-section {
          padding: 100px 5%;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .cta-section::before {
          content: '';
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .cta-card {
          max-width: 700px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
          padding: 4rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(124,58,237,0.2);
          border-radius: 32px;
          backdrop-filter: blur(20px);
        }
        .cta-title {
          font-size: clamp(1.75rem, 4vw, 2.75rem);
          font-weight: 900;
          color: #f0f0f5;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: 1rem;
        }
        .cta-subtitle {
          font-size: 1.0625rem;
          color: #8888a0;
          margin-bottom: 2rem;
          line-height: 1.6;
        }

        /* ===== FOOTER ===== */
        .footer {
          padding: 3rem 5%;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .footer-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9375rem;
          font-weight: 700;
          color: #8888a0;
          text-decoration: none;
        }
        .footer-links {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .footer-links a {
          font-size: 0.875rem;
          color: #555566;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .footer-links a:hover { color: #8888a0; }
        .footer-copy {
          font-size: 0.8125rem;
          color: #444455;
        }

        @media (max-width: 768px) {
          .nav-links { display: none; }
          .hero { padding: 100px 1.25rem 60px; }
          .hero-floating-cards { display: none; }
          .hero-stats { gap: 1rem; }
          .hero-divider { display: none; }
          .features, .testimonials { padding: 60px 1.25rem; }
          .pricing { padding: 60px 1.25rem; }
          .cta-card { padding: 2.5rem 1.5rem; }
          .footer { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className='landing-page'>
        {/* ===== NAVIGATION ===== */}
        <nav className='nav'>
          <a href='/' className='nav-logo'>
            <div className='nav-logo-icon'>✦</div>
            <span className='nav-logo-text'>
              AI<span>Workspace</span>
            </span>
          </a>
          <ul className='nav-links'>
            <li>
              <a href='#features'>Features</a>
            </li>
            <li>
              <a href='#pricing'>Pricing</a>
            </li>
            <li>
              <a href='#docs'>Docs</a>
            </li>
            <li>
              <a href='#changelog'>Changelog</a>
            </li>
          </ul>
          <div className='nav-actions'>
            <Link href='/sign-in' className='btn-ghost-nav'>
              Sign In
            </Link>
            <Link href='/sign-up' className='btn-nav-primary'>
              Get Started Free
            </Link>
          </div>
        </nav>

        {/* ===== HERO ===== */}
        <section className='hero'>
          <div className='hero-blob-1' />
          <div className='hero-blob-2' />
          <div className='hero-blob-3' />

          {/* Floating cards */}
          <div className='hero-floating-cards'>
            <div className='float-card float-card-1'>
              <div className='float-card-title'>💰 Cost This Month</div>
              <div className='float-card-value'>$12.47</div>
            </div>
            <div className='float-card float-card-2'>
              <div className='float-card-title'>⚡ Tokens Today</div>
              <div className='float-card-value'>1.2M</div>
            </div>
            <div className='float-card float-card-3'>
              <div className='float-card-title'>🤖 Active Models</div>
              <div className='float-card-value'>GPT-4o · Claude 3.5</div>
            </div>
            <div className='float-card float-card-4'>
              <div className='float-card-title'>✅ Provider Status</div>
              <div className='float-card-value' style={{ color: "#10b981" }}>
                All Systems Normal
              </div>
            </div>
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            <div className='hero-badge'>
              <div className='hero-badge-dot' />
              Now supporting GPT-4o, Claude 3.5, Gemini 1.5 Pro & more
            </div>
            <h1 className='hero-headline'>
              One workspace for
              <br />
              <span className='gradient-word'>all your AI models</span>
            </h1>
            <p className='hero-subtitle'>
              Stop juggling multiple AI subscriptions. AI Workspace gives you
              instant access to 50+ models, BYOK support, real-time token
              tracking, and team collaboration — all in one beautiful platform.
            </p>
            <div className='hero-cta'>
              <Link href='/sign-up' className='btn-hero-primary'>
                Start for Free →
              </Link>
              <Link href='/dashboard' className='btn-hero-secondary'>
                View Demo
              </Link>
            </div>
            <div className='hero-stats'>
              <div className='hero-stat'>
                <div className='hero-stat-number'>50+</div>
                <div className='hero-stat-label'>AI Models</div>
              </div>
              <div className='hero-divider' />
              <div className='hero-stat'>
                <div className='hero-stat-number'>10K+</div>
                <div className='hero-stat-label'>Teams using it</div>
              </div>
              <div className='hero-divider' />
              <div className='hero-stat'>
                <div className='hero-stat-number'>2B+</div>
                <div className='hero-stat-label'>Tokens processed</div>
              </div>
              <div className='hero-divider' />
              <div className='hero-stat'>
                <div className='hero-stat-number'>99.9%</div>
                <div className='hero-stat-label'>Uptime SLA</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== PROVIDER STRIP ===== */}
        <div className='providers-strip'>
          <div className='providers-label'>
            Works with the world's leading AI providers
          </div>
          <div className='providers-logos'>
            {[
              { name: "OpenAI", color: "#10a37f" },
              { name: "Anthropic", color: "#d4a959" },
              { name: "Google DeepMind", color: "#4285f4" },
              { name: "Mistral AI", color: "#ff7c00" },
              { name: "Cohere", color: "#39c5bb" },
              { name: "OpenRouter", color: "#7c3aed" },
            ].map((p) => (
              <div key={p.name} className='provider-pill'>
                <div className='provider-dot' style={{ background: p.color }} />
                {p.name}
              </div>
            ))}
          </div>
        </div>

        {/* ===== FEATURES ===== */}
        <section id='features' className='features'>
          <div className='section-header'>
            <div className='section-eyebrow'>Features</div>
            <h2 className='section-title'>
              Everything you need to ship with AI
            </h2>
            <p className='section-subtitle'>
              From individual developers to enterprise teams, AI Workspace
              scales with your needs.
            </p>
          </div>
          <div className='features-grid'>
            {[
              {
                icon: "🤖",
                bg: "rgba(124,58,237,0.12)",
                title: "50+ AI Models in One Place",
                desc: "Instantly switch between GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, and more. No more juggling separate subscriptions and interfaces.",
                tag: {
                  label: "Multi-model",
                  color: "#7c3aed",
                  bg: "rgba(124,58,237,0.1)",
                },
              },
              {
                icon: "🔑",
                bg: "rgba(245,158,11,0.12)",
                title: "Bring Your Own API Keys (BYOK)",
                desc: "Connect your own OpenAI, Anthropic, and Google API keys. Full data privacy and cost transparency — we never markup your API costs.",
                tag: {
                  label: "Data Privacy",
                  color: "#f59e0b",
                  bg: "rgba(245,158,11,0.1)",
                },
              },
              {
                icon: "📊",
                bg: "rgba(59,130,246,0.12)",
                title: "Real-time Token Analytics",
                desc: "Track every token spent, cost per model, daily trends, and team usage. Export detailed reports and set budget alerts.",
                tag: {
                  label: "Analytics",
                  color: "#3b82f6",
                  bg: "rgba(59,130,246,0.1)",
                },
              },
              {
                icon: "⚡",
                bg: "rgba(6,182,212,0.12)",
                title: "Server-Sent Event Streaming",
                desc: "Real-time response streaming with character-by-character output. Works across all supported models, with latency monitoring.",
                tag: {
                  label: "SSE Streaming",
                  color: "#06b6d4",
                  bg: "rgba(6,182,212,0.1)",
                },
              },
              {
                icon: "👥",
                bg: "rgba(16,185,129,0.12)",
                title: "Team Workspace & Collaboration",
                desc: "Invite your team, assign roles, share conversations and AI agents. All team usage consolidated in one billing account.",
                tag: {
                  label: "Team Plans",
                  color: "#10b981",
                  bg: "rgba(16,185,129,0.1)",
                },
              },
              {
                icon: "🛒",
                bg: "rgba(239,68,68,0.12)",
                title: "AI Agent Marketplace",
                desc: "Discover and deploy pre-built AI agents for coding, writing, research, and analysis. Create your own and share with the community.",
                tag: {
                  label: "Marketplace",
                  color: "#ef4444",
                  bg: "rgba(239,68,68,0.1)",
                },
              },
            ].map((f) => (
              <div key={f.title} className='feature-card'>
                <div className='feature-icon' style={{ background: f.bg }}>
                  {f.icon}
                </div>
                <div className='feature-title'>{f.title}</div>
                <div className='feature-desc'>{f.desc}</div>
                <div
                  className='feature-tag'
                  style={{ background: f.tag.bg, color: f.tag.color }}
                >
                  {f.tag.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== PRICING ===== */}
        <section id='pricing' className='pricing'>
          <div className='pricing-inner'>
            <div className='section-header'>
              <div className='section-eyebrow'>Pricing</div>
              <h2 className='section-title'>Simple, transparent pricing</h2>
              <p className='section-subtitle'>
                Pay only for what you use. No surprise bills. Cancel any time.
              </p>
            </div>
            <div className='pricing-grid'>
              {/* Free */}
              <div className='pricing-card'>
                <div className='pricing-plan'>Free</div>
                <div className='pricing-price'>
                  <span className='pricing-currency'>$</span>
                  <span className='pricing-amount'>0</span>
                  <span className='pricing-period'>/month</span>
                </div>
                <div className='pricing-desc'>
                  Perfect for trying out AI Workspace.
                </div>
                <div className='pricing-divider' />
                <ul className='pricing-features'>
                  {[
                    [true, "500K tokens / month"],
                    [true, "2 AI models (GPT-4o Mini, Gemini Flash)"],
                    [true, "50 conversations / month"],
                    [true, "Basic analytics"],
                    [false, "BYOK support"],
                    [false, "Team workspace"],
                    [false, "Priority support"],
                  ].map(([included, label], i) => (
                    <li
                      key={i}
                      className={`pricing-feature ${included ? "included" : ""}`}
                    >
                      <span
                        className={
                          included
                            ? "pricing-feature-check"
                            : "pricing-feature-x"
                        }
                      >
                        {included ? "✓" : "×"}
                      </span>
                      {label as string}
                    </li>
                  ))}
                </ul>
                <Link href='/sign-up' className='btn-pricing-secondary'>
                  Get Started Free
                </Link>
              </div>

              {/* Pro */}
              <div className='pricing-card popular'>
                <div className='pricing-popular-badge'>Most Popular</div>
                <div className='pricing-plan' style={{ color: "#a78bfa" }}>
                  Pro
                </div>
                <div className='pricing-price'>
                  <span className='pricing-currency'>$</span>
                  <span
                    className='pricing-amount'
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    29
                  </span>
                  <span className='pricing-period'>/month</span>
                </div>
                <div className='pricing-desc'>
                  For power users and individual developers.
                </div>
                <div
                  className='pricing-divider'
                  style={{ background: "rgba(124,58,237,0.2)" }}
                />
                <ul className='pricing-features'>
                  {[
                    [true, "10M tokens / month"],
                    [true, "All 50+ AI models"],
                    [true, "Unlimited conversations"],
                    [true, "Advanced analytics & exports"],
                    [true, "BYOK support (unlimited keys)"],
                    [true, "API access"],
                    [false, "Team workspace"],
                  ].map(([included, label], i) => (
                    <li
                      key={i}
                      className={`pricing-feature ${included ? "included" : ""}`}
                    >
                      <span
                        className={
                          included
                            ? "pricing-feature-check"
                            : "pricing-feature-x"
                        }
                      >
                        {included ? "✓" : "×"}
                      </span>
                      {label as string}
                    </li>
                  ))}
                </ul>
                <Link href='/sign-up' className='btn-pricing-primary'>
                  Start Pro Trial
                </Link>
              </div>

              {/* Team */}
              <div className='pricing-card'>
                <div className='pricing-plan'>Team</div>
                <div className='pricing-price'>
                  <span className='pricing-currency'>$</span>
                  <span className='pricing-amount'>99</span>
                  <span className='pricing-period'>/month</span>
                </div>
                <div className='pricing-desc'>
                  For teams building AI-powered products.
                </div>
                <div className='pricing-divider' />
                <ul className='pricing-features'>
                  {[
                    [true, "100M tokens / month"],
                    [true, "All 50+ AI models"],
                    [true, "Up to 25 team members"],
                    [true, "Team analytics dashboard"],
                    [true, "Shared BYOK keys"],
                    [true, "AI agent marketplace access"],
                    [true, "Priority support & SLA"],
                  ].map(([included, label], i) => (
                    <li
                      key={i}
                      className={`pricing-feature ${included ? "included" : ""}`}
                    >
                      <span
                        className={
                          included
                            ? "pricing-feature-check"
                            : "pricing-feature-x"
                        }
                      >
                        {included ? "✓" : "×"}
                      </span>
                      {label as string}
                    </li>
                  ))}
                </ul>
                <Link href='/sign-up' className='btn-pricing-secondary'>
                  Start Team Trial
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ===== TESTIMONIALS ===== */}
        <section className='testimonials'>
          <div className='section-header'>
            <div className='section-eyebrow'>Testimonials</div>
            <h2 className='section-title'>Loved by developers & teams</h2>
          </div>
          <div className='testimonials-grid'>
            {[
              {
                stars: 5,
                text: '"AI Workspace completely transformed how our team uses AI. We went from managing 6 separate subscriptions to one unified platform. The BYOK feature alone saved us $800/month."',
                name: "Sarah Chen",
                role: "CTO at Nexus Labs",
                avatar: "SC",
                avatarBg: "linear-gradient(135deg, #7c3aed, #3b82f6)",
              },
              {
                stars: 5,
                text: '"The token analytics are incredible. I can see exactly which models give me the best quality-to-cost ratio. Switched to Claude 3.5 for complex tasks and cut my AI budget by 40%."',
                name: "Marcus Rivera",
                role: "Senior Engineer, Vercel",
                avatar: "MR",
                avatarBg: "linear-gradient(135deg, #3b82f6, #06b6d4)",
              },
              {
                stars: 5,
                text: '"The streaming is buttery smooth and the model selector is a game changer. Being able to switch between GPT-4o and Claude mid-project without leaving the interface is priceless."',
                name: "Priya Sharma",
                role: "Founder, BuildAI.dev",
                avatar: "PS",
                avatarBg: "linear-gradient(135deg, #06b6d4, #10b981)",
              },
            ].map((t) => (
              <div key={t.name} className='testimonial-card'>
                <div className='testimonial-stars'>{"★".repeat(t.stars)}</div>
                <p className='testimonial-text'>{t.text}</p>
                <div className='testimonial-author'>
                  <div
                    className='testimonial-avatar'
                    style={{ background: t.avatarBg }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <div className='testimonial-name'>{t.name}</div>
                    <div className='testimonial-role'>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== CTA SECTION ===== */}
        <section className='cta-section'>
          <div className='cta-card'>
            <h2 className='cta-title'>
              Ready to unify your
              <br />
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #7c3aed, #3b82f6, #06b6d4)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI workflow?
              </span>
            </h2>
            <p className='cta-subtitle'>
              Join 10,000+ developers and teams who manage all their AI usage in
              AI Workspace. Start free, upgrade when you're ready.
            </p>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link href='/sign-up' className='btn-hero-primary'>
                Get Started Free →
              </Link>
              <Link href='/sign-in' className='btn-hero-secondary'>
                Sign In
              </Link>
            </div>
            <p
              style={{
                marginTop: "1.25rem",
                fontSize: "0.8125rem",
                color: "#555566",
              }}
            >
              No credit card required · Free tier forever · Cancel anytime
            </p>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className='footer'>
          <a href='/' className='footer-logo'>
            <div
              style={{
                width: 24,
                height: 24,
                background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
              }}
            >
              ✦
            </div>
            AI Workspace
          </a>
          <div className='footer-links'>
            <a href='#'>Privacy Policy</a>
            <a href='#'>Terms of Service</a>
            <a href='#'>Documentation</a>
            <a href='#'>Status</a>
            <a href='#'>Blog</a>
            <a href='#'>GitHub</a>
          </div>
          <div className='footer-copy'>
            © 2025 AI Workspace. All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
}
