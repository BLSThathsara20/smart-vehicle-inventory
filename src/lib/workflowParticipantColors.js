/** Consistent, dark-theme-friendly accents per Firebase uid (steps, comments, avatars). */

const GOLDEN = 0x9e3779b9
const HUES = [32, 172, 265, 136, 200, 308, 18, 220, 115, 328, 52, 242]

export function participantHue(uid) {
  let h = 0
  const s = String(uid || 'anonymous')
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), GOLDEN)
  }
  return HUES[Math.abs(h) % HUES.length]
}

/**
 * @returns {{ hue: number, accent: string, soft: string, border: string, glow: string, text: string }}
 */
export function getParticipantPalette(uid) {
  const hue = participantHue(uid)
  return {
    hue,
    accent: `hsl(${hue} 68% 60%)`,
    soft: `hsla(${hue} 45% 55% / 0.16)`,
    border: `hsla(${hue} 50% 52% / 0.42)`,
    glow: `hsla(${hue} 60% 50% / 0.2)`,
    text: `hsl(${hue} 75% 78%)`,
  }
}
