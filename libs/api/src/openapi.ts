/** Hand-authored OpenAPI 3.1 document for the public REST API. Served at /api/openapi.json. */
export function openApiSpec(): Record<string, unknown> {
  const bearer = [{ bearerAuth: [] }];
  const json = (schema: unknown) => ({ content: { 'application/json': { schema } } });
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
  const projectId = { name: 'projectId', in: 'query', schema: { type: 'string', format: 'uuid' } };

  // Standard responses reused across endpoints.
  const unauthorized = { description: 'Missing or invalid bearer token', ...json(ref('Error')) };
  const forbidden = { description: 'Role lacks the required permission', ...json(ref('Error')) };
  const notFound = { description: 'Not found', ...json(ref('Error')) };
  const badRequest = { description: 'Invalid payload', ...json(ref('Error')) };
  const conflict = {
    description: 'Conflicts with an invariant (duplicate / self / last SysAdmin)',
    ...json(ref('Error')),
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'vacti API',
      version: '0.1.0',
      description:
        'Recon (Vulnerability Assessment) + Threat Intelligence REST API.\n\n' +
        '**Auth:** every endpoint except `/api/health`, `/api/openapi.json` and `/api/docs` requires a ' +
        'Bearer **API token** (`Authorization: Bearer vct_…`), created under Settings → API tokens.\n\n' +
        '**RBAC:** mutating endpoints are gated by the token owner’s role (SysAdmin / PenetrationTester / ' +
        'Auditor); a disallowed action returns `403`.',
    },
    servers: [{ url: '/', description: 'Same origin' }],
    security: bearer,
    tags: [
      { name: 'System' },
      { name: 'Targets' },
      { name: 'Scans' },
      { name: 'Schedules' },
      { name: 'Threat Intel' },
      { name: 'Webhooks' },
      { name: 'Search' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'API token (vct_…)' },
      },
      schemas: {
        Error: { type: 'object', properties: { error: {} }, required: ['error'] },
        Target: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            domain: { type: 'string' },
            predefinedSubdomains: { type: 'array', items: { type: 'string' } },
            customHeaders: { type: 'object', additionalProperties: { type: 'string' }, nullable: true },
          },
        },
        CreateTarget: {
          type: 'object',
          required: ['projectId', 'domain'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            domain: { type: 'string' },
            predefinedSubdomains: { type: 'array', items: { type: 'string' } },
          },
        },
        ScanProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            tools: {
              type: 'object',
              properties: {
                subfinder: { type: 'boolean' },
                httpx: { type: 'boolean' },
                naabu: { type: 'boolean' },
                nuclei: { type: 'boolean' },
                wordfence: { type: 'boolean' },
              },
            },
            ports: { type: 'string', example: 'top-100' },
            severities: { type: 'array', items: { type: 'string' } },
          },
        },
        Scan: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            targetId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed', 'cancelled'] },
            stage: { type: 'string', nullable: true },
            counts: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Vulnerability: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            severity: { type: 'integer', description: '0=info … 4=critical' },
            status: { type: 'string' },
            cvss: { type: 'number', nullable: true },
            cveIds: { type: 'array', items: { type: 'string' } },
            url: { type: 'string', nullable: true },
          },
        },
        ScanDiff: {
          type: 'object',
          properties: {
            baseline: { type: 'string', format: 'uuid' },
            current: { type: 'string', format: 'uuid' },
            diff: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  added: { type: 'array', items: { type: 'string' } },
                  removed: { type: 'array', items: { type: 'string' } },
                  unchanged: { type: 'integer' },
                },
              },
            },
          },
        },
        Schedule: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            targetId: { type: 'string', format: 'uuid' },
            profileId: { type: 'string', format: 'uuid', nullable: true },
            cron: { type: 'string', example: '0 2 * * *' },
            enabled: { type: 'boolean' },
            lastRunAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Indicator: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['domain', 'subdomain', 'ip'] },
            value: { type: 'string' },
            note: { type: 'string', nullable: true },
          },
        },
        Webhook: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            channel: { type: 'string', enum: ['discord', 'slack', 'telegram', 'google_chat', 'generic'] },
            label: { type: 'string', nullable: true },
            url: { type: 'string', nullable: true },
            events: { type: 'array', items: { type: 'string' } },
            enabled: { type: 'boolean' },
          },
        },
        SearchResults: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            hits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  kind: {
                    type: 'string',
                    enum: ['project', 'target', 'scan', 'subdomain', 'endpoint', 'vulnerability'],
                  },
                  id: { type: 'string' },
                  label: { type: 'string' },
                  href: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    paths: {
      '/api/health': {
        get: {
          summary: 'Health check (public)',
          tags: ['System'],
          security: [],
          responses: { '200': { description: 'OK' } },
        },
      },
      '/api/whoami': {
        get: {
          summary: 'Current principal',
          tags: ['System'],
          security: bearer,
          responses: { '200': { description: 'OK' }, '401': unauthorized },
        },
      },
      '/api/search': {
        get: {
          summary: 'Universal search across resources',
          tags: ['Search'],
          security: bearer,
          parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'OK', ...json(ref('SearchResults')) }, '401': unauthorized },
        },
      },
      '/api/targets': {
        get: {
          summary: 'List targets',
          tags: ['Targets'],
          security: bearer,
          parameters: [projectId],
          responses: {
            '200': {
              description: 'OK',
              ...json({ type: 'object', properties: { targets: { type: 'array', items: ref('Target') } } }),
            },
            '401': unauthorized,
          },
        },
        post: {
          summary: 'Create a target',
          tags: ['Targets'],
          security: bearer,
          requestBody: { required: true, ...json(ref('CreateTarget')) },
          responses: {
            '201': { description: 'Created', ...json({ type: 'object', properties: { target: ref('Target') } }) },
            '400': badRequest,
            '401': unauthorized,
            '403': forbidden,
          },
        },
      },
      '/api/profiles': {
        get: {
          summary: 'List scan profiles',
          tags: ['Scans'],
          security: bearer,
          responses: { '200': { description: 'OK' }, '401': unauthorized },
        },
        post: {
          summary: 'Create a scan profile',
          tags: ['Scans'],
          security: bearer,
          requestBody: { required: true, ...json(ref('ScanProfile')) },
          responses: { '201': { description: 'Created' }, '400': badRequest, '403': forbidden },
        },
      },
      '/api/scans': {
        get: {
          summary: 'List scans (paginated)',
          tags: ['Scans'],
          security: bearer,
          parameters: [
            projectId,
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, minimum: 1, maximum: 100 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: {
            '200': {
              description: 'OK',
              ...json({
                type: 'object',
                properties: {
                  scans: { type: 'array', items: ref('Scan') },
                  total: { type: 'integer' },
                  limit: { type: 'integer' },
                  offset: { type: 'integer' },
                },
              }),
            },
            '401': unauthorized,
          },
        },
        post: {
          summary: 'Start a scan (enqueue)',
          tags: ['Scans'],
          security: bearer,
          requestBody: {
            required: true,
            ...json({
              type: 'object',
              required: ['targetId'],
              properties: {
                targetId: { type: 'string', format: 'uuid' },
                profileId: { type: 'string', format: 'uuid' },
              },
            }),
          },
          responses: {
            '202': { description: 'Queued', ...json({ type: 'object', properties: { scan: ref('Scan') } }) },
            '400': badRequest,
            '403': forbidden,
            '404': notFound,
          },
        },
      },
      '/api/scans/{id}': {
        get: {
          summary: 'Scan status + activity',
          tags: ['Scans'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'OK' }, '404': notFound },
        },
        delete: {
          summary: 'Delete a scan (cascades activity/results)',
          tags: ['Scans'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'Deleted' }, '403': forbidden },
        },
      },
      '/api/scans/{id}/results': {
        get: {
          summary: 'Scan results (subdomains/endpoints/ports/vulns)',
          tags: ['Scans'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'OK' }, '404': notFound },
        },
      },
      '/api/scans/{id}/events': {
        get: {
          summary: 'Scan progress (Server-Sent Events)',
          tags: ['Scans'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'text/event-stream' } },
        },
      },
      '/api/scans/{id}/cancel': {
        post: {
          summary: 'Cancel a running/queued scan',
          tags: ['Scans'],
          security: bearer,
          parameters: [idParam],
          responses: {
            '200': { description: 'Cancelled / terminal' },
            '202': { description: 'Cancellation requested' },
            '403': forbidden,
            '404': notFound,
          },
        },
      },
      '/api/scans/{id}/diff': {
        get: {
          summary: 'Diff this scan against another',
          tags: ['Scans'],
          security: bearer,
          parameters: [
            idParam,
            { name: 'against', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '200': { description: 'OK', ...json(ref('ScanDiff')) }, '400': badRequest, '404': notFound },
        },
      },
      '/api/vulnerabilities/{id}/status': {
        post: {
          summary: 'Set vulnerability triage status',
          tags: ['Scans'],
          security: bearer,
          parameters: [idParam],
          requestBody: {
            required: true,
            ...json({
              type: 'object',
              required: ['status'],
              properties: { status: { type: 'string' }, note: { type: 'string' } },
            }),
          },
          responses: {
            '200': {
              description: 'OK',
              ...json({ type: 'object', properties: { vulnerability: ref('Vulnerability') } }),
            },
            '400': badRequest,
            '403': forbidden,
            '404': notFound,
          },
        },
      },
      '/api/schedules': {
        get: {
          summary: 'List scan schedules',
          tags: ['Schedules'],
          security: bearer,
          responses: {
            '200': {
              description: 'OK',
              ...json({ type: 'object', properties: { schedules: { type: 'array', items: ref('Schedule') } } }),
            },
            '401': unauthorized,
          },
        },
        post: {
          summary: 'Create a scan schedule',
          tags: ['Schedules'],
          security: bearer,
          requestBody: {
            required: true,
            ...json({
              type: 'object',
              required: ['targetId', 'cron'],
              properties: {
                targetId: { type: 'string', format: 'uuid' },
                cron: { type: 'string' },
                profileId: { type: 'string', format: 'uuid' },
              },
            }),
          },
          responses: {
            '201': { description: 'Created', ...json({ type: 'object', properties: { schedule: ref('Schedule') } }) },
            '400': badRequest,
            '403': forbidden,
          },
        },
      },
      '/api/schedules/{id}': {
        delete: {
          summary: 'Delete a scan schedule',
          tags: ['Schedules'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'Deleted' }, '403': forbidden },
        },
      },
      '/api/threat-intel': {
        get: {
          summary: 'Threat-intel data + unified risk score',
          tags: ['Threat Intel'],
          security: bearer,
          parameters: [{ ...projectId, required: true }],
          responses: { '200': { description: 'OK' }, '400': badRequest },
        },
      },
      '/api/threat-intel/refresh': {
        post: {
          summary: 'Enqueue a threat-intel refresh',
          tags: ['Threat Intel'],
          security: bearer,
          requestBody: {
            required: true,
            ...json({
              type: 'object',
              required: ['projectId'],
              properties: { projectId: { type: 'string', format: 'uuid' } },
            }),
          },
          responses: { '202': { description: 'Queued' }, '400': badRequest, '403': forbidden },
        },
      },
      '/api/indicators': {
        get: {
          summary: 'List manual indicators',
          tags: ['Threat Intel'],
          security: bearer,
          parameters: [projectId],
          responses: {
            '200': {
              description: 'OK',
              ...json({ type: 'object', properties: { indicators: { type: 'array', items: ref('Indicator') } } }),
            },
          },
        },
        post: {
          summary: 'Add a manual indicator',
          tags: ['Threat Intel'],
          security: bearer,
          requestBody: {
            required: true,
            ...json({
              type: 'object',
              required: ['projectId', 'type', 'value'],
              properties: {
                projectId: { type: 'string', format: 'uuid' },
                type: { type: 'string', enum: ['domain', 'subdomain', 'ip'] },
                value: { type: 'string' },
                note: { type: 'string' },
              },
            }),
          },
          responses: {
            '201': { description: 'Created', ...json({ type: 'object', properties: { indicator: ref('Indicator') } }) },
            '400': badRequest,
            '403': forbidden,
          },
        },
      },
      '/api/indicators/{id}': {
        delete: {
          summary: 'Delete a manual indicator',
          tags: ['Threat Intel'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'Deleted' }, '403': forbidden },
        },
      },
      '/api/leaks/{id}/status': {
        post: {
          summary: 'Set leak triage status',
          tags: ['Threat Intel'],
          security: bearer,
          parameters: [idParam],
          requestBody: {
            required: true,
            ...json({ type: 'object', required: ['status'], properties: { status: { type: 'string' } } }),
          },
          responses: { '200': { description: 'OK' }, '400': badRequest, '403': forbidden, '404': notFound },
        },
      },
      '/api/leaks/{id}/toggle': {
        post: {
          summary: 'Toggle a leak checked flag',
          tags: ['Threat Intel'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'OK' }, '403': forbidden, '404': notFound },
        },
      },
      '/api/webhooks': {
        get: {
          summary: 'List webhooks',
          tags: ['Webhooks'],
          security: bearer,
          parameters: [projectId],
          responses: {
            '200': {
              description: 'OK',
              ...json({ type: 'object', properties: { webhooks: { type: 'array', items: ref('Webhook') } } }),
            },
          },
        },
        post: {
          summary: 'Create a webhook',
          tags: ['Webhooks'],
          security: bearer,
          requestBody: { required: true, ...json(ref('Webhook')) },
          responses: { '201': { description: 'Created' }, '400': badRequest, '403': forbidden },
        },
      },
      '/api/webhooks/{id}': {
        delete: {
          summary: 'Delete a webhook',
          tags: ['Webhooks'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'Deleted' }, '403': forbidden },
        },
      },
      '/api/webhooks/{id}/test': {
        post: {
          summary: 'Send a test notification',
          tags: ['Webhooks'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'OK' }, '403': forbidden, '404': notFound },
        },
      },
      '/api/projects/{id}': {
        delete: {
          summary: 'Delete a project (cascades targets/scans/findings)',
          tags: ['Projects'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'Deleted' }, '403': forbidden },
        },
      },
      '/api/targets/{id}': {
        delete: {
          summary: 'Delete a target (cascades subdomains/endpoints/ports)',
          tags: ['Targets'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'Deleted' }, '403': forbidden },
        },
      },
      '/api/vulnerabilities/{id}': {
        delete: {
          summary: 'Delete a vulnerability finding',
          tags: ['Scans'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'Deleted' }, '403': forbidden },
        },
      },
      '/api/leaks/{id}': {
        delete: {
          summary: 'Delete a leaked-credential record',
          tags: ['Threat Intel'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'Deleted' }, '403': forbidden },
        },
      },
      '/api/surface/findings/{id}': {
        delete: {
          summary: 'Delete an exposure finding',
          tags: ['Attack Surface'],
          security: bearer,
          parameters: [idParam],
          responses: { '200': { description: 'Deleted' }, '403': forbidden },
        },
      },
      '/api/users': {
        post: {
          summary: 'Create a user (SysAdmin only)',
          tags: ['Users'],
          security: bearer,
          requestBody: {
            required: true,
            ...json({
              type: 'object',
              required: ['email', 'password', 'role'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8 },
                role: { type: 'string', enum: ['SysAdmin', 'PenetrationTester', 'Auditor'] },
              },
            }),
          },
          responses: { '200': { description: 'Created' }, '400': badRequest, '403': forbidden, '409': conflict },
        },
      },
      '/api/users/{id}': {
        delete: {
          summary: 'Delete a user (SysAdmin only; never self or last SysAdmin)',
          tags: ['Users'],
          security: bearer,
          parameters: [idParam],
          responses: {
            '200': { description: 'Deleted' },
            '403': forbidden,
            '404': notFound,
            '409': conflict,
          },
        },
      },
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
