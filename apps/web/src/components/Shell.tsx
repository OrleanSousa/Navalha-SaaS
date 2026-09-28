import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Permissions, type PermissionKey } from '../lib/permissions';
import { api, assetUrl } from '../lib/api';
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
  Landmark,
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
  ['/atendimentos', 'Atendimentos', Scissors, Permissions.SALES_READ],
  ['/clientes', 'Clientes', Users, Permissions.CUSTOMERS_READ],
  ['/colaboradores', 'Colaboradores', UserRound, Permissions.EMPLOYEES_READ],
  ['/servicos', 'Serviços', Scissors, Permissions.SERVICES_READ],
  ['/produtos', 'Produtos', Package, Permissions.PRODUCTS_READ],
  ['/estoque', 'Estoque', Warehouse],
  ['/vendas', 'Vendas', ReceiptText, Permissions.SALES_READ],
  ['/financeiro', 'Financeiro', WalletCards, Permissions.FINANCE_READ],
  ['/contas', 'Contas', Landmark, Permissions.ACCOUNTS_READ],
  ['/comissoes', 'Comissões', BadgeDollarSign, Permissions.COMMISSIONS_READ],
  ['/relatorios', 'Relatórios', ChartNoAxesCombined, Permissions.REPORTS_READ],
  ['/configuracoes', 'Configurações', Settings, Permissions.SETTINGS_READ],
] as ReadonlyArray<readonly [string, string, typeof LayoutDashboard, PermissionKey?]>;
export function Shell() {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { data: workspace } = useQuery<{
    name: string;
    tradeName?: string;
    logoUrl?: string;
    primaryColor: string;
    primaryTextColor: string;
  }>({ queryKey: ['workspace'], queryFn: async () => (await api.get('/workspace')).data });
  const title =
    items.find((x) => x[0] === loc.pathname)?.[1] ||
    (loc.pathname.startsWith('/colaboradores/') ? 'Colaborador' : 'Navalha');
  return (
    <div
      className="app"
      style={
        {
          '--brand-color': workspace?.primaryColor || '#B8832B',
          '--brand-text': workspace?.primaryTextColor || '#FFFFFF',
        } as React.CSSProperties
      }
    >
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
          <span>
            {workspace?.logoUrl ? (
              <img src={assetUrl(workspace.logoUrl)} alt="" />
            ) : (
              (workspace?.name || user?.barbershop || 'MB').slice(0, 2).toUpperCase()
            )}
          </span>
          <div>
            <b>
              {workspace?.tradeName || workspace?.name || user?.barbershop || 'Minha barbearia'}
            </b>
            <small>Ambiente de gestão</small>
          </div>
        </div>
        <nav>
          {items
            .filter(([, , , permission]) => !permission || can(permission))
            .map(([to, label, Icon]) => (
              <NavLink to={to} end={to === '/'} onClick={() => setOpen(false)} key={to}>
                <Icon />
                <span>{label}</span>
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
