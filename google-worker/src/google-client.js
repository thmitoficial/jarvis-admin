// Cliente OAuth Google usando fetch nativo (sem dependências externas).
// Fluxo: authorization code → access token (curta duração) + refresh token (longo).
// O refresh token é persistido em GOOGLE_REFRESH_TOKEN no .env (ou em memória).
// Access tokens expiram em ~1h; este módulo renova automaticamente.

import 'dotenv/config';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send'
].join(' ');

// Cache em memória do access token
let cachedToken = null;
let cachedExpiry = 0;

function creds() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw Object.assign(new Error('OAuth Google não configurado. Preencha GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env do worker.'), { statusCode: 503 });
  }
  return { clientId, clientSecret, redirectUri };
}

// URL para o usuário autorizar
export function getAuthUrl() {
  const { clientId, redirectUri } = creds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: Math.random().toString(36).slice(2)
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// Troca o código de autorização por tokens
export async function exchangeCode(code) {
  const { clientId, clientSecret, redirectUri } = creds();
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });
  const j = await r.json();
  if (j.error) throw new Error(`OAuth token exchange: ${j.error} - ${j.error_description || ''}`);
  // Persiste refresh token
  if (j.refresh_token) {
    process.env.GOOGLE_REFRESH_TOKEN = j.refresh_token;
    console.log('✓ Refresh token obtido e armazenado em memória.');
    console.log('  Para persistir entre reinícios, adicione ao .env:');
    console.log('  GOOGLE_REFRESH_TOKEN=' + j.refresh_token);
  }
  cachedToken = j.access_token;
  cachedExpiry = Date.now() + (j.expires_in - 60) * 1000;
  return j;
}

// Renova access token usando o refresh token
async function refreshAccessToken() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw Object.assign(new Error('Sem refresh token. Acesse /oauth/start para autorizar.'), { statusCode: 401 });
  }
  const { clientId, clientSecret } = creds();
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    })
  });
  const j = await r.json();
  if (j.error) {
    if (j.error === 'invalid_grant') {
      throw Object.assign(new Error('Refresh token inválido ou expirado. Reautorize em /oauth/start.'), { statusCode: 401 });
    }
    throw new Error(`OAuth refresh: ${j.error} - ${j.error_description || ''}`);
  }
  cachedToken = j.access_token;
  cachedExpiry = Date.now() + (j.expires_in - 60) * 1000;
  return j.access_token;
}

// Retorna access token válido, renovando se necessário
export async function getAccessToken() {
  if (cachedToken && Date.now() < cachedExpiry) return cachedToken;
  return refreshAccessToken();
}

// Chama a API do Google com token válido
export async function googleFetch(url, opts = {}) {
  const token = await getAccessToken();
  const r = await fetch(url, {
    ...opts,
    headers: { 'Authorization': `Bearer ${token}`, ...(opts.headers || {}) }
  });
  if (r.status === 401) {
    // Token pode ter expirado entre o cache e a chamada; força renovação
    cachedExpiry = 0;
    return googleFetch(url, opts);
  }
  return r;
}
