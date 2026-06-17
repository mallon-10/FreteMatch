import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function buscarCep(cep) {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) throw new Error('CEP inválido');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`, { signal: controller.signal });
    const data = await res.json();
    if (data.erro) throw new Error('CEP não encontrado');
    return { cep: data.cep, cidade: data.localidade, uf: data.uf, bairro: data.bairro };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Timeout ao buscar CEP — tente novamente');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calcula frete com base na tabela real (FP por faixa + ad valorem + GRIS + pedágio)
 *
 * @param {string} tenantId
 * @param {number} pesoG - peso em gramas
 * @param {string} ufDestino - UF de destino (ex: "SP")
 * @param {string} [nomeRegiao] - nome da região (ex: "São Paulo", "Interior 1") — opcional
 * @param {number} [valorNfCentavos] - valor da NF em centavos para calcular ad valorem
 */
export async function calcularFrete({ tenantId, pesoG, ufDestino, nomeRegiao, valorNfCentavos }) {
  const tabela = await prisma.tabelaFrete.findFirst({
    where: { tenant_id: tenantId, ativa: true },
    include: { regioes: { include: { faixas_peso: true } } },
  });

  if (!tabela) throw new Error('Nenhuma tabela de frete ativa encontrada');

  // Encontra região: match exato UF+nome > primeira da UF (capital)
  let regiao = null;
  if (nomeRegiao) {
    regiao = tabela.regioes.find(
      (r) => r.uf === ufDestino && r.nome.toLowerCase() === nomeRegiao.toLowerCase()
    );
  }
  if (!regiao) {
    regiao = tabela.regioes.find((r) => r.uf === ufDestino);
  }
  if (!regiao) throw new Error(`Região não encontrada para UF: ${ufDestino}`);

  // Faixa de peso
  const faixas = regiao.faixas_peso.sort((a, b) => a.peso_min_g - b.peso_min_g);
  const faixa = faixas.find(
    (f) => pesoG >= f.peso_min_g && (f.peso_max_g === -1 || pesoG <= f.peso_max_g)
  );

  let fretePesoCentavos;
  if (faixa) {
    fretePesoCentavos = faixa.preco_centavos;
  } else {
    // Peso acima de todas as faixas — usa última + excedente por kg
    const ultima = faixas[faixas.length - 1];
    const kgExcedente = Math.ceil((pesoG - ultima.peso_max_g) / 1000);
    fretePesoCentavos = ultima.preco_centavos + kgExcedente * (regiao.preco_kg_excedente_centavos ?? 0);
  }

  // Ad valorem
  let adValoremCentavos = 0;
  if (valorNfCentavos > 0) {
    adValoremCentavos = Math.round(valorNfCentavos * (regiao.ad_valorem_percentual / 100));
    const min = regiao.ad_valorem_minimo_centavos ?? 0;
    if (adValoremCentavos < min) adValoremCentavos = min;
  }

  // GRIS
  let grisCentavos = 0;
  if (valorNfCentavos > 0) {
    const perc = regiao.gris_percentual ?? tabela.gris_percentual_padrao ?? 0;
    grisCentavos = Math.round(valorNfCentavos * (perc / 100));
    const min = regiao.gris_minimo_centavos ?? tabela.gris_minimo_centavos ?? 0;
    if (grisCentavos < min) grisCentavos = min;
  }

  // Pedágio (por fração de 100kg)
  let pedagogioCentavos = 0;
  if (tabela.pedagio_por_100kg_centavos) {
    const fracoes = Math.ceil(pesoG / 100000);
    pedagogioCentavos = fracoes * tabela.pedagio_por_100kg_centavos;
  }

  const taxaDespachoCentavos = tabela.taxa_despacho_centavos ?? 0;
  const totalCentavos = fretePesoCentavos + adValoremCentavos + grisCentavos + pedagogioCentavos + taxaDespachoCentavos;

  return {
    regiao_id: regiao.id,
    regiao_nome: `${regiao.nome} (${regiao.uf})`,
    prazo_min_dias: regiao.prazo_min_dias,
    prazo_max_dias: regiao.prazo_max_dias,
    prazo_dias: regiao.prazo_max_dias,
    frete_peso_centavos: fretePesoCentavos,
    ad_valorem_centavos: adValoremCentavos,
    gris_centavos: grisCentavos,
    pedagio_centavos: pedagogioCentavos,
    taxa_despacho_centavos: taxaDespachoCentavos,
    valor_total_centavos: totalCentavos,
    resumo: {
      frete_peso: `R$ ${(fretePesoCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ad_valorem: `R$ ${(adValoremCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      gris: `R$ ${(grisCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      pedagio: `R$ ${(pedagogioCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      taxa_despacho: `R$ ${(taxaDespachoCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      total: `R$ ${(totalCentavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      prazo: `${regiao.prazo_min_dias} a ${regiao.prazo_max_dias} dias úteis`,
    },
  };
}
