import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Permissions, type PermissionKey } from '../lib/permissions';
import {
  LayoutDashboard,
  CalendarDays,
  Scissors,
  Users,
  UserRound,
  Package,
  Warehouse,
  ReceiptText,
  WalletCards,
  BadgeDollarSign,
  ChartNoAxesCombined,
  Settings,
  Menu,
  Bell,
  Search,
  Plus,
  LogOut,
  X,
} from 'lucide-react';
const items = [
  ['/', 'Visão geral', LayoutDashboard, Permissions.DASHBOARD_READ],
  ['/agenda', 'Agenda', CalendarDays, Permissions.APPOINTMENTS_READ],
  ['/atendimentos', 'Atendimentos', Scissors],
  ['/clientes', 'Clientes', Users, Permissions.CUSTOMERS_READ],
  ['/colaboradores', 'Colaboradores', UserRound, Permissions.EMPLOYEES_READ],
  ['/servicos', 'Serviços', Scissors, Permissions.SERVICES_READ],
  ['/produtos', 'Produtos', Package, Permissions.PRODUCTS_READ],
  ['/estoque', 'Estoque', Warehouse],
  ['/vendas', 'Vendas', ReceiptText],
  ['/financeiro', 'Financeiro', WalletCards],
  ['/comissoes', 'Comissões', BadgeDollarSign],
  ['/relatorios', 'Relatórios', ChartNoAxesCombined],
  ['/configuracoes', 'Configurações', Settings],
] as ReadonlyArray<readonly [string, string, typeof LayoutDashboard, PermissionKey?]>;
export function Shell() {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const title = items.find((x) => x[0] === loc.pathname)?.[1] || 'Navalha';
  return (
    <div className="app">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <span className="brandmark">
            <Scissors />
          </span>
          <div>
            <b>NAVALHA</b>
            <small>GESTÃO INTELIGENTE</small>
          </div>
          <button className="icon mobile" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <div className="shop">
          <span>BM</span>
          <div>
            <b>Barbearia Modelo</b>
            <small>Plano profissional</small>
          </div>
        </div>
        <nav>
          {items
            .filter(([, , , permission]) => !permission || can(permission))
            .map(([to, label, Icon]) => (
              <NavLink to={to} end={to === '/'} onClick={() => setOpen(false)} key={to}>
                <Icon />
                <span>{label}</span>
                {label === 'Agenda' && <em>8</em>}
              </NavLink>
            ))}
        </nav>
        <div className="profile">
          <span>{(user?.name || 'Admin').slice(0, 2).toUpperCase()}</span>
          <div>
            <b>{user?.name || 'Administrador'}</b>
            <small>{user?.role || 'ADMIN'}</small>
          </div>
          <button className="icon" onClick={logout} title="Sair">
            <LogOut />
          </button>
        </div>
      </aside>
      <main>
        <header>
          <button className="icon mobile" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div>
            <small>PAINEL DE CONTROLE</small>
            <h1>{title}</h1>
          </div>
          <div className="header-actions">
            <label className="search">
              <Search />
              <input placeholder="Buscar..." />
            </label>
            <button className="icon notify">
              <Bell />
              <i />
            </button>
            {can(Permissions.APPOINTMENTS_CREATE) && (
              <button className="primary">
                <Plus /> Novo agendamento
              </button>
            )}
          </div>
        </header>
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {items
          .filter(([, , , permission]) => !permission || can(permission))
          .slice(0, 5)
          .map(([to, label, Icon]) => (
            <NavLink to={to} end={to === '/'} key={to}>
              <Icon />
              <small>{label}</small>
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
