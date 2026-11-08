/**
 * Copy text to the clipboard. The dashboard's helper adds a non-secure-context
 * fallback through a hidden textarea; this keeps the same contract (resolves
 * `true` when the text was copied, never rejects).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the textarea path
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand?.('copy') ?? false
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/** Copy a command or code snippet; the same call, named for its call sites. */
export function copyCode(text: string): Promise<boolean> {
  return copyToClipboard(text)
}
