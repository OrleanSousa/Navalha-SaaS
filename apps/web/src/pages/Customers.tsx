import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Phone, Plus, Save, Search, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

type Customer = {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  _count?: { appointments: number };
  totalSpent?: number;
  lastVisit?: string | null;
};

const emptyForm = {
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  cpf: '',
  birthDate: '',
  notes: '',
};

export function Customers() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { data = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers')).data,
  });

  const createCustomer = useMutation({
    mutationFn: () =>
      api.post(
        '/customers',
        Object.fromEntries(Object.entries(form).filter(([, value]) => Boolean(value))),
      ),
    onSuccess: async () => {
      toast.success('Cliente cadastrado');
      setShowForm(false);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível cadastrar o cliente'),
  });

  return (
    <div className="page customers-module">
      <div className="module-head">
        <div>
          <h2>Clientes</h2>
          <p>Gerencie seus clientes e acompanhe o histórico.</p>
        </div>
        {can(Permissions.CUSTOMERS_CREATE) && !showForm && (
          <button className="primary" onClick={() => setShowForm(true)}>
            <Plus /> Novo cliente
          </button>
        )}
      </div>

      {showForm && (
        <form
          className="card customer-form"
          onSubmit={(event) => {
            event.preventDefault();
            createCustomer.mutate();
          }}
        >
          <div className="customer-form-head">
            <div>
              <h3>Novo cliente</h3>
              <p>Cadastre os dados de contato e identificação.</p>
            </div>
            <button
              className="icon"
              type="button"
              title="Fechar"
              onClick={() => setShowForm(false)}
            >
              <X />
            </button>
          </div>
          <label>
            Nome
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Telefone
            <input
              required
              maxLength={30}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>
          <label>
            WhatsApp
            <input
              maxLength={30}
              value={form.whatsapp}
              onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              maxLength={160}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            CPF
            <input
              maxLength={20}
              value={form.cpf}
              onChange={(event) => setForm({ ...form, cpf: event.target.value })}
            />
          </label>
          <label>
            Nascimento
            <input
              type="date"
              value={form.birthDate}
              onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
            />
          </label>
          <label className="wide">
            Observações
            <textarea
              maxLength={1000}
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
          <div className="customer-form-actions">
            <button
              className="outline"
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
            >
              Cancelar
            </button>
            <button className="primary" type="submit" disabled={createCustomer.isPending}>
              <Save /> {createCustomer.isPending ? 'Salvando...' : 'Salvar cliente'}
            </button>
          </div>
        </form>
      )}

      <div className="card table-card">
        <div className="table-tools">
          <label className="search">
            <Search />
            <input placeholder="Buscar por nome, telefone ou CPF..." />
          </label>
          <span>{data.length} clientes cadastrados</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contato</th>
              <th>Visitas</th>
              <th>Total gasto</th>
              <th>Último atendimento</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <div className="customer">
                    <span>{customer.name.slice(0, 2).toUpperCase()}</span>
                    <b>{customer.name}</b>
                  </div>
                </td>
                <td>
                  <small>
                    <Phone /> {customer.phone}
                  </small>
                </td>
                <td>{customer._count?.appointments || 0}</td>
                <td>{money(Number(customer.totalSpent || 0))}</td>
                <td>
                  {customer.lastVisit
                    ? new Intl.DateTimeFormat('pt-BR').format(new Date(customer.lastVisit))
                    : '—'}
                </td>
                <td>
                  <button className="icon" title="Ações">
                    <MoreHorizontal />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && <div className="empty">Nenhum cliente encontrado.</div>}
      </div>
    </div>
  );
}
