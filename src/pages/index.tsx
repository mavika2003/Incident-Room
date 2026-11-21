/**
 * Landing page - a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div
        data-testid="static-landing"
        className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b1118] text-[#e6edf5]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 20% -10%, rgba(45,212,191,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(56,189,248,0.12), transparent 50%)',
          }}
        />
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-teal-300/90">
            {APP_NAME}
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Investigate security incidents in one shared room.
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
            A collaborative operations console for triage, assignment, and
            durable incident records - built on DeepSpace realtime storage.
          </p>
          <div className="mt-8">
            <Link
              to="/home"
              className="inline-flex items-center rounded-md bg-teal-300 px-5 py-2.5 text-sm font-semibold text-teal-950 transition-opacity hover:opacity-90"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
