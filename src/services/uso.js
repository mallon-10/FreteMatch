import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function verificarLimite(tenantId) {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plano: true },
  });

  const uso = await prisma.usoMensal.findUnique({
    where: { tenant_id_ano_mes: { tenant_id: tenantId, ano, mes } },
  });

  const totalAtual = uso?.total_cotacoes ?? 0;
  const limite = tenant.plano.limite_mensal;
  const percentual = totalAtual / limite;

  if (percentual >= 1.1) {
    throw new Error(`Limite do plano ultrapassado (${totalAtual}/${limite} cotações). Entre em contato para fazer upgrade.`);
  }

  return { totalAtual, limite, percentual };
}

export async function incrementarUso(tenantId) {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  await prisma.usoMensal.upsert({
    where: { tenant_id_ano_mes: { tenant_id: tenantId, ano, mes } },
    update: { total_cotacoes: { increment: 1 } },
    create: { tenant_id: tenantId, ano, mes, total_cotacoes: 1 },
  });
}
