import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rotas from './pages/Rotas';

function RotaProtegida({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RotaProtegida><Dashboard /></RotaProtegida>} />
        <Route path="/rotas" element={<RotaProtegida><Rotas /></RotaProtegida>} />
      </Routes>
    </BrowserRouter>
  );
}
