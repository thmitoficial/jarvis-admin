import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router } from './routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/', router);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`jarvis-admin rodando na porta ${port}`));

export default app;
