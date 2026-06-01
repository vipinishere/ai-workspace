import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { headers } from 'next/headers'

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

interface ClerkWebhookEvent {
  type: string
  data: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set')
    return new NextResponse('Webhook secret not configured', { status: 500 })
  }

  // Get Svix headers
  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse('Missing Svix headers', { status: 400 })
  }

  const body = await req.text()

  // Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET)
  let event: ClerkWebhookEvent

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return new NextResponse('Invalid webhook signature', { status: 400 })
  }

  // Forward to FastAPI backend
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  try {
    const backendResponse = await fetch(`${apiUrl}/api/v1/webhooks/clerk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        type: event.type,
        data: event.data,
      }),
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error('Backend webhook handler failed:', errorText)
      return new NextResponse('Backend processing failed', { status: 500 })
    }

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Failed to forward webhook to backend:', err)
    return new NextResponse('Failed to process webhook', { status: 500 })
  }
}
