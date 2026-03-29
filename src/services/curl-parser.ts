import type { ParsedCurl } from '../types';

export function parseCurl(raw: string): ParsedCurl {
  let s = raw.trim();

  // Normalize Windows CMD line continuations and escape characters
  s = s.replace(/\^\s*[\r\n]+\s*/g, ' ');
  s = s.replace(/\^/g, '');

  // Normalize bash line continuations
  s = s.replace(/\\\s*\n\s*/g, ' ');

  // Normalize PowerShell line continuations
  s = s.replace(/`\s*\n\s*/g, ' ');

  // Extract URL: first quoted or unquoted argument after curl
  const urlMatch = s.match(/curl(?:\.exe)?\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(https?:\/\/\S+))/i);
  if (!urlMatch) {
    throw new Error('Could not find URL in cURL command');
  }
  const url = (urlMatch[1] ?? urlMatch[2] ?? urlMatch[3]).replace(/\\"/g, '"');

  if (!url.startsWith('https://')) {
    throw new Error('URL must use HTTPS');
  }

  // Extract headers from -H flags (double-quoted and single-quoted)
  const headers: Record<string, string> = {};
  const headerRegex = /-H\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/g;
  let match;
  while ((match = headerRegex.exec(s)) !== null) {
    const headerStr = (match[1] ?? match[2]).replace(/\\"/g, '"');
    const colonIdx = headerStr.indexOf(':');
    if (colonIdx > 0) {
      const key = headerStr.substring(0, colonIdx).trim().toLowerCase();
      const value = headerStr.substring(colonIdx + 1).trim();
      headers[key] = value;
    }
  }

  // Extract cookies from -b / --cookie flag
  const cookieMatch = s.match(/(?:-b|--cookie)\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/);
  let cookies = '';
  if (cookieMatch) {
    cookies = (cookieMatch[1] ?? cookieMatch[2]).replace(/\\"/g, '"');
  } else if (headers['cookie']) {
    cookies = headers['cookie'];
  }

  if (!headers['authorization']) {
    throw new Error('Authorization header not found in cURL command');
  }

  if (!cookies) {
    throw new Error('Cookies not found in cURL command. Use -b flag or Cookie header.');
  }

  return { url, headers, cookies };
}
