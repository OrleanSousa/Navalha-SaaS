import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  correlationId?: string;
  createdAt: string;
  user?: { name: string };
};

export function AuditLogs() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery<{ items: AuditLog[]; total: number; pages: number }>({
    queryKey: ['audit-logs', search, page],
    queryFn: async () =>
      (await api.get('/audit-logs', { params: { search: search || undefined, page, limit: 20 } }))
        .data,
  });

  return (
    <div className="page">
      <div className="module-head">
        <div>
          <h2>Auditoria</h2>
          <p>Histórico rastreável de alterações administrativas e operacionais.</p>
        </div>
      </div>
      <section className="card table-card">
        <div className="table-tools">
          <label className="search">
            <Search />
            <input
              value={search}
              placeholder="Ação, entidade, usuário ou identificador"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <span>{query.data?.total || 0} registros</span>
        </div>
        {query.isLoading && <div className="empty">Carregando auditoria...</div>}
        {query.isError && <div className="empty">Não foi possível carregar a auditoria.</div>}
        {query.data?.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Responsável</th>
                <th>Correlação</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                  <td>
                    <b>{item.action}</b>
                  </td>
                  <td>
                    {item.entity}
                    {item.entityId ? ` · ${item.entityId.slice(0, 8)}` : ''}
                  </td>
                  <td>{item.user?.name || 'Sistema'}</td>
                  <td>
                    <small>{item.correlationId?.slice(0, 12) || '—'}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {!query.isLoading && !query.isError && !query.data?.items.length && (
          <div className="empty">
            <ShieldCheck /> Nenhum evento encontrado.
          </div>
        )}
        {Boolean(query.data?.pages && query.data.pages > 1) && (
          <div className="customer-pagination">
            <button className="icon" disabled={page === 1} onClick={() => setPage(page - 1)}>
              ‹
            </button>
            <span>
              Página {page} de {query.data?.pages}
            </span>
            <button
              className="icon"
              disabled={page === query.data?.pages}
              onClick={() => setPage(page + 1)}
            >
              ›
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
