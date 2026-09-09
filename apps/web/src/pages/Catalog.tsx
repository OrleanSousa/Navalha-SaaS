import { useQuery } from '@tanstack/react-query';
import { Clock3, Package, Plus } from 'lucide-react';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

export function Catalog({ type }: { type: 'services' | 'products' }) {
  const { can } = useAuth();
  const product = type === 'products';
  const createPermission = product ? Permissions.PRODUCTS_CREATE : Permissions.SERVICES_CREATE;
  const { data = [] } = useQuery({
    queryKey: [type],
    queryFn: async () => (await api.get('/' + type)).data,
  });

  return (
    <div className="page">
      <div className="module-head">
        <div>
          <h2>{product ? 'Produtos' : 'Serviços'}</h2>
          <p>
            {product
              ? 'Controle produtos, preços e estoque.'
              : 'Configure seu catálogo, duração e comissões.'}
          </p>
        </div>
        {can(createPermission) && (
          <button className="primary">
            <Plus /> Novo {product ? 'produto' : 'serviço'}
          </button>
        )}
      </div>
      <div className="catalog-grid">
        {data.map((item: any) => (
          <article className="card catalog" key={item.id}>
            <span className="catalog-icon">{product ? <Package /> : '✂'}</span>
            <i className={item.active ? 'on' : 'off'}>{item.active ? 'ATIVO' : 'INATIVO'}</i>
            <h3>{item.name}</h3>
            <p>{item.description || item.category || 'Sem descrição'}</p>
            <div>
              <b>{money(Number(product ? item.salePrice : item.price))}</b>
              <small>
                {product ? (
                  `${item.stockQuantity} em estoque`
                ) : (
                  <>
                    <Clock3 /> {item.durationMinutes} min · {item.commissionPercent}% comissão
                  </>
                )}
              </small>
            </div>
          </article>
        ))}
      </div>
      {!data.length && (
        <div className="empty card">
          Nenhum item cadastrado. Execute o seed para carregar os dados de demonstração.
        </div>
      )}
    </div>
  );
}
