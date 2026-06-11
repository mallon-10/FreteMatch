import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { processarMensagem } from '../services/bot.js';

const router = Router();
const prisma = new PrismaClient();

// POST /webhook/:slug — cada tenant tem seu próprio endpoint pelo slug
router.post('/:slug', async (req, res) => {
  res.sendStatus(200); // responde imediatamente para não dar timeout

  try {
    const { slug } = req.params;
    const body = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant?.ativo) return;

    // Ignora mensagens enviadas pela própria transportadora
    if (body.fromMe) return;

    const texto = body.text?.message || body.message;
    const telefone = body.phone;

    if (!texto || !telefone) return;

    await processarMensagem(tenant.id, telefone, texto);
  } catch (err) {
    console.error('Webhook erro:', err.message);
  }
});

export const rotasWebhook = router;
