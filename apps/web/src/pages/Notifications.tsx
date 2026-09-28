import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  CircleDollarSign,
  Package,
  WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import './Notifications.css';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  actionUrl?: string;
  readAt?: string;
  createdAt: string;
};

const iconFor = (type: string) => {
  if (type.includes('APPOINTMENT')) return CalendarDays;
  if (type === 'LOW_STOCK') return Package;
  if (type === 'COMMISSION_PENDING') return CircleDollarSign;
  if (type.includes('ACCOUNT') || type.includes('CASH')) return WalletCards;
  return Bell;
};

export function Notifications() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery<{ items: Notification[]; unread: number }>({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['notifications'] }),
      client.invalidateQueries({ queryKey: ['notification-count'] }),
    ]);
  };
  const read = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: refresh,
  });
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: refresh,
  });
  const open = async (notification: Notification) => {
    if (!notification.readAt) await read.mutateAsync(notification.id);
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  return (
    <div className="page notifications-page">
      <div className="module-head">
        <div>
          <h2>Notificações</h2>
          <p>Avisos operacionais e eventos importantes da barbearia.</p>
        </div>
        <button
          className="outline"
          disabled={!query.data?.unread || readAll.isPending}
          onClick={() => readAll.mutate()}
        >
          <CheckCheck /> Marcar todas como lidas
        </button>
      </div>
      <section className="card notification-list">
        {query.isLoading && <div className="empty">Carregando notificações...</div>}
        {query.isError && <div className="empty">Não foi possível carregar as notificações.</div>}
        {query.data?.items.map((notification) => {
          const Icon = iconFor(notification.type);
          return (
            <button
              className={notification.readAt ? '' : 'unread'}
              key={notification.id}
              onClick={() => open(notification)}
            >
              <span>
                <Icon />
              </span>
              <div>
                <b>{notification.title}</b>
                <p>{notification.message}</p>
                <small>{new Date(notification.createdAt).toLocaleString('pt-BR')}</small>
              </div>
              {!notification.readAt && <i />}
            </button>
          );
        })}
        {!query.isLoading && !query.data?.items.length && (
          <div className="empty">
            <Bell />
            Nenhuma notificação por aqui.
          </div>
        )}
      </section>
    </div>
  );
}
