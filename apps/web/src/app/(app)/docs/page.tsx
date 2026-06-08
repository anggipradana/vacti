import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/ui/page-header';
import { getCurrentUser } from '../../../lib/session';

export const dynamic = 'force-dynamic';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Projects (workspaces)',
    body: 'Everything is scoped to a Project. On Projects you can create, rename (Edit), delete (cascades all its data), and mark one as Default (the workspace shown on login). The top-bar switcher sets the active project.',
  },
  {
    title: '2. Targets',
    body: 'Under Targets, add a domain to a project (optional predefined subdomains + custom request headers). Use Edit to change the domain/headers later, or delete it.',
  },
  {
    title: '3. Scans',
    body: 'From Scans (or a target) start a scan. Profiles (Settings → Scan Profiles) control the toolset (subfinder / httpx / naabu / nuclei + wordfence), ports, severities and per-tool options. A scan detail page streams live progress; you can cancel, re-scan, diff against an earlier scan, and delete it.',
  },
  {
    title: '4. Findings & triage',
    body: "On a scan's Vulnerabilities tab: search by text, filter by status, select rows to bulk-change status, change a single finding instantly, enrich with AI (needs an AI key), add an analyst note, or delete. The same search + multi-select pattern is on the leaked-credentials, news and exposure tables.",
  },
  {
    title: '5. Attack Surface (passive recon)',
    body: 'Run a passive or full scan to populate Attack Surface: archived URLs (Wayback — covers the domain and all subdomains), exposure findings (masked, confidential), and IP resolutions. Filter/search, triage, add notes, and export to CSV/ZIP.',
  },
  {
    title: '6. Cyber Threat Intelligence',
    body: 'The Threat page shows a unified risk score, OTX/leak data, KEV/EPSS/ransomware landscape, sector Security news and Brand monitoring (newest 15 each; auto-refreshed daily at 09:00 WIB, or on demand). "AI: filter irrelevant" learns from your Irrelevant/Relevant marks. Generate a bilingual TI report.',
  },
  {
    title: '7. Reports',
    body: 'Generate bilingual (EN/ID) PDF reports for VA (per scan) and TI (per project). Branding and signatories are configured at Settings → Reports.',
  },
  {
    title: '8. Integrations & account',
    body: 'Settings → Integrations: webhooks (add/edit/test), the AI provider (Anthropic / OpenAI / Ollama, optional Base URL), and the per-project encrypted key vault. Settings → Account: change your own password/email and sign out of all devices.',
  },
];

export default async function DocsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <>
      <PageHeader
        title="Documentation"
        description="How to use vacti. For the scriptable REST API, see the API reference."
        actions={
          <Button asChild variant="secondary">
            <a href="/api/docs" target="_blank" rel="noopener noreferrer">
              API reference (Redoc) →
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className="text-base">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-fg-muted">{s.body}</CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">API &amp; automation</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-fg-muted">
          Every operation is scriptable via the typed REST API (Bearer token). Create a token at Settings → API Tokens,
          then explore the interactive reference at{' '}
          <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            /api/docs
          </a>{' '}
          (machine-readable spec at{' '}
          <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            /api/openapi.json
          </a>
          ). Both require a signed-in session.
        </CardContent>
      </Card>
    </>
  );
}
