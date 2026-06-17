import { PrismaClient } from '@prisma/client';
import { buscarCep, calcularFrete } from './calcularFrete.js';
import { verificarLimite, incrementarUso } from './uso.js';
import { enviarMensagem, notificarResponsavel } from './whatsapp.js';

const prisma = new PrismaClient();

// Sessões em memória: Map<`${tenantId}:${telefone}`, estado>
const sessoes = new Map();

function chave(tenantId, telefone) {
  return `${tenantId}:${telefone}`;
}

function getSessao(tenantId, telefone) {
  const k = chave(tenantId, telefone);
  if (!sessoes.has(k)) {
    sessoes.set(k, { etapa: 'inicio', dados: {} });
  }
  return sessoes.get(k);
}

function setSessao(tenantId, telefone, estado) {
  sessoes.set(chave(tenantId, telefone), estado);
}

function limparSessao(tenantId, telefone) {
  sessoes.delete(chave(tenantId, telefone));
}

const TIPO_CARGA_MAP = {
  '1': 'DOCUMENTO',
  '2': 'ENCOMENDA',
  '3': 'FRACIONADA',
  '4': 'LOTACAO',
};

export async function processarMensagem(tenantId, telefone, texto) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plano: true },
  });

  if (!tenant?.ativo) return;

  const msg = texto.trim();
  const sessao = getSessao(tenantId, telefone);

  // Garante ou cria o cliente
  let cliente = await prisma.clienteTenant.findUnique({
    where: { tenant_id_telefone: { tenant_id: tenantId, telefone } },
  });
  if (!cliente) {
    cliente = await prisma.clienteTenant.create({
      data: { tenant_id: tenantId, telefone },
    });
  }

  async function responder(texto) {
    await enviarMensagem(tenantId, telefone, texto);
  }

  // ── ETAPA: INICIO ─────────────────────────────────────────────────────────
  if (sessao.etapa === 'inicio') {
    await responder(
      `Olá! 👋 Bem-vindo à *${tenant.nome}*.\n\nVou te ajudar a cotar seu frete rapidinho. Para começar, me informe o *CEP de origem* da carga.`
    );
    setSessao(tenantId, telefone, { etapa: 'aguardando_cep_origem', dados: {} });
    return;
  }

  // ── ETAPA: CEP ORIGEM ─────────────────────────────────────────────────────
  if (sessao.etapa === 'aguardando_cep_origem') {
    try {
      const dados = await buscarCep(msg);
      sessao.dados.cep_origem = msg.replace(/\D/g, '');
      sessao.dados.cidade_origem = dados.localidade;
      sessao.dados.estado_origem = dados.uf;
      setSessao(tenantId, telefone, { ...sessao, etapa: 'aguardando_cep_destino' });
      await responder(`📍 Origem: *${dados.localidade} - ${dados.uf}*\n\nAgora me informe o *CEP de destino*.`);
    } catch {
      await responder('CEP de origem não encontrado. Por favor, informe um CEP válido (ex: 01310-100).');
    }
    return;
  }

  // ── ETAPA: CEP DESTINO ────────────────────────────────────────────────────
  if (sessao.etapa === 'aguardando_cep_destino') {
    try {
      const dados = await buscarCep(msg);
      sessao.dados.cep_destino = msg.replace(/\D/g, '');
      sessao.dados.cidade_destino = dados.localidade;
      sessao.dados.estado_destino = dados.uf;
      setSessao(tenantId, telefone, { ...sessao, etapa: 'aguardando_tipo_carga' });
      await responder(
        `📍 Destino: *${dados.localidade} - ${dados.uf}*\n\n` +
        `Qual o tipo de carga?\n\n` +
        `1️⃣ Documento\n2️⃣ Encomenda\n3️⃣ Carga Fracionada\n4️⃣ Lotação\n\n` +
        `Responda com o número da opção.`
      );
    } catch {
      await responder('CEP de destino não encontrado. Por favor, informe um CEP válido.');
    }
    return;
  }

  // ── ETAPA: TIPO DE CARGA ──────────────────────────────────────────────────
  if (sessao.etapa === 'aguardando_tipo_carga') {
    const tipo = TIPO_CARGA_MAP[msg];
    if (!tipo) {
      await responder('Opção inválida. Responda com 1, 2, 3 ou 4.');
      return;
    }
    sessao.dados.tipo_carga = tipo;
    setSessao(tenantId, telefone, { ...sessao, etapa: 'aguardando_peso' });
    await responder('Qual o *peso* da carga em kg? (ex: 2.5)');
    return;
  }

  // ── ETAPA: PESO ───────────────────────────────────────────────────────────
  if (sessao.etapa === 'aguardando_peso') {
    const pesoKg = parseFloat(msg.replace(',', '.'));
    if (isNaN(pesoKg) || pesoKg <= 0) {
      await responder('Peso inválido. Informe apenas o número em kg (ex: 2.5).');
      return;
    }
    sessao.dados.peso_g = Math.round(pesoKg * 1000);
    setSessao(tenantId, telefone, { ...sessao, etapa: 'aguardando_dimensoes' });
    await responder(
      'Informe as *dimensões* da carga em cm no formato:\n*altura x largura x comprimento*\n\nEx: 30x20x40\n\nOu responda *pular* se não souber.'
    );
    return;
  }

  // ── ETAPA: DIMENSÕES ──────────────────────────────────────────────────────
  if (sessao.etapa === 'aguardando_dimensoes') {
    if (msg.toLowerCase() !== 'pular') {
      const partes = msg.toLowerCase().replace(/\s/g, '').split('x');
      if (partes.length === 3 && partes.every((p) => !isNaN(parseInt(p)))) {
        sessao.dados.altura_cm = parseInt(partes[0]);
        sessao.dados.largura_cm = parseInt(partes[1]);
        sessao.dados.comprimento_cm = parseInt(partes[2]);
      } else {
        await responder('Formato inválido. Use o formato altura x largura x comprimento (ex: 30x20x40) ou responda *pular*.');
        return;
      }
    }

    // Calcula frete
    try {
      await verificarLimite(tenantId);

      const resultado = await calcularFrete({
        tenantId,
        pesoG: sessao.dados.peso_g,
        cepDestino: sessao.dados.cep_destino,
        tipoCarga: sessao.dados.tipo_carga,
      });

      sessao.dados.valor_centavos = resultado.valorCentavos;
      sessao.dados.prazo_dias = resultado.prazoDias;
      setSessao(tenantId, telefone, { ...sessao, etapa: 'aguardando_confirmacao' });

      const valor = (resultado.valorCentavos / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

      await responder(
        `✅ *Cotação calculada!*\n\n` +
        `🗺️ ${sessao.dados.cidade_origem}/${sessao.dados.estado_origem} → ${resultado.cidadeDestino}/${resultado.estadoDestino}\n` +
        `📦 ${sessao.dados.tipo_carga} — ${(sessao.dados.peso_g / 1000).toFixed(2)} kg\n` +
        `💰 Valor: *${valor}*\n` +
        `⏱️ Prazo: *${resultado.prazoDias} dias úteis*\n\n` +
        `Deseja confirmar o frete? Responda *SIM* para confirmar ou *NÃO* para cancelar.`
      );
    } catch (err) {
      limparSessao(tenantId, telefone);
      await responder(`Não foi possível calcular o frete: ${err.message}`);
    }
    return;
  }

  // ── ETAPA: CONFIRMAÇÃO ────────────────────────────────────────────────────
  if (sessao.etapa === 'aguardando_confirmacao') {
    const resposta = msg.toLowerCase();

    if (resposta === 'sim' || resposta === 's') {
      const cotacao = await prisma.cotacao.create({
        data: {
          tenant_id: tenantId,
          cliente_id: cliente.id,
          cep_origem: sessao.dados.cep_origem,
          cep_destino: sessao.dados.cep_destino,
          cidade_origem: sessao.dados.cidade_origem,
          cidade_destino: sessao.dados.cidade_destino,
          estado_origem: sessao.dados.estado_origem,
          estado_destino: sessao.dados.estado_destino,
          tipo_carga: sessao.dados.tipo_carga,
          peso_g: sessao.dados.peso_g,
          altura_cm: sessao.dados.altura_cm ?? null,
          largura_cm: sessao.dados.largura_cm ?? null,
          comprimento_cm: sessao.dados.comprimento_cm ?? null,
          valor_centavos: sessao.dados.valor_centavos,
          prazo_dias: sessao.dados.prazo_dias,
          status: 'CONFIRMADA',
        },
        include: { cliente: true },
      });

      await incrementarUso(tenantId);
      limparSessao(tenantId, telefone);

      await responder(
        `🎉 Frete confirmado! Em breve nossa equipe entrará em contato para os próximos passos.\n\nObrigado por escolher a *${tenant.nome}*!`
      );

      await notificarResponsavel(tenant, cotacao);

    } else if (resposta === 'não' || resposta === 'nao' || resposta === 'n') {
      await prisma.cotacao.create({
        data: {
          tenant_id: tenantId,
          cliente_id: cliente.id,
          cep_origem: sessao.dados.cep_origem,
          cep_destino: sessao.dados.cep_destino,
          cidade_origem: sessao.dados.cidade_origem,
          cidade_destino: sessao.dados.cidade_destino,
          estado_origem: sessao.dados.estado_origem,
          estado_destino: sessao.dados.estado_destino,
          tipo_carga: sessao.dados.tipo_carga,
          peso_g: sessao.dados.peso_g,
          valor_centavos: sessao.dados.valor_centavos,
          prazo_dias: sessao.dados.prazo_dias,
          status: 'CANCELADA',
        },
      });

      await incrementarUso(tenantId);
      limparSessao(tenantId, telefone);
      await responder('Tudo bem! Se precisar de uma nova cotação, é só mandar mensagem. 😊');

    } else {
      await responder('Responda *SIM* para confirmar ou *NÃO* para cancelar.');
    }
    return;
  }

  // Mensagem fora de fluxo — reinicia
  limparSessao(tenantId, telefone);
  await processarMensagem(tenantId, telefone, texto);
}
