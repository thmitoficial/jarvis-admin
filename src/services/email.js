// E-mail — duas vias:
//  (1) SMTP direto (envio) via Nodemailer. Configure SMTP_* no .env.
//  (2) Gmail OAuth via worker Google (leitura + envio). Configure GOOGLE_WEBHOOK_URL + WORKER_API_TOKEN.
// Os endpoints /admin/email/listar e /admin/email/:threadId usam a via (2).

import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw Object.assign(new Error('SMTP não configurado. Preencha SMTP_* no .env.'), { statusCode: 503 });
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

export async function enviarEmail({ to, subject, text, html }) {
  // Se GOOGLE_WEBHOOK_URL estiver configurado, envia via Gmail OAuth (rastreável na conta)
  if (process.env.GOOGLE_WEBHOOK_URL) {
    return workerPost('/email/enviar', { to, subject, body: text || html });
  }
  // Senão, via SMTP
  const t = getTransporter();
  return t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
}

// Lista threads (caixa de entrada) via worker Google
export async function listarEmails(q = '', max = 10) {
  if (!process.env.GOOGLE_WEBHOOK_URL) {
    throw Object.assign(new Error('Listagem de e-mail requer o worker Google. Configure GOOGLE_WEBHOOK_URL no .env.'), { statusCode: 503 });
  }
  return workerGet(`/email/listar?q=${encodeURIComponent(q)}&max=${max}`);
}

// Lê thread completa via worker Google
export async function lerThread(threadId) {
  if (!process.env.GOOGLE_WEBHOOK_URL) {
    throw Object.assign(new Error('Leitura de e-mail requer o worker Google. Configure GOOGLE_WEBHOOK_URL no .env.'), { statusCode: 503 });
  }
  return workerGet(`/email/${threadId}`);
}

// ----- helpers de chamada ao worker -----
async function workerGet(path) {
  const url = process.env.GOOGLE_WEBHOOK_URL.replace(/\/$/, '') + path;
  const r = await fetch(url, { headers: { 'X-Worker-Token': process.env.WORKER_API_TOKEN || '' } });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.erro || `worker ${r.status}`), { statusCode: r.status });
  return j;
}

async function workerPost(path, body) {
  const url = process.env.GOOGLE_WEBHOOK_URL.replace(/\/$/, '') + path;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Worker-Token': process.env.WORKER_API_TOKEN || '' },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.erro || `worker ${r.status}`), { statusCode: r.status });
  return j;
}
