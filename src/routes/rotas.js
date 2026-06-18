import { Router } from 'express';
import { calcularFrete } from '../services/calcularFrete.js';

const router = Router();

async function chamarGoogleMaps(apiKey, enderecos) {
  // Monta rota com todos os endereços únicos
  // Primeiro é origem, último é destino, do meio são waypoints otimizáveis
  const origem = enderecos[0];
  const destino = enderecos[enderecos.length - 1];
  const waypoints = enderecos.slice(1, -1);

  const waypointsParam = waypoints.length > 0
    ? `&waypoints=optimize:true|${waypoints.map(encodeURIComponent).join('|')}`
    : '';

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}${waypointsParam}&key=${apiKey}&language=pt-BR&region=BR`;

  const resp = await fetch(url);
  const data = await resp.json();
  if (data.status !== 'OK') {
    throw new Error(`Google Maps: ${data.status} — ${data.error_message || ''}`);
  }
  return data.routes[0];
}

function calcularPesoCubado(comp_cm, larg_cm, alt_cm) {
  if (!comp_cm || !larg_cm || !alt_cm) return 0;
  return (parseFloat(comp_cm) * parseFloat(larg_cm) * parseFloat(alt_cm)) / 6000;
}

function formatarDuracao(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function formatarDistancia(metros) {
  return metros >= 1000
    ? `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
    : `${metros} m`;
}

