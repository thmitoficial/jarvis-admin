import 'dotenv/config';
import express from 'express';
import { router } from './routes.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(router);

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`google-worker rodando na porta ${port}`));

export default app;
