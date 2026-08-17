import * as src from './services/sources.js';

export async function despachar(texto) {
  const t = String(texto || '').toLowerCase();
  const cnpj = t.match(/cnpj[\s:]*([\d\.\/\-]+)/);
  if (cnpj) return { intencao: 'cnpj', dados: await src.cnpj(cnpj[1]) };
  const cep = t.match(/cep[\s:]*([\d\-]+)/);
  if (cep) return { intencao: 'cep', dados: await src.cep(cep[1]) };
  const moeda = t.match(/(cota[cç][aã]o|d[oó]lar|euro|libra)[\s:]*(usd|eur|gbp|dolar|euro|libra)?/);
  if (moeda) {
    const map = { dolar: 'USD', 'dólar': 'USD', usd: 'USD', euro: 'EUR', libra: 'GBP', gbp: 'GBP' };
    return { intencao: 'cotacao', dados: await src.cotacao(map[moeda[2] || 'usd'] || 'USD') };
  }
  const feriado = t.match(/feriados?[\s:]*([\d]{4})?/);
  if (feriado) return { intencao: 'feriados', dados: await src.feriados(feriado[1] || new Date().getFullYear()) };
  const chave = t.match(/nfe[\s:]*([\d]{44})/);
  if (chave) return { intencao: 'nfe', dados: await src.nfe(chave[1]) };
  const geo = t.match(/gps[\s:]*(-?[\d\.]+)[,\s]+(-?[\d\.]+)/);
  if (geo) return { intencao: 'gps', dados: await src.reverseGeocode(geo[1], geo[2]) };
  return { intencao: 'nao_reconhecida', mensagem: 'Não consegui identificar CNPJ, CEP, cotação, feriado, NF-e ou GPS no texto.', texto };
}
