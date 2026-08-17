// Fontes públicas brasileiras — cada função busca o dado em tempo real.
// Não há cache: cada chamada bate na fonte.

const U = (s) => encodeURIComponent(s);

// ---------- BrasilAPI ----------
export async function cnpj(numero) {
  const c = String(numero).replace(/\D/g, '');
  if (c.length !== 14) throw new Error('CNPJ deve ter 14 dígitos.');
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
  if (!r.ok) throw new Error(`BrasilAPI CNPJ ${r.status}`);
  return r.json();
}

export async function cep(numero) {
  const c = String(numero).replace(/\D/g, '');
  if (c.length !== 8) throw new Error('CEP deve ter 8 dígitos.');
  const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${c}`);
  if (!r.ok) throw new Error(`BrasilAPI CEP ${r.status}`);
  return r.json();
}

export async function feriados(ano) {
  const a = String(ano).replace(/\D/g, '');
  const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${a}`);
  if (!r.ok) throw new Error(`BrasilAPI Feriados ${r.status}`);
  return r.json();
}

export async function bancos() {
  const r = await fetch('https://brasilapi.com.br/api/banks/v1');
  if (!r.ok) throw new Error(`BrasilAPI Bancos ${r.status}`);
  return r.json();
}

// ---------- Banco Central (SGC / Olinda) ----------
export async function cotacao(moeda, data) {
  // moeda: USD, EUR, GBP... data: opcional MM-DD-YYYY (default hoje)
  const m = (moeda || 'USD').toUpperCase();
  const d = data || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPorData(moeda=@moeda,dataCotacao=@data)?@moeda='${m}'&@data='${d}'&$top=1&$format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`BCB PTAX ${r.status}`);
  const j = await r.json();
  const v = j.value?.[0];
  if (!v) throw new Error(`Sem cotação ${m} em ${d} (feriado/fim de semana).`);
  return { moeda: m, data: d, cotacaoCompra: v.cotacaoCompra, cotacaoVenda: v.cotacaoVenda };
}

export async function taxas() {
  // Taxa SELIC, CDI etc. via API pública do BCB
  const r = await fetch('https://olinda.bcb.gov.br/olinda/servico/TaxasJuros/versao/v2/odata/TaxasJurosMensalPorMes?$top=20&$format=json');
  if (!r.ok) throw new Error(`BCB Taxas ${r.status}`);
  return r.json();
}

// ---------- IBGE ----------
export async function estados() {
  const r = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados');
  if (!r.ok) throw new Error(`IBGE estados ${r.status}`);
  return r.json();
}

export async function municipios(uf) {
  const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${U(uf)}/municipios`);
  if (!r.ok) throw new Error(`IBGE municipios ${r.status}`);
  return r.json();
}

export async function populacao(uf) {
  const r = await fetch(`https://servicodados.ibge.gov.br/api/v3/agregados/659/periodos/2021/variaveis/9?localidades=N3[all]|N7[N6[${U(uf)}]]&format=json`);
  if (!r.ok) throw new Error(`IBGE populacao ${r.status}`);
  return r.json();
}

// ---------- GPS / Geolocalização ----------
// O dado de satélite sai do chip GPS do dispositivo; a API só enriquece.
export async function reverseGeocode(lat, lon) {
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=pt-BR`, {
    headers: { 'User-Agent': 'jarvis-admin/1.0' }
  });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  return r.json();
}

export async function rota(origemLat, origemLon, destLat, destLon) {
  // OSRM — rota e tempo estimado de carro
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${origemLon},${origemLat};${destLon},${destLat}?overview=false&steps=false`);
  if (!r.ok) throw new Error(`OSRM ${r.status}`);
  const j = await r.json();
  const rota = j.routes?.[0];
  if (!rota) throw new Error('Sem rota encontrada.');
  return { distanciaKm: (rota.distance / 1000).toFixed(2), duracaoMin: Math.round(rota.duration / 60) };
}

export async function ipGeo(ip) {
  // Fallback: geolocalização aproximada por IP
  const alvo = ip || '';
  const r = await fetch(`https://ipapi.co/${alvo}/json/`);
  if (!r.ok) throw new Error(`ipapi ${r.status}`);
  return r.json();
}

// ---------- NF-e ----------
// ATENÇÃO: NÃO existe API pública gratuita para consulta de NF-e por chave.
// O portal nacional (nfe.fazenda.gov.br) usa reCaptcha + exige certificado
// digital para a consulta oficial. Para NF-e real é necessário:
//  (a) certificado A1/A3 + integração com o serviço de distribuição de DFe
//      da Receita (NSU) — pesado, server-side com certificado instalado; OU
//  (b) provedor pago que encapsula isso (nfse.io, Tech4Flex, etc.).
// Aqui abaixo: se NFE_PROVIDER_URL estiver setado, repassa; senão, responde 503.
export async function nfe(chave) {
  const url = process.env.NFE_PROVIDER_URL;
  const token = process.env.NFE_PROVIDER_TOKEN;
  if (!url || !token) {
    const e = new Error('NF-e sem provedor configurado. Sem API pública gratuita — veja .env.example.');
    e.statusCode = 503;
    throw e;
  }
  const r = await fetch(`${url.replace(/\/$/, '')}/${chave}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`NF-e provedor ${r.status}`);
  return r.json();
}
