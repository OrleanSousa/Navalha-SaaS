# Decisões de segurança

## PostgreSQL Row Level Security

O isolamento principal continua na aplicação: o tenant vem exclusivamente do JWT, repositories filtram por `barbershopId`, relacionamentos são validados e a suíte E2E cruza IDs de tenants diferentes.

A segunda barreira está pronta em `ops/rls.sql`. Ela habilita políticas nas tabelas empresariais e compara `barbershopId` com `app.current_tenant_id`. As políticas falham fechadas quando não há contexto. `ops/database-roles.sql` separa o proprietário de migrations (`navalha_owner`) do papel da aplicação (`navalha_app`), que não possui `BYPASSRLS`.

Regras obrigatórias na ativação:

1. migrations e seed usam apenas o papel proprietário;
2. a API usa o papel limitado e define o tenant com `SET LOCAL` dentro da mesma transação das consultas;
3. operações globais de Super Admin usam uma conexão administrativa separada e são auditadas;
4. testes conectam explicitamente como `navalha_app`, pois o proprietário das tabelas ignora RLS por padrão;
5. o rollout ocorre primeiro em homologação, com teste Barbearia A versus Barbearia B.

O RLS não é aplicado automaticamente pela migration para evitar bloquear login, Super Admin ou migrations em instalações que ainda usam uma única conta. Sua ativação é uma etapa operacional vinculada ao provisionamento do banco gerenciado.

## Aplicação

JWTs são curtos e refresh tokens rotativos ficam em cookie HTTP-only. Senhas usam bcrypt, DTOs rejeitam campos extras, Helmet configura headers, CORS aceita origem explícita e os endpoints sensíveis têm rate limiting. Uploads validam tamanho, MIME e assinatura binária.

Logs HTTP são JSON e recebem correlation ID. Snapshots da auditoria mascaram senhas, tokens, documentos e contatos. Erros 5xx são enviados ao Sentry somente quando `SENTRY_DSN` estiver configurado, sem PII padrão.

A revisão detalhada e a rotina pré-release estão em `docs/SECURITY-REVIEW.md`.
