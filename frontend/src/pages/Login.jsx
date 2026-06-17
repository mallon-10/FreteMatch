import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, senha });
      localStorage.setItem('token', data.token);
      navigate('/');
    } catch {
      setErro('Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 14,
    color: '#f1f5f9',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            backgroundColor: '#2563eb',
            borderRadius: 16,
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 24 }}>🚛</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>FreteMatch</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>Faça login para acessar o painel</p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 20,
          padding: 32,
        }}>
          <form onSubmit={handleSubmit}>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com.br"
                required
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>

            {erro && (
              <div style={{
                backgroundColor: '#450a0a',
                border: '1px solid #7f1d1d',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: '#fca5a5',
                marginBottom: 20,
              }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: loading ? '#1d4ed8' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '13px 0',
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'background-color 0.2s',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#475569', marginTop: 24 }}>
          FreteMatch © {new Date().getFullYear()}
        </p>

      </div>
    </div>
  );
}
