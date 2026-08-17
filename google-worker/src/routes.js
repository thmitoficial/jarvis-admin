import { Router } from 'express';
import { getAuthUrl, exchangeCode, googleFetch } from './google-client.js';

export const router = Router();

function authWorker(req, res, next) {
  const expected = process.env.WORKER_API_TOKEN;
  if (!expected) return res.status(503).json({ erro: 'WORKER_API_TOKEN não configurado no worker.' });
  const got = req.headers['x-worker-token'];
  if (got !== expected) return res.status(401).json({ erro: 'Token do worker inválido.' });
  next();
}

router.get('/oauth/start', (req, res) => { res.redirect(getAuthUrl()); });

router.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`Erro OAuth: ${error}`);
  if (!code) return res.status(400).send('Código de autorização ausente.');
  try {
    await exchangeCode(code);
    res.send('✅ Autorizado! O refresh token foi obtido. Você já pode fechar esta página e usar a API jarvis-admin. <br><br>Para persistir entre reinícios, copie o refresh token exibido no console do worker para o .env (GOOGLE_REFRESH_TOKEN).');
  } catch (e) {
    res.status(500).send(`Erro: ${e.message}`);
  }
});

router.get('/agenda', authWorker, async (req, res) => {
  try {
    const now = new Date();
    const de = req.query.de || now.toISOString();
    const ate = req.query.ate || new Date(Date.now() + 7 * 86400000).toISOString();
    const params = new URLSearchParams({ timeMin: de, timeMax: ate, singleEvents: 'true', orderBy: 'startTime', maxResults: '50' });
    const r = await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    res.json(j.items || []);
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

router.post('/agenda', authWorker, async (req, res) => {
  try {
    const { summary, startDateTime, endDateTime, location, description, attendees } = req.body;
    if (!summary || !startDateTime) return res.status(400).json({ erro: 'summary e startDateTime são obrigatórios.' });
    const body = {
      summary,
      start: { dateTime: startDateTime },
      end: endDateTime ? { dateTime: endDateTime } : { dateTime: new Date(new Date(startDateTime).getTime() + 3600000).toISOString() }
    };
    if (location) body.location = location;
    if (description) body.description = description;
    if (Array.isArray(attendees)) body.attendees = attendees.map(a => typeof a === 'string' ? { email: a } : a);
    const r = await googleFetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    res.json(j);
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

router.get('/email/listar', authWorker, async (req, res) => {
  try {
    const q = req.query.q || '';
    const max = Math.min(Number(req.query.max) || 10, 50);
    const params = new URLSearchParams({ q, maxResults: max });
    const r1 = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`);
    const j1 = await r1.json();
    if (j1.error) throw new Error(j1.error.message);
    const threads = j1.threads || [];
    const detailed = await Promise.all(threads.slice(0, max).map(async t => {
      const r = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
      const j = await r.json();
      const msg = (j.messages || [])[0] || {};
      const headers = Object.fromEntries((msg.payload?.headers || []).map(h => [h.name, h.value]));
      return { id: t.id, snippet: j.snippet || t.snippet, from: headers.From || '', subject: headers.Subject || '', date: headers.Date || '', unread: (msg.labelIds || []).includes('UNREAD') };
    }));
    res.json(detailed);
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

router.get('/email/:threadId', authWorker, async (req, res) => {
  try {
    const r = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${req.params.threadId}?format=full`);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    const messages = (j.messages || []).map(m => {
      const headers = Object.fromEntries((m.payload?.headers || []).map(h => [h.name, h.value]));
      let body = '';
      if (m.payload?.body?.data) body = Buffer.from(m.payload.body.data, 'base64url').toString('utf-8');
      else if (m.payload?.parts) {
        const part = m.payload.parts.find(p => p.mimeType === 'text/plain');
        if (part?.body?.data) body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
      return { id: m.id, from: headers.From, to: headers.To, subject: headers.Subject, date: headers.Date, body, snippet: m.snippet };
    });
    res.json(messages);
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

router.post('/email/enviar', authWorker, async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    if (!to || !subject) return res.status(400).json({ erro: 'to e subject obrigatórios.' });
    const raw = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', '', body || ''].join('\n');
    const encoded = Buffer.from(raw).toString('base64url');
    const r = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: encoded })
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    res.json({ id: j.id, threadId: j.threadId });
  } catch (e) {
    res.status(e.statusCode || 500).json({ erro: e.message });
  }
});

router.get('/health', (req, res) => res.json({ ok: true, oauth: !!process.env.GOOGLE_REFRESH_TOKEN }));
