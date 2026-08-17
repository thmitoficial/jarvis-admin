export async function listarEventos({ de, ate }) {
  const url = process.env.GOOGLE_WEBHOOK_URL;
  if (!url) throw Object.assign(new Error('Agenda sem webhook Google configurado. Ver README.'), { statusCode: 503 });
  const r = await fetch(`${url.replace(/\/$/, '')}/agenda?de=${encodeURIComponent(de || '')}&ate=${encodeURIComponent(ate || '')}`);
  if (!r.ok) throw new Error(`Agenda webhook ${r.status}`);
  return r.json();
}
export async function criarEvento(dados) {
  const url = process.env.GOOGLE_WEBHOOK_URL;
  if (!url) throw Object.assign(new Error('Agenda sem webhook Google configurado. Ver README.'), { statusCode: 503 });
  const r = await fetch(`${url.replace(/\/$/, '')}/agenda`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
  if (!r.ok) throw new Error(`Agenda webhook ${r.status}`);
  return r.json();
}
