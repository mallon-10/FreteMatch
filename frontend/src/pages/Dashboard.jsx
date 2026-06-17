import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api';

function Card({ children, className = '' }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <Card>
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </Card>
  );
}

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

  const percentual = resumo?.percentual_uso ?? 0;
  const corBarra = percentual >= 80 ? '#ef4444' : '#3b82f6';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">FreteMatch</h1>
        <button onClick={sair} className="text-sm text-gray-400 hover:text-white transition">Sair</button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Cotações este mês"
            value={resumo?.total_cotacoes ?? '—'}
            sub={`Plano ${resumo?.plano ?? '...'}`}
          />
          <StatCard
            label="Limite do plano"
            value={resumo?.limite_plano ?? '—'}
            sub="cotações/mês"
          />
          <StatCard
            label="Uso atual"
            value={resumo ? `${percentual}%` : '—'}
            sub={percentual >= 80 ? 'Atenção: próximo do limite' : 'Dentro do limite'}
            color={percentual >= 80 ? 'text-red-400' : 'text-green-400'}
          />
        </div>

        {/* Gráfico */}
        {resumo?.volume_diario?.length > 0 && (
          <Card>
            <h2 className="text-sm text-gray-400 mb-4">Cotações por dia — mês atual</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={resumo.volume_diario}>
                <XAxis dataKey="dia" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => v.slice(8)} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {resumo.volume_diario.map((_, i) => (
                    <Cell key={i} fill={corBarra} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Calculadora */}
        <Card>
          <h2 className="text-sm text-gray-400 mb-1">Calcular frete</h2>
          <p className="text-xs text-gray-600 mb-4">Origem: São Bento do Sul / SC</p>
          <form onSubmit={calcular} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">CEP de destino</label>
              <input
                value={form.cep_destino}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                  const fmt = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                  setForm({ ...form, cep_destino: fmt });
                }}
                placeholder="00000-000"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Peso (kg)</label>
              <input
                type="number"
                step="0.1"
                value={form.peso_kg}
                onChange={(e) => setForm({ ...form, peso_kg: e.target.value })}
                placeholder="10"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Valor NF (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.valor_nf}
                onChange={(e) => setForm({ ...form, valor_nf: e.target.value })}
                placeholder="1000"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={calculando}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-6 py-2 text-sm font-medium transition"
              >
                {calculando ? 'Calculando...' : 'Calcular'}
              </button>
            </div>
          </form>

          {erroCalc && <p className="text-red-400 text-sm mt-3">{erroCalc}</p>}

          {resultado && (
            <div className="mt-4 bg-gray-800 rounded-xl p-4 text-sm space-y-1">
              <p className="text-gray-400">Destino: <span className="text-white">{resultado.destino.cidade} — {resultado.destino.uf}</span></p>
              <p className="text-gray-400">Região: <span className="text-white">{resultado.regiao}</span></p>
              <p className="text-gray-400">Prazo: <span className="text-white">{resultado.prazo}</span></p>
              <div className="border-t border-gray-700 pt-2 mt-2 space-y-1">
                <p className="text-gray-400">Frete peso: <span className="text-white">{resultado.breakdown.frete_peso}</span></p>
                <p className="text-gray-400">Ad valorem: <span className="text-white">{resultado.breakdown.ad_valorem}</span></p>
                <p className="text-gray-400">GRIS: <span className="text-white">{resultado.breakdown.gris}</span></p>
                <p className="text-gray-400">Pedágio: <span className="text-white">{resultado.breakdown.pedagio}</span></p>
                <p className="text-gray-400">Taxa despacho: <span className="text-white">{resultado.breakdown.taxa_despacho}</span></p>
              </div>
              <p className="text-lg font-bold text-green-400 pt-1">Total: {resultado.total}</p>
            </div>
          )}
        </Card>

        {/* Lista de cotações */}
        {cotacoes.length > 0 && (
          <Card>
            <h2 className="text-sm text-gray-400 mb-4">Últimas cotações</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-left border-b border-gray-800">
                    <th className="pb-2 pr-4">Data</th>
                    <th className="pb-2 pr-4">Destino</th>
                    <th className="pb-2 pr-4">Peso</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cotacoes.map((c) => (
                    <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 pr-4 text-gray-400">
                        {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-2 pr-4">{c.uf_destino || '—'}</td>
                      <td className="py-2 pr-4">{c.peso_kg ? `${c.peso_kg} kg` : '—'}</td>
                      <td className="py-2 text-green-400 font-medium">
                        {c.valor_total_centavos
                          ? `R$ ${(c.valor_total_centavos / 100).toFixed(2).replace('.', ',')}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      </main>
    </div>
  );
}
