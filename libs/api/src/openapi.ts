/** Hand-authored OpenAPI 3.1 document for the public REST API. Served at /api/openapi.json. */
export function openApiSpec(): Record<string, unknown> {
  const bearer = [{ bearerAuth: [] }];
  const ok = { description: 'OK' };
  const projectId = { name: 'projectId', in: 'query', schema: { type: 'string', format: 'uuid' } };
  const get = (summary: string, tag: string, params: unknown[] = []) => ({
    get: { summary, tags: [tag], security: bearer, parameters: params, responses: { '200': ok } },
  });
  const post = (summary: string, tag: string) => ({
    post: {
      summary,
      tags: [tag],
      security: bearer,
      responses: { '201': ok, '202': ok, '200': ok, '400': { description: 'Bad request' } },
    },
  });
  return {
    openapi: '3.1.0',
    info: {
      title: 'vacti API',
      version: '0.1.0',
      description: 'Recon (VA) + Threat Intelligence REST API. Auth: Bearer API token (vct_…).',
    },
    servers: [{ url: '/' }],
    security: bearer,
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    tags: [{ name: 'System' }, { name: 'Targets' }, { name: 'Scans' }, { name: 'Threat Intel' }, { name: 'Webhooks' }],
    paths: {
      '/api/health': { get: { summary: 'Health check', tags: ['System'], responses: { '200': ok } } },
      '/api/whoami': get('Current principal', 'System'),
      '/api/targets': { ...get('List targets', 'Targets', [projectId]), ...post('Create target', 'Targets') },
      '/api/profiles': { ...get('List scan profiles', 'Scans'), ...post('Create scan profile', 'Scans') },
      '/api/scans': { ...get('List scans', 'Scans', [projectId]), ...post('Start a scan (enqueue)', 'Scans') },
      '/api/scans/{id}': get('Scan status + activity', 'Scans', [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ]),
      '/api/scans/{id}/results': get('Scan results (subdomains/endpoints/ports/vulns)', 'Scans', [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ]),
      '/api/scans/{id}/events': get('Scan progress (SSE)', 'Scans', [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ]),
      '/api/vulnerabilities/{id}/status': post('Set vulnerability triage status', 'Scans'),
      '/api/threat-intel': get('Threat-intel data + unified risk score', 'Threat Intel', [
        { ...projectId, required: true },
      ]),
      '/api/threat-intel/refresh': post('Enqueue a threat-intel refresh', 'Threat Intel'),
      '/api/indicators': {
        ...get('List manual indicators', 'Threat Intel', [projectId]),
        ...post('Add manual indicator', 'Threat Intel'),
      },
      '/api/leaks/{id}/status': post('Set leak triage status', 'Threat Intel'),
      '/api/webhooks': { ...get('List webhooks', 'Webhooks', [projectId]), ...post('Create webhook', 'Webhooks') },
      '/api/webhooks/{id}/test': post('Send a test notification', 'Webhooks'),
    },
  };
}

export function redocHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>vacti API</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0}</style></head>
<body><redoc spec-url="/api/openapi.json"></redoc>
<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script></body></html>`;
}
