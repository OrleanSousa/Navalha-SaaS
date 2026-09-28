import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Eye, Package, Pencil, Plus, Power, Save, Tags, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

type ServiceCategory = { id: string; name: string };
type Service = {
  id: string;
  name: string;
  description?: string | null;
  category?: ServiceCategory | null;
  price: string | number;
  durationMinutes: number;
  commissionPercent?: string | number | null;
  commissionFixed?: string | number | null;
  active: boolean;
  _count?: { employeeServices: number };
};

const emptyServiceForm = {
  name: '',
  description: '',
  categoryId: '',
  price: '',
  durationMinutes: '30',
  commissionType: 'PERCENT',
  commissionValue: '',
};

export function Catalog({ type }: { type: 'services' | 'products' }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const product = type === 'products';
  const createPermission = product ? Permissions.PRODUCTS_CREATE : Permissions.SERVICES_CREATE;
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Service[]>({
    queryKey: [type],
    queryFn: async () => (await api.get('/' + type)).data,
  });
  const { data: categories = [] } = useQuery<ServiceCategory[]>({
    queryKey: ['service-categories'],
    queryFn: async () => (await api.get('/services/categories')).data,
    enabled: !product,
  });

  const saveService = useMutation({
    mutationFn: () => {
      const payload = {
        name: serviceForm.name,
        description: serviceForm.description || null,
        categoryId: serviceForm.categoryId || null,
        price: Number(serviceForm.price),
        durationMinutes: Number(serviceForm.durationMinutes),
        commissionPercent:
          serviceForm.commissionType === 'PERCENT' && serviceForm.commissionValue !== ''
            ? Number(serviceForm.commissionValue)
            : null,
        commissionFixed:
          serviceForm.commissionType === 'FIXED' && serviceForm.commissionValue !== ''
            ? Number(serviceForm.commissionValue)
            : null,
      };
      return editingId
        ? api.patch(`/services/${editingId}`, payload)
        : api.post('/services', payload);
    },
    onSuccess: async () => {
      toast.success(editingId ? 'Serviço atualizado' : 'Serviço cadastrado');
      closeServiceForm();
      await queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível salvar o serviço'),
  });

  const createCategory = useMutation({
    mutationFn: () => api.post('/services/categories', { name: categoryName }),
    onSuccess: async () => {
      toast.success('Categoria cadastrada');
      setCategoryName('');
      setShowCategoryForm(false);
      await queryClient.invalidateQueries({ queryKey: ['service-categories'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível cadastrar a categoria'),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/services/${id}/status`, { active }),
    onSuccess: async (_, { active }) => {
      toast.success(active ? 'Serviço ativado' : 'Serviço inativado');
      await queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível alterar o status'),
  });

  function closeServiceForm() {
    setShowServiceForm(false);
    setEditingId(undefined);
    setServiceForm(emptyServiceForm);
  }

  function editService(service: Service) {
    setEditingId(service.id);
    setShowServiceForm(true);
    setServiceForm({
      name: service.name,
      description: service.description || '',
      categoryId: service.category?.id || '',
      price: String(service.price),
      durationMinutes: String(service.durationMinutes),
      commissionType: service.commissionFixed != null ? 'FIXED' : 'PERCENT',
      commissionValue: String(service.commissionFixed ?? service.commissionPercent ?? ''),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page">
      <div className="module-head">
        <div>
          <h2>{product ? 'Produtos' : 'Serviços'}</h2>
          <p>
            {product
              ? 'Controle produtos, preços e estoque.'
              : 'Configure catálogo, profissionais e comissões.'}
          </p>
        </div>
        <div className="service-head-actions">
          {!product && can(Permissions.SERVICES_CATEGORIES) && (
            <button className="outline" onClick={() => setShowCategoryForm((value) => !value)}>
              <Tags /> Categorias
            </button>
          )}
          {can(createPermission) && !product && !showServiceForm && (
            <button className="primary" onClick={() => setShowServiceForm(true)}>
              <Plus /> Novo serviço
            </button>
          )}
        </div>
      </div>

      {!product && showCategoryForm && (
        <form
          className="card category-form"
          onSubmit={(event) => {
            event.preventDefault();
            createCategory.mutate();
          }}
        >
          <label>
            Nova categoria
            <input
              required
              minLength={2}
              maxLength={80}
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
            />
          </label>
          <button className="primary" disabled={createCategory.isPending}>
            <Save /> Salvar
          </button>
        </form>
      )}

      {!product && showServiceForm && (
        <form
          className="card service-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveService.mutate();
          }}
        >
          <div className="service-form-head">
            <div>
              <h3>{editingId ? 'Editar serviço' : 'Novo serviço'}</h3>
              <p>Dados comerciais e regra padrão de comissão.</p>
            </div>
            <button className="icon" type="button" title="Fechar" onClick={closeServiceForm}>
              <X />
            </button>
          </div>
          <div className="service-form-grid">
            <label>
              Nome
              <input
                required
                minLength={2}
                maxLength={120}
                value={serviceForm.name}
                onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })}
              />
            </label>
            <label>
              Categoria
              <select
                value={serviceForm.categoryId}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, categoryId: event.target.value })
                }
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preço (R$)
              <input
                required
                type="number"
                min="0.01"
                max="99999999.99"
                step="0.01"
                value={serviceForm.price}
                onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })}
              />
            </label>
            <label>
              Duração (minutos)
              <input
                required
                type="number"
                min="1"
                max="1440"
                step="1"
                value={serviceForm.durationMinutes}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, durationMinutes: event.target.value })
                }
              />
            </label>
            <label>
              Tipo de comissão
              <select
                value={serviceForm.commissionType}
                onChange={(event) =>
                  setServiceForm({
                    ...serviceForm,
                    commissionType: event.target.value,
                    commissionValue: '',
                  })
                }
              >
                <option value="PERCENT">Percentual</option>
                <option value="FIXED">Valor fixo</option>
              </select>
            </label>
            <label>
              {serviceForm.commissionType === 'FIXED' ? 'Comissão (R$)' : 'Comissão (%)'}
              <input
                type="number"
                min="0"
                max={serviceForm.commissionType === 'PERCENT' ? '100' : '99999999.99'}
                step="0.01"
                value={serviceForm.commissionValue}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, commissionValue: event.target.value })
                }
              />
            </label>
            <label className="wide">
              Descrição
              <textarea
                maxLength={1000}
                rows={3}
                value={serviceForm.description}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, description: event.target.value })
                }
              />
            </label>
          </div>
          <div className="service-form-actions">
            <button className="outline" type="button" onClick={closeServiceForm}>
              Cancelar
            </button>
            <button className="primary" disabled={saveService.isPending}>
              <Save /> {saveService.isPending ? 'Salvando...' : 'Salvar serviço'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <div className="empty card">Carregando catálogo...</div>}
      {isError && (
        <div className="empty card catalog-error">
          Não foi possível carregar o catálogo.
          <button className="outline" onClick={() => refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!isLoading && !isError && (
        <div className="catalog-grid">
          {data.map((item: any) => (
            <article className="card catalog" key={item.id}>
              <span className="catalog-icon">{product ? <Package /> : '✂'}</span>
              <i className={item.active ? 'on' : 'off'}>{item.active ? 'ATIVO' : 'INATIVO'}</i>
              <h3>{item.name}</h3>
              <p>{item.description || item.category?.name || item.category || 'Sem descrição'}</p>
              <div>
                <b>{money(Number(product ? item.salePrice : item.price))}</b>
                <small>
                  {product ? (
                    `${item.stockQuantity} em estoque`
                  ) : (
                    <>
                      <Clock3 /> {item.durationMinutes} min · {item._count?.employeeServices || 0}{' '}
                      profissionais
                    </>
                  )}
                </small>
              </div>
              {!product && (
                <footer className="catalog-actions">
                  <Link className="icon" title="Detalhes" to={`/servicos/${item.id}`}>
                    <Eye />
                  </Link>
                  {can(Permissions.SERVICES_UPDATE) && (
                    <button className="icon" title="Editar" onClick={() => editService(item)}>
                      <Pencil />
                    </button>
                  )}
                  {can(Permissions.SERVICES_STATUS) && (
                    <button
                      className="icon"
                      title={item.active ? 'Inativar' : 'Ativar'}
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: item.id, active: !item.active })}
                    >
                      <Power />
                    </button>
                  )}
                </footer>
              )}
            </article>
          ))}
        </div>
      )}
      {!isLoading && !isError && !data.length && (
        <div className="empty card">Nenhum {product ? 'produto' : 'serviço'} cadastrado.</div>
      )}
    </div>
  );
}
