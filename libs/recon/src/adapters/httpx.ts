export interface HttpxResult {
  input: string;
  url: string;
  host: string;
  port?: string;
  scheme?: string;
  title?: string;
  webServer?: string;
  statusCode?: number;
  contentLength?: number;
  tech: string[];
  ips: string[];
  cdn?: boolean;
}

export function httpxArgs(): string[] {
  return ['-json', '-silent', '-td', '-title', '-status-code', '-web-server', '-cdn', '-no-color'];
}

interface HttpxRaw {
  input?: string;
  url?: string;
  host?: string;
  port?: string;
  scheme?: string;
  title?: string;
  webserver?: string;
  status_code?: number;
  content_length?: number;
  tech?: string[];
  a?: string[];
  cdn?: boolean;
}

export function parseHttpxLine(line: string): HttpxResult | null {
  try {
    const j = JSON.parse(line) as HttpxRaw;
    if (!j.url) return null;
    return {
      input: j.input ?? j.url,
      url: j.url,
      host: j.host ?? '',
      port: j.port,
      scheme: j.scheme,
      title: j.title,
      webServer: j.webserver,
      statusCode: j.status_code,
      contentLength: j.content_length,
      tech: j.tech ?? [],
      ips: j.a ?? [],
      cdn: j.cdn,
    };
  } catch {
    return null;
  }
}
