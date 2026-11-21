/**
 * Theme catalog.
 *
 * Color values live in styles.css / themes.css - this file is metadata only.
 */

export const THEMES = [
  {
    id: 'opsroom',
    label: 'Opsroom',
    description: 'Dark security operations console with teal signal accents.',
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Light example theme showing the token contract.',
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Scaffold dark placeholder (indigo accent). Prefer opsroom.',
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/** Read the currently active theme id from <html data-theme>. */
export function getActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return 'opsroom'
  const id = document.documentElement.getAttribute('data-theme') as ThemeId | null
  return id ?? 'opsroom'
}

/** Look up a theme entry by id, or fall back to the first theme. */
export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
