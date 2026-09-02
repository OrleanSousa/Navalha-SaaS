import { Navigate, Route, Routes } from 'react-router-dom';
import { Login } from './pages/Login';
import { Shell } from './components/Shell';
import { Dashboard } from './pages/Dashboard';
import { Agenda } from './pages/Agenda';
import { Customers } from './pages/Customers';
import { Catalog } from './pages/Catalog';
import { Finance } from './pages/Finance';
import { Placeholder } from './pages/Placeholder';
import { useAuth } from './lib/auth';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty big">Carregando sessão...</div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/recuperar-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route element={user ? <Shell /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="clientes" element={<Customers />} />
        <Route path="servicos" element={<Catalog type="services" />} />
        <Route path="produtos" element={<Catalog type="products" />} />
        <Route path="financeiro" element={<Finance />} />
        <Route path=":page" element={<Placeholder />} />
      </Route>
    </Routes>
  );
}
