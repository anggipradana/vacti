import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';
import { SubmitButton } from '../../../../components/ui/submit-button';
import { Badge } from '../../../../components/ui/badge';
import { EmptyState } from '../../../../components/ui/empty-state';
import { ALL_EVENT_TYPES, listProjectSecretNames, listProjectSecretChecks } from '@vacti/integrations';
import { projects, webhooks, aiSettings } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import {
  addWebhookAction,
  deleteWebhookAction,
  editWebhookAction,
  testWebhookAction,
} from '../../../../lib/integration-actions';
import { saveAiSettingsAction } from '../../../../lib/ai-actions';
import { saveProjectKeyAction, clearProjectKeyAction, testProjectKeyAction } from '../../../../lib/vault-actions';

const VAULT_KEYS: { name: string; label: string; hint: string }[] = [
  { name: 'otx', label: 'OTX (AlienVault)', hint: 'Threat-intel pulses' },
  { name: 'leakcheck', label: 'LeakCheck', hint: 'Leaked credentials' },
  { name: 'virustotal', label: 'VirusTotal', hint: 'Passive DNS, subdomains & URLs' },
  { name: 'urlscan', label: 'URLScan', hint: 'Passive URL / IoC lookups' },
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
  // Persisted validity-check verdicts, keyed by secret name, so the status badge survives reloads.
  const keyChecks = new Map((projectId ? await listProjectSecretChecks(db, projectId) : []).map((c) => [c.name, c]));

  return (
    <>
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
                <SubmitButton className="w-full" data-testid="webhook-add">
                  Add webhook
                </SubmitButton>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {hooks.length === 0 ? (
              <EmptyState title="No webhooks" description="Add a webhook to get scan & finding notifications." />
            ) : (
              hooks.map((w) => (
                <Card key={w.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
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
                          <SubmitButton variant="outline" size="sm">
                            Test
                          </SubmitButton>
                        </form>
                        <form action={deleteWebhookAction}>
                          <input type="hidden" name="id" value={w.id} />
                          <SubmitButton variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                            Remove
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-accent hover:underline">Edit</summary>
                      <form action={editWebhookAction} className="mt-3 space-y-3" data-testid={`webhook-edit-${w.id}`}>
                        <input type="hidden" name="id" value={w.id} />
                        <div className="space-y-1">
                          <Label htmlFor={`channel-${w.id}`}>Channel</Label>
                          <Select id={`channel-${w.id}`} name="channel" defaultValue={w.channel}>
                            <option value="discord">Discord</option>
                            <option value="slack">Slack</option>
                            <option value="telegram">Telegram</option>
                            <option value="google_chat">Google Chat</option>
                            <option value="generic">Generic (JSON)</option>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`label-${w.id}`}>Label</Label>
                          <Input
                            id={`label-${w.id}`}
                            name="label"
                            defaultValue={w.label ?? ''}
                            placeholder="Team alerts"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`url-${w.id}`}>Webhook URL</Label>
                          <Input
                            id={`url-${w.id}`}
                            name="url"
                            defaultValue={w.url ?? ''}
                            placeholder="https://… (Discord/Slack/GChat/Generic)"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor={`tgtoken-${w.id}`}>Telegram bot token</Label>
                            <Input
                              id={`tgtoken-${w.id}`}
                              name="telegramToken"
                              defaultValue={w.telegramToken ?? ''}
                              placeholder="for Telegram"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`tgchat-${w.id}`}>Telegram chat id</Label>
                            <Input id={`tgchat-${w.id}`} name="telegramChatId" defaultValue={w.telegramChatId ?? ''} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Events (none = all)</Label>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {ALL_EVENT_TYPES.map((e) => (
                              <label
                                key={e}
                                className="flex items-center gap-1 rounded-md border border-border px-2 py-1"
                              >
                                <input type="checkbox" name="events" value={e} defaultChecked={w.events.includes(e)} />{' '}
                                {e}
                              </label>
                            ))}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="enabled" defaultChecked={w.enabled} /> Enabled
                        </label>
                        <SubmitButton size="sm" data-testid={`webhook-edit-save-${w.id}`}>
                          Save changes
                        </SubmitButton>
                      </form>
                    </details>
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
                <SubmitButton data-testid="ai-save">Save</SubmitButton>
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
                      )}{' '}
                      {setKeys.has(k.name) && keyChecks.get(k.name)?.status ? (
                        <Badge
                          variant={
                            keyChecks.get(k.name)!.status === 'valid'
                              ? 'success'
                              : keyChecks.get(k.name)!.status === 'invalid'
                                ? 'danger'
                                : 'neutral'
                          }
                          data-testid={`vault-test-result-${k.name}`}
                          title={
                            keyChecks.get(k.name)?.checkedAt
                              ? `Last checked ${keyChecks.get(k.name)!.checkedAt!.toISOString()}`
                              : undefined
                          }
                        >
                          {keyChecks.get(k.name)!.status === 'valid'
                            ? 'valid'
                            : keyChecks.get(k.name)!.status === 'invalid'
                              ? 'invalid'
                              : 'check failed'}
                        </Badge>
                      ) : null}
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
                      <SubmitButton variant="outline" size="sm" data-testid={`vault-save-${k.name}`}>
                        Save
                      </SubmitButton>
                    </form>
                  </div>
                  {setKeys.has(k.name) ? (
                    <>
                      <form action={testProjectKeyAction}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="name" value={k.name} />
                        <SubmitButton
                          variant="outline"
                          size="sm"
                          pendingText="Testing..."
                          data-testid={`vault-test-${k.name}`}
                        >
                          Test
                        </SubmitButton>
                      </form>
                      <form action={clearProjectKeyAction}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="name" value={k.name} />
                        <SubmitButton
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:bg-danger/10"
                          data-testid={`vault-clear-${k.name}`}
                        >
                          Clear
                        </SubmitButton>
                      </form>
                    </>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
