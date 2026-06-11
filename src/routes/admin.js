import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { apenasAdmin } from '../middlewares/autenticar.js';

const router = Router();
const prisma = new PrismaClient();

router.use(apenasAdmin);

// GET /admin/tenants — lista todos os tenants com consumo do mês
router.get('/tenants', async (req, res) => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const tenants = await prisma.tenant.findMany({
    include: {
      plano: true,
      uso_mensal: {
        where: { ano, mes },
      },
    },
    orderBy: { criado_em: 'desc' },
  });

  const resultado = tenants.map((t) => ({
    id: t.id,
    nome: t.nome,
    cnpj: t.cnpj,
    email: t.email,
    ativo: t.ativo,
    plano: t.plano.nome,
    preco_centavos: t.plano.preco_centavos,
    limite_mensal: t.plano.limite_mensal,
    uso_mes: t.uso_mensal[0]?.total_cotacoes ?? 0,
    percentual: Math.round(((t.uso_mensal[0]?.total_cotacoes ?? 0) / t.plano.limite_mensal) * 100),
    criado_em: t.criado_em,
  }));

  const receita_estimada = resultado.reduce((acc, t) => acc + (t.ativo ? t.preco_centavos : 0), 0);

  res.json({ tenants: resultado, receita_estimada_centavos: receita_estimada });
});

// POST /admin/tenants — cria novo tenant
router.post('/tenants', async (req, res) => {
  const { nome, cnpj, email, telefone_responsavel, slug, plano_id, usuario_email, usuario_senha } = req.body;

  const senha_hash = await bcrypt.hash(usuario_senha, 10);

  const tenant = await prisma.tenant.create({
    data: {
      nome,
      cnpj,
      email,
      telefone_responsavel,
      slug,
      plano_id,
      usuarios: {
        create: {
          nome,
          email: usuario_email,
          senha_hash,
          perfil: 'ADMIN_TENANT',
        },
      },
    },
    include: { plano: true },
  });

  res.status(201).json(tenant);
});

// PATCH /admin/tenants/:id — ativa/desativa ou muda plano
router.patch('/tenants/:id', async (req, res) => {
  const { id } = req.params;
  const { ativo, plano_id } = req.body;

  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      ...(ativo !== undefined ? { ativo } : {}),
      ...(plano_id ? { plano_id } : {}),
    },
  });

  res.json(tenant);
});

// GET /admin/planos — lista planos disponíveis
router.get('/planos', async (_req, res) => {
  const planos = await prisma.plano.findMany({ orderBy: { preco_centavos: 'asc' } });
  res.json(planos);
});

// POST /admin/planos — cria novo plano
router.post('/planos', async (req, res) => {
  const { nome, limite_mensal, preco_centavos } = req.body;
  const plano = await prisma.plano.create({ data: { nome, limite_mensal, preco_centavos } });
  res.status(201).json(plano);
});

export const rotasAdmin = router;
