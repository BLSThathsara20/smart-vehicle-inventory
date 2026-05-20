/**
 * Firebase Cloud Functions — send FCM web push using tokens stored on Sanity `userProfile.fcm_web_tokens`.
 *
 * Configure environment (Firebase console → Functions → your function → Environment variables):
 *   SANITY_PROJECT_ID *   SANITY_DATASET (default: production)
 *   SANITY_API_TOKEN — read + write on userProfile (to prune bad tokens)
 *   PUSH_WEBHOOK_SECRET — shared secret; caller sends Authorization: Bearer <secret>
 *
 * Example:
 *   curl -X POST "$FUNCTION_URL" \
 *     -H "Authorization: Bearer $PUSH_WEBHOOK_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"firebase_uid":"...","title":"New task","body":"You have a prep step.","path":"/app/my-work"}'
 */

const { onRequest } = require('firebase-functions/v2/https')
const { logger } = require('firebase-functions')
const admin = require('firebase-admin')
const { createClient } = require('@sanity/client')

if (!admin.apps.length) {
  admin.initializeApp()
}

function sanityClient() {
  const projectId = process.env.SANITY_PROJECT_ID
  const dataset = process.env.SANITY_DATASET || 'production'
  const token = process.env.SANITY_API_TOKEN
  if (!projectId || !token) {
    throw new Error('Missing SANITY_PROJECT_ID or SANITY_API_TOKEN')
  }
  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2024-01-01',
    useCdn: false,
  })
}

exports.sendPushToUser = onRequest(
  {
    region: 'us-central1',
    cors: false,
    invoker: 'public',
    timeoutSeconds: 60,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }

    const expected = process.env.PUSH_WEBHOOK_SECRET
    const auth = req.get('authorization') || ''
    if (!expected || auth !== `Bearer ${expected}`) {
      res.status(401).send('Unauthorized')
      return
    }

    let body = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        res.status(400).send('Invalid JSON body')
        return
      }
    }

    const firebaseUid = body?.firebase_uid
    const title = String(body?.title || 'Notification').slice(0, 120)
    const bodyText = String(body?.body || '').slice(0, 500)
    let path = String(body?.path || '/app/notifications').slice(0, 500)
    if (!path.startsWith('/')) path = `/${path}`

    if (!firebaseUid) {
      res.status(400).send('firebase_uid required')
      return
    }

    let sanity
    try {
      sanity = sanityClient()
    } catch (e) {
      logger.error(e)
      res.status(500).send('Server misconfigured')
      return
    }

    const doc = await sanity.fetch(
      `*[_type == "userProfile" && firebase_uid == $u][0]{ _id, fcm_web_tokens }`,
      { u: firebaseUid }
    )
    const profileId = doc?._id
    const tokens = Array.isArray(doc?.fcm_web_tokens) ? [...new Set(doc.fcm_web_tokens.filter(Boolean))] : []

    if (!tokens.length) {
      res.json({ ok: true, sent: 0, message: 'No FCM tokens for user' })
      return
    }

    const message = {
      tokens,
      notification: { title, body: bodyText },
      data: { path },
    }

    try {
      const resp = await admin.messaging().sendEachForMulticast(message)
      const invalid = []
      resp.responses.forEach((r, i) => {
        if (!r.success && r.error) {
          const code = r.error.code
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalid.push(tokens[i])
          }
        }
      })

      if (invalid.length && profileId) {
        const next = tokens.filter((t) => !invalid.includes(t))
        try {
          await sanity.patch(profileId).set({ fcm_web_tokens: next }).commit()
        } catch (e) {
          logger.warn('Could not prune invalid FCM tokens', e)
        }
      }

      res.json({
        ok: true,
        sent: resp.successCount,
        failed: resp.failureCount,
        pruned: invalid.length,
      })
    } catch (e) {
      logger.error(e)
      res.status(500).send('FCM send failed')
    }
  }
)
