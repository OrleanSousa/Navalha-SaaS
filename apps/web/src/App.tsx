import { Navigate, Route, Routes } from 'react-router-dom';
import { Login } from './pages/Login';
import { Shell } from './components/Shell';
import { Dashboard } from './pages/Dashboard';
import { Agenda } from './pages/Agenda';
import { Customers } from './pages/Customers';
import { Catalog } from './pages/Catalog';
import { Finance } from './pages/Finance';
import { Employees } from './pages/Employees';
import { EmployeeDetails } from './pages/EmployeeDetails';
import { Placeholder } from './pages/Placeholder';
import { useAuth } from './lib/auth';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { SuperAdmin } from './pages/SuperAdmin';
export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty big">Carregando sessão...</div>;
  const home = user?.role === 'SUPER_ADMIN' ? '/super-admin' : '/';
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} /> : <Login />} />
      <Route path="/recuperar-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route
        path="/super-admin"
        element={
          user?.role === 'SUPER_ADMIN' ? <SuperAdmin /> : <Navigate to={user ? '/' : '/login'} />
        }
      />
      <Route
        element={
          user && user.role !== 'SUPER_ADMIN' ? <Shell /> : <Navigate to={user ? home : '/login'} />
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="clientes" element={<Customers />} />
        <Route path="servicos" element={<Catalog type="services" />} />
        <Route path="produtos" element={<Catalog type="products" />} />
        <Route path="financeiro" element={<Finance />} />
        <Route path="colaboradores" element={<Employees />} />
        <Route path="colaboradores/:id" element={<EmployeeDetails />} />
        <Route path=":page" element={<Placeholder />} />
      </Route>
    </Routes>
  );
}
