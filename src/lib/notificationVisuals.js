/**
 * Card colours for Notifications page — distinct palettes by notification type so staff can scan quickly.
 */

/**
 * @param {{ type?: string, severity?: string }} n
 */
export function getNotificationAppearance(n, meta = {}) {
  const done = meta.relevantTaskDone === true
  if (done) {
    return {
      variant: 'done',
      border: 'border-emerald-500/35',
      bg: 'bg-emerald-500/10',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
      titleClass: 'text-emerald-300',
      bodyClass: 'text-emerald-200/75',
      dueClass: 'text-emerald-200/45',
    }
  }

  const t = String(n?.type || '')

  /** @type {Record<string, { border: string, bg: string, iconBg: string, titleClass: string }>} */
  const map = {
    viewing_public_manager_alert: {
      border: 'border-cyan-500/40',
      bg: 'bg-gradient-to-r from-cyan-500/[0.14] to-sky-500/[0.08]',
      iconBg: 'bg-cyan-500/25 text-cyan-300',
      titleClass: 'text-cyan-200',
    },
    viewing_public_team_ping: {
      border: 'border-cyan-500/40',
      bg: 'bg-gradient-to-r from-cyan-500/[0.14] to-sky-500/[0.08]',
      iconBg: 'bg-cyan-500/25 text-cyan-300',
      titleClass: 'text-cyan-200',
    },
    viewing_public_mention: {
      border: 'border-cyan-500/35',
      bg: 'bg-cyan-500/[0.1]',
      iconBg: 'bg-cyan-500/20 text-cyan-300',
      titleClass: 'text-cyan-100',
    },
    viewing_manager_alert: {
      border: 'border-amber-500/35',
      bg: 'bg-amber-500/[0.1]',
      iconBg: 'bg-amber-500/22 text-amber-400',
      titleClass: 'text-amber-300',
    },
    viewing_team_ping: {
      border: 'border-amber-500/35',
      bg: 'bg-amber-500/[0.1]',
      iconBg: 'bg-amber-500/22 text-amber-400',
      titleClass: 'text-amber-300',
    },
    viewing_mention: {
      border: 'border-amber-500/33',
      bg: 'bg-amber-500/[0.08]',
      iconBg: 'bg-amber-500/18 text-amber-400',
      titleClass: 'text-amber-200',
    },
    viewing_today: {
      border: 'border-violet-500/40',
      bg: 'bg-violet-500/[0.1]',
      iconBg: 'bg-violet-500/22 text-violet-300',
      titleClass: 'text-violet-200',
    },
    viewing_soon: {
      border: 'border-violet-400/33',
      bg: 'bg-violet-500/[0.07]',
      iconBg: 'bg-violet-500/18 text-violet-300',
      titleClass: 'text-violet-100',
    },
    delivery_today: {
      border: 'border-sky-500/42',
      bg: 'bg-sky-500/[0.1]',
      iconBg: 'bg-sky-500/23 text-sky-300',
      titleClass: 'text-sky-200',
    },
    delivery_soon: {
      border: 'border-sky-400/34',
      bg: 'bg-sky-500/[0.07]',
      iconBg: 'bg-sky-500/18 text-sky-300',
      titleClass: 'text-sky-100',
    },
    full_service_due: {
      border: 'border-orange-500/36',
      bg: 'bg-orange-500/[0.1]',
      iconBg: 'bg-orange-500/22 text-orange-300',
      titleClass: 'text-orange-200',
    },
    pdi_due: {
      border: 'border-teal-500/38',
      bg: 'bg-teal-500/[0.1]',
      iconBg: 'bg-teal-500/23 text-teal-300',
      titleClass: 'text-teal-100',
    },
    mot_expiry: {
      border: 'border-rose-500/43',
      bg: 'bg-rose-500/[0.1]',
      iconBg: 'bg-rose-500/23 text-rose-300',
      titleClass: 'text-rose-100',
    },
    work_assigned: {
      border: 'border-indigo-500/39',
      bg: 'bg-indigo-500/[0.1]',
      iconBg: 'bg-indigo-500/23 text-indigo-300',
      titleClass: 'text-indigo-100',
    },
    work_comment: {
      border: 'border-purple-400/34',
      bg: 'bg-purple-500/[0.08]',
      iconBg: 'bg-purple-500/20 text-purple-300',
      titleClass: 'text-purple-100',
    },
    workshop_service_today: {
      border: 'border-amber-700/42',
      bg: 'bg-amber-800/[0.2]',
      iconBg: 'bg-amber-600/35 text-amber-200',
      titleClass: 'text-amber-100',
    },
    staff_signup_pending: {
      border: 'border-fuchsia-500/41',
      bg: 'bg-fuchsia-500/[0.1]',
      iconBg: 'bg-fuchsia-500/23 text-fuchsia-300',
      titleClass: 'text-fuchsia-100',
    },
  }

  const hit = map[t]
  const sevHigh = String(n?.severity || '') === 'high'
  const defaultLow = sevHigh
    ? {
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/[0.08]',
        iconBg: 'bg-amber-500/18 text-amber-400',
        titleClass: 'text-amber-200',
      }
    : {
        border: 'border-zinc-700/72',
        bg: 'bg-zinc-900/55',
        iconBg: 'bg-zinc-800/72 text-zinc-400',
        titleClass: 'text-white',
      }

  const v = hit || defaultLow

  return {
    variant: hit ? `typed-${t}` : sevHigh ? 'severity-high' : 'muted',
    border: v.border,
    bg: v.bg,
    iconBg: v.iconBg,
    titleClass: v.titleClass,
    bodyClass: 'text-zinc-500',
    dueClass: 'text-zinc-600',
  }
}
