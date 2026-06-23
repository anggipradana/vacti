import { createHash, createHmac } from 'node:crypto';

/**
 * Presign a Cloudflare R2 (S3-compatible) GET URL so the browser can load an evidence blob straight
 * from the bucket - the bytes never transit vacti (it stays light). AWS SigV4 query-string signing by
 * hand (no aws-sdk). The engine uploads the object; vacti only holds the key + signs short-lived reads.
 */
export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const sha256hex = (d: string): string => createHash('sha256').update(d).digest('hex');
const hmac = (key: string | Buffer, data: string): Buffer => createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding (encodeURIComponent plus the four chars it leaves alone) per the SigV4 spec. */
function enc(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export function presignR2Get(cfg: R2Config, key: string, expiresSec = 300, now: Date = new Date()): string {
  return presignR2('GET', cfg, key, expiresSec, now);
}

/** Presign a PUT URL so vacti can cache a generated report (e.g. PDF) straight into the bucket. */
export function presignR2Put(cfg: R2Config, key: string, expiresSec = 300, now: Date = new Date()): string {
  return presignR2('PUT', cfg, key, expiresSec, now);
}

function presignR2(method: 'GET' | 'PUT', cfg: R2Config, key: string, expiresSec: number, now: Date): string {
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const amzdate = now
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/\.\d{3}/, '');
  const datestamp = amzdate.slice(0, 8);
  const canonicalUri = `/${cfg.bucket}/${key.split('/').map(enc).join('/')}`;
  const credential = `${cfg.accessKeyId}/${datestamp}/${region}/${service}/aws4_request`;

  const canonicalQuery = (
    [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', credential],
      ['X-Amz-Date', amzdate],
      ['X-Amz-Expires', String(expiresSec)],
      ['X-Amz-SignedHeaders', 'host'],
    ] as [string, string][]
  )
    .map(([k, v]) => [enc(k), enc(v)] as [string, string])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const scope = `${datestamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzdate}\n${scope}\n${sha256hex(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, datestamp), region), service), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
