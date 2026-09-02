import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ChevronLeft, ChevronRight, Filter, Plus } from 'lucide-react';
export function Agenda() {
  const { data: events = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => (await api.get('/appointments')).data,
  });
  return (
    <div className="page">
      <div className="toolbar">
        <div className="seg">
          <button className="active">Dia</button>
          <button>Semana</button>
          <button>Mês</button>
        </div>
        <div className="daynav">
          <button>
            <ChevronLeft />
          </button>
          <b>Terça, 01 de setembro</b>
          <button>
            <ChevronRight />
          </button>
        </div>
        <button className="outline">
          <Filter /> Filtrar
        </button>
        <button className="primary">
          <Plus /> Novo agendamento
        </button>
      </div>
      <div className="calendar card">
        <div className="calendar-head">
          <b>Horário</b>
          <b>João Silva</b>
          <b>Carlos Lima</b>
          <b>Pedro Alves</b>
        </div>
        {Array.from({ length: 10 }, (_, i) => 8 + i).map((h) => (
          <div className="calendar-row" key={h}>
            <span>{String(h).padStart(2, '0')}:00</span>
            {[0, 1, 2].map((col) => {
              const e = events.find(
                (x: any) =>
                  new Date(x.startAt).getHours() === h &&
                  ['João Silva', 'Carlos Lima', 'Pedro Alves'][col] === x.employee.name,
              );
              return (
                <div key={col}>
                  {e && (
                    <article className={`event e${col}`}>
                      <b>{e.customer.name}</b>
                      <small>{e.services[0]?.service.name}</small>
                      <em>{e.status}</em>
                    </article>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
