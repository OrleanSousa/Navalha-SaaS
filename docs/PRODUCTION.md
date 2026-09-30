# Operação em produção

## Ambientes

- **Homologação:** banco e credenciais próprios, `APP_ENV=staging`, domínio separado e dados sintéticos.
- **Produção:** PostgreSQL gerenciado com PITR, TLS obrigatório, segredos no cofre do provedor e API sem acesso público direto quando houver proxy.
- Nunca reutilize banco, cookie, JWT, DSN de monitoramento ou bucket de uploads entre ambientes.

## Publicação

1. Crie o PostgreSQL 16 gerenciado e os papéis descritos em `ops/database-roles.sql`.
2. Configure `DATABASE_URL`, `JWT_SECRET` aleatório (mínimo 32 bytes), `WEB_URL`, `SENTRY_DSN`, `APP_ENV=production` e `APP_VERSION`.
3. Execute `npm run db:migrate:deploy` com o papel proprietário.
4. Aplique `ops/rls.sql`; a aplicação deve usar o papel limitado.
5. Construa e publique as imagens de `apps/api/Dockerfile` e `apps/web/Dockerfile`.
6. Termine TLS no load balancer/proxy, force HTTPS e restrinja CORS ao domínio real.
7. Execute `SMOKE_BASE_URL=https://api.exemplo.com SMOKE_WEB_URL=https://app.exemplo.com npm run smoke`.

`docker-compose.prod.yml` é a referência reproduzível para homologação ou instalação em host único. Em produção comercial, prefira banco gerenciado, volume de uploads persistente/objeto e múltiplas réplicas da API.

## Migrations e rollback

Migrations são aplicadas antes de trocar o tráfego. Faça backup antes de migrations destrutivas. O rollback da aplicação usa a imagem anterior; rollback de schema deve ser uma migration compensatória, nunca `migrate reset`.

## Monitoramento

- `GET /api/health/live`: processo ativo, sem dependência externa.
- `GET /api/health/ready`: valida a conexão com o banco e deve controlar entrada no balanceador.
- Respostas e logs incluem `x-correlation-id`; pesquise o mesmo valor no Sentry e no agregador de logs.
- Alertas mínimos: readiness falhando, erro 5xx, p95 de latência, conexões do banco, disco, fila de mensagens e falhas de backup.

## Backup e restauração

Execute `scripts/backup.sh` diariamente, copie os dumps criptografados para armazenamento externo e mantenha ao menos 30 dias. O banco gerenciado também deve ter PITR habilitado.

Mensalmente, restaure o dump mais recente em banco descartável:

```sh
RESTORE_DATABASE_URL=postgresql://... BACKUP_FILE=backups/navalha-....dump scripts/restore-test.sh
```

Registre data, duração, tamanho, responsável e resultado. Um backup sem restauração testada não é considerado válido.

## Pós-deploy

- Rode o smoke test e uma autenticação manual.
- Crie um agendamento de teste, cancele-o e confirme auditoria/notificação.
- Verifique uploads, headers HTTPS, CORS, monitoramento e execução do backup.
- Em incidente, retire a versão do tráfego, preserve correlation IDs e reverta para a imagem anterior.
