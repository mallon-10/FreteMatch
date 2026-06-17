import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /tenants/me — dados do tenant autenticado
router.get('/me', async (req, res) => {
  const { tenant_id } = req.usuario;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenant_id },
    include: { plano: true, tabelas_frete: { include: { faixas_peso: true, fatores_distancia: true, prazos: true } } },
  });
  res.json(tenant);
});

// GET /tenants/tabela — tabela de frete ativa
router.get('/tabela', async (req, res) => {
  const { tenant_id } = req.usuario;
  const tabela = await prisma.tabelaFrete.findFirst({
    where: { tenant_id, ativa: true },
    include: { faixas_peso: true, fatores_distancia: true, prazos: true },
  });
  if (!tabela) return res.status(404).json({ erro: 'Nenhuma tabela ativa' });
  res.json(tabela);
});

// POST /tenants/tabela — cria nova tabela de frete
router.post('/tabela', async (req, res) => {
  const { tenant_id } = req.usuario;
  const { nome, faixas_peso, fatores_distancia, prazos } = req.body;

  const tabela = await prisma.tabelaFrete.create({
    data: {
      tenant_id,
      nome,
      faixas_peso: { create: faixas_peso },
      fatores_distancia: { create: fatores_distancia },
      prazos: { create: prazos },
    },
    include: { faixas_peso: true, fatores_distancia: true, prazos: true },
  });

  res.status(201).json(tabela);
});

export const rotasTenants = router;
