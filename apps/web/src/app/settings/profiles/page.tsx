import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { AppShell } from '../../../components/shell/app-shell';
import { PageHeader } from '../../../components/ui/page-header';
import { SettingsTabs } from '../../../components/settings-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { SubmitButton } from '../../../components/ui/submit-button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { userCan, Permission } from '@vacti/core';
import { scanProfiles } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { saveProfileAction, deleteProfileAction } from '../../../lib/recon-actions';

export const dynamic = 'force-dynamic';

const TOOLS = ['subfinder', 'httpx', 'naabu', 'nuclei', 'wordfence'] as const;
const SEVS = ['critical', 'high', 'medium', 'low', 'info'] as const;

export default async function ProfilesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const canEdit = userCan(user, Permission.ModifyScanConfig);
  const rows = await getDb().select().from(scanProfiles).orderBy(desc(scanProfiles.createdAt));

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader title="Settings" description="Scan profiles — tools, scope, and advanced per-tool options." />
      <SettingsTabs active="/settings/profiles" isSysAdmin={user.isSysAdmin} />

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        {canEdit ? (
          <Card>
            <CardHeader>
              <CardTitle>New scan profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={saveProfileAction} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="e.g. Deep w/ custom UA" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Tools</Label>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {TOOLS.map((t) => (
                      <label key={t} className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
                        <input type="checkbox" name="tools" value={t} defaultChecked={t !== 'wordfence'} /> {t}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-fg-subtle">Uncheck subfinder to skip discovery (use predefined subs).</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ports">Ports</Label>
                    <Input id="ports" name="ports" defaultValue="top-100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="userAgent">User-Agent</Label>
                    <Input id="userAgent" name="userAgent" placeholder="Mozilla/5.0 …" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Severities</Label>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {SEVS.map((s) => (
                      <label key={s} className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
                        <input type="checkbox" name="severities" value={s} defaultChecked={s !== 'info'} /> {s}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rateLimit">Rate limit</Label>
                    <Input id="rateLimit" name="rateLimit" type="number" placeholder="150" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="concurrency">Concurrency</Label>
                    <Input id="concurrency" name="concurrency" type="number" placeholder="25" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="retries">Retries</Label>
                    <Input id="retries" name="retries" type="number" placeholder="1" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nucleiTags">nuclei tags</Label>
                  <Input id="nucleiTags" name="nucleiTags" placeholder="cve, exposure, misconfig" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nucleiExcludeTags">nuclei exclude-tags</Label>
                  <Input id="nucleiExcludeTags" name="nucleiExcludeTags" placeholder="dos, intrusive, fuzzing" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nucleiTemplates">nuclei templates (paths)</Label>
                  <Input id="nucleiTemplates" name="nucleiTemplates" placeholder="custom/my-template.yaml" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="excludeSubdomains">Exclude subdomains</Label>
                  <Textarea
                    id="excludeSubdomains"
                    name="excludeSubdomains"
                    rows={2}
                    placeholder={'dev.example.com\nstaging.example.com'}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nucleiExtraArgs">nuclei extra args (advanced, allow-listed)</Label>
                  <Input id="nucleiExtraArgs" name="nucleiExtraArgs" placeholder="-follow-redirects -timeout 10" />
                  <p className="text-xs text-fg-subtle">Only safe flags pass; unknown flags are dropped server-side.</p>
                </div>
                <SubmitButton pendingText="Saving…" className="w-full">
                  Create profile
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-2">
          {rows.length === 0 ? (
            <EmptyState title="No scan profiles" description="Create a profile to customise tools & scope." />
          ) : (
            rows.map((p) => {
              const tools = (p.tools ?? {}) as Record<string, boolean>;
              const cfg = (p.config ?? {}) as Record<string, unknown>;
              const on = Object.entries(tools)
                .filter(([, v]) => v)
                .map(([k]) => k);
              return (
                <Card key={p.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.name}</span>
                      <div className="flex items-center gap-2">
                        {p.projectId ? null : <Badge variant="neutral">global</Badge>}
                        {canEdit ? (
                          <form action={deleteProfileAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <Button type="submit" variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                              Delete
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-fg-muted">
                      <span>tools: {on.join(', ') || '—'}</span>
                      <span>· ports: {p.ports}</span>
                      <span>· sev: {p.severities.join('/')}</span>
                      {cfg.userAgent ? <span>· UA set</span> : null}
                      {cfg.rateLimit ? <span>· rate {String(cfg.rateLimit)}</span> : null}
                      {Array.isArray(cfg.excludeSubdomains) ? (
                        <span>· excl {(cfg.excludeSubdomains as string[]).length}</span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
