# Jarvis Admin — Assistente administrativo

API REST em Node.js/Express que entrega **dados públicos brasileiros em tempo real** e integrações de e-mail e agenda. Cada chamada bate na fonte original — sem cache, sem dado fabricado.

## Fontes reais

| Domínio | Fonte pública | Endpoint |
|---|---|---|
| Empresa (CNPJ) | BrasilAPI → Receita | `GET /admin/empresa/:cnpj` |
| Endereço (CEP) | BrasilAPI → Correios | `GET /admin/cep/:cep` |
| Cotação USD/EUR/GBP | Banco Central (Olinda PTAX) | `GET /admin/cotacao/:moeda?data=MM-DD-AAAA` |
| Taxas SELIC/CDI | Banco Central | `GET /admin/taxas` |
| Estados / Municípios | IBGE | `GET /admin/estados`, `/admin/estados/:uf/municipios` |
| População | IBGE Censo | `GET /admin/estados/:uf/populacao` |
| Feriados nacionais | BrasilAPI | `GET /admin/feriados/:ano` |
| Bancos | BrasilAPI | `GET /admin/bancos` |
| GPS reverse geocode | OpenStreetMap Nominatim | `GET /admin/geo/reverse?lat=&lon=` |
| Rota e tempo | OSRM | `GET /admin/geo/rota?origLat=&origLon=&destLat=&destLon=` |
| Geolocalização por IP | ipapi.co | `GET /admin/geo/ip?ip=` |
| Chat (linguagem natural) | `POST /admin/chat` `{ "texto": "..." }` |

## Sobre GPS em tempo real

O dado bruto de satélite sai do **chip GPS do dispositivo** (celular/notebook), não de uma API server-side. O cliente (app/web) lê `navigator.geolocation` e envia `lat,lon` para `/admin/geo/reverse`.

## Sobre NF-e (importante)

**Não existe API pública gratuita** para consulta de NF-e por chave de acesso. Configure um provedor pago em `NFE_PROVIDER_URL`/`NFE_PROVIDER_TOKEN`, ou instale certificado A1/A3 no servidor e use a API de distribuição de DFe da Receita por NSU. Sem nada configurado, `/admin/nfe/:chave` retorna `503`.

## E-mail (SMTP)

Configure `SMTP_*` no `.env` (Gmail com app password, SendGrid, SES, Mailtrap). `POST /admin/email/enviar` com `{ to, subject, text, html }`.

## Agenda / Calendário

Dados de calendário são privados. Configure um webhook Google autenticado em `GOOGLE_WEBHOOK_URL`, ou troque `src/services/agenda.js` por uma integração CalDAV.

## Rodar local

```bash
npm install
cp .env.example .env
npm start
```

## Deploy

Funciona em qualquer Node 18+. Render, Railway ou Vercel (`vercel.json` já incluso).

## Estrutura

```
src/
  server.js
  routes.js
  dispatcher.js
  services/
    sources.js
    email.js
    agenda.js
```
