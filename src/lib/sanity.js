import { createClient } from '@sanity/client'

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID || ''
const dataset = import.meta.env.VITE_SANITY_DATASET || 'production'
const apiVersion = import.meta.env.VITE_SANITY_API_VERSION || '2024-01-01'
const token = import.meta.env.VITE_SANITY_TOKEN || ''

export const hasSanityConfig = !!projectId && !!dataset && !!token

export const sanity = hasSanityConfig
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      token,
      useCdn: false,
    })
  : null

/**
 * Turn Sanity mutation errors into actionable copy. A 403 with "create" usually means
 * VITE_SANITY_TOKEN is Viewer/read-only — the app needs Editor (write) access.
 */
export function formatSanityMutationError(err) {
  const msg = err?.message || String(err || '')
  const code = err?.statusCode ?? err?.response?.statusCode ?? err?.response?.status
  if (
    code === 403 ||
    /Insufficient permissions/i.test(msg) ||
    /permission ['"]?create['"]? required/i.test(msg)
  ) {
    return (
      'Sanity blocked this change: your API token cannot create or update documents. ' +
      'In sanity.io/manage → your project → API → Tokens, create a token with Editor access (not Viewer), ' +
      'put it in VITE_SANITY_TOKEN, then restart the dev server.'
    )
  }
  return msg
}
