# Navalha — Gestão inteligente para barbearias

> Progresso e tarefas restantes: consulte [`docs/ROADMAP.md`](docs/ROADMAP.md).

SaaS multiempresa responsivo para agenda, clientes, colaboradores, serviços, produtos, estoque, vendas, comissões e financeiro. Esta primeira versão entrega a fundação executável e os fluxos centrais integrados; módulos futuros já possuem entidades e rotas reservadas na interface.

## Arquitetura

```text
apps/web  React + TypeScript + Vite + TanStack Query
    │ REST + JWT
apps/api  NestJS + Passport + Prisma
    │ tenant obtido exclusivamente do token autenticado
PostgreSQL
```

Cada registro empresarial contém `barbershopId`. Os controllers ignoram qualquer tenant enviado pelo cliente e aplicam o identificador presente no JWT. Índices compostos, chaves estrangeiras e constraints reforçam integridade. A finalização de atendimento deve ser implementada com `prisma.$transaction`, mantendo venda, pagamento, comissão, estoque e agenda atômicos.

## Módulos e telas

- Login e sessão JWT; dashboard executivo e mobile; agenda diária;
- Clientes, colaboradores, serviços, produtos e estoque;
- Atendimento, vendas, pagamentos divididos e comissões;
- Caixa, lançamentos financeiros, relatórios e configurações;
- Estrutura para Super Admin, planos, assinaturas, auditoria e booking público.

API documentada em `http://localhost:3333/docs` após iniciar o backend. Endpoints iniciais: `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/dashboard`, `GET /api/customers`, `GET /api/employees`, `GET /api/services`, `GET /api/products` e `GET /api/appointments`.

## Instalação

Pré-requisitos: Node 22+, Docker e Docker Compose.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate -- --name initial
npm run db:seed
npm run dev
```

Para verificar lint, testes e builds em uma única execução:

```bash
npm run validate
```

No PowerShell, use `Copy-Item .env.example .env` no lugar de `cp`. Acesse `http://localhost:5173`.

Usuário de demonstração:

```text
admin@barbeariamodelo.com
Admin@123
```

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL |
| `JWT_SECRET` | Assinatura do token (mínimo recomendado: 32 caracteres) |
| `PORT` | Porta da API |
| `WEB_URL` | Origem permitida pelo CORS |
| `VITE_API_URL` | URL pública da API no frontend |

## Modelo de dados

O schema completo está em `apps/api/prisma/schema.prisma`: barbearias e assinaturas; usuários/RBAC; colaboradores e jornadas; clientes; catálogo; agenda; venda/itens/pagamentos; estoque; comissões; caixa e financeiro; notificações, configurações e auditoria. Valores monetários usam `Decimal`, nunca ponto flutuante.

## Segurança e próximos passos

Senhas são armazenadas com bcrypt (custo 12), DTOs são validados com whitelist, headers recebem Helmet e barbearias suspensas não autenticam. A sessão utiliza access token de 15 minutos somente em memória e refresh token rotativo em cookie HTTP-only; logout e troca de senha revogam sessões. Login e renovação possuem rate limiting. Antes de produção: política detalhada de permissões, rotação de segredos, testes E2E completos, backups automáticos e observabilidade.

Sequência recomendada: completar CRUDs e regras de disponibilidade; atendimento transacional; caixa/comissões; RBAC granular e auditoria; booking público com lock transacional; relatórios; Super Admin e cobrança; testes E2E e deploy.
