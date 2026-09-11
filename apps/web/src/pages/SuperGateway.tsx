import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, PlugZap, Save, Webhook } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

type GatewayConfiguration = {
  provider: 'MANUAL' | 'CUSTOM';
  environment: 'SANDBOX' | 'PRODUCTION';
  enabled: boolean;
  apiBaseUrl?: string;
  webhookUrl?: string;
  publicKey?: string;
  secretEnvVar: string;
  webhookSecretEnvVar: string;
  apiSecretConfigured: boolean;
  webhookSecretConfigured: boolean;
};

const emptyConfiguration: GatewayConfiguration = {
  provider: 'MANUAL',
  environment: 'SANDBOX',
  enabled: false,
  apiBaseUrl: '',
  webhookUrl: '',
  publicKey: '',
  secretEnvVar: 'BILLING_GATEWAY_API_KEY',
  webhookSecretEnvVar: 'BILLING_GATEWAY_WEBHOOK_SECRET',
  apiSecretConfigured: false,
  webhookSecretConfigured: false,
};

function errorMessage(error: any) {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message[0] : message || 'Não foi possível salvar a integração';
}

export function SuperGateway() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<GatewayConfiguration>(emptyConfiguration);
  const { data, isLoading, isError } = useQuery<GatewayConfiguration>({
    queryKey: ['super-admin', 'billing-gateway'],
    queryFn: async () => (await api.get('/super-admin/billing/gateway')).data,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.patch('/super-admin/billing/gateway', {
        provider: form.provider,
        environment: form.environment,
        enabled: form.enabled,
        apiBaseUrl: form.apiBaseUrl || undefined,
        webhookUrl: form.webhookUrl || undefined,
        publicKey: form.publicKey || undefined,
        secretEnvVar: form.secretEnvVar,
        webhookSecretEnvVar: form.webhookSecretEnvVar,
      }),
    onSuccess: async () => {
      toast.success('Configuração do gateway atualizada');
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'billing-gateway'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isLoading) return <div className="empty card">Carregando integração...</div>;
  if (isError) return <div className="empty card">Não foi possível carregar a integração.</div>;

  const update = <K extends keyof GatewayConfiguration>(field: K, value: GatewayConfiguration[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  return (
    <section className="gateway-module">
      <div className="module-head">
        <div>
          <span className="eyebrow">COBRANÇA EXTERNA</span>
          <h2>Integração de pagamento</h2>
          <p>Configuração do adaptador usado nas assinaturas da plataforma.</p>
        </div>
        <label className="gateway-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => update('enabled', event.target.checked)}
          />
          <span />
          {form.enabled ? 'Ativo' : 'Inativo'}
        </label>
      </div>

      <div className="gateway-status-grid">
        <article className="card gateway-status">
          <span>
            <PlugZap />
          </span>
          <div>
            <small>ADAPTADOR</small>
            <b>{form.provider === 'MANUAL' ? 'Manual' : 'Personalizado'}</b>
          </div>
          <em className={form.enabled ? 'ready' : ''}>{form.enabled ? 'ATIVO' : 'INATIVO'}</em>
        </article>
        <article className="card gateway-status">
          <span>
            <KeyRound />
          </span>
          <div>
            <small>CHAVE DA API</small>
            <b>{form.secretEnvVar}</b>
          </div>
          <em className={form.apiSecretConfigured ? 'ready' : ''}>
            {form.apiSecretConfigured ? 'CONFIGURADA' : 'AUSENTE'}
          </em>
        </article>
        <article className="card gateway-status">
          <span>
            <Webhook />
          </span>
          <div>
            <small>SEGREDO DO WEBHOOK</small>
            <b>{form.webhookSecretEnvVar}</b>
          </div>
          <em className={form.webhookSecretConfigured ? 'ready' : ''}>
            {form.webhookSecretConfigured ? 'CONFIGURADO' : 'AUSENTE'}
          </em>
        </article>
      </div>

      <form
        className="card gateway-form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Adaptador
          <select
            value={form.provider}
            onChange={(event) =>
              update('provider', event.target.value as GatewayConfiguration['provider'])
            }
          >
            <option value="MANUAL">Manual</option>
            <option value="CUSTOM">Personalizado</option>
          </select>
        </label>
        <label>
          Ambiente
          <select
            value={form.environment}
            onChange={(event) =>
              update('environment', event.target.value as GatewayConfiguration['environment'])
            }
          >
            <option value="SANDBOX">Sandbox</option>
            <option value="PRODUCTION">Produção</option>
          </select>
        </label>
        <label className="wide">
          URL base da API
          <input
            type="url"
            value={form.apiBaseUrl || ''}
            onChange={(event) => update('apiBaseUrl', event.target.value)}
          />
        </label>
        <label className="wide">
          URL do webhook
          <input
            type="url"
            value={form.webhookUrl || ''}
            onChange={(event) => update('webhookUrl', event.target.value)}
          />
        </label>
        <label>
          Chave pública
          <input
            value={form.publicKey || ''}
            onChange={(event) => update('publicKey', event.target.value)}
          />
        </label>
        <label>
          Variável da chave secreta
          <input
            required
            pattern="[A-Z][A-Z0-9_]{2,63}"
            value={form.secretEnvVar}
            onChange={(event) => update('secretEnvVar', event.target.value.toUpperCase())}
          />
        </label>
        <label>
          Variável do segredo do webhook
          <input
            required
            pattern="[A-Z][A-Z0-9_]{2,63}"
            value={form.webhookSecretEnvVar}
            onChange={(event) => update('webhookSecretEnvVar', event.target.value.toUpperCase())}
          />
        </label>
        <div className="gateway-form-actions wide">
          <button className="primary" disabled={save.isPending}>
            <Save /> {save.isPending ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </form>
    </section>
  );
}
