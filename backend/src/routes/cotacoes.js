import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { buscarCep, calcularFrete } from '../services/calcularFrete.js';

const router = Router();
const prisma = new PrismaClient();

// GET /cotacoes — lista cotações do tenant autenticado
router.get('/', async (req, res) => {
  const { tenant_id } = req.usuario;
  const { pagina = 1, por_pagina = 20, status, mes, ano } = req.query;

  const agora = new Date();
  const filtroAno = ano ? parseInt(ano) : agora.getFullYear();
  const filtroMes = mes ? parseInt(mes) : agora.getMonth() + 1;

  const inicio = new Date(filtroAno, filtroMes - 1, 1);
  const fim = new Date(filtroAno, filtroMes, 1);

  const where = {
    tenant_id,
    criado_em: { gte: inicio, lt: fim },
    ...(status ? { status } : {}),
  };

  const [cotacoes, total] = await Promise.all([
    prisma.cotacao.findMany({
      where,
      orderBy: { criado_em: 'desc' },
      skip: (parseInt(pagina) - 1) * parseInt(por_pagina),
      take: parseInt(por_pagina),
      include: { cliente: true },
    }),
    prisma.cotacao.count({ where }),
  ]);

  res.json({ cotacoes, total, pagina: parseInt(pagina), por_pagina: parseInt(por_pagina) });
});

// GET /cotacoes/resumo — dados para o dashboard
router.get('/resumo', async (req, res) => {
  const { tenant_id } = req.usuario;
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);

  const [uso, tenant, porDia, porStatus] = await Promise.all([
    prisma.usoMensal.findUnique({
      where: { tenant_id_ano_mes: { tenant_id, ano, mes } },
    }),
    prisma.tenant.findUnique({
      where: { id: tenant_id },
      include: { plano: true },
    }),
    prisma.$queryRaw`
      SELECT DATE(criado_em) as dia, COUNT(*) as total
      FROM "Cotacao"
      WHERE tenant_id = ${tenant_id}
        AND criado_em >= ${inicio}
        AND criado_em < ${fim}
      GROUP BY DATE(criado_em)
      ORDER BY dia ASC
    `,
    prisma.cotacao.groupBy({
      by: ['status'],
      where: { tenant_id, criado_em: { gte: inicio, lt: fim } },
      _count: true,
    }),
  ]);

  const totalCotacoes = uso?.total_cotacoes ?? 0;
  const limite = tenant.plano.limite_mensal;

  res.json({
    total_cotacoes: totalCotacoes,
    limite_plano: limite,
    percentual_uso: Math.round((totalCotacoes / limite) * 100),
    alerta_80: totalCotacoes / limite >= 0.8,
    plano: tenant.plano.nome,
    volume_diario: porDia,
    por_status: porStatus,
  });
});

// POST /cotacoes/calcular — calcula frete sem salvar (para testar)
router.post('/calcular', async (req, res) => {
  try {
    const { tenant_id } = req.usuario;
    const { cep_destino, peso_kg, valor_nf, nome_regiao } = req.body;

    if (!cep_destino || !peso_kg) {
      return res.status(400).json({ erro: 'cep_destino e peso_kg são obrigatórios' });
    }

    const dadosCep = await buscarCep(cep_destino);
    const pesoG = Math.round(parseFloat(peso_kg) * 1000);
    const valorNfCentavos = valor_nf ? Math.round(parseFloat(valor_nf) * 100) : 0;

    const resultado = await calcularFrete({
      tenantId: tenant_id,
      pesoG,
      ufDestino: dadosCep.uf,
      nomeRegiao: nome_regiao,
      valorNfCentavos,
    });

    res.json({
      destino: { cep: dadosCep.cep, cidade: dadosCep.cidade, uf: dadosCep.uf },
      peso_kg: parseFloat(peso_kg),
      regiao: resultado.regiao_nome,
      prazo: resultado.resumo.prazo,
      breakdown: {
        frete_peso: resultado.resumo.frete_peso,
        ad_valorem: resultado.resumo.ad_valorem,
        gris: resultado.resumo.gris,
        pedagio: resultado.resumo.pedagio,
        taxa_despacho: resultado.resumo.taxa_despacho,
      },
      total: resultado.resumo.total,
    });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

export const rotasCotacao = router;
