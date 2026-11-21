/**
 * Public-page SEO - what search engines, AI answer engines, and link previews
 * see for this app.
 */

import { APP_NAME } from './constants'

/** Injected by prerender.ts: `https://<name>.app.space` from wrangler.toml, or
 *  what `deepspace deploy` passes (staging: spacestest.com). Absent in unit
 *  tests, hence the guard. */
declare const __DEEPSPACE_SITE_ORIGIN__: string | undefined

export const seo = {
  title: `${APP_NAME} | Security incident investigations`,
  description:
    'IncidentRoom is a real-time collaborative security operations workspace for tracking, triaging, and investigating incidents.',
  origin: typeof __DEEPSPACE_SITE_ORIGIN__ === 'string' ? __DEEPSPACE_SITE_ORIGIN__ : 'http://localhost',
  noindex: false,
}
