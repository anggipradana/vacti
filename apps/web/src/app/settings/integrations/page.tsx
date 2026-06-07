import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { AppShell } from '../../../components/shell/app-shell';
import { PageHeader } from '../../../components/ui/page-header';
import { SettingsTabs } from '../../../components/settings-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { ALL_EVENT_TYPES, listProjectSecretNames } from '@vacti/integrations';
import { projects, webhooks, aiSettings } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { addWebhookAction, deleteWebhookAction, testWebhookAction } from '../../../lib/integration-actions';
import { saveAiSettingsAction } from '../../../lib/ai-actions';
import { saveProjectKeyAction, clearProjectKeyAction } from '../../../lib/vault-actions';

const VAULT_KEYS: { name: string; label: string; hint: string }[] = [
  { name: 'otx', label: 'OTX (AlienVault)', hint: 'Threat-intel pulses' },
  { name: 'leakcheck', label: 'LeakCheck', hint: 'Leaked credentials' },
  { name: 'anthropic', label: 'Anthropic (Claude)', hint: 'AI enrichment' },
  { name: 'openai', label: 'OpenAI', hint: 'AI enrichment' },
];

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const sp = await searchParams;
  const projectId = sp.project ?? projectRows[0]?.id;

  const hooks = projectId ? await db.select().from(webhooks).where(eq(webhooks.projectId, projectId)) : [];
  const [ai] = projectId ? await db.select().from(aiSettings).where(eq(aiSettings.projectId, projectId)) : [];
  const setKeys = projectId ? new Set(await listProjectSecretNames(db, projectId)) : new Set<string>();

  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader title="Settings" description="Webhook notifications, AI, and API docs." />
      <SettingsTabs active="/settings/integrations" isSysAdmin={user.isSysAdmin} />

      <p className="mb-4 text-sm text-fg-muted">
        Public REST API docs:{' '}
        <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          /api/docs
        </a>{' '}
        · OpenAPI:{' '}
        <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          /api/openapi.json
        </a>
      </p>

      {!projectId ? (
        <p className="text-sm text-fg-muted">Create a project first.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Add webhook</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addWebhookAction} className="space-y-3">
                <input type="hidden" name="projectId" value={projectId} />
                <div className="space-y-1">
                  <Label htmlFor="channel">Channel</Label>
                  <Select id="channel" name="channel">
                    <option value="discord">Discord</option>
                    <option value="slack">Slack</option>
                    <option value="telegram">Telegram</option>
                    <option value="google_chat">Google Chat</option>
                    <option value="generic">Generic (JSON)</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="label">Label</Label>
                  <Input id="label" name="label" placeholder="Team alerts" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input id="url" name="url" placeholder="https://… (Discord/Slack/GChat/Generic)" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="tgtoken">Telegram bot token</Label>
                    <Input id="tgtoken" name="telegramToken" placeholder="for Telegram" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tgchat">Telegram chat id</Label>
                    <Input id="tgchat" name="telegramChatId" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Events (none = all)</Label>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {ALL_EVENT_TYPES.map((e) => (
                      <label key={e} className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
                        <input type="checkbox" name="events" value={e} /> {e}
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" data-testid="webhook-add">
                  Add webhook
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {hooks.length === 0 ? (
              <EmptyState title="No webhooks" description="Add a webhook to get scan & finding notifications." />
            ) : (
              hooks.map((w) => (
                <Card key={w.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <span className="font-medium">{w.label ?? w.channel}</span>{' '}
                      <Badge variant="neutral">{w.channel}</Badge>{' '}
                      <span className="text-xs text-fg-subtle">
                        {w.events.length ? w.events.join(', ') : 'all events'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={testWebhookAction}>
                        <input type="hidden" name="id" value={w.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Test
                        </Button>
                      </form>
                      <form action={deleteWebhookAction}>
                        <input type="hidden" name="id" value={w.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                          Remove
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {projectId ? (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
            AI enrichment
          </h2>
          <Card className="max-w-xl">
            <CardContent className="pt-5">
              <p className="mb-3 text-sm text-fg-muted">
                Provider for vulnerability enrichment (description/impact/remediation). Set the matching API key in the
                vault below (or environment); features degrade gracefully without a key.
              </p>
              <form action={saveAiSettingsAction} className="space-y-3">
                <input type="hidden" name="projectId" value={projectId} />
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="provider">Provider</Label>
                    <Select id="provider" name="provider" defaultValue={ai?.provider ?? 'anthropic'}>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="openai">OpenAI</option>
                      <option value="ollama">Ollama</option>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" name="model" defaultValue={ai?.model ?? 'claude-sonnet-4-6'} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="baseUrl">Base URL (optional)</Label>
                  <Input
                    id="baseUrl"
                    name="baseUrl"
                    type="url"
                    placeholder="https://my-gateway.local/v1  (blank = vendor default)"
                    defaultValue={ai?.baseUrl ?? ''}
                  />
                  <p className="text-xs text-fg-subtle">
                    Point Anthropic/OpenAI at a compatible endpoint (local proxy, LiteLLM, gateway). Leave blank to use
                    the official cloud API. Does not change your API key. (Ollama uses OLLAMA_BASE_URL.)
                  </p>
                </div>
                <Button type="submit" data-testid="ai-save">
                  Save
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {projectId ? (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
            API keys (encrypted vault)
          </h2>
          <Card className="max-w-2xl">
            <CardContent className="space-y-3 pt-5">
              <p className="text-sm text-fg-muted">
                Per-project keys, encrypted at rest (AES-256-GCM). When set, they override the environment defaults.
                Values are never displayed after saving.
              </p>
              {VAULT_KEYS.map((k) => (
                <div
                  key={k.name}
                  className="flex items-end gap-2 border-t border-border pt-3 first:border-0 first:pt-0"
                >
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`key-${k.name}`}>
                      {k.label}{' '}
                      {setKeys.has(k.name) ? (
                        <Badge variant="success">set</Badge>
                      ) : (
                        <span className="text-xs text-fg-subtle">· {k.hint}</span>
                      )}
                    </Label>
                    <form action={saveProjectKeyAction} className="flex items-center gap-2" id={`form-${k.name}`}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="name" value={k.name} />
                      <Input
                        id={`key-${k.name}`}
                        name="value"
                        type="password"
                        data-testid={`vault-input-${k.name}`}
                        placeholder={setKeys.has(k.name) ? '•••••••• (replace)' : 'Paste key…'}
                      />
                      <Button type="submit" variant="outline" size="sm" data-testid={`vault-save-${k.name}`}>
                        Save
                      </Button>
                    </form>
                  </div>
                  {setKeys.has(k.name) ? (
                    <form action={clearProjectKeyAction}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="name" value={k.name} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger/10"
                        data-testid={`vault-clear-${k.name}`}
                      >
                        Clear
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
