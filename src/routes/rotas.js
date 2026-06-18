import { Router } from 'express';

const router = Router();

// POST /rotas/otimizar — recebe endereços e retorna rota otimizada via Google Maps
router.post('/otimizar', async (req, res) => {
  try {
    const { origem, destinos } = req.body;

    if (!origem || !destinos || destinos.length < 1) {
      return res.status(400).json({ erro: 'origem e pelo menos 1 destino são obrigatórios' });
    }

    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) return res.status(500).json({ erro: 'Google Maps Key não configurada' });

    const waypoints = destinos.slice(0, -1); // todos menos o último
    const destino_final = destinos[destinos.length - 1];

    const waypointsParam = waypoints.length > 0
      ? `&waypoints=optimize:true|${waypoints.map(encodeURIComponent).join('|')}`
      : '';

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino_final)}${waypointsParam}&key=${apiKey}&language=pt-BR&region=BR`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status !== 'OK') {
      return res.status(400).json({ erro: `Google Maps: ${data.status} — ${data.error_message || ''}` });
    }

    const rota = data.routes[0];
    const ordem = rota.waypoint_order ?? [];

    // Reconstrói sequência otimizada
    const todosDestinos = [...destinos];
    const sequencia = [origem];
    if (waypoints.length > 0) {
      ordem.forEach(i => sequencia.push(waypoints[i]));
    }
    sequencia.push(destino_final);

    // Extrai distância e tempo de cada leg
    const legs = rota.legs.map((leg, i) => ({
      de: leg.start_address,
      para: leg.end_address,
      distancia: leg.distance.text,
      duracao: leg.duration.text,
      distancia_m: leg.distance.value,
      duracao_s: leg.duration.value,
    }));

    const totalDistancia = legs.reduce((acc, l) => acc + l.distancia_m, 0);
    const totalDuracao = legs.reduce((acc, l) => acc + l.duracao_s, 0);

    const horas = Math.floor(totalDuracao / 3600);
    const minutos = Math.floor((totalDuracao % 3600) / 60);
    const totalDuracaoTexto = horas > 0 ? `${horas}h ${minutos}min` : `${minutos} min`;
    const totalDistanciaTexto = totalDistancia >= 1000
      ? `${(totalDistancia / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
      : `${totalDistancia} m`;

    res.json({
      sequencia,
      legs,
      total_distancia: totalDistanciaTexto,
      total_duracao: totalDuracaoTexto,
      url_google_maps: `https://www.google.com/maps/dir/${sequencia.map(encodeURIComponent).join('/')}`,
      url_waze: `https://waze.com/ul?navigate=yes&q=${encodeURIComponent(sequencia[sequencia.length - 1])}`,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

export const rotasRotas = router;
