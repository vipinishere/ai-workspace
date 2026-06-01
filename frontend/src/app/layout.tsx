import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'AI Workspace — The Unified AI Platform',
    template: '%s | AI Workspace',
  },
  description:
    'Access 50+ AI models in one workspace. Bring your own API keys, track token usage, collaborate with your team, and build AI-powered workflows.',
  keywords: ['AI', 'LLM', 'ChatGPT', 'Claude', 'Gemini', 'workspace', 'API', 'tokens'],
  openGraph: {
    title: 'AI Workspace — The Unified AI Platform',
    description: 'Access 50+ AI models in one workspace.',
    type: 'website',
    siteName: 'AI Workspace',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Workspace — The Unified AI Platform',
    description: 'Access 50+ AI models in one workspace.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable} suppressHydrationWarning>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
        </head>
        <body>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
