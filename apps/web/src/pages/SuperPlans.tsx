import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, money } from '../lib/api';

type Plan = {
  id: string;
  name: string;
  price: string | number;
  maxEmployees: number;
  maxUsers: number;
  delinquencyGraceDays: number;
  features: Record<string, boolean> & { pendingDefinition?: boolean };
  active: boolean;
  _count: { subscriptions: number };
};

const emptyForm = {
  name: '',
  price: '0',
  maxEmployees: '0',
  maxUsers: '0',
  delinquencyGraceDays: '7',
  features: '',
};

export function SuperPlans() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['super-admin', 'plans'],
    queryFn: async () => (await api.get('/super-admin/plans')).data,
  });
  const save = useMutation({
    mutationFn: () => {
      const features = Object.fromEntries(
        form.features
          .split(',')
          .map((feature) => feature.trim())
          .filter(Boolean)
          .map((feature) => [feature, true]),
      );
      const payload = {
        name: form.name,
        price: Number(form.price),
        maxEmployees: Number(form.maxEmployees),
        maxUsers: Number(form.maxUsers),
        delinquencyGraceDays: Number(form.delinquencyGraceDays),
        features,
      };
      return editingId
        ? api.patch(`/super-admin/plans/${editingId}`, payload)
        : api.post('/super-admin/plans', payload);
    },
    onSuccess: async () => {
      toast.success(editingId ? 'Plano atualizado' : 'Plano criado');
      closeForm();
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] });
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível salvar o plano'),
  });
  const toggle = useMutation({
    mutationFn: (plan: Plan) =>
      api.patch(`/super-admin/plans/${plan.id}`, { active: !plan.active }),
    onSuccess: async () => {
      toast.success('Status do plano atualizado');
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] });
    },
  });

  function edit(plan: Plan) {
    const features = Object.entries(plan.features || {})
      .filter(([key, enabled]) => key !== 'pendingDefinition' && enabled)
      .map(([key]) => key)
      .join(', ');
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      price: String(plan.price),
      maxEmployees: String(plan.maxEmployees),
      maxUsers: String(plan.maxUsers),
      delinquencyGraceDays: String(plan.delinquencyGraceDays),
      features,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(undefined);
    setForm(emptyForm);
  }

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Planos</h2>
          <p>Defina valores, limites, benefícios e acompanhe as adesões.</p>
        </div>
        <button className="primary" onClick={() => setShowForm(true)}>
          <Plus /> Novo plano
        </button>
      </div>
      {showForm && (
        <form
          className="card plan-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <h3>{editingId ? 'Editar plano' : 'Novo plano'}</h3>
          <label>
            Nome
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Valor mensal
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </label>
          <label>
            Limite de usuários
            <input
              type="number"
              min="0"
              value={form.maxUsers}
              onChange={(e) => setForm({ ...form, maxUsers: e.target.value })}
              required
            />
          </label>
          <label>
            Limite de colaboradores
            <input
              type="number"
              min="0"
              value={form.maxEmployees}
              onChange={(e) => setForm({ ...form, maxEmployees: e.target.value })}
              required
            />
          </label>
          <label>
            Prazo antes da suspensão
            <input
              type="number"
              min="0"
              max="90"
              value={form.delinquencyGraceDays}
              onChange={(e) => setForm({ ...form, delinquencyGraceDays: e.target.value })}
              required
            />
            <small>Dias após o vencimento.</small>
          </label>
          <label className="wide">
            Benefícios
            <input
              placeholder="agenda, financeiro, relatórios"
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
            />
            <small>Separe os benefícios por vírgulas.</small>
          </label>
          <div className="tenant-form-actions wide">
            <button type="button" className="outline" onClick={closeForm}>
              Cancelar
            </button>
            <button className="primary" disabled={save.isPending}>
              {save.isPending ? 'Salvando...' : 'Salvar plano'}
            </button>
          </div>
        </form>
      )}
      <div className="catalog-grid plan-grid">
        {plans.map((plan) => (
          <article className={`card plan-card ${plan.active ? '' : 'inactive'}`} key={plan.id}>
            <span className="catalog-icon">
              <CheckCircle2 />
            </span>
            <i>{plan.active ? 'ATIVO' : 'INATIVO'}</i>
            <h3>{plan.name}</h3>
            <b>{Number(plan.price) > 0 ? money(Number(plan.price)) : 'Valor a definir'}</b>
            <p>
              {plan.features?.pendingDefinition
                ? 'Benefícios e limites aguardando definição.'
                : `${plan.maxUsers} usuários, ${plan.maxEmployees} colaboradores e suspensão em ${plan.delinquencyGraceDays} dias`}
            </p>
            <div>
              <small>{plan._count.subscriptions} ASSINATURA(S)</small>
              <span className="plan-actions">
                <button className="icon" onClick={() => edit(plan)} title="Editar">
                  <Pencil />
                </button>
                <button className="link" onClick={() => toggle.mutate(plan)}>
                  {plan.active ? 'Desativar' : 'Ativar'}
                </button>
              </span>
            </div>
          </article>
        ))}
      </div>
      {isLoading && <div className="empty">Carregando planos...</div>}
    </>
  );
}
