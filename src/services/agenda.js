// AGENDA / CALENDÁRIO
// Dados de calendário são privados (não "públicos"). Existem dois caminhos:
//
//  (1) OAuth Google (recomendado) — conecte Gmail + Google Calendar no
//      painel de conectores deste ambiente. O agente consegue então ler e
//      criar eventos reais da sua agenda. Para a API REST deste projeto,
//      você expõe essas ações via webhook autenticado que aponta para um
//      pequeno worker segurando o refresh token (não embarcar token Google
//      no .env de um servidor público).
//
//  (2) CalDAV — se você usa agenda iCloud/Fastmail/Nextcloud, plugue a URL
//      CalDAV + credenciais no .env e troque a implementação abaixo por
//      uma lib tipo 'caldav-client'.
//
// Por padrão este módulo chama GOOGLE_WEBHOOK_URL se definido; senão 503.

export async function listarEventos({ de, ate }) {
  const url = process.env.GOOGLE_WEBHOOK_URL;
  if (!url) throw Object.assign(new Error('Agenda sem webhook Google configurado. Ver README.'), { statusCode: 503 });
  const r = await fetch(`${url.replace(/\/$/, '')}/agenda?de=${encodeURIComponent(de || '')}&ate=${encodeURIComponent(ate || '')}`, {
    headers: { 'X-Worker-Token': process.env.WORKER_API_TOKEN || '' }
  });
  if (!r.ok) throw new Error(`Agenda webhook ${r.status}`);
  return r.json();
}

export async function criarEvento(dados) {
  const url = process.env.GOOGLE_WEBHOOK_URL;
  if (!url) throw Object.assign(new Error('Agenda sem webhook Google configurado. Ver README.'), { statusCode: 503 });
  const r = await fetch(`${url.replace(/\/$/, '')}/agenda`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Worker-Token': process.env.WORKER_API_TOKEN || '' },
    body: JSON.stringify(dados)
  });
  if (!r.ok) throw new Error(`Agenda webhook ${r.status}`);
  return r.json();
}
