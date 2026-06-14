import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';
import { ActionForm, ActionSubmit } from '../../../../components/ui/action-form';
import { Badge } from '../../../../components/ui/badge';
import { EmptyState } from '../../../../components/ui/empty-state';
import { ALL_EVENT_TYPES, listProjectSecretNames, listProjectSecretChecks } from '@vacti/integrations';
import { projects, webhooks, aiSettings, aiDefaults } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { getActiveProjectId } from '../../../../lib/active-project';
import { ProjectSwitcher } from '../../../../components/project-switcher';
import {
  addWebhookAction,
  deleteWebhookAction,
  editWebhookAction,
  testWebhookAction,
} from '../../../../lib/integration-actions';
import { saveAiSettingsAction, saveAiDefaultsAction } from '../../../../lib/ai-actions';
import { saveProjectKeyAction, clearProjectKeyAction, testProjectKeyAction } from '../../../../lib/vault-actions';

const VAULT_KEYS: { name: string; label: string; hint: string }[] = [
  { name: 'otx', label: 'OTX (AlienVault)', hint: 'Threat-intel pulses' },
  { name: 'leakcheck', label: 'LeakCheck', hint: 'Leaked credentials' },
  { name: 'virustotal', label: 'VirusTotal', hint: 'Passive DNS, subdomains & URLs' },
  { name: 'urlscan', label: 'URLScan', hint: 'Passive URL / IoC lookups' },
  { name: 'anthropic', label: 'Anthropic (Claude)', hint: 'AI enrichment' },
  { name: 'openai', label: 'OpenAI', hint: 'AI enrichment' },
  { name: 'deepseek', label: 'DeepSeek', hint: 'AI enrichment' },
  { name: 'kimi', label: 'Kimi (Moonshot)', hint: 'AI enrichment' },
];

