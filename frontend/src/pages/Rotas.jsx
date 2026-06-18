import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

function buscarEnderecoPorCep(cep) {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) return Promise.reject(new Error('CEP inválido'));
  return fetch(`https://viacep.com.br/ws/${limpo}/json/`)
    .then(r => r.json())
    .then(d => {
      if (d.erro) throw new Error('CEP não encontrado');
      return `${d.logradouro}, ${d.localidade} - ${d.uf}, Brasil`;
    });
}

function formatCep(v) {
  const n = v.replace(/\D/g, '').slice(0, 8);
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
}

export default function Rotas() {
  const navigate = useNavigate();
  const [cepOrigem, setCepOrigem] = useState('');
  const [destinos, setDestinos] = useState(['', '']);
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState('');

  function adicionarDestino() {
    if (destinos.length < 8) setDestinos([...destinos, '']);
  }

  function removerDestino(i) {
    if (destinos.length > 1) setDestinos(destinos.filter((_, idx) => idx !== i));
  }

  function atualizarDestino(i, val) {
    const novos = [...destinos];
    novos[i] = formatCep(val);
    setDestinos(novos);
  }

  async function calcular(e) {
    e.preventDefault();
    setErro('');
    setResultado(null);
    setCalculando(true);

    try {
      const cepsFilled = destinos.filter(d => d.replace(/\D/g, '').length === 8);
      if (!cepOrigem || cepOrigem.replace(/\D/g, '').length !== 8) throw new Error('CEP de origem inválido');
      if (cepsFilled.length < 1) throw new Error('Adicione pelo menos 1 destino com CEP completo');

      // Resolve todos os CEPs em endereços via ViaCEP (no browser)
      const [endOrigem, ...endsDestinos] = await Promise.all([
        buscarEnderecoPorCep(cepOrigem),
        ...cepsFilled.map(buscarEnderecoPorCep),
      ]);

      const { data } = await api.post('/rotas/otimizar', {
        origem: endOrigem,
        destinos: endsDestinos,
      });

      setResultado(data);
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

  const mapUrl = resultado
    ? `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_KEY}&origin=${encodeURIComponent(resultado.sequencia[0])}&destination=${encodeURIComponent(resultado.sequencia[resultado.sequencia.length - 1])}&waypoints=${resultado.sequencia.slice(1, -1).map(encodeURIComponent).join('|')}&language=pt-BR`
    : null;

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

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

        {/* Formulário */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Planejar rota de entrega</p>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>Digite os CEPs — a rota será otimizada automaticamente</p>

          <form onSubmit={calcular}>
            {/* Origem */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                📍 CEP de origem (coleta)
              </label>
              <input
                value={cepOrigem}
                onChange={e => setCepOrigem(formatCep(e.target.value))}
                placeholder="00000-000"
                required
                style={{ width: '100%', maxWidth: 300, backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Destinos */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 10 }}>
                🏁 CEPs de entrega
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {destinos.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: '#64748b', width: 24, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                    <input
                      value={d}
                      onChange={e => atualizarDestino(i, e.target.value)}
                      placeholder="00000-000"
                      style={{ width: 300, backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {destinos.length > 1 && (
                      <button type="button" onClick={() => removerDestino(i)} style={{ fontSize: 16, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {destinos.length < 8 && (
                <button type="button" onClick={adicionarDestino} style={{ marginTop: 10, fontSize: 13, color: '#3b82f6', background: 'none', border: '1px dashed #3b82f6', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
                  + Adicionar destino
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={calculando}
              style={{ backgroundColor: calculando ? '#334155' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: calculando ? 'not-allowed' : 'pointer' }}
            >
              {calculando ? 'Calculando rota...' : 'Otimizar rota'}
            </button>
          </form>

          {erro && (
            <div style={{ marginTop: 16, backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#fca5a5' }}>
              {erro}
            </div>
          )}
        </div>

        {/* Resultado */}
        {resultado && (
          <>
            {/* Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Distância total</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{resultado.total_distancia}</p>
              </div>
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Tempo estimado</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{resultado.total_duracao}</p>
              </div>
            </div>

            {/* Sequência de paradas */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Sequência otimizada</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {resultado.legs.map((leg, i) => (
                  <div key={i}>
                    {i === 0 && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>S</div>
                          <div style={{ width: 2, height: 40, backgroundColor: '#334155' }} />
                        </div>
                        <div style={{ paddingTop: 6 }}>
                          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Saída</p>
                          <p style={{ fontSize: 13, color: '#f1f5f9' }}>{leg.de}</p>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: i === resultado.legs.length - 1 ? '#16a34a' : '#0f172a', border: `2px solid ${i === resultado.legs.length - 1 ? '#16a34a' : '#475569'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: i === resultado.legs.length - 1 ? '#fff' : '#94a3b8' }}>{i + 1}</div>
                        {i < resultado.legs.length - 1 && <div style={{ width: 2, height: 40, backgroundColor: '#334155' }} />}
                      </div>
                      <div style={{ paddingTop: 6, flex: 1 }}>
                        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                          {i === resultado.legs.length - 1 ? 'Destino final' : `Parada ${i + 1}`}
                          {' · '}{leg.distancia} · {leg.duracao}
                        </p>
                        <p style={{ fontSize: 13, color: '#f1f5f9', marginBottom: 24 }}>{leg.para}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mapa */}
            {mapUrl && (
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
                <iframe
                  src={mapUrl}
                  width="100%"
                  height="420"
                  style={{ border: 'none', display: 'block' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}

            {/* Botões */}
            <div style={{ display: 'flex', gap: 12 }}>
              <a
                href={resultado.url_google_maps}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, color: '#f1f5f9', textDecoration: 'none' }}
              >
                🗺️ Abrir no Google Maps
              </a>
              <a
                href={`https://waze.com/ul?navigate=yes&q=${encodeURIComponent(resultado.sequencia[resultado.sequencia.length - 1])}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, color: '#f1f5f9', textDecoration: 'none' }}
              >
                🚗 Abrir no Waze
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
