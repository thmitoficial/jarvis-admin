import { Router } from 'express';
import * as src from './services/sources.js';
import { enviarEmail } from './services/email.js';
import { listarEventos, criarEvento } from './services/agenda.js';
import { despachar } from './dispatcher.js';

export const router = Router();

function wrap(fn) {
  return async (req, res) => {
    try {
      const out = await fn(req);
      res.json({ ok: true, dados: out });
    } catch (e) {
      res.status(e.statusCode || 500).json({ ok: false, erro: e.message });
    }
  };
}

router.get('/admin/empresa/:cnpj', wrap(r => src.cnpj(r.params.cnpj)));
router.get('/admin/cep/:cep', wrap(r => src.cep(r.params.cep)));
router.get('/admin/cotacao/:moeda', wrap(r => src.cotacao(r.params.moeda, r.query.data)));
router.get('/admin/taxas', wrap(_ => src.taxas()));
router.get('/admin/estados', wrap(_ => src.estados()));
router.get('/admin/estados/:uf/municipios', wrap(r => src.municipios(r.params.uf)));
router.get('/admin/estados/:uf/populacao', wrap(r => src.populacao(r.params.uf)));
router.get('/admin/feriados/:ano', wrap(r => src.feriados(r.params.ano)));
router.get('/admin/bancos', wrap(_ => src.bancos()));
router.get('/admin/nfe/:chave', wrap(r => src.nfe(r.params.chave)));
router.get('/admin/geo/reverse', wrap(r => src.reverseGeocode(r.query.lat, r.query.lon)));
router.get('/admin/geo/rota', wrap(r => src.rota(r.query.origLat, r.query.origLon, r.query.destLat, r.query.destLon)));
router.get('/admin/geo/ip', wrap(r => src.ipGeo(r.query.ip)));
router.post('/admin/email/enviar', wrap(r => enviarEmail(r.body)));
router.get('/admin/agenda', wrap(r => listarEventos({ de: r.query.de, ate: r.query.ate })));
router.post('/admin/agenda', wrap(r => criarEvento(r.body)));
router.post('/admin/chat', wrap(r => despachar(r.body.texto)));
