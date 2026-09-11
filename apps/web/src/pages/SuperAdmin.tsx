import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Eye, EyeOff, LogOut, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { maskCnpj, maskCpf, maskPhone } from '../lib/masks';
import { SuperOverview } from './SuperOverview';
import { SuperPlans } from './SuperPlans';
import { SuperBilling } from './SuperBilling';
import { SuperFinance } from './SuperFinance';

type Plan = { id: string; name: string; price: string | number; active: boolean };
type Barbershop = {
  id: string;
  name: string;
  slug: string;
  email?: string;
  status: string;
  subscription?: { plan: Plan };
  _count: { users: number; employees: number };
  onboarding: { percentage: number; completed: number; total: number };
};
type View = 'dashboard' | 'barbershops' | 'plans' | 'payments' | 'finance';
type TenantEdit = {
  name: string;
  ownerName: string;
  email: string;
  document: string;
  documentType: 'CPF' | 'CNPJ';
  phone: string;
  planId: string;
};

const emptyForm = {
  name: '',
  ownerName: '',
  email: '',
  document: '',
  documentType: 'CNPJ' as 'CPF' | 'CNPJ',
  phone: '',
  planId: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  adminPasswordConfirmation: '',
};

export function SuperAdmin() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const [selectedShopId, setSelectedShopId] = useState<string>();
  const [tenantEdit, setTenantEdit] = useState<TenantEdit>();
  const [trialDays, setTrialDays] = useState(14);
  const [renewalMonths, setRenewalMonths] = useState(1);
  const [graceDays, setGraceDays] = useState(7);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['super-admin', 'plans'],
    queryFn: async () => (await api.get('/super-admin/plans')).data,
  });
  const { data, isLoading } = useQuery<{ items: Barbershop[]; total: number }>({
    queryKey: ['super-admin', 'barbershops'],
    queryFn: async () => (await api.get('/super-admin/barbershops')).data,
  });
  const { data: selectedShop } = useQuery<any>({
    queryKey: ['super-admin', 'barbershop', selectedShopId],
    queryFn: async () => (await api.get(`/super-admin/barbershops/${selectedShopId}`)).data,
    enabled: Boolean(selectedShopId),
  });
  const { data: subscriptionHistory = [] } = useQuery<any[]>({
    queryKey: ['super-admin', 'subscription-history', selectedShopId],
    queryFn: async () =>
      (await api.get(`/super-admin/barbershops/${selectedShopId}/subscription-history`)).data,
    enabled: Boolean(selectedShopId),
  });
  const create = useMutation({
    mutationFn: () => api.post('/super-admin/barbershops', form),
    onSuccess: async () => {
      toast.success('Barbearia e administrador criados com sucesso');
      setForm(emptyForm);
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'barbershops'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message || 'Não foi possível criar');
    },
  });
  const updateTenant = useMutation({
    mutationFn: () => api.patch(`/super-admin/barbershops/${selectedShopId}`, tenantEdit),
    onSuccess: async () => {
      toast.success('Dados da barbearia atualizados');
      setTenantEdit(undefined);
      await queryClient.invalidateQueries({
        queryKey: ['super-admin', 'barbershop', selectedShopId],
      });
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'barbershops'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível atualizar'),
  });
  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/super-admin/barbershops/${selectedShopId}/status`, { status }),
    onSuccess: async () => {
      toast.success('Status da barbearia atualizado');
      await queryClient.invalidateQueries({
        queryKey: ['super-admin', 'barbershop', selectedShopId],
      });
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'barbershops'] });
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
    },
  });
  const changeSubscriptionStatus = useMutation({
    mutationFn: (action: 'trial' | 'activate') =>
      action === 'trial'
        ? api.post(`/super-admin/barbershops/${selectedShopId}/subscription/trial`, {
            days: trialDays,
          })
        : api.post(`/super-admin/barbershops/${selectedShopId}/subscription/activate`),
    onSuccess: async () => {
      toast.success('Assinatura atualizada');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['super-admin', 'barbershop', selectedShopId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['super-admin', 'subscription-history', selectedShopId],
        }),
        queryClient.invalidateQueries({ queryKey: ['super-admin', 'barbershops'] }),
        queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] }),
      ]);
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível atualizar a assinatura'),
  });

  const renewSubscription = useMutation({
    mutationFn: () =>
      api.post(`/super-admin/barbershops/${selectedShopId}/subscription/renew`, {
        months: renewalMonths,
      }),
    onSuccess: async () => {
      toast.success('Assinatura renovada');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['super-admin', 'barbershop', selectedShopId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['super-admin', 'subscription-history', selectedShopId],
        }),
      ]);
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível renovar a assinatura'),
  });

  const configureGracePeriod = useMutation({
    mutationFn: () =>
      api.post(`/super-admin/barbershops/${selectedShopId}/subscription/grace-period`, {
        days: graceDays,
      }),
    onSuccess: async () => {
      toast.success(graceDays ? 'Período de cortesia atualizado' : 'Cortesia removida');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['super-admin', 'barbershop', selectedShopId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['super-admin', 'subscription-history', selectedShopId],
        }),
      ]);
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível configurar a cortesia'),
  });

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="super-page">
      <header className="super-header">
        <div className="hero-brand">
          <span>
            <Building2 />
          </span>
          NAVALHA ADMIN
        </div>
        <div className="super-profile">
          <div>
            <b>{user?.name}</b>
            <small>SUPER ADMIN</small>
          </div>
          <button className="outline" onClick={logout}>
            <LogOut /> Sair
          </button>
        </div>
      </header>
      <nav className="super-nav">
        {(
          [
            ['dashboard', 'Visão geral'],
            ['barbershops', 'Barbearias'],
            ['plans', 'Planos'],
            ['payments', 'Pagamentos'],
            ['finance', 'Financeiro'],
          ] as Array<[View, string]>
        ).map(([key, label]) => (
          <button className={view === key ? 'active' : ''} onClick={() => setView(key)} key={key}>
            {label}
          </button>
        ))}
      </nav>
      <main className="super-content">
        {view === 'dashboard' && <SuperOverview onShowTenants={() => setView('barbershops')} />}
        {view === 'plans' && <SuperPlans />}
        {view === 'payments' && <SuperBilling />}
        {view === 'finance' && <SuperFinance />}
        <section hidden={view !== 'barbershops'}>
          <div className="module-head">
            <div>
              <h2>Barbearias</h2>
              <p>{data?.total || 0} tenants cadastrados na plataforma.</p>
            </div>
            <button className="primary" onClick={() => setShowForm((visible) => !visible)}>
              <Plus /> Nova barbearia
            </button>
          </div>

          {showForm && (
            <form
              className="card tenant-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (form.adminPassword !== form.adminPasswordConfirmation) {
                  toast.error('A confirmação da senha não corresponde');
                  return;
                }
                create.mutate();
              }}
            >
              <h3>Novo tenant</h3>
              <label>
                Nome da barbearia
                <input
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                />
              </label>
              <label>
                Proprietário
                <input
                  value={form.ownerName}
                  onChange={(e) => update('ownerName', e.target.value)}
                  required
                />
              </label>
              <label>
                E-mail da barbearia
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                />
              </label>
              <label>
                Tipo de documento
                <select
                  value={form.documentType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      documentType: e.target.value as 'CPF' | 'CNPJ',
                      document: '',
                    })
                  }
                >
                  <option value="CNPJ">CNPJ</option>
                  <option value="CPF">CPF</option>
                </select>
              </label>
              <label>
                {form.documentType}
                <input
                  inputMode="numeric"
                  placeholder={
                    form.documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'
                  }
                  value={form.document}
                  onChange={(e) =>
                    update(
                      'document',
                      form.documentType === 'CPF'
                        ? maskCpf(e.target.value)
                        : maskCnpj(e.target.value),
                    )
                  }
                  required
                />
              </label>
              <label>
                Telefone
                <input
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  value={form.phone}
                  onChange={(e) => update('phone', maskPhone(e.target.value))}
                  required
                />
              </label>
              <label>
                Plano
                <select
                  value={form.planId}
                  onChange={(e) => update('planId', e.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {plans
                    .filter((plan) => plan.active)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} —{' '}
                        {Number(plan.price) > 0 ? money(Number(plan.price)) : 'valor a definir'}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Nome do administrador
                <input
                  value={form.adminName}
                  onChange={(e) => update('adminName', e.target.value)}
                  required
                />
              </label>
              <label>
                Login do administrador
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => update('adminEmail', e.target.value)}
                  required
                />
              </label>
              <label>
                Senha inicial
                <div className="password">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    value={form.adminPassword}
                    onChange={(e) => update('adminPassword', e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </label>
              <label>
                Confirme a senha
                <div className="password">
                  <input
                    type={showConfirmation ? 'text' : 'password'}
                    minLength={8}
                    value={form.adminPasswordConfirmation}
                    onChange={(e) => update('adminPasswordConfirmation', e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmation((visible) => !visible)}>
                    {showConfirmation ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </label>
              <div className="tenant-form-actions">
                <button type="button" className="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button className="primary" disabled={create.isPending}>
                  {create.isPending ? 'Criando...' : 'Criar barbearia'}
                </button>
              </div>
            </form>
          )}

          <div className="card table-card">
            <table>
              <thead>
                <tr>
                  <th>Barbearia</th>
                  <th>Plano</th>
                  <th>Cadastro</th>
                  <th>Usuários</th>
                  <th>Colaboradores</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((shop) => (
                  <tr
                    className="tenant-row"
                    key={shop.id}
                    onClick={() => setSelectedShopId(shop.id)}
                  >
                    <td>
                      <b>{shop.name}</b>
                      <small className="tenant-slug">/{shop.slug}</small>
                    </td>
                    <td>{shop.subscription?.plan.name || 'Sem plano'}</td>
                    <td>
                      <div className="onboarding-progress">
                        <span style={{ width: `${shop.onboarding.percentage}%` }} />
                      </div>
                      <small>{shop.onboarding.percentage}% concluído</small>
                    </td>
                    <td>{shop._count.users}</td>
                    <td>{shop._count.employees}</td>
                    <td>
                      <span className="status confirmado">{shop.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isLoading && <div className="empty">Carregando barbearias...</div>}
            {!isLoading && !data?.items.length && (
              <div className="empty">Nenhuma barbearia cadastrada.</div>
            )}
          </div>
          {selectedShop && (
            <section className="card tenant-detail">
              <div className="card-head">
                <div>
                  <span className="eyebrow">DETALHES DO TENANT</span>
                  <h3>{selectedShop.name}</h3>
                </div>
                <div className="tenant-detail-actions">
                  <button
                    className="outline"
                    onClick={() =>
                      setTenantEdit({
                        name: selectedShop.name,
                        ownerName: selectedShop.ownerName,
                        email: selectedShop.email || '',
                        document:
                          String(selectedShop.document || '').length === 11
                            ? maskCpf(selectedShop.document)
                            : maskCnpj(selectedShop.document || ''),
                        documentType:
                          String(selectedShop.document || '').length === 11 ? 'CPF' : 'CNPJ',
                        phone: maskPhone(selectedShop.phone || ''),
                        planId: selectedShop.subscription?.plan.id || '',
                      })
                    }
                  >
                    Editar
                  </button>
                  {selectedShop.status !== 'ACTIVE' && (
                    <button className="outline" onClick={() => updateStatus.mutate('ACTIVE')}>
                      Ativar
                    </button>
                  )}
                  {selectedShop.status !== 'SUSPENDED' && (
                    <button
                      className="outline"
                      onClick={() =>
                        window.confirm('Suspender o acesso desta barbearia?') &&
                        updateStatus.mutate('SUSPENDED')
                      }
                    >
                      Suspender
                    </button>
                  )}
                  {selectedShop.status !== 'CANCELLED' && (
                    <button
                      className="outline danger"
                      onClick={() =>
                        window.confirm('Cancelar esta barbearia? O acesso será bloqueado.') &&
                        updateStatus.mutate('CANCELLED')
                      }
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    className="icon"
                    onClick={() => {
                      setSelectedShopId(undefined);
                      setTenantEdit(undefined);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
              {tenantEdit && (
                <form
                  className="tenant-edit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateTenant.mutate();
                  }}
                >
                  <label>
                    Nome da barbearia
                    <input
                      value={tenantEdit.name}
                      onChange={(e) => setTenantEdit({ ...tenantEdit, name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Proprietário
                    <input
                      value={tenantEdit.ownerName}
                      onChange={(e) => setTenantEdit({ ...tenantEdit, ownerName: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      type="email"
                      value={tenantEdit.email}
                      onChange={(e) => setTenantEdit({ ...tenantEdit, email: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Tipo de documento
                    <select
                      value={tenantEdit.documentType}
                      onChange={(e) =>
                        setTenantEdit({
                          ...tenantEdit,
                          documentType: e.target.value as 'CPF' | 'CNPJ',
                          document: '',
                        })
                      }
                    >
                      <option value="CNPJ">CNPJ</option>
                      <option value="CPF">CPF</option>
                    </select>
                  </label>
                  <label>
                    {tenantEdit.documentType}
                    <input
                      inputMode="numeric"
                      value={tenantEdit.document}
                      onChange={(e) =>
                        setTenantEdit({
                          ...tenantEdit,
                          document:
                            tenantEdit.documentType === 'CPF'
                              ? maskCpf(e.target.value)
                              : maskCnpj(e.target.value),
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Telefone
                    <input
                      inputMode="tel"
                      value={tenantEdit.phone}
                      onChange={(e) =>
                        setTenantEdit({ ...tenantEdit, phone: maskPhone(e.target.value) })
                      }
                      required
                    />
                  </label>
                  <label>
                    Plano
                    <select
                      value={tenantEdit.planId}
                      onChange={(e) => setTenantEdit({ ...tenantEdit, planId: e.target.value })}
                      required
                    >
                      <option value="">Selecione o plano</option>
                      {plans
                        .filter(
                          (plan) => plan.active || plan.id === selectedShop.subscription?.plan.id,
                        )
                        .map((plan) => (
                          <option value={plan.id} key={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="tenant-edit-actions">
                    <button
                      type="button"
                      className="outline"
                      onClick={() => setTenantEdit(undefined)}
                    >
                      Descartar
                    </button>
                    <button className="primary" disabled={updateTenant.isPending}>
                      {updateTenant.isPending ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                  </div>
                </form>
              )}
              <section className="subscription-control">
                <div>
                  <span className="eyebrow">ASSINATURA</span>
                  <h4>{selectedShop.subscription?.status || 'SEM ASSINATURA'}</h4>
                  {selectedShop.subscription?.trialEndsAt && (
                    <small>
                      Teste até{' '}
                      {new Date(selectedShop.subscription.trialEndsAt).toLocaleDateString('pt-BR')}
                    </small>
                  )}
                  {selectedShop.subscription?.expiresAt && (
                    <small>
                      Vigência até{' '}
                      {new Date(selectedShop.subscription.expiresAt).toLocaleDateString('pt-BR')}
                    </small>
                  )}
                  {selectedShop.subscription?.graceEndsAt && (
                    <small>
                      Cortesia até{' '}
                      {new Date(selectedShop.subscription.graceEndsAt).toLocaleDateString('pt-BR')}
                    </small>
                  )}
                </div>
                <label>
                  Dias de teste
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={trialDays}
                    onChange={(e) => setTrialDays(Number(e.target.value))}
                  />
                </label>
                <button
                  className="outline"
                  onClick={() => changeSubscriptionStatus.mutate('trial')}
                  disabled={changeSubscriptionStatus.isPending}
                >
                  Iniciar teste
                </button>
                <button
                  className="primary"
                  onClick={() => changeSubscriptionStatus.mutate('activate')}
                  disabled={changeSubscriptionStatus.isPending}
                >
                  Ativar assinatura
                </button>
                <label>
                  Meses para renovar
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={renewalMonths}
                    onChange={(e) => setRenewalMonths(Number(e.target.value))}
                  />
                </label>
                <button
                  className="outline"
                  onClick={() => renewSubscription.mutate()}
                  disabled={renewSubscription.isPending}
                >
                  Renovar
                </button>
                <label>
                  Dias de cortesia
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={graceDays}
                    onChange={(e) => setGraceDays(Number(e.target.value))}
                  />
                </label>
                <button
                  className="outline"
                  onClick={() => configureGracePeriod.mutate()}
                  disabled={configureGracePeriod.isPending}
                >
                  {graceDays ? 'Aplicar cortesia' : 'Remover cortesia'}
                </button>
              </section>
              <div className="tenant-detail-grid">
                <div>
                  <small>
                    {String(selectedShop.document || '').length === 11 ? 'CPF' : 'CNPJ'}
                  </small>
                  <b>
                    {selectedShop.document
                      ? String(selectedShop.document).length === 11
                        ? maskCpf(selectedShop.document)
                        : maskCnpj(selectedShop.document)
                      : 'Não informado'}
                  </b>
                </div>
                <div>
                  <small>PLANO</small>
                  <b>{selectedShop.subscription?.plan.name || 'Sem plano'}</b>
                </div>
                <div>
                  <small>CLIENTES</small>
                  <b>{selectedShop._count.customers}</b>
                </div>
                <div>
                  <small>AGENDAMENTOS</small>
                  <b>{selectedShop._count.appointments}</b>
                </div>
                <div>
                  <small>VENDAS</small>
                  <b>{selectedShop._count.sales}</b>
                </div>
                <div>
                  <small>ONBOARDING</small>
                  <b>{selectedShop.onboarding.percentage}%</b>
                </div>
              </div>
              <div className="onboarding-steps">
                {selectedShop.onboarding.steps.map((step: any) => (
                  <span className={step.complete ? 'complete' : ''} key={step.key}>
                    {step.complete ? '✓' : '○'} {step.label}
                  </span>
                ))}
              </div>
              <h4>Usuários</h4>
              {selectedShop.users.map((tenantUser: any) => (
                <div className="tenant-user" key={tenantUser.id}>
                  <div>
                    <b>{tenantUser.name}</b>
                    <small>{tenantUser.email}</small>
                  </div>
                  <span>{tenantUser.role}</span>
                </div>
              ))}
              <h4>Histórico da assinatura</h4>
              <div className="subscription-history">
                {subscriptionHistory.map((entry) => (
                  <div key={entry.id}>
                    <span />
                    <div>
                      <b>{entry.action.replaceAll('_', ' ')}</b>
                      <small>{new Date(entry.effectiveAt).toLocaleString('pt-BR')}</small>
                    </div>
                    <em>
                      {entry.fromStatus || '—'} → {entry.toStatus || '—'}
                    </em>
                  </div>
                ))}
                {!subscriptionHistory.length && (
                  <div className="empty">Nenhuma alteração registrada ainda.</div>
                )}
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