// Provider options shared by the per-project and the system-default AI forms.
const AI_PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'kimi', label: 'Kimi (Moonshot)' },
  { value: 'ollama', label: 'Ollama' },
];

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const sp = await searchParams;
  // Cookie-aware: follow the active project like the other project-scoped pages (a switch persists).
  const projectId = await getActiveProjectId(sp.project, projectRows);

  const hooks = projectId ? await db.select().from(webhooks).where(eq(webhooks.projectId, projectId)) : [];
  const [ai] = projectId ? await db.select().from(aiSettings).where(eq(aiSettings.projectId, projectId)) : [];
  const [aiDefault] = await db.select().from(aiDefaults).where(eq(aiDefaults.id, 'default'));
  const setKeys = projectId ? new Set(await listProjectSecretNames(db, projectId)) : new Set<string>();
  // Persisted validity-check verdicts, keyed by secret name, so the status badge survives reloads.
  const keyChecks = new Map((projectId ? await listProjectSecretChecks(db, projectId) : []).map((c) => [c.name, c]));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Public REST API docs:{' '}
          <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            /api/docs
          </a>{' '}
          · OpenAPI:{' '}
          <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            /api/openapi.json
          </a>
        </p>
        <ProjectSwitcher projects={projectRows} current={projectId} basePath="/settings/integrations" />
      </div>

      {!projectId ? (
        <p className="text-sm text-fg-muted">Create a project first.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Add webhook</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={addWebhookAction} className="space-y-3">
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
                        <Checkbox name="events" value={e} /> {e}
                      </label>
                    ))}
                  </div>
                </div>
                <ActionSubmit className="w-full" data-testid="webhook-add">
                  Add webhook
                </ActionSubmit>
              </ActionForm>
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
                        <ActionForm action={testWebhookAction}>
                          <input type="hidden" name="id" value={w.id} />
                          <ActionSubmit variant="outline" size="sm">
                            Test
                          </ActionSubmit>
                        </ActionForm>
                        <ActionForm action={deleteWebhookAction} confirm="Remove this webhook? This cannot be undone.">
                          <input type="hidden" name="id" value={w.id} />
                          <ActionSubmit variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                            Remove
                          </ActionSubmit>
                        </ActionForm>
                      </div>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-accent hover:underline">Edit</summary>
                      <ActionForm
                        action={editWebhookAction}
                        className="mt-3 space-y-3"
                        data-testid={`webhook-edit-${w.id}`}
                      >
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
                                <Checkbox name="events" value={e} defaultChecked={w.events.includes(e)} /> {e}
                              </label>
                            ))}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox name="enabled" defaultChecked={w.enabled} /> Enabled
                        </label>
                        <ActionSubmit size="sm" data-testid={`webhook-edit-save-${w.id}`}>
                          Save changes
                        </ActionSubmit>
                      </ActionForm>
                    </details>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
          Default AI enrichment (system)
        </h2>
        <Card className="max-w-xl">
          <CardContent className="pt-5">
            <p className="mb-3 text-sm text-fg-muted">
              The default provider used for AI enrichment when a project has not chosen its own below. The system API
              key works across all projects; a key stored in a project vault overrides it for that project.
            </p>
            <ActionForm action={saveAiDefaultsAction} className="space-y-3">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="default-provider">Provider</Label>
                  <Select
                    id="default-provider"
                    name="provider"
                    defaultValue={aiDefault?.provider ?? 'anthropic'}
                    data-testid="ai-default-provider"
                  >
                    {AI_PROVIDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="default-model">Model</Label>
                  <Input
                    id="default-model"
                    name="model"
                    defaultValue={aiDefault?.model ?? 'claude-sonnet-4-6'}
                    placeholder="e.g. deepseek-chat, kimi-latest"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="default-baseUrl">Base URL (optional)</Label>
                <Input
                  id="default-baseUrl"
                  name="baseUrl"
                  type="url"
                  placeholder="https://my-gateway.local/v1  (blank = vendor default)"
                  defaultValue={aiDefault?.baseUrl ?? ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="default-apiKey">
                  System API key{' '}
                  {aiDefault?.apiKeyCiphertext ? (
                    <Badge variant="success">set</Badge>
                  ) : (
                    <span className="text-xs text-fg-subtle">· used by every project without its own key</span>
                  )}{' '}
                  {aiDefault?.apiKeyCiphertext && aiDefault?.lastCheckStatus ? (
                    <Badge
                      variant={
                        aiDefault.lastCheckStatus === 'valid'
                          ? 'success'
                          : aiDefault.lastCheckStatus === 'invalid'
                            ? 'danger'
                            : 'neutral'
                      }
                      data-testid="ai-default-key-status"
                      title={
                        aiDefault.lastCheckedAt ? `Last checked ${aiDefault.lastCheckedAt.toISOString()}` : undefined
                      }
                    >
                      {aiDefault.lastCheckStatus === 'valid'
                        ? 'valid'
                        : aiDefault.lastCheckStatus === 'invalid'
                          ? 'invalid'
                          : 'check failed'}
                    </Badge>
                  ) : null}
                </Label>
                <Input
                  id="default-apiKey"
                  name="apiKey"
                  type="password"
                  autoComplete="off"
                  placeholder={aiDefault?.apiKeyCiphertext ? 'Leave blank to keep the stored key' : 'sk-...'}
                  data-testid="ai-default-key"
                />
                {aiDefault?.apiKeyCiphertext ? (
                  <label className="flex items-center gap-2 pt-1 text-xs text-fg-subtle">
                    <Checkbox name="clearKey" className="size-3.5" /> Remove the stored system key
                  </label>
                ) : null}
              </div>
              <ActionSubmit data-testid="ai-default-save" pendingText="Saving + testing key...">
                Save default
              </ActionSubmit>
            </ActionForm>
          </CardContent>
        </Card>
      </div>

      {projectId ? (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-fg-subtle">
            AI enrichment (this project)
          </h2>
          <Card className="max-w-xl">
            <CardContent className="pt-5">
              <p className="mb-3 text-sm text-fg-muted">
                Provider for vulnerability enrichment (description/impact/remediation) for this project. This OVERRIDES
                the system default above. Choose &quot;Use system default&quot; to follow it. Set the matching API key
                in the vault below (or environment); features degrade gracefully without a key.
              </p>
              <ActionForm action={saveAiSettingsAction} className="space-y-3">
                <input type="hidden" name="projectId" value={projectId} />
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="provider">Provider</Label>
                    <Select id="provider" name="provider" defaultValue={ai?.provider ?? ''}>
                      <option value="">Use system default</option>
                      {AI_PROVIDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      name="model"
                      defaultValue={ai?.model ?? 'claude-sonnet-4-6'}
                      placeholder="e.g. deepseek-chat, kimi-latest"
                    />
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
                    DeepSeek and Kimi are OpenAI-compatible (no base URL needed). Point Anthropic/OpenAI at a compatible
                    endpoint (local proxy, LiteLLM, gateway) if you use one. Leave blank for the official cloud API.
                    (Ollama uses OLLAMA_BASE_URL.)
                  </p>
                </div>
                <ActionSubmit data-testid="ai-save">Save</ActionSubmit>
              </ActionForm>
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
                    <ActionForm action={saveProjectKeyAction} className="flex items-center gap-2" id={`form-${k.name}`}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="name" value={k.name} />
                      <Input
                        id={`key-${k.name}`}
                        name="value"
                        type="password"
                        data-testid={`vault-input-${k.name}`}
                        placeholder={setKeys.has(k.name) ? '•••••••• (replace)' : 'Paste key…'}
                      />
                      <ActionSubmit variant="outline" size="sm" data-testid={`vault-save-${k.name}`}>
                        Save
                      </ActionSubmit>
                    </ActionForm>
                  </div>
                  {setKeys.has(k.name) ? (
                    <>
                      <ActionForm action={testProjectKeyAction}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="name" value={k.name} />
                        <ActionSubmit
                          variant="outline"
                          size="sm"
                          pendingText="Testing..."
                          data-testid={`vault-test-${k.name}`}
                        >
                          Test
                        </ActionSubmit>
                      </ActionForm>
                      <ActionForm action={clearProjectKeyAction}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="name" value={k.name} />
                        <ActionSubmit
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:bg-danger/10"
                          data-testid={`vault-clear-${k.name}`}
                        >
                          Clear
                        </ActionSubmit>
                      </ActionForm>
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
