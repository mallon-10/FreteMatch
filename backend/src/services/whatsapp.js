import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getCredenciais(tenantId) {
  const instancia = await prisma.instanciaZapi.findUnique({
    where: { tenant_id: tenantId },
  });
  if (!instancia) throw new Error('Instância Z-API não configurada para este tenant');
  return instancia;
}

export async function enviarMensagem(tenantId, telefone, texto) {
  const { instance_id, token, client_token } = await getCredenciais(tenantId);
  const url = `https://api.z-api.io/instances/${instance_id}/token/${token}/send-text`;

  const resposta = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': client_token,
    },
    body: JSON.stringify({ phone: telefone, message: texto }),
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Z-API erro ${resposta.status}: ${erro}`);
  }

  return resposta.json();
}

export async function notificarResponsavel(tenant, cotacao) {
  const valor = (cotacao.valor_centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const mensagem =
    `🚚 *Nova cotação confirmada!*\n\n` +
    `Cliente: ${cotacao.cliente?.telefone ?? 'Não identificado'}\n` +
    `Origem: ${cotacao.cep_origem} — ${cotacao.cidade_origem ?? ''}\n` +
    `Destino: ${cotacao.cep_destino} — ${cotacao.cidade_destino ?? ''}\n` +
    `Carga: ${cotacao.tipo_carga}\n` +
    `Peso: ${(cotacao.peso_g / 1000).toFixed(2)} kg\n` +
    `Valor: ${valor}\n` +
    `Prazo: ${cotacao.prazo_dias} dias úteis`;

  await enviarMensagem(tenant.id, tenant.telefone_responsavel, mensagem);
}
