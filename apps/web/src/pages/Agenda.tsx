import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  Save,
  UserX,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

type View = 'day' | 'week' | 'month';
type Appointment = {
  id: string;
  customerId: string;
  employeeId: string;
  startAt: string;
  endAt: string;
  status: string;
  price: string | number;
  notes?: string | null;
  cancellationReason?: string | null;
  customer: { id: string; name: string };
  employee: { id: string; name: string; color: string };
  services: Array<{ service: { id: string; name: string } }>;
};
type Options = {
  customers: Array<{ id: string; name: string; phone: string }>;
  employees: Array<{ id: string; name: string; color: string }>;
  services: Array<{
    id: string;
    name: string;
    price: string | number;
    durationMinutes: number;
    employeeServices: Array<{ employeeId: string }>;
  }>;
};
const emptyForm = {
  customerId: '',
  employeeId: '',
  serviceIds: [] as string[],
  date: '',
  startAt: '',
  notes: '',
};
const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_SERVICE: 'Em atendimento',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - ((day + 6) % 7));
  result.setHours(0, 0, 0, 0);
  return result;
}
function period(view: View, anchor: Date) {
  if (view === 'day') {
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    return [start, addDays(start, 1)];
  }
  if (view === 'week') {
    const start = startOfWeek(anchor);
    return [start, addDays(start, 7)];
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return [start, new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)];
}

