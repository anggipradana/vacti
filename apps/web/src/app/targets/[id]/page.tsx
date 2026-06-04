import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '../../../components/shell/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { userCan, Permission } from '@vacti/core';
import { targets, reconNotes } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { addNoteAction, toggleNoteAction, deleteNoteAction } from '../../../lib/recon-actions';

export const dynamic = 'force-dynamic';

export default async function TargetDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const db = getDb();
  const [target] = await db.select().from(targets).where(eq(targets.id, id));
  if (!target) notFound();
  const notes = await db
    .select()
    .from(reconNotes)
    .where(eq(reconNotes.targetId, id))
    .orderBy(desc(reconNotes.createdAt));
  const headers = (target.customHeaders as Record<string, string> | null) ?? null;
  const canEdit = userCan(user, Permission.ModifyTargets);

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <div className="mb-6">
        <Link href="/targets" className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Targets
        </Link>
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{target.domain}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-sm">
            <div>
              <div className="text-xs text-fg-subtle">Predefined subdomains</div>
              {target.predefinedSubdomains.length ? (
                <div className="mt-1 font-mono text-xs">{target.predefinedSubdomains.join(', ')}</div>
              ) : (
                <div className="text-fg-muted">— discovery on</div>
              )}
            </div>
            <div>
              <div className="text-xs text-fg-subtle">Custom request headers</div>
              {headers ? (
                <div className="mt-1 space-y-0.5 font-mono text-xs">
                  {Object.keys(headers).map((k) => (
                    <div key={k}>
                      {k}: <span className="text-fg-subtle">••••••</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-fg-muted">— none</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recon notes &amp; TODOs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {canEdit ? (
              <form action={addNoteAction} className="flex items-center gap-2">
                <input type="hidden" name="targetId" value={target.id} />
                <Input name="body" placeholder="Add a note or TODO…" required />
                <Button type="submit" size="sm">
                  Add
                </Button>
              </form>
            ) : null}
            {notes.length === 0 ? (
              <p className="py-2 text-sm text-fg-muted">No notes yet.</p>
            ) : (
              <ul className="space-y-1">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0"
                  >
                    <span className={n.done ? 'text-sm text-fg-subtle line-through' : 'text-sm'}>{n.body}</span>
                    <div className="flex items-center gap-1">
                      {n.done ? <Badge variant="success">done</Badge> : null}
                      {canEdit ? (
                        <>
                          <form action={toggleNoteAction}>
                            <input type="hidden" name="id" value={n.id} />
                            <input type="hidden" name="targetId" value={target.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              {n.done ? 'Reopen' : 'Done'}
                            </Button>
                          </form>
                          <form action={deleteNoteAction}>
                            <input type="hidden" name="id" value={n.id} />
                            <input type="hidden" name="targetId" value={target.id} />
                            <Button type="submit" variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                              ✕
                            </Button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
