# Decisões de segurança

## PostgreSQL Row Level Security

O uso de RLS foi avaliado na etapa 2.11. Ele não deve ser ativado ainda no ambiente atual pelos seguintes motivos:

- a aplicação e as migrations usam a conta proprietária `postgres`, que ignora políticas RLS por padrão;
- usar `FORCE ROW LEVEL SECURITY` nessa mesma conta afetaria autenticação, migrations, seed e tarefas administrativas que não possuem tenant;
- o Prisma utiliza pool de conexões, portanto uma variável de sessão com o tenant só é segura dentro de uma transação interativa com `SET LOCAL`;
- ativar políticas antes de separar os papéis do banco criaria uma falsa sensação de isolamento ou poderia bloquear consultas legítimas.

Antes da produção, o banco deverá utilizar dois papéis:

1. um papel proprietário exclusivo para migrations;
2. um papel limitado para a aplicação, sujeito às políticas RLS.

As consultas tenant-aware deverão executar em transação com o tenant definido por `SET LOCAL`, enquanto operações globais de Super Admin usarão um fluxo administrativo explícito e auditado. Até essa infraestrutura existir, o isolamento continua obrigatório na camada de serviços, coberto por guards e testes E2E entre tenants.