// POST /rotas/otimizar-cargas
// Recebe array de cargas, cada uma com origem/destino/peso/dimensões/NF
// Otimiza a rota e calcula o frete de cada carga proporcional ao trecho
router.post('/otimizar-cargas', async (req, res) => {
  try {
    const { cargas } = req.body;
    const tenantId = req.usuario.tenant_id;

    if (!cargas || cargas.length === 0) {
      return res.status(400).json({ erro: 'Informe ao menos uma carga' });
    }

    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) return res.status(500).json({ erro: 'Google Maps Key não configurada' });

    // Coleta todos os endereços únicos que aparecem na rota
    const todosEnderecos = [];
    const seenEnderecos = new Set();
    for (const c of cargas) {
      if (!seenEnderecos.has(c.end_origem)) { todosEnderecos.push(c.end_origem); seenEnderecos.add(c.end_origem); }
      if (!seenEnderecos.has(c.end_destino)) { todosEnderecos.push(c.end_destino); seenEnderecos.add(c.end_destino); }
    }

    // Chama Google Maps com todos os pontos únicos
    const rota = await chamarGoogleMaps(apiKey, todosEnderecos);
    const ordem = rota.waypoint_order ?? [];

    // Reconstrói sequência real de paradas na ordem otimizada
    const intermediarios = todosEnderecos.slice(1, -1);
    const sequenciaOrdenada = [
      todosEnderecos[0],
      ...ordem.map(i => intermediarios[i]),
      todosEnderecos[todosEnderecos.length - 1],
    ];

    // Mapeia endereço → posição na sequência
    const posicaoNaRota = {};
    sequenciaOrdenada.forEach((end, i) => { posicaoNaRota[end] = i; });

    // Extrai legs (trecho entre cada par de paradas consecutivas)
    const legs = rota.legs.map((leg, i) => ({
      de: leg.start_address,
      para: leg.end_address,
      distancia: leg.distance.text,
      duracao: leg.duration.text,
      distancia_m: leg.distance.value,
      duracao_s: leg.duration.value,
    }));

    const totalDistanciaM = legs.reduce((s, l) => s + l.distancia_m, 0);
    const totalDuracaoS = legs.reduce((s, l) => s + l.duracao_s, 0);

    // Calcula distância acumulada até cada parada
    // distancia_ate[i] = soma dos legs[0..i-1]
    const distanciaAcumulada = [0];
    for (const leg of legs) {
      distanciaAcumulada.push(distanciaAcumulada[distanciaAcumulada.length - 1] + leg.distancia_m);
    }

    // Calcula frete de cada carga
    const resultadoCargas = await Promise.all(cargas.map(async (c) => {
      const pesoRealKg = parseFloat(c.peso_kg) || 0;
      const pesoCubadoKg = calcularPesoCubado(c.comp_cm, c.larg_cm, c.alt_cm);
      const pesoTaxadoKg = Math.max(pesoRealKg, pesoCubadoKg);
      const pesoTaxadoG = Math.round(pesoTaxadoKg * 1000);
      const valorNfCentavos = c.valor_nf ? Math.round(parseFloat(c.valor_nf) * 100) : 0;

      // Trecho percorrido por esta carga
      const posOrigem = posicaoNaRota[c.end_origem] ?? 0;
      const posDestino = posicaoNaRota[c.end_destino] ?? legs.length;
      const trechoDistanciaM = distanciaAcumulada[posDestino] - distanciaAcumulada[posOrigem];
      const trechoLegs = legs.slice(posOrigem, posDestino);
      const trechoDuracaoS = trechoLegs.reduce((s, l) => s + l.duracao_s, 0);

      // Proporção do trecho em relação à rota total (para rateio de pedágio/despacho)
      const proporcaoTrecho = totalDistanciaM > 0 ? trechoDistanciaM / totalDistanciaM : 1;

      // Calcula frete base pela tabela TodoBrasil
      let freteBase;
      try {
        freteBase = await calcularFrete({
          tenantId,
          pesoG: pesoTaxadoG,
          ufDestino: c.uf_destino,
          valorNfCentavos,
        });
      } catch {
        // Se não encontrar tabela para a UF, usa cálculo simplificado
        freteBase = null;
      }

      let fretePesoCentavos = 0;
      let adValoremCentavos = 0;
      let grisCentavos = 0;
      let pedagogioCentavos = 0;
      let taxaDespachoCentavos = 0;

      if (freteBase) {
        fretePesoCentavos = freteBase.frete_peso_centavos;
        adValoremCentavos = freteBase.ad_valorem_centavos;
        grisCentavos = freteBase.gris_centavos;
        // Pedágio e despacho rateados pelo trecho percorrido
        pedagogioCentavos = Math.round(freteBase.pedagio_centavos * proporcaoTrecho);
        taxaDespachoCentavos = Math.round(freteBase.taxa_despacho_centavos * proporcaoTrecho);
      } else {
        // Fallback: seguro 0,3% do valor NF + R$3,50/100kg de pedágio proporcional
        adValoremCentavos = valorNfCentavos > 0 ? Math.round(valorNfCentavos * 0.003) : 0;
        const fracoes = Math.ceil(pesoTaxadoG / 100000);
        pedagogioCentavos = Math.round(fracoes * 350 * proporcaoTrecho);
      }

      const valorTotalCentavos = fretePesoCentavos + adValoremCentavos + grisCentavos + pedagogioCentavos + taxaDespachoCentavos;

      return {
        origem_cidade: c.cidade_destino ? c.end_origem.split(',').slice(-2, -1)[0]?.trim() : c.end_origem,
        destino_cidade: c.cidade_destino || c.end_destino,
        trecho_distancia: formatarDistancia(trechoDistanciaM),
        trecho_duracao: formatarDuracao(trechoDuracaoS),
        trecho_distancia_m: trechoDistanciaM,
        peso_real_kg: pesoRealKg,
        peso_cubado_kg: pesoCubadoKg,
        peso_taxado_kg: pesoTaxadoKg,
        frete_peso_centavos: fretePesoCentavos,
        ad_valorem_centavos: adValoremCentavos,
        gris_centavos: grisCentavos,
        pedagio_centavos: pedagogioCentavos,
        taxa_despacho_centavos: taxaDespachoCentavos,
        valor_total_centavos: valorTotalCentavos,
        sem_tabela: !freteBase,
      };
    }));

    res.json({
      sequencia: sequenciaOrdenada,
      legs,
      total_distancia: formatarDistancia(totalDistanciaM),
      total_duracao: formatarDuracao(totalDuracaoS),
      cargas: resultadoCargas,
      url_google_maps: `https://www.google.com/maps/dir/${sequenciaOrdenada.map(encodeURIComponent).join('/')}`,
      url_waze: `https://waze.com/ul?navigate=yes&q=${encodeURIComponent(sequenciaOrdenada[sequenciaOrdenada.length - 1])}`,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /rotas/otimizar — endpoint legado simples (sem cargas)
router.post('/otimizar', async (req, res) => {
  try {
    const { origem, destinos } = req.body;
    if (!origem || !destinos || destinos.length < 1) {
      return res.status(400).json({ erro: 'origem e pelo menos 1 destino são obrigatórios' });
    }
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) return res.status(500).json({ erro: 'Google Maps Key não configurada' });

    const destino_final = destinos[0];
    const waypoints = destinos.slice(1);
    const waypointsParam = waypoints.length > 0
      ? `&waypoints=optimize:true|${waypoints.map(encodeURIComponent).join('|')}`
      : '';
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino_final)}${waypointsParam}&key=${apiKey}&language=pt-BR&region=BR`;

    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status !== 'OK') return res.status(400).json({ erro: `Google Maps: ${data.status}` });

    const rota = data.routes[0];
    const ordem = rota.waypoint_order ?? [];
    const intermediarios = destinos.slice(1);
    const sequencia = [origem, ...ordem.map(i => intermediarios[i]), destino_final];

    const legs = rota.legs.map(leg => ({
      de: leg.start_address,
      para: leg.end_address,
      distancia: leg.distance.text,
      duracao: leg.duration.text,
      distancia_m: leg.distance.value,
      duracao_s: leg.duration.value,
    }));

    const totalDistanciaM = legs.reduce((s, l) => s + l.distancia_m, 0);
    const totalDuracaoS = legs.reduce((s, l) => s + l.duracao_s, 0);

    res.json({
      sequencia,
      legs,
      total_distancia: formatarDistancia(totalDistanciaM),
      total_duracao: formatarDuracao(totalDuracaoS),
      url_google_maps: `https://www.google.com/maps/dir/${sequencia.map(encodeURIComponent).join('/')}`,
      url_waze: `https://waze.com/ul?navigate=yes&q=${encodeURIComponent(sequencia[sequencia.length - 1])}`,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

export const rotasRotas = router;
