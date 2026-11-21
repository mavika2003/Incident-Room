/**
 * Account settings - gated by (protected)/_layout AuthGate.
 */

import { signOut, useUser } from 'deepspace'
import { Button } from '@/components/ui'

export default function SettingsPage() {
  const { user } = useUser()

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Account details for this IncidentRoom session.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your account
          </h2>

          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="mt-1 text-foreground">{user?.name ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1 text-foreground">{user?.email ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="mt-1 capitalize text-foreground">{user?.role ?? '-'}</dd>
            </div>
          </dl>

          <Button variant="secondary" className="mt-6" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Data notes
          </h2>
          <p className="text-sm text-muted-foreground">
            Incidents live in the DeepSpace `incidents` collection. Claims use
            `assigneeId` with server-enforced `unclaimed-or-own` updates.
            Timeline rows live in `investigation-events` with userBound
            `authorId`. Synthetic demos use `DEMO-` ids and `source: synthetic`.
          </p>
        </section>
      </div>
    </div>
  )
}
