import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Image, Palette, Save, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, assetUrl } from '../lib/api';
import './Settings.css';

const days = [
  ['mon', 'Segunda'],
  ['tue', 'Terça'],
  ['wed', 'Quarta'],
  ['thu', 'Quinta'],
  ['fri', 'Sexta'],
  ['sat', 'Sábado'],
  ['sun', 'Domingo'],
] as const;
type Hour = { day: string; enabled: boolean; start: string; end: string };
type SettingsData = {
  barbershop: Record<string, any>;
  settings: Record<string, any>;
  onboarding: {
    completedSteps: string[];
    dismissedAt?: string | null;
    completedAt?: string | null;
  };
};
const errorMessage = (error: any, fallback: string) => error.response?.data?.message || fallback;

function useSettingsMutation(fn: () => Promise<any>, message: string, refresh: () => Promise<void>) {
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      toast.success(message);
      await refresh();
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Não foi possível salvar')),
  });
}

export function Settings() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  });
  const [business, setBusiness] = useState<Record<string, string>>({});
  const [regional, setRegional] = useState({ currency: 'BRL', timezone: 'America/Sao_Paulo' });
  const [operational, setOperational] = useState({
    allowNegativeStock: false,
    allowCreditSales: false,
    publicBooking: true,
  });
  const [hours, setHours] = useState<Hour[]>(
    days.map(([day]) => ({ day, enabled: day !== 'sun', start: '08:00', end: '18:00' })),
  );
  useEffect(() => {
    if (!query.data) return;
    const shop = query.data.barbershop;
    setBusiness({
      name: shop.name || '',
      tradeName: shop.tradeName || '',
      document: shop.document || '',
      ownerName: shop.ownerName || '',
      phone: shop.phone || '',
      whatsapp: shop.whatsapp || '',
      email: shop.email || '',
      address: shop.address || '',
      city: shop.city || '',
      state: shop.state || '',
      zipCode: shop.zipCode || '',
      primaryColor: shop.primaryColor || '#B8832B',
    });
    setRegional({ currency: query.data.settings.currency, timezone: query.data.settings.timezone });
    setOperational({
      allowNegativeStock: query.data.settings.allowNegativeStock,
      allowCreditSales: query.data.settings.allowCreditSales,
      publicBooking: query.data.settings.publicBooking,
    });
    const saved = query.data.settings.openingHours as Record<
      string,
      [string, string] | null
    > | null;
    if (saved)
      setHours(
        days.map(([day]) => ({
          day,
          enabled: Boolean(saved[day]),
          start: saved[day]?.[0] || '08:00',
          end: saved[day]?.[1] || '18:00',
        })),
      );
  }, [query.data]);
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['settings'] }),
      client.invalidateQueries({ queryKey: ['workspace'] }),
    ]);
  }
  const saveBusiness = useSettingsMutation(
    () => api.patch('/settings/business', business),
    'Identidade atualizada',
    refresh,
  );
  const saveRegional = useSettingsMutation(
    () => api.patch('/settings/regional', regional),
    'Preferências regionais atualizadas',
    refresh,
  );
  const saveHours = useSettingsMutation(
    () => api.patch('/settings/opening-hours', { hours }),
    'Horários atualizados',
    refresh,
  );
  const saveOperational = useSettingsMutation(
    () => api.patch('/settings/operational', operational),
    'Regras operacionais atualizadas',
    refresh,
  );
  const onboardingAction = useMutation({
    mutationFn: (action: 'dismiss' | 'resume') => api.post(`/settings/onboarding/${action}`),
    onSuccess: refresh,
  });
  const logo = useMutation({
    mutationFn: (file: File) => {
      const data = new FormData();
      data.append('logo', file);
      return api.post('/settings/logo', data);
    },
    onSuccess: async () => {
      toast.success('Logo atualizado');
      await refresh();
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Não foi possível enviar o logo')),
  });
  if (query.isLoading) return <div className="empty big">Carregando configurações...</div>;
  if (query.isError || !query.data)
    return <div className="empty big">Não foi possível carregar as configurações.</div>;
  const completed = query.data.onboarding.completedSteps;
  const steps = [
    ['BUSINESS', 'Identidade', 'Informe os dados e a marca da barbearia.', '#business'],
    ['HOURS', 'Horários', 'Configure os dias de funcionamento.', '#hours'],
    ['TEAM', 'Equipe', 'Cadastre ao menos um colaborador.', '/colaboradores'],
    ['SERVICES', 'Serviços', 'Cadastre os serviços oferecidos.', '/servicos'],
    ['BOOKING', 'Agendamento', 'Ative o agendamento público.', '#operational'],
  ];
  return (
    <div className="page settings-page">
      <div className="module-head">
        <div>
          <h2>Configurações</h2>
          <p>Identidade, operação e primeiro acesso da barbearia.</p>
        </div>
      </div>
      <section
        className={`card onboarding-panel ${query.data.onboarding.dismissedAt ? 'dismissed' : ''}`}
      >
        <div className="onboarding-head">
          <div>
            <span className="eyebrow">PRIMEIRO ACESSO</span>
            <h3>
              {query.data.onboarding.completedAt
                ? 'Configuração concluída'
                : `${completed.length} de 5 passos concluídos`}
            </h3>
          </div>
          <button
            className="outline"
            onClick={() =>
              onboardingAction.mutate(query.data.onboarding.dismissedAt ? 'resume' : 'dismiss')
            }
          >
            {query.data.onboarding.dismissedAt ? 'Retomar onboarding' : 'Dispensar por agora'}
          </button>
        </div>
        <div className="onboarding-progress">
          <i style={{ width: `${completed.length * 20}%` }} />
        </div>
        {!query.data.onboarding.dismissedAt && (
          <div className="onboarding-steps">
            {steps.map(([key, title, description, target], index) => (
              <button
                className={completed.includes(key) ? 'done' : ''}
                key={key}
                onClick={() =>
                  target.startsWith('/')
                    ? navigate(target)
                    : document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                <span>{completed.includes(key) ? <Check /> : index + 1}</span>
                <b>{title}</b>
                <small>{description}</small>
              </button>
            ))}
          </div>
        )}
      </section>
      <form
        id="business"
        className="card settings-section"
        onSubmit={(event) => {
          event.preventDefault();
          saveBusiness.mutate();
        }}
      >
        <div className="settings-title">
          <Palette />
          <div>
            <h3>Dados e identidade</h3>
            <p>Essas informações aparecem no painel e no agendamento.</p>
          </div>
        </div>
        <div className="settings-logo">
          <label>
            {query.data.barbershop.logoUrl ? (
              <img src={assetUrl(query.data.barbershop.logoUrl)} alt="Logo" />
            ) : (
              <Image />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => event.target.files?.[0] && logo.mutate(event.target.files[0])}
            />
          </label>
          <span>
            <b>Logo da barbearia</b>
            <small>PNG, JPEG ou WebP, até 5 MB.</small>
          </span>
        </div>
        <div className="settings-grid">
          {[
            ['name', 'Nome'],
            ['tradeName', 'Nome fantasia'],
            ['ownerName', 'Responsável'],
            ['document', 'CPF/CNPJ'],
            ['phone', 'Telefone'],
            ['whatsapp', 'WhatsApp'],
            ['email', 'E-mail'],
            ['address', 'Endereço'],
            ['city', 'Cidade'],
            ['state', 'UF'],
            ['zipCode', 'CEP'],
          ].map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                required={['name', 'ownerName'].includes(field)}
                value={business[field] || ''}
                onChange={(event) => setBusiness({ ...business, [field]: event.target.value })}
              />
            </label>
          ))}
          <label>
            Cor principal
            <div className="color-input">
              <input
                type="color"
                value={business.primaryColor || '#B8832B'}
                onChange={(event) => setBusiness({ ...business, primaryColor: event.target.value })}
              />
              <code>{business.primaryColor}</code>
            </div>
          </label>
        </div>
        <SaveButton pending={saveBusiness.isPending} />
      </form>
      <form
        id="hours"
        className="card settings-section"
        onSubmit={(event) => {
          event.preventDefault();
          saveHours.mutate();
        }}
      >
        <div className="settings-title">
          <Settings2 />
          <div>
            <h3>Horário de funcionamento</h3>
            <p>Defina a disponibilidade geral de cada dia.</p>
          </div>
        </div>
        <div className="opening-hours">
          {hours.map((hour, index) => (
            <div key={hour.day}>
              <label>
                <input
                  type="checkbox"
                  checked={hour.enabled}
                  onChange={(event) =>
                    setHours(
                      hours.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                      ),
                    )
                  }
                />{' '}
                {days.find(([day]) => day === hour.day)?.[1]}
              </label>
              <input
                type="time"
                disabled={!hour.enabled}
                value={hour.start}
                onChange={(event) =>
                  setHours(
                    hours.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, start: event.target.value } : item,
                    ),
                  )
                }
              />
              <span>até</span>
              <input
                type="time"
                disabled={!hour.enabled}
                value={hour.end}
                onChange={(event) =>
                  setHours(
                    hours.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, end: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
        <SaveButton pending={saveHours.isPending} />
      </form>
      <div className="settings-columns">
        <form
          className="card settings-section"
          onSubmit={(event) => {
            event.preventDefault();
            saveRegional.mutate();
          }}
        >
          <div className="settings-title">
            <Settings2 />
            <div>
              <h3>Região</h3>
              <p>Moeda e fuso usados nos dados.</p>
            </div>
          </div>
          <div className="settings-grid">
            <label>
              Moeda
              <select
                value={regional.currency}
                onChange={(event) => setRegional({ ...regional, currency: event.target.value })}
              >
                <option value="BRL">Real (BRL)</option>
                <option value="USD">Dólar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </label>
            <label>
              Fuso horário
              <select
                value={regional.timezone}
                onChange={(event) => setRegional({ ...regional, timezone: event.target.value })}
              >
                <option value="America/Sao_Paulo">Brasília</option>
                <option value="America/Manaus">Manaus</option>
                <option value="America/Rio_Branco">Rio Branco</option>
                <option value="America/Fortaleza">Fortaleza</option>
              </select>
            </label>
          </div>
          <SaveButton pending={saveRegional.isPending} />
        </form>
        <form
          id="operational"
          className="card settings-section"
          onSubmit={(event) => {
            event.preventDefault();
            saveOperational.mutate();
          }}
        >
          <div className="settings-title">
            <Settings2 />
            <div>
              <h3>Regras operacionais</h3>
              <p>Comportamentos permitidos no sistema.</p>
            </div>
          </div>
          <div className="settings-toggles">
            <Toggle
              label="Permitir estoque negativo"
              checked={operational.allowNegativeStock}
              onChange={(value) => setOperational({ ...operational, allowNegativeStock: value })}
            />
            <Toggle
              label="Permitir venda a prazo"
              checked={operational.allowCreditSales}
              onChange={(value) => setOperational({ ...operational, allowCreditSales: value })}
            />
            <Toggle
              label="Agendamento público"
              checked={operational.publicBooking}
              onChange={(value) => setOperational({ ...operational, publicBooking: value })}
            />
          </div>
          {operational.publicBooking && query.data.barbershop.slug && (
            <a
              className="public-booking-link"
              href={`/agendar/${query.data.barbershop.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir página pública de agendamento
            </a>
          )}
          <SaveButton pending={saveOperational.isPending} />
        </form>
      </div>
    </div>
  );
}
function SaveButton({ pending }: { pending: boolean }) {
  return (
    <div className="settings-actions">
      <button className="primary" disabled={pending}>
        <Save /> {pending ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
