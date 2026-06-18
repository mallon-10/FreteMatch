import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

function carregarGoogleMaps(apiKey) {
  return new Promise((resolve) => {
    if (window.google?.maps?.DirectionsService) return resolve(window.google.maps);
    // Remove script anterior se existir
    const old = document.getElementById('gmaps-script');
    if (old) old.remove();
    const script = document.createElement('script');
    script.id = 'gmaps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    document.head.appendChild(script);
  });
}

function criarIconeCustom(maps, cor, numero) {
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: cor,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2.5,
    scale: 16,
    labelOrigin: new maps.Point(0, 0),
  };
}

function MapaRota({ sequencia, cargas }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!sequencia || sequencia.length < 2 || !ref.current) return;

    carregarGoogleMaps(GOOGLE_KEY).then((maps) => {
      const mapStyles = [
        { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#475569' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ];

      const map = new maps.Map(ref.current, {
        zoom: 5,
        center: { lat: -22, lng: -46 },
        mapTypeId: 'roadmap',
        styles: mapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      const coletas = new Set(cargas.map(c => c.end_origem));
      const entregas = new Set(cargas.map(c => c.end_destino));

      const directionsService = new maps.DirectionsService();
      const directionsRenderer = new maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
      });

      const waypoints = sequencia.slice(1, -1).map(address => ({
        location: address,
        stopover: true,
      }));

      directionsService.route(
        {
          origin: sequencia[0],
          destination: sequencia[sequencia.length - 1],
          waypoints,
          travelMode: maps.TravelMode.DRIVING,
          region: 'BR',
        },
        (result, status) => {
          if (status !== 'OK') {
            console.error('Directions error:', status);
            return;
          }
          directionsRenderer.setDirections(result);

          // Extrai coordenadas reais dos legs retornados pelo Google
          const legs = result.routes[0].legs;
          // Pontos na ordem: origem do leg[0], depois destino de cada leg
          const pontos = [legs[0].start_location, ...legs.map(l => l.end_location)];

          pontos.forEach((pos, i) => {
            const address = sequencia[i];
            const isColeta = coletas.has(address);
            const isEntrega = entregas.has(address);
            const isAmbos = isColeta && isEntrega;

            let cor, titulo;
            if (isAmbos)        { cor = '#f59e0b'; titulo = 'Coleta + Entrega'; }
            else if (isColeta)  { cor = '#22c55e'; titulo = 'Coleta'; }
            else                { cor = '#ef4444'; titulo = 'Entrega'; }

            new maps.Marker({
              position: pos,
              map,
              title: `${titulo} — Parada ${i + 1}`,
              label: {
                text: String(i + 1),
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold',
              },
              icon: criarIconeCustom(maps, cor, i + 1),
              zIndex: 100 + i,
            });
          });
        }
      );
    });
  }, [sequencia, cargas]);

  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #334155', display: 'flex', gap: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Legenda:</span>
        {[['#22c55e', 'Coleta'], ['#ef4444', 'Entrega'], ['#f59e0b', 'Coleta + Entrega']].map(([cor, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: cor, border: '2px solid white', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
      </div>
      <div ref={ref} style={{ width: '100%', height: 460 }} />
    </div>
  );
}

function formatCep(v) {
  const n = v.replace(/\D/g, '').slice(0, 8);
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
}

function formatBRL(centavos) {
  return `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cargaVazia() {
  return { cep_origem: '', cep_destino: '', peso_kg: '', comp_cm: '', larg_cm: '', alt_cm: '', valor_nf: '' };
}

async function buscarEnderecoPorCep(cep) {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) throw new Error(`CEP ${cep} inválido`);
  const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
  const d = await r.json();
  if (d.erro) throw new Error(`CEP ${cep} não encontrado`);
  const partes = [];
  if (d.logradouro) partes.push(d.logradouro);
  if (d.bairro) partes.push(d.bairro);
  partes.push(`${d.localidade} - ${d.uf}`);
  partes.push('Brasil');
  return { endereco: partes.join(', '), uf: d.uf, cidade: d.localidade };
}

export default function Rotas() {
  const navigate = useNavigate();
  const [cargas, setCargas] = useState([cargaVazia(), cargaVazia()]);
  const [cargasComEnderecos, setCargasComEnderecos] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState('');

  function atualizarCarga(i, campo, val) {
    const novas = [...cargas];
    if (campo === 'cep_origem' || campo === 'cep_destino') val = formatCep(val);
    novas[i] = { ...novas[i], [campo]: val };
    setCargas(novas);
  }

  function adicionarCarga() {
    if (cargas.length < 8) setCargas([...cargas, cargaVazia()]);
  }

  function removerCarga(i) {
    if (cargas.length > 1) setCargas(cargas.filter((_, idx) => idx !== i));
  }

  async function calcular(e) {
    e.preventDefault();
    setErro('');
    setResultado(null);
    setCalculando(true);

    try {
      const cargasValidas = cargas.filter(
        c => c.cep_origem.replace(/\D/g, '').length === 8 &&
             c.cep_destino.replace(/\D/g, '').length === 8 &&
             c.peso_kg
      );
      if (cargasValidas.length === 0) throw new Error('Preencha ao menos uma carga com CEPs e peso');

      // Resolve todos os CEPs únicos de uma vez
      const cepsUnicos = [...new Set(
        cargasValidas.flatMap(c => [c.cep_origem, c.cep_destino])
      )];
      const resultsCep = await Promise.all(cepsUnicos.map(buscarEnderecoPorCep));
      const mapaCep = Object.fromEntries(cepsUnicos.map((cep, i) => [cep, resultsCep[i]]));

      // Monta lista de todos endereços únicos para a rota
      const enderecosCarga = cargasValidas.map(c => ({
        ...c,
        end_origem: mapaCep[c.cep_origem].endereco,
        end_destino: mapaCep[c.cep_destino].endereco,
        uf_destino: mapaCep[c.cep_destino].uf,
        cidade_destino: mapaCep[c.cep_destino].cidade,
      }));

      const { data } = await api.post('/rotas/otimizar-cargas', { cargas: enderecosCarga });
      setResultado(data);
      setCargasComEnderecos(enderecosCarga);
    } catch (err) {
      setErro(err.response?.data?.erro || err.message || 'Erro ao calcular rota.');
    } finally {
      setCalculando(false);
    }
  }

  function sair() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>FreteMatch</span>
          <nav style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/')} style={{ fontSize: 14, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8 }}>
              Dashboard
            </button>
            <button style={{ fontSize: 14, color: '#f1f5f9', background: '#334155', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, fontWeight: 600 }}>
              Rotas
            </button>
          </nav>
        </div>
        <button onClick={sair} style={{ fontSize: 14, color: '#94a3b8', background: 'none', border: '1px solid #334155', borderRadius: 8, padding: '6px 16px', cursor: 'pointer' }}>
          Sair
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        <form onSubmit={calcular}>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>Planejar rota de entrega</p>
              <p style={{ fontSize: 12, color: '#64748b' }}>Cada carga tem sua própria origem e destino. A rota será otimizada automaticamente.</p>
            </div>
            <button
              type="submit"
              disabled={calculando}
              style={{ backgroundColor: calculando ? '#334155' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: calculando ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
            >
              {calculando ? 'Calculando...' : 'Otimizar rota'}
            </button>
          </div>

          {/* Cargas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cargas.map((c, i) => (
              <div key={i} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Carga {i + 1}</span>
                  {cargas.length > 1 && (
                    <button type="button" onClick={() => removerCarga(i)} style={{ fontSize: 12, color: '#ef4444', background: 'none', border: '1px solid #7f1d1d', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                      Remover
                    </button>
                  )}
                </div>

                {/* CEPs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5 }}>📍 CEP origem (coleta)</label>
                    <input value={c.cep_origem} onChange={e => atualizarCarga(i, 'cep_origem', e.target.value)} placeholder="00000-000"
                      style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5 }}>🏁 CEP destino (entrega)</label>
                    <input value={c.cep_destino} onChange={e => atualizarCarga(i, 'cep_destino', e.target.value)} placeholder="00000-000"
                      style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                {/* Peso + Dimensões + NF */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5 }}>Peso (kg)</label>
                    <input type="number" step="0.1" min="0.1" value={c.peso_kg} onChange={e => atualizarCarga(i, 'peso_kg', e.target.value)} placeholder="Ex: 40"
                      style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5 }}>Comp. (cm)</label>
                    <input type="number" min="1" value={c.comp_cm} onChange={e => atualizarCarga(i, 'comp_cm', e.target.value)} placeholder="Ex: 100"
                      style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5 }}>Larg. (cm)</label>
                    <input type="number" min="1" value={c.larg_cm} onChange={e => atualizarCarga(i, 'larg_cm', e.target.value)} placeholder="Ex: 80"
                      style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5 }}>Alt. (cm)</label>
                    <input type="number" min="1" value={c.alt_cm} onChange={e => atualizarCarga(i, 'alt_cm', e.target.value)} placeholder="Ex: 60"
                      style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5 }}>Valor NF (R$)</label>
                    <input type="number" step="0.01" min="0" value={c.valor_nf} onChange={e => atualizarCarga(i, 'valor_nf', e.target.value)} placeholder="Ex: 2500"
                      style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {cargas.length < 8 && (
            <button type="button" onClick={adicionarCarga} style={{ marginTop: 10, fontSize: 13, color: '#3b82f6', background: 'none', border: '1px dashed #3b82f6', borderRadius: 8, padding: '8px 18px', cursor: 'pointer' }}>
              + Adicionar carga
            </button>
          )}
        </form>

        {erro && (
          <div style={{ marginTop: 16, backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#fca5a5' }}>
            {erro}
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div style={{ marginTop: 32 }}>

            {/* Totais gerais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Distância total', val: resultado.total_distancia },
                { label: 'Tempo estimado', val: resultado.total_duracao },
                { label: 'Total frete', val: formatBRL(resultado.cargas.reduce((s, c) => s + c.valor_total_centavos, 0)) },
              ].map(({ label, val }) => (
                <div key={label} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Sequência otimizada */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Sequência otimizada</p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {resultado.legs.map((leg, i) => (
                  <div key={i}>
                    {i === 0 && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>S</div>
                          <div style={{ width: 2, height: 36, backgroundColor: '#334155' }} />
                        </div>
                        <div style={{ paddingTop: 6, paddingBottom: 16 }}>
                          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Saída</p>
                          <p style={{ fontSize: 13, color: '#f1f5f9' }}>{leg.de}</p>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: i === resultado.legs.length - 1 ? '#16a34a' : '#0f172a', border: `2px solid ${i === resultado.legs.length - 1 ? '#16a34a' : '#475569'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: i === resultado.legs.length - 1 ? '#fff' : '#94a3b8' }}>{i + 1}</div>
                        {i < resultado.legs.length - 1 && <div style={{ width: 2, height: 36, backgroundColor: '#334155' }} />}
                      </div>
                      <div style={{ paddingTop: 6, paddingBottom: 16, flex: 1 }}>
                        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                          {i === resultado.legs.length - 1 ? 'Destino final' : `Parada ${i + 1}`}
                          {' · '}{leg.distancia} · {leg.duracao}
                        </p>
                        <p style={{ fontSize: 13, color: '#f1f5f9' }}>{leg.para}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detalhamento por carga */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Custo por carga</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {resultado.cargas.map((c, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Carga {i + 1}</span>
                        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 10 }}>{c.origem_cidade} → {c.destino_cidade}</span>
                        <span style={{ fontSize: 11, color: '#475569', marginLeft: 10 }}>{c.trecho_distancia} · {c.trecho_duracao}</span>
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>{formatBRL(c.valor_total_centavos)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[
                        ['Peso taxado', `${c.peso_taxado_kg.toFixed(1)} kg`],
                        ['Frete peso', formatBRL(c.frete_peso_centavos)],
                        ['Ad valorem', formatBRL(c.ad_valorem_centavos)],
                        ['GRIS', formatBRL(c.gris_centavos)],
                        ['Pedágio', formatBRL(c.pedagio_centavos)],
                        ['Despacho', formatBRL(c.taxa_despacho_centavos)],
                      ].map(([label, val]) => (
                        <div key={label} style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{label}</p>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{val}</p>
                        </div>
                      ))}
                    </div>
                    {c.peso_cubado_kg > c.peso_real_kg && (
                      <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 8 }}>
                        ⚠️ Peso cubado ({c.peso_cubado_kg.toFixed(1)} kg) maior que peso real ({c.peso_real_kg.toFixed(1)} kg) — cobrado o cubado
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Mapa */}
            {resultado.sequencia?.length >= 2 && (
              <MapaRota sequencia={resultado.sequencia} cargas={cargasComEnderecos} />
            )}

            {/* Botões */}
            <div style={{ display: 'flex', gap: 12 }}>
              <a href={resultado.url_google_maps} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, color: '#f1f5f9', textDecoration: 'none' }}>
                🗺️ Abrir no Google Maps
              </a>
              <a href={`https://waze.com/ul?navigate=yes&q=${encodeURIComponent(resultado.sequencia[resultado.sequencia.length - 1])}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, color: '#f1f5f9', textDecoration: 'none' }}>
                🚗 Abrir no Waze
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
