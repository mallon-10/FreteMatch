import 'dotenv/config';
import express from 'express';
import { rotasAuth } from './routes/auth.js';
import { rotasCotacao } from './routes/cotacoes.js';
import { rotasWebhook } from './routes/webhook.js';
import { rotasTenants } from './routes/tenants.js';
import { rotasAdmin } from './routes/admin.js';
import { autenticar } from './middlewares/autenticar.js';

const app = express();
app.use(express.json());

// Rotas públicas
app.use('/auth', rotasAuth);
app.use('/webhook', rotasWebhook);

// Rotas autenticadas
app.use('/cotacoes', autenticar, rotasCotacao);
app.use('/tenants', autenticar, rotasTenants);
app.use('/admin', autenticar, rotasAdmin);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  console.log(`FreteMatch backend rodando na porta ${PORTA}`);
});
