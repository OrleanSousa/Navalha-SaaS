# Revisão final de segurança

## Controles implementados

- **XSS:** React escapa conteúdo por padrão; não há uso de `dangerouslySetInnerHTML`. CSP e demais headers são enviados pelo Helmet.
- **CSRF:** a API de negócio exige Bearer token mantido em memória. O refresh token é cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax` e restrito a `/api/auth`; CORS aceita uma origem explícita e credenciais.
- **SQL injection:** consultas usam Prisma parametrizado. SQL bruto existente usa tagged templates sem interpolação de entrada do cliente.
- **Uploads:** limite de 5 MiB, lista explícita de MIME, assinatura binária JPEG/PNG/WebP, nome aleatório e diretório controlado. Arquivos não são executados pelo servidor.
- **Autenticação:** bcrypt, JWT curto, refresh rotativo/revogável, rate limit e bloqueio por status do tenant.
- **Multi-tenancy:** guards, filtros tenant-aware, matriz E2E e políticas RLS disponíveis em `ops/rls.sql` para o papel limitado.
- **Segredos:** `.env` é ignorado; CI usa segredo efêmero. Produção deve usar cofre e rotação.
- **Dependências:** `npm audit` integra a revisão e o CI bloqueia vulnerabilidades críticas.

## Verificações recorrentes

Rode `npm run validate`, `npm run test:e2e`, `npm run test:web` e `npm run test:security` antes de releases. Revise permissões de banco, CORS, expiração de segredos, uploads e dependências a cada ciclo mensal.

## RLS

As policies usam `current_setting('app.current_tenant_id', true)` e falham fechadas quando o contexto não existe. O proprietário de migrations não deve ser usado pela aplicação. Operações globais do Super Admin exigem conexão administrativa separada e auditada. Toda adoção de RLS deve incluir um teste de integração conectando como `navalha_app`, pois proprietários de tabela ignoram RLS por padrão.
