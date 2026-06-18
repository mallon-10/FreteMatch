import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { rotasAuth } from './routes/auth.js';
import { rotasCotacao } from './routes/cotacoes.js';
import { rotasWebhook } from './routes/webhook.js';
import { rotasTenants } from './routes/tenants.js';
import { rotasAdmin } from './routes/admin.js';
import { rotasRotas } from './routes/rotas.js';
import { autenticar } from './middlewares/autenticar.js';

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// Rotas públicas
app.use('/auth', rotasAuth);
app.use('/webhook', rotasWebhook);

// Rotas autenticadas
app.use('/cotacoes', autenticar, rotasCotacao);
app.use('/tenants', autenticar, rotasTenants);
app.use('/admin', autenticar, rotasAdmin);
app.use('/rotas', autenticar, rotasRotas);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rota temporária de setup — rodar uma vez e remover
app.post('/setup/seed', async (_req, res) => {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execFile);
    const { stdout, stderr } = await exec('node', ['prisma/seed.js'], {
      cwd: process.cwd(),
      env: process.env,
      timeout: 60000,
    });
    res.json({ ok: true, stdout, stderr });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message, stderr: err.stderr });
  }
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  console.log(`FreteMatch backend rodando na porta ${PORTA}`);
});
