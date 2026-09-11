import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  PowerOff,
  Save,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, assetUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

type Employee = {
  id: string;
  name: string;
  photoUrl?: string | null;
  position?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  address?: string | null;
  hiredAt?: string | null;
  notes?: string | null;
  active: boolean;
  color: string;
  defaultCommission: string | number;
  user?: { email: string; active: boolean } | null;
  _count: { appointments: number; employeeServices: number };
};

type EmployeePage = {
  items: Employee[];
  page: number;
  limit: number;
  total: number;
  pages: number;
  positions: string[];
};

const emptyForm = {
  name: '',
  cpf: '',
  birthDate: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  position: '',
  hiredAt: '',
  color: '#4F7CAC',
  defaultCommission: '0',
  notes: '',
};

export function Employees() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [position, setPosition] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [pendingStatusId, setPendingStatusId] = useState<string>();
  const [photoFile, setPhotoFile] = useState<File>();
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('');
  const [form, setForm] = useState(emptyForm);

  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : currentPhotoUrl),
    [photoFile, currentPhotoUrl],
  );

  useEffect(
    () => () => {
      if (photoFile && photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoFile, photoPreview],
  );

  useEffect(() => setPage(1), [search, status, position]);

  const { data, isLoading, isError } = useQuery<EmployeePage>({
    queryKey: ['employees', { search, status, position, page }],
    queryFn: async () =>
      (
        await api.get('/employees', {
          params: {
            page,
            limit: 10,
            search: search || undefined,
            status,
            position: position || undefined,
          },
        })
      ).data,
    placeholderData: (previous) => previous,
  });

  const save = useMutation({
    mutationFn: async () => {
      const values = editingId
        ? Object.fromEntries(
            Object.entries(form).map(([key, value]) => [key, value === '' ? null : value]),
          )
        : Object.fromEntries(
            Object.entries(form).filter(
              ([key, value]) => key === 'color' || key === 'defaultCommission' || value,
            ),
          );
      const payload = { ...values, defaultCommission: Number(form.defaultCommission) };
      const response = editingId
        ? api.patch(`/employees/${editingId}`, payload)
        : api.post('/employees', payload);
      const saved = await response;
      let photoUploaded = true;
      if (photoFile) {
        const photo = new FormData();
        photo.append('photo', photoFile);
        try {
          await api.post(`/employees/${saved.data.id}/photo`, photo);
        } catch {
          photoUploaded = false;
        }
      }
      return { saved, photoUploaded };
    },
    onSuccess: async ({ photoUploaded }) => {
      if (photoUploaded) {
        toast.success(editingId ? 'Colaborador atualizado' : 'Colaborador cadastrado');
      } else {
        toast.warning('Dados salvos, mas não foi possível enviar a foto');
      }
      closeForm();
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível salvar o colaborador'),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => {
      setPendingStatusId(id);
      return api.patch(`/employees/${id}/status`, { active });
    },
    onSuccess: async (_, { active }) => {
      toast.success(active ? 'Colaborador reativado' : 'Colaborador inativado');
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível alterar o status'),
    onSettled: () => setPendingStatusId(undefined),
  });

  function closeForm() {
    setShowForm(false);
    setEditingId(undefined);
    setPhotoFile(undefined);
    setCurrentPhotoUrl('');
    setForm(emptyForm);
  }

  function edit(employee: Employee) {
    setEditingId(employee.id);
    setPhotoFile(undefined);
    setCurrentPhotoUrl(assetUrl(employee.photoUrl));
    setForm({
      name: employee.name,
      cpf: employee.cpf || '',
      birthDate: employee.birthDate?.slice(0, 10) || '',
      phone: employee.phone || '',
      whatsapp: employee.whatsapp || '',
      email: employee.email || '',
      address: employee.address || '',
      position: employee.position || '',
      hiredAt: employee.hiredAt?.slice(0, 10) || '',
      color: employee.color,
      defaultCommission: String(employee.defaultCommission),
      notes: employee.notes || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleStatus(employee: Employee) {
    const action = employee.active ? 'inativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} ${employee.name}?`)) return;
    changeStatus.mutate({ id: employee.id, active: !employee.active });
  }

  function selectPhoto(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Selecione uma imagem JPEG, PNG ou WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A foto deve ter no máximo 5 MB');
      return;
    }
    setPhotoFile(file);
  }

  return (
    <div className="page employees-module">
      <div className="module-head">
        <div>
          <h2>Colaboradores</h2>
          <p>Consulte a equipe, os contatos e os acessos ao sistema.</p>
        </div>
        <div className="employee-head-actions">
          <span className="employee-total">{data?.total ?? 0} cadastrados</span>
          {can(Permissions.EMPLOYEES_CREATE) && (
            <button
              className="primary"
              onClick={() => {
                setEditingId(undefined);
                setPhotoFile(undefined);
                setCurrentPhotoUrl('');
                setForm(emptyForm);
                setShowForm(true);
              }}
            >
              <Plus /> Novo colaborador
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form
          className="card employee-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="employee-form-head">
            <div>
              <h3>{editingId ? 'Editar colaborador' : 'Novo colaborador'}</h3>
              <p>Informe os dados profissionais e de contato.</p>
            </div>
            <button
              type="button"
              className="icon"
              onClick={closeForm}
              title="Fechar formulário"
              aria-label="Fechar formulário"
            >
              <X />
            </button>
          </div>
          {can(Permissions.EMPLOYEES_PHOTO) && (
            <div className="employee-photo-field">
              <span className="employee-photo-preview">
                {photoPreview ? <img src={photoPreview} alt="Prévia da foto" /> : <Camera />}
              </span>
              <div>
                <b>Foto do colaborador</b>
                <small>JPEG, PNG ou WebP, até 5 MB</small>
              </div>
              <label className="outline">
                <Camera /> Selecionar foto
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => selectPhoto(event.target.files?.[0])}
                />
              </label>
            </div>
          )}
          <div className="employee-form-grid">
            <label>
              Nome completo
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              Cargo
              <input
                value={form.position}
                onChange={(event) => setForm({ ...form, position: event.target.value })}
                maxLength={80}
              />
            </label>
            <label>
              CPF
              <input
                value={form.cpf}
                onChange={(event) => setForm({ ...form, cpf: event.target.value })}
                maxLength={20}
              />
            </label>
            <label>
              Data de nascimento
              <input
                type="date"
                value={form.birthDate}
                onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
              />
            </label>
            <label>
              Telefone
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                maxLength={30}
              />
            </label>
            <label>
              WhatsApp
              <input
                value={form.whatsapp}
                onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
                maxLength={30}
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                maxLength={160}
              />
            </label>
            <label>
              Data de contratação
              <input
                type="date"
                value={form.hiredAt}
                onChange={(event) => setForm({ ...form, hiredAt: event.target.value })}
              />
            </label>
            <label>
              Comissão padrão (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.defaultCommission}
                onChange={(event) => setForm({ ...form, defaultCommission: event.target.value })}
                required
              />
            </label>
            <label>
              Cor na agenda
              <span className="employee-color-input">
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) => setForm({ ...form, color: event.target.value })}
                />
                {form.color.toUpperCase()}
              </span>
            </label>
            <label className="wide">
              Endereço
              <input
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                maxLength={240}
              />
            </label>
            <label className="wide">
              Observações
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                maxLength={1000}
              />
            </label>
          </div>
          <div className="employee-form-actions">
            <button type="submit" className="primary" disabled={save.isPending}>
              <Save /> {save.isPending ? 'Salvando...' : 'Salvar colaborador'}
            </button>
          </div>
        </form>
      )}

      <div className="employee-filters">
        <label className="search">
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, contato ou CPF..."
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Status"
        >
          <option value="ALL">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </select>
        <select
          value={position}
          onChange={(event) => setPosition(event.target.value)}
          aria-label="Cargo"
        >
          <option value="">Todos os cargos</option>
          {data?.positions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="card employee-table">
        {isLoading ? (
          <div className="empty">Carregando colaboradores...</div>
        ) : isError ? (
          <div className="empty">Não foi possível carregar os colaboradores.</div>
        ) : !data?.items.length ? (
          <div className="empty">Nenhum colaborador encontrado para os filtros selecionados.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Contato</th>
                <th>Atuação</th>
                <th>Comissão</th>
                <th>Acesso</th>
                <th>Status</th>
                <th aria-label="Ações"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="employee-person">
                      {employee.photoUrl ? (
                        <img src={assetUrl(employee.photoUrl)} alt="" />
                      ) : (
                        <span
                          style={{ backgroundColor: `${employee.color}24`, color: employee.color }}
                        >
                          {employee.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <b>{employee.name}</b>
                        <small>{employee.position || 'Cargo não informado'}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="employee-contact">
                      <small>
                        <Phone /> {employee.whatsapp || employee.phone || 'Não informado'}
                      </small>
                      <small>
                        <Mail /> {employee.email || employee.user?.email || 'Não informado'}
                      </small>
                    </div>
                  </td>
                  <td>{employee._count.employeeServices} serviços</td>
                  <td>{Number(employee.defaultCommission).toLocaleString('pt-BR')}%</td>
                  <td>
                    <span className={`access-state ${employee.user?.active ? 'enabled' : ''}`}>
                      <UserRound />{' '}
                      {employee.user
                        ? employee.user.active
                          ? 'Liberado'
                          : 'Bloqueado'
                        : 'Sem acesso'}
                    </span>
                  </td>
                  <td>
                    <span className={`employee-status ${employee.active ? 'active' : ''}`}>
                      {employee.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="employee-row-actions">
                      {can(Permissions.EMPLOYEES_UPDATE) && (
                        <button
                          className="icon"
                          onClick={() => edit(employee)}
                          title="Editar colaborador"
                          aria-label={`Editar ${employee.name}`}
                        >
                          <Pencil />
                        </button>
                      )}
                      {can(Permissions.EMPLOYEES_STATUS) && (
                        <button
                          className={`icon status-action ${employee.active ? 'deactivate' : 'activate'}`}
                          onClick={() => toggleStatus(employee)}
                          disabled={pendingStatusId === employee.id}
                          title={employee.active ? 'Inativar colaborador' : 'Reativar colaborador'}
                          aria-label={`${employee.active ? 'Inativar' : 'Reativar'} ${employee.name}`}
                        >
                          {employee.active ? <PowerOff /> : <Power />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!!data?.total && (
          <div className="employee-pagination">
            <span>
              Página {data.page} de {Math.max(data.pages, 1)}
            </span>
            <div>
              <button
                className="icon outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={data.page <= 1}
                title="Página anterior"
                aria-label="Página anterior"
              >
                <ChevronLeft />
              </button>
              <button
                className="icon outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={data.page >= data.pages}
                title="Próxima página"
                aria-label="Próxima página"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
