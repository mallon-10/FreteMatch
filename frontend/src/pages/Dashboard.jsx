import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api';

export default function Dashboard() {
  const [resumo, setResumo] = useState(null);
  const [cotacoes, setCotacoes] = useState([]);
  const [form, setForm] = useState({ cep_destino: '', peso_kg: '', valor_nf: '' });
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [erroCalc, setErroCalc] = useState('');

  useEffect(() => {
    api.get('/cotacoes/resumo').then((r) => setResumo(r.data)).catch(() => {});
    api.get('/cotacoes?por_pagina=10').then((r) => setCotacoes(r.data.cotacoes)).catch(() => {});
  }, []);

  async function calcular(e) {
    e.preventDefault();
    setErroCalc('');
    setResultado(null);
    setCalculando(true);
    try {
      const { data } = await api.post('/cotacoes/calcular', form);
      setResultado(data);
    } catch (err) {
      setErroCalc(err.response?.data?.erro || 'Erro ao calcular.');
    } finally {
      setCalculando(false);
    }
  }

  function sair() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  function formatCep(v) {
    const n = v.replace(/\D/g, '').slice(0, 8);
    return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
  }

  const percentual = resumo?.percentual_uso ?? 0;
  const corBarra = percentual >= 80 ? '#ef4444' : '#3b82f6';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>FreteMatch</span>
        <button
          onClick={sair}
          style={{ fontSize: 14, color: '#94a3b8', background: 'none', border: '1px solid #334155', borderRadius: 8, padding: '6px 16px', cursor: 'pointer' }}
        >
          Sair
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            {
              label: 'Cotações este mês',
              value: resumo?.total_cotacoes ?? '—',
              sub: `Plano ${resumo?.plano ?? '...'}`,
              color: '#f1f5f9',
            },
            {
              label: 'Limite do plano',
              value: resumo?.limite_plano ?? '—',
              sub: 'cotações/mês',
              color: '#f1f5f9',
            },
            {
              label: 'Uso atual',
              value: resumo ? `${percentual}%` : '—',
              sub: percentual >= 80 ? '⚠️ Próximo do limite' : 'Dentro do limite',
              color: percentual >= 80 ? '#f87171' : '#4ade80',
            },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
              <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>{s.label}</p>
              <p style={{ fontSize: 32, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: '#64748b' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Barra de uso */}
        {resumo && (
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Uso do plano</span>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>{resumo.total_cotacoes} / {resumo.limite_plano}</span>
            </div>
            <div style={{ height: 8, backgroundColor: '#334155', borderRadius: 99 }}>
              <div style={{ height: 8, width: `${Math.min(percentual, 100)}%`, backgroundColor: corBarra, borderRadius: 99, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Gráfico */}
        {resumo?.volume_diario?.length > 0 && (
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, marginBottom: 32 }}>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Cotações por dia — mês atual</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={resumo.volume_diario}>
                <XAxis dataKey="dia" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => v.slice(8)} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {resumo.volume_diario.map((_, i) => (
                    <Cell key={i} fill={corBarra} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Calculadora */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, marginBottom: 32 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Calcular frete</p>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Origem: São Bento do Sul / SC</p>

          <form onSubmit={calcular}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>CEP de destino *</label>
                <input
                  value={form.cep_destino}
                  onChange={(e) => setForm({ ...form, cep_destino: formatCep(e.target.value) })}
                  placeholder="00000-000"
                  required
                  style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Peso (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={form.peso_kg}
                  onChange={(e) => setForm({ ...form, peso_kg: e.target.value })}
                  placeholder="Ex: 40"
                  required
                  style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Valor NF (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_nf}
                  onChange={(e) => setForm({ ...form, valor_nf: e.target.value })}
                  placeholder="Ex: 1500"
                  style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={calculando}
              style={{ backgroundColor: calculando ? '#334155' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontSize: 14, fontWeight: 600, cursor: calculando ? 'not-allowed' : 'pointer' }}
            >
              {calculando ? 'Calculando...' : 'Calcular frete'}
            </button>
          </form>

          {erroCalc && (
            <div style={{ marginTop: 16, backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#fca5a5' }}>
              {erroCalc}
            </div>
          )}

          {resultado && (
            <div style={{ marginTop: 20, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Destino</p>
                  <p style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>{resultado.destino.cidade} — {resultado.destino.uf}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Região</p>
                  <p style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>{resultado.regiao}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Prazo</p>
                  <p style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>{resultado.prazo}</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #334155', paddingTop: 16 }}>
                {[
                  ['Frete peso', resultado.breakdown.frete_peso],
                  ['Ad valorem', resultado.breakdown.ad_valorem],
                  ['GRIS', resultado.breakdown.gris],
                  ['Pedágio', resultado.breakdown.pedagio],
                  ['Taxa despacho', resultado.breakdown.taxa_despacho],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>{label}</span>
                    <span style={{ fontSize: 13, color: '#f1f5f9' }}>{val}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #334155', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Total</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#4ade80' }}>{resultado.total}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lista de cotações */}
        {cotacoes.length > 0 && (
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Últimas cotações</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {['Data', 'Destino', 'Peso', 'Total'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '0 0 10px 0', color: '#64748b', fontWeight: 500, paddingRight: 16 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cotacoes.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '10px 16px 10px 0', color: '#94a3b8' }}>{new Date(c.criado_em).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '10px 16px 10px 0', color: '#f1f5f9' }}>{c.uf_destino || '—'}</td>
                    <td style={{ padding: '10px 16px 10px 0', color: '#f1f5f9' }}>{c.peso_kg ? `${c.peso_kg} kg` : '—'}</td>
                    <td style={{ padding: '10px 0', color: '#4ade80', fontWeight: 600 }}>
                      {c.valor_total_centavos ? `R$ ${(c.valor_total_centavos / 100).toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