export function Agenda() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('day');
  const [anchor, setAnchor] = useState(() => new Date());
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment>();
  const [form, setForm] = useState(emptyForm);
  const [start, end] = period(view, anchor);
  const { data: options } = useQuery<Options>({
    queryKey: ['appointment-options'],
    queryFn: async () => (await api.get('/appointments/options')).data,
  });
  const {
    data: events = [],
    isLoading,
    isError,
  } = useQuery<Appointment[]>({
    queryKey: [
      'appointments',
      start.toISOString(),
      end.toISOString(),
      employeeFilter,
      statusFilter,
    ],
    queryFn: async () =>
      (
        await api.get('/appointments', {
          params: {
            start: start.toISOString(),
            end: end.toISOString(),
            employeeId: employeeFilter || undefined,
            status: statusFilter || undefined,
          },
        })
      ).data,
  });
  const eligibleServices =
    options?.services.filter(
      (service) =>
        !form.employeeId ||
        service.employeeServices.some((link) => link.employeeId === form.employeeId),
    ) || [];
  const { data: slotData, isFetching: loadingSlots } = useQuery<{
    slots: Array<{ startAt: string; endAt: string }>;
  }>({
    queryKey: ['appointment-slots', editing?.id, form.employeeId, form.serviceIds, form.date],
    queryFn: async () =>
      (
        await api.post('/appointments/available-slots', {
          appointmentId: editing?.id,
          employeeId: form.employeeId,
          serviceIds: form.serviceIds,
          date: form.date,
        })
      ).data,
    enabled: Boolean(form.employeeId && form.serviceIds.length && form.date),
  });
  const selectedServices =
    options?.services.filter((service) => form.serviceIds.includes(service.id)) || [];
  const summary = {
    duration: selectedServices.reduce((sum, service) => sum + service.durationMinutes, 0),
    price: selectedServices.reduce((sum, service) => sum + Number(service.price), 0),
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        customerId: form.customerId,
        employeeId: form.employeeId,
        serviceIds: form.serviceIds,
        startAt: form.startAt,
        notes: form.notes || null,
      };
      return editing
        ? api.patch(`/appointments/${editing.id}`, payload)
        : api.post('/appointments', payload);
    },
    onSuccess: async () => {
      toast.success(editing ? 'Agendamento atualizado' : 'Agendamento criado');
      closeForm();
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível salvar o agendamento'),
  });
  const statusAction = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason?: string }) =>
      api.post(`/appointments/${id}/${action}`, reason ? { reason } : {}),
    onSuccess: async () => {
      toast.success('Status atualizado');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível alterar o status'),
  });

  function closeForm() {
    setShowForm(false);
    setEditing(undefined);
    setForm(emptyForm);
  }
  function edit(event: Appointment) {
    setEditing(event);
    setShowForm(true);
    setForm({
      customerId: event.customer.id,
      employeeId: event.employee.id,
      serviceIds: event.services.map(({ service }) => service.id),
      date: dateInput(new Date(event.startAt)),
      startAt: event.startAt,
      notes: event.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function navigate(direction: number) {
    const amount = view === 'day' ? 1 : view === 'week' ? 7 : 0;
    setAnchor(
      amount
        ? addDays(anchor, direction * amount)
        : new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1),
    );
  }
  const title =
    view === 'day'
      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(anchor)
      : view === 'week'
        ? `${new Intl.DateTimeFormat('pt-BR').format(start)} a ${new Intl.DateTimeFormat('pt-BR').format(addDays(end, -1))}`
        : new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(anchor);
  const dayGroups = Array.from(
    { length: Math.round((end.getTime() - start.getTime()) / 86400000) },
    (_, index) => addDays(start, index),
  );

  const eventCard = (event: Appointment) => (
    <article
      className={`agenda-event status-${event.status.toLowerCase()}`}
      style={{ borderLeftColor: event.employee.color }}
      key={event.id}
    >
      <div>
        <b>
          {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
            new Date(event.startAt),
          )}{' '}
          · {event.customer.name}
        </b>
        <small>
          {event.services.map(({ service }) => service.name).join(', ')} · {event.employee.name}
        </small>
        <em>
          {statusLabels[event.status] || event.status} · {money(Number(event.price))}
        </em>
      </div>
      <div className="agenda-event-actions">
        {can(Permissions.APPOINTMENTS_UPDATE) &&
          ['SCHEDULED', 'CONFIRMED'].includes(event.status) && (
            <button className="icon" title="Editar" onClick={() => edit(event)}>
              <Pencil />
            </button>
          )}
        {can(Permissions.APPOINTMENTS_STATUS) && event.status === 'SCHEDULED' && (
          <button
            className="icon"
            title="Confirmar"
            onClick={() => statusAction.mutate({ id: event.id, action: 'confirm' })}
          >
            <Check />
          </button>
        )}
        {can(Permissions.APPOINTMENTS_STATUS) &&
          ['SCHEDULED', 'CONFIRMED'].includes(event.status) && (
            <>
              <button
                className="icon"
                title="Não compareceu"
                onClick={() => statusAction.mutate({ id: event.id, action: 'no-show' })}
              >
                <UserX />
              </button>
              <button
                className="icon danger"
                title="Cancelar"
                onClick={() => {
                  const reason = window.prompt('Motivo do cancelamento:');
                  if (reason?.trim())
                    statusAction.mutate({ id: event.id, action: 'cancel', reason });
                }}
              >
                <X />
              </button>
            </>
          )}
      </div>
    </article>
  );

  return (
    <div className="page agenda-page">
      <div className="module-head">
        <div>
          <h2>Agenda</h2>
          <p>Agendamentos, disponibilidade e rotina dos profissionais.</p>
        </div>
        {can(Permissions.APPOINTMENTS_CREATE) && !showForm && (
          <button
            className="primary"
            onClick={() => {
              setForm({ ...emptyForm, date: dateInput(anchor) });
              setShowForm(true);
            }}
          >
            <Plus /> Novo agendamento
          </button>
        )}
      </div>
      {showForm && (
        <form
          className="card appointment-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="service-form-head">
            <div>
              <h3>{editing ? 'Editar agendamento' : 'Novo agendamento'}</h3>
              <p>O preço e a duração são calculados pela API.</p>
            </div>
            <button className="icon" type="button" onClick={closeForm}>
              <X />
            </button>
          </div>
          <div className="appointment-form-grid">
            <label>
              Cliente
              <select
                required
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              >
                <option value="">Selecione</option>
                {options?.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.phone}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Profissional
              <select
                required
                value={form.employeeId}
                onChange={(e) =>
                  setForm({ ...form, employeeId: e.target.value, serviceIds: [], startAt: '' })
                }
              >
                <option value="">Selecione</option>
                {options?.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value, startAt: '' })}
              />
            </label>
            <label>
              Horário
              <select
                required
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                disabled={!form.serviceIds.length || loadingSlots}
              >
                <option value="">{loadingSlots ? 'Consultando...' : 'Selecione'}</option>
                {editing &&
                  form.startAt &&
                  !slotData?.slots.some((slot) => slot.startAt === form.startAt) && (
                    <option value={form.startAt}>
                      {new Intl.DateTimeFormat('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(form.startAt))}
                    </option>
                  )}
                {slotData?.slots.map((slot) => (
                  <option key={slot.startAt} value={slot.startAt}>
                    {new Intl.DateTimeFormat('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(slot.startAt))}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Serviços</legend>
              {eligibleServices.map((service) => (
                <label key={service.id}>
                  <input
                    type="checkbox"
                    checked={form.serviceIds.includes(service.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        serviceIds: e.target.checked
                          ? [...form.serviceIds, service.id]
                          : form.serviceIds.filter((id) => id !== service.id),
                        startAt: '',
                      })
                    }
                  />{' '}
                  <span>
                    <b>{service.name}</b>
                    <small>
                      {service.durationMinutes} min · {money(Number(service.price))}
                    </small>
                  </span>
                </label>
              ))}
              {form.employeeId && !eligibleServices.length && (
                <small>Nenhum serviço habilitado.</small>
              )}
            </fieldset>
            <label className="wide">
              Observações
              <textarea
                maxLength={1000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="appointment-summary">
            <span>
              <Clock3 /> {summary.duration} minutos
            </span>
            <b>{money(summary.price)}</b>
          </div>
          <div className="service-form-actions">
            <button className="outline" type="button" onClick={closeForm}>
              Cancelar
            </button>
            <button className="primary" disabled={save.isPending || !form.serviceIds.length}>
              <Save /> {save.isPending ? 'Salvando...' : 'Salvar agendamento'}
            </button>
          </div>
        </form>
      )}
      <div className="agenda-toolbar card">
        <div className="seg">
          {(['day', 'week', 'month'] as View[]).map((item) => (
            <button
              key={item}
              className={view === item ? 'active' : ''}
              onClick={() => setView(item)}
            >
              {item === 'day' ? 'Dia' : item === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
        <div className="daynav">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft />
          </button>
          <b>{title}</b>
          <button onClick={() => navigate(1)}>
            <ChevronRight />
          </button>
        </div>
        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
          <option value="">Todos os profissionais</option>
          {options?.employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {isLoading && <div className="empty card">Carregando agenda...</div>}
      {isError && <div className="empty card">Não foi possível carregar a agenda.</div>}
      {!isLoading && !isError && view !== 'month' && (
        <div className={`agenda-period ${view}`}>
          {dayGroups.map((day) => {
            const items = events.filter(
              (event) => dateInput(new Date(event.startAt)) === dateInput(day),
            );
            return (
              <section className="card agenda-day" key={day.toISOString()}>
                <header>
                  <CalendarDays />
                  <div>
                    <b>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(day)}</b>
                    <small>{new Intl.DateTimeFormat('pt-BR').format(day)}</small>
                  </div>
                  <span>{items.length}</span>
                </header>
                <div>
                  {items.length ? (
                    items.map(eventCard)
                  ) : (
                    <p className="detail-empty">Nenhum agendamento.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {!isLoading && !isError && view === 'month' && (
        <div className="month-calendar card">
          <div className="month-weekdays">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
              <b key={day}>{day}</b>
            ))}
          </div>
          <div className="month-grid">
            {Array.from({ length: (start.getDay() + 6) % 7 }, (_, i) => (
              <div className="month-blank" key={`blank-${i}`} />
            ))}
            {dayGroups.map((day) => {
              const items = events.filter(
                (event) => dateInput(new Date(event.startAt)) === dateInput(day),
              );
              return (
                <button
                  key={day.toISOString()}
                  className={dateInput(day) === dateInput(new Date()) ? 'today' : ''}
                  onClick={() => {
                    setAnchor(day);
                    setView('day');
                  }}
                >
                  <b>{day.getDate()}</b>
                  {items.slice(0, 3).map((event) => (
                    <span key={event.id} style={{ borderColor: event.employee.color }}>
                      {new Intl.DateTimeFormat('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(event.startAt))}{' '}
                      {event.customer.name}
                    </span>
                  ))}
                  {items.length > 3 && <small>+{items.length - 3}</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
