import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
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
  ['/', 'Visão geral', LayoutDashboard],
  ['/agenda', 'Agenda', CalendarDays],
  ['/atendimentos', 'Atendimentos', Scissors],
  ['/clientes', 'Clientes', Users],
  ['/colaboradores', 'Colaboradores', UserRound],
  ['/servicos', 'Serviços', Scissors],
  ['/produtos', 'Produtos', Package],
  ['/estoque', 'Estoque', Warehouse],
  ['/vendas', 'Vendas', ReceiptText],
  ['/financeiro', 'Financeiro', WalletCards],
  ['/comissoes', 'Comissões', BadgeDollarSign],
  ['/relatorios', 'Relatórios', ChartNoAxesCombined],
  ['/configuracoes', 'Configurações', Settings],
] as const;
export function Shell() {
  const { user, logout } = useAuth();
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
          {items.map(([to, label, Icon]) => (
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
            <button className="primary">
              <Plus /> Novo agendamento
            </button>
          </div>
        </header>
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {items.slice(0, 5).map(([to, label, Icon]) => (
          <NavLink to={to} end={to === '/'} key={to}>
            <Icon />
            <small>{label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
