import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, Check, ChevronLeft, Clock, MapPin, Scissors, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, assetUrl } from '../lib/api';
import './PublicBooking.css';

type Service = {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  durationMinutes: number;
  category?: { name: string };
};
type Professional = {
  id: string;
  name: string;
  photoUrl?: string;
  color: string;
  position?: string;
};
type Slot = { startAt: string; endAt: string };
type PageData = {
  barbershop: {
    name: string;
    tradeName?: string;
    logoUrl?: string;
    primaryColor: string;
    primaryTextColor: string;
    address?: string;
    city?: string;
    state?: string;
    settings: { timezone: string; currency: string };
  };
  services: Service[];
};

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

export function PublicBooking() {
  const { slug = '' } = useParams();
  const [serviceId, setServiceId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(tomorrow);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const page = useQuery<PageData>({
    queryKey: ['public-booking', slug],
    queryFn: async () => (await api.get(`/public/booking/${slug}`)).data,
    retry: false,
  });
  const professionals = useQuery<Professional[]>({
    queryKey: ['public-booking-professionals', slug, serviceId],
    queryFn: async () =>
      (await api.get(`/public/booking/${slug}/services/${serviceId}/professionals`)).data,
    enabled: Boolean(serviceId),
  });
  const availability = useQuery<{ slots: Slot[]; timezone: string }>({
    queryKey: ['public-booking-slots', slug, serviceId, employeeId, date],
    queryFn: async () =>
      (
        await api.get(`/public/booking/${slug}/availability`, {
          params: { serviceId, employeeId, date },
        })
      ).data,
    enabled: Boolean(serviceId && employeeId && date),
  });
  const selectedService = page.data?.services.find((item) => item.id === serviceId);
  const selectedProfessional = professionals.data?.find((item) => item.id === employeeId);
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: page.data?.barbershop.settings.currency || 'BRL',
      }),
    [page.data?.barbershop.settings.currency],
  );
  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/public/booking/${slug}/appointments`, {
          serviceId,
          employeeId,
          startAt: slot?.startAt,
          name,
          whatsapp,
        })
      ).data,
    onSuccess: setConfirmation,
    onError: () => availability.refetch(),
  });

  if (page.isLoading) return <div className="public-booking-state">Carregando agenda...</div>;
  if (page.isError || !page.data)
    return (
      <div className="public-booking-state">Esta página de agendamento não está disponível.</div>
    );
  const shop = page.data.barbershop;
  const theme = {
    '--booking-brand': shop.primaryColor,
    '--booking-brand-text': shop.primaryTextColor,
  } as React.CSSProperties;

  if (confirmation) {
    return (
      <main className="public-booking" style={theme}>
        <section className="booking-confirmation">
          <span>
            <Check />
          </span>
          <small>AGENDAMENTO CONFIRMADO</small>
          <h1>Seu horário está reservado!</h1>
          <p>Você já pode guardar os detalhes abaixo.</p>
          <div>
            <b>{confirmation.appointment.services[0].service.name}</b>
            <span>{confirmation.appointment.employee.name}</span>
            <span>{new Date(confirmation.appointment.startAt).toLocaleString('pt-BR')}</span>
            <code>#{confirmation.appointment.id.slice(0, 8).toUpperCase()}</code>
          </div>
          <button onClick={() => window.location.reload()}>Fazer outro agendamento</button>
        </section>
      </main>
    );
  }

  return (
    <main className="public-booking" style={theme}>
      <header className="booking-brand">
        <div className="booking-logo">
          {shop.logoUrl ? <img src={assetUrl(shop.logoUrl)} alt="" /> : <Scissors />}
        </div>
        <div>
          <small>AGENDAMENTO ONLINE</small>
          <h1>{shop.tradeName || shop.name}</h1>
          {(shop.address || shop.city) && (
            <p>
              <MapPin /> {[shop.address, shop.city, shop.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </header>

      <section className="booking-card">
        <div className="booking-progress">
          {['Serviço', 'Profissional', 'Horário', 'Seus dados'].map((label, index) => (
            <span
              className={[serviceId, employeeId, slot, slot && name][index] ? 'done' : ''}
              key={label}
            >
              <i>{index + 1}</i>
              {label}
            </span>
          ))}
        </div>

        {!serviceId && (
          <div className="booking-section">
            <small>PASSO 1</small>
            <h2>Qual serviço você deseja?</h2>
            <div className="booking-services">
              {page.data.services.map((service) => (
                <button key={service.id} onClick={() => setServiceId(service.id)}>
                  <span>
                    <Scissors />
                  </span>
                  <div>
                    <b>{service.name}</b>
                    <small>
                      {service.category?.name || 'Serviço'} · {service.durationMinutes} min
                    </small>
                  </div>
                  <strong>{formatter.format(Number(service.price))}</strong>
                </button>
              ))}
            </div>
          </div>
        )}

        {serviceId && !employeeId && (
          <div className="booking-section">
            <button className="booking-back" onClick={() => setServiceId('')}>
              <ChevronLeft /> Voltar
            </button>
            <small>PASSO 2</small>
            <h2>Escolha o profissional</h2>
            <div className="booking-professionals">
              {professionals.data?.map((professional) => (
                <button key={professional.id} onClick={() => setEmployeeId(professional.id)}>
                  <span style={{ background: professional.color }}>
                    {professional.photoUrl ? (
                      <img src={assetUrl(professional.photoUrl)} alt="" />
                    ) : (
                      <UserRound />
                    )}
                  </span>
                  <b>{professional.name}</b>
                  <small>{professional.position || 'Profissional'}</small>
                </button>
              ))}
            </div>
            {!professionals.isLoading && !professionals.data?.length && (
              <p className="booking-empty">Nenhum profissional disponível para este serviço.</p>
            )}
          </div>
        )}

        {employeeId && !slot && (
          <div className="booking-section">
            <button className="booking-back" onClick={() => setEmployeeId('')}>
              <ChevronLeft /> Voltar
            </button>
            <small>PASSO 3</small>
            <h2>Escolha a data e o horário</h2>
            <label className="booking-date">
              <CalendarDays />
              <input
                type="date"
                min={tomorrow()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <div className="booking-slots">
              {availability.data?.slots.map((item) => (
                <button key={item.startAt} onClick={() => setSlot(item)}>
                  <Clock />{' '}
                  {new Date(item.startAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </button>
              ))}
            </div>
            {availability.isLoading && <p className="booking-empty">Consultando horários...</p>}
            {!availability.isLoading && !availability.data?.slots.length && (
              <p className="booking-empty">Não há horários livres nesta data.</p>
            )}
          </div>
        )}

        {slot && (
          <div className="booking-section booking-details">
            <button className="booking-back" onClick={() => setSlot(null)}>
              <ChevronLeft /> Voltar
            </button>
            <small>PASSO 4</small>
            <h2>Informe seus dados</h2>
            <div className="booking-summary">
              <b>{selectedService?.name}</b>
              <span>{selectedProfessional?.name}</span>
              <span>{new Date(slot.startAt).toLocaleString('pt-BR')}</span>
            </div>
            <label>
              Seu nome
              <input
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="Como podemos chamar você?"
              />
            </label>
            <label>
              WhatsApp
              <input
                value={whatsapp}
                maxLength={20}
                onChange={(event) => setWhatsapp(event.target.value)}
                placeholder="(11) 99999-9999"
              />
            </label>
            {create.isError && (
              <p className="booking-error">
                O horário pode ter sido reservado. Escolha outro e tente novamente.
              </p>
            )}
            <button
              className="booking-submit"
              disabled={
                name.trim().length < 2 ||
                whatsapp.replace(/\D/g, '').length < 10 ||
                create.isPending
              }
              onClick={() => create.mutate()}
            >
              {create.isPending ? 'Reservando...' : 'Confirmar agendamento'}
            </button>
          </div>
        )}
      </section>
      <footer>Agendamento seguro por Navalha</footer>
    </main>
  );
}
