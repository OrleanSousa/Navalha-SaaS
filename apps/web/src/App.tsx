import { Navigate, Route, Routes } from 'react-router-dom';
import { Login } from './pages/Login';
import { Shell } from './components/Shell';
import { Dashboard } from './pages/Dashboard';
import { Agenda } from './pages/Agenda';
import { Customers } from './pages/Customers';
import { CustomerDetails } from './pages/CustomerDetails';
import { Catalog } from './pages/Catalog';
import { Finance } from './pages/Finance';
import { Employees } from './pages/Employees';
import { EmployeeDetails } from './pages/EmployeeDetails';
import { ServiceDetails } from './pages/ServiceDetails';
import { ProductCatalog } from './pages/ProductCatalog';
import { ProductDetails } from './pages/ProductDetails';
import { Attendances } from './pages/Attendances';
import { Commissions } from './pages/Commissions';
import { Accounts } from './pages/Accounts';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
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
        <Route path="clientes/:id" element={<CustomerDetails />} />
        <Route path="servicos" element={<Catalog type="services" />} />
        <Route path="servicos/:id" element={<ServiceDetails />} />
        <Route path="produtos" element={<ProductCatalog />} />
        <Route path="produtos/:id" element={<ProductDetails />} />
        <Route path="atendimentos" element={<Attendances />} />
        <Route path="vendas" element={<Attendances historyOnly />} />
        <Route path="comissoes" element={<Commissions />} />
        <Route path="financeiro" element={<Finance />} />
        <Route path="contas" element={<Accounts />} />
        <Route path="relatorios" element={<Reports />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="colaboradores" element={<Employees />} />
        <Route path="colaboradores/:id" element={<EmployeeDetails />} />
        <Route path=":page" element={<Placeholder />} />
      </Route>
    </Routes>
  );
}
