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
| Chat (linguagem natural) | despachador local | `POST /admin/chat` `{ "texto": "..." }` |

## Sobre GPS em tempo real

O dado bruto de satélite sai do **chip GPS do dispositivo** (celular/notebook), não de uma API server-side. O fluxo correto é: o cliente (app/web) lê `navigator.geolocation` e envia `lat,lon` para `/admin/geo/reverse`, que devolve o endereço. Para rota, envie origem+destino para `/admin/geo/rota`.

## Sobre NF-e (importante)

**Não existe API pública gratuita** para consulta de NF-e por chave de acesso. O portal nacional `nfe.fazenda.gov.br` usa reCaptcha e exige certificado digital A1/A3 para a consulta oficial. Para NF-e real neste projeto:

1. **Certificado próprio (server-side)** — instale um certificado A1/A3 no servidor e use a API de distribuição de DFe da Receita por NSU. Pesado, exige infraestrutura.
2. **Provedor pago** — preencha `NFE_PROVIDER_URL` e `NFE_PROVIDER_TOKEN` no `.env` com um serviço como nfse.io, Tech4Flex, etc. O endpoint `/admin/nfe/:chave` repassa automaticamente.

Sem nada configurado, `/admin/nfe/:chave` retorna `503` com a explicação.

## E-mail (duas vias)

**Via 1 — SMTP direto (envio apenas):** configure `SMTP_*` no `.env` (Gmail com app password, SendGrid, SES, Mailtrap). `POST /admin/email/enviar` com `{ to, subject, text, html }`. Funciona sem o worker Google.

**Via 2 — Gmail OAuth via worker Google (recomendado):** leitura + envio, rastreável na sua conta. Endpoints:
- `GET /admin/email/listar?q=&max=` — lista threads (caixa de entrada)
- `GET /admin/email/:threadId` — thread completa (corpo dos e-mails)
- `POST /admin/email/enviar` — envia via Gmail (quando `GOOGLE_WEBHOOK_URL` configurado)

## Agenda / E-mail via worker Google (OAuth)

Dados de calendário e e-mail são **privados** — não há API pública. A solução é o **worker Google** na pasta `google-worker/`: um app Node.js mínimo que segura o refresh token OAuth e expõe endpoints seguros para a API jarvis-admin.

### Arquitetura

```
[App Web / Voz] → [API jarvis-admin :3000] → [Worker Google :8787] → [Google Calendar/Gmail API]
                          ↑                              ↑
                          └── X-Worker-Token ───────────┘
```

### Configuração do worker (uma vez)

1. **Criar credenciais no Google Cloud Console**
   - Acesse [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
   - Crie um OAuth Client ID tipo **Web application**
   - Authorized redirect URIs: `http://localhost:8787/oauth/callback`
   - Ative as APIs: Google Calendar API + Gmail API
   - Configure a tela de consentimento (tipo "External", adicione seu e-mail como test user)

2. **Configurar o worker**
   ```bash
   cd google-worker
   npm install
   cp .env.example .env
   # Edite .env: cole GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, gere WORKER_API_TOKEN forte
   ```

3. **Autorizar (uma vez só)**
   ```bash
   npm start
   # No navegador: http://localhost:8787/oauth/start
   # Autorize com sua conta Google. O refresh token é exibido no console.
   # Copie para o .env do worker: GOOGLE_REFRESH_TOKEN=...
   # Reinicie o worker.
   ```

4. **Conectar a API jarvis-admin**
   - No `.env` da API principal, preencha:
     ```
     GOOGLE_WEBHOOK_URL=http://localhost:8787
     WORKER_API_TOKEN=mesmo-token-do-worker
     ```

### Segurança

- O worker valida `X-Worker-Token` em todos os endpoints de leitura/escrita.
- O refresh token fica apenas no `.env` do worker — nunca exposto na API.
- Access tokens (~1h) são renovados automaticamente pelo worker.
- O worker não tem CORS aberto — só a API jarvis-admin chama.
- Em produção, rode o worker em rede privada ou behind-a-proxy com TLS.

## App de voz (web/PWA)

A pasta `web/` contém um app web PWA com interface escura, navegação por voz (Web Speech API, pt-BR) e visualização intuitiva de todas as fontes.

### Rodar o app

```bash
# Sirva a pasta web/ com qualquer servidor estático:
npx serve web/
# ou
python3 -m http.server 8080 --directory web/
```

Abra no Chrome/Edge (suporte completo à Web Speech API). Configure a URL da API em ⚙ Configurações (padrão `http://localhost:3000`).

### Comandos de voz suportados

- "ler e-mails" / "ver caixa de entrada"
- "próximos eventos" / "ver agenda"
- "escrever e-mail"
- "cotação do dólar" / "cotação do euro"
- "consultar CNPJ 11222333000181"
- "consultar CEP 01001000"
- "feriados"
- "onde estou" / "minha localização" (GPS do dispositivo)
- "fontes" (status das integrações)

Toque no microfone para falar, ou ative o **modo contínuo** para comandos sequenciais sem clicar de novo.

## Rodar local

```bash
npm install
cp .env.example .env   # edite conforme necessário
npm start
```

## Deploy

Funciona em qualquer Node 18+. Exemplos:

- **Render** — new > Web Service > repo > build `npm install` > start `npm start`.
- **Railway** — new from repo, detecta Node automaticamente.
- **Vercel** — `vercel.json` já incluso. Importe o repo no dashboard Vercel.

## Estrutura

```
src/
  server.js              # setup Express
  routes.js              # todos os endpoints
  dispatcher.js          # roteamento de linguagem natural
  services/
    sources.js           # BrasilAPI, BCB, IBGE, OSM, OSRM, NF-e
    email.js             # Nodemailer SMTP + worker Google
    agenda.js            # webhook Google Calendar
google-worker/
  src/
    server.js            # setup Express do worker
    google-client.js     # OAuth flow + refresh token automático
    routes.js            # /agenda, /email/*, /oauth/*
web/
  index.html            # PWA de voz
  manifest.json         # PWA manifest
```

## Nota sobre os projetos de referência

- **Jarvis.cx** — referência de produto (chat multi-canal, helpdesk). Esta API entrega o backend administrativo que um produto assim consumiria.
- **Iris (Avinash Biradar)** — assistente desktop com voz/biometria em Python. Esta API é a contraparte server-side: o cliente Iris pode chamar `/admin/*` para enriquecer respostas com dado real.
- **Oreate** — workspace de IA criativa. Fora do escopo administrativo; mencionado como referência visual de produto.
