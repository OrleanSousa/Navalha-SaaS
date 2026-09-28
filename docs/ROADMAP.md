# Roadmap de implementação — Navalha SaaS

Este documento é a fonte de verdade do progresso. Uma tarefa só passa para **Concluída** quando banco, backend, frontend, validações, erros e testes do fluxo estiverem funcionando.

## Estado atual

### Concluído

- [x] Monorepo com React/Vite e NestJS
- [x] Prisma conectado à arquitetura PostgreSQL
- [x] Modelo inicial multi-tenant
- [x] Login JWT inicial
- [x] Tenant derivado do token nos endpoints existentes
- [x] Seed da Barbearia Modelo
- [x] Swagger inicial
- [x] Layout responsivo e navegação principal
- [x] Leituras iniciais de dashboard, agenda, clientes, serviços e produtos
- [x] Build de produção validado

### Regra de conclusão por funcionalidade

- [ ] Migration e constraints aplicadas
- [ ] DTOs e validações de entrada
- [ ] Regra de negócio no backend
- [ ] Endpoint protegido e isolado por tenant
- [ ] Interface integrada à API
- [ ] Estados de carregamento, vazio e erro
- [ ] Testes unitários ou E2E relevantes
- [ ] Documentação atualizada

---

## Etapa 0 — Ambiente e qualidade

Objetivo: garantir uma base reproduzível antes dos CRUDs.

- [x] 0.1 Criar `.env` local a partir do exemplo
- [x] 0.2 Subir PostgreSQL pelo Docker
- [x] 0.3 Criar e aplicar migration inicial
- [x] 0.4 Executar e validar seed
- [x] 0.5 Criar endpoint `/api/health`
- [x] 0.6 Configurar ESLint e Prettier no monorepo
- [x] 0.7 Configurar Jest para API
- [x] 0.8 Criar configuração e banco separado para testes
- [x] 0.9 Adicionar script de validação `lint + test + build`
- [x] 0.10 Remover fallbacks visuais permanentes do frontend

Critério de aceite: uma instalação limpa sobe banco, aplica migration, executa seed, abre login e passa no script de validação.

## Etapa 1 — Autenticação, sessão e segurança

- [x] 1.1 Criar entidade de refresh token/sessão
- [x] 1.2 Emitir access token de curta duração
- [x] 1.3 Armazenar refresh token em cookie HTTP-only
- [x] 1.4 Implementar renovação automática de sessão
- [x] 1.5 Implementar logout com revogação
- [x] 1.6 Criar recuperação e redefinição de senha
- [x] 1.7 Implementar alteração de senha autenticada
- [x] 1.8 Aplicar rate limiting no login e refresh
- [x] 1.9 Padronizar respostas de erro
- [x] 1.10 Criar filtro global de exceções
- [x] 1.11 Registrar eventos importantes de autenticação
- [x] 1.12 Testar login correto, senha incorreta, usuário inativo e tenant suspenso

Critério de aceite: sessão segura, renovável e revogável, sem token persistente no `localStorage`.

## Etapa 2 — Multi-tenancy e RBAC

- [x] 2.1 Criar decorator para usuário autenticado
- [x] 2.2 Criar serviço central de contexto do tenant
- [x] 2.3 Substituir filtros manuais por repositories/services tenant-aware
- [x] 2.4 Criar tabelas de permissões e vínculos de perfil
- [x] 2.5 Criar catálogo de permissões do sistema
- [x] 2.6 Criar guard de roles
- [x] 2.7 Criar guard de permissões
- [x] 2.8 Permitir exceção controlada para Super Admin
- [x] 2.9 Ocultar ações sem permissão no frontend
- [x] 2.10 Criar teste E2E Barbearia A versus Barbearia B para cada padrão de acesso
- [ ] 2.11 Aplicar PostgreSQL Row Level Security (avaliação concluída; depende da separação dos papéis de banco em produção)

Critério de aceite: IDs válidos de outro tenant sempre retornam `404`/`403`, inclusive em atualização, exclusão e relacionamentos.

## Etapa 3 — Barbearias, planos e Super Admin

- [x] 3.1 CRUD de planos
- [x] 3.2 Listagem paginada de barbearias
- [x] 3.3 Cadastro de barbearia com administrador inicial
- [x] 3.4 Edição dos dados da barbearia
- [x] 3.5 Ativar, suspender e cancelar barbearia
- [x] 3.6 Aplicar vencimento e status da assinatura no login
- [x] 3.7 Exibir métricas de usuários e colaboradores por tenant
- [x] 3.8 Criar dashboard do Super Admin
- [x] 3.9 Criar tela de planos e assinatura
- [x] 3.10 Auditar mudanças administrativas
- [x] 3.11 Criar página detalhada de cada barbearia
- [x] 3.12 Acompanhar progresso de cadastro e onboarding por tenant
- [x] 3.13 Registrar histórico de alterações de plano e assinatura
- [x] 3.14 Configurar período de teste e conversão para plano pago
- [x] 3.15 Implementar renovação, upgrade e downgrade de plano
- [x] 3.16 Criar entidades de cobrança, fatura e pagamento da assinatura
- [x] 3.17 Controlar cobranças pagas, pendentes, vencidas, estornadas e canceladas
- [x] 3.18 Implementar cupons, descontos e períodos de cortesia
- [x] 3.19 Calcular MRR, ARR, ticket médio, churn e inadimplência
- [x] 3.20 Criar régua e histórico de tentativas de cobrança
- [x] 3.21 Suspender e reativar tenant conforme regras de inadimplência
- [x] 3.22 Criar tela de pagamentos e faturas no Super Admin
- [x] 3.23 Criar visão financeira consolidada do SaaS
- [x] 3.24 Criar interface para integração futura com gateway de pagamento
- [x] 3.25 Criar relatórios comerciais por período, plano e status

## Etapa 4 — Colaboradores e usuários

- [x] 4.1 Listar colaboradores com busca, filtro e paginação
- [x] 4.2 Criar colaborador
- [x] 4.3 Editar colaborador
- [x] 4.4 Inativar e reativar colaborador
- [x] 4.5 Implementar upload/armazenamento de foto
- [x] 4.6 Criar acesso ao sistema associado ao colaborador
- [x] 4.7 Editar perfil e permissões individuais
- [x] 4.8 Configurar comissão padrão
- [x] 4.9 Criar tela de detalhes do colaborador
- [x] 4.10 Testar isolamento e permissões do módulo

## Etapa 5 — Jornadas e indisponibilidades

- [x] 5.1 CRUD de jornada semanal por colaborador
- [x] 5.2 Validar intervalos e sobreposições da jornada
- [x] 5.3 Criar entidade de bloqueio/indisponibilidade
- [x] 5.4 Cadastrar folga
- [x] 5.5 Cadastrar férias e afastamentos
- [x] 5.6 Cadastrar bloqueios pontuais de agenda
- [x] 5.7 Exibir jornada na tela do colaborador
- [x] 5.8 Criar serviço backend de cálculo de disponibilidade
- [x] 5.9 Testar jornada, intervalos, folgas e bloqueios

## Etapa 6 — Clientes

- [x] 6.1 Criar cliente com telefone normalizado
- [x] 6.2 Editar cliente
- [x] 6.3 Arquivar e restaurar cliente
- [x] 6.4 Buscar por nome, telefone e CPF
- [x] 6.5 Paginar e ordenar listagem
- [x] 6.6 Validar duplicidade configurável de CPF/telefone
- [x] 6.7 Criar página de detalhes
- [x] 6.8 Exibir histórico de serviços
- [x] 6.9 Exibir produtos comprados
- [x] 6.10 Calcular visitas, total gasto e último atendimento
- [x] 6.11 Exibir próximo agendamento
- [x] 6.12 Testar CRUD e isolamento

## Etapa 7 — Serviços e comissões específicas

- [x] 7.1 Criar serviço
- [x] 7.2 Editar serviço
- [x] 7.3 Ativar/inativar serviço
- [x] 7.4 Criar categorias de serviços
- [x] 7.5 Validar preço monetário e duração
- [x] 7.6 Definir comissão percentual ou fixa
- [x] 7.7 Vincular profissionais habilitados ao serviço
- [x] 7.8 Configurar comissão específica por profissional
- [x] 7.9 Criar formulários e tela de detalhes
- [x] 7.10 Testar prioridade das configurações

## Etapa 8 — Produtos e estoque

- [x] 8.1 Criar produto
- [x] 8.2 Editar produto
- [x] 8.3 Ativar/inativar produto
- [x] 8.4 Criar categorias de produtos
- [x] 8.5 Validar SKU e código de barras por tenant
- [x] 8.6 Registrar entrada de estoque
- [x] 8.7 Registrar ajuste
- [x] 8.8 Registrar perda
- [x] 8.9 Registrar devolução
- [x] 8.10 Criar extrato de movimentações
- [x] 8.11 Criar alerta de estoque mínimo
- [x] 8.12 Impedir estoque negativo conforme configuração
- [x] 8.13 Testar concorrência na baixa de estoque

## Etapa 9 — Agenda e agendamentos

- [x] 9.1 Criar DTO de novo agendamento
- [x] 9.2 Validar cliente, profissional e serviços no mesmo tenant
- [x] 9.3 Calcular duração e preço no backend
- [x] 9.4 Criar endpoint de horários disponíveis
- [x] 9.5 Impedir horário fora da jornada
- [x] 9.6 Impedir horário em intervalo ou bloqueio
- [x] 9.7 Impedir sobreposição transacional
- [x] 9.8 Criar agendamento com múltiplos serviços
- [x] 9.9 Editar e reagendar
- [x] 9.10 Confirmar agendamento
- [x] 9.11 Cancelar com motivo
- [x] 9.12 Marcar não comparecimento
- [x] 9.13 Implementar visualização diária real
- [x] 9.14 Implementar visualização semanal
- [x] 9.15 Implementar visualização mensal
- [x] 9.16 Filtrar por profissional e status
- [x] 9.17 Usar cor configurada do profissional
- [x] 9.18 Testar duas requisições simultâneas para o mesmo horário

## Etapa 10 — Atendimento, venda e pagamento

- [x] 10.1 Iniciar atendimento a partir do agendamento
- [x] 10.2 Criar atendimento avulso
- [x] 10.3 Adicionar/remover múltiplos serviços
- [x] 10.4 Adicionar/remover produtos
- [x] 10.5 Recalcular subtotal no backend
- [x] 10.6 Aplicar desconto com permissão e motivo
- [x] 10.7 Registrar uma forma de pagamento
- [x] 10.8 Registrar pagamento dividido
- [x] 10.9 Validar soma dos pagamentos contra total
- [x] 10.10 Finalizar tudo em uma transação Prisma
- [x] 10.11 Criar itens da venda
- [x] 10.12 Baixar estoque atomicamente
- [x] 10.13 Criar entrada financeira
- [x] 10.14 Criar comissão sem duplicidade
- [x] 10.15 Marcar agendamento como finalizado
- [x] 10.16 Criar comprovante/resumo da venda
- [x] 10.17 Testar rollback quando qualquer etapa falhar

## Etapa 11 — Comissões

- [x] 11.1 Implementar prioridade de cálculo definida no briefing
- [x] 11.2 Suportar percentual e valor fixo
- [x] 11.3 Calcular comissão de serviços
- [x] 11.4 Calcular comissão de produtos
- [x] 11.5 Listar por profissional, período e status
- [x] 11.6 Exibir resumo vendido/comissão/atendimentos
- [x] 11.7 Marcar uma comissão como paga
- [x] 11.8 Pagar comissões em lote
- [x] 11.9 Registrar responsável, data e observação
- [x] 11.10 Gerar saída financeira do pagamento
- [x] 11.11 Auditar ajustes e pagamentos

## Etapa 12 — Caixa e lançamentos financeiros

- [x] 12.1 Abrir caixa com saldo inicial
- [x] 12.2 Impedir dois caixas abertos conforme regra configurada
- [x] 12.3 Listar movimentações do caixa
- [x] 12.4 Criar entrada manual
- [x] 12.5 Criar saída manual
- [x] 12.6 Editar/cancelar lançamento com auditoria
- [x] 12.7 Consolidar valores por forma de pagamento
- [x] 12.8 Calcular saldo esperado
- [x] 12.9 Fechar caixa com saldo contado
- [x] 12.10 Calcular e registrar diferença
- [x] 12.11 Impedir fechamento duplicado
- [x] 12.12 Criar histórico de caixas
- [x] 12.13 Testar abertura, movimentação e fechamento

## Etapa 13 — Contas a pagar e receber

- [x] 13.1 Adicionar entidades/migrations específicas
- [x] 13.2 CRUD de fornecedores e categorias
- [x] 13.3 Criar conta a pagar
- [x] 13.4 Marcar conta como paga e lançar saída
- [x] 13.5 Calcular status vencida
- [x] 13.6 Criar recorrência de despesas
- [x] 13.7 Criar conta a receber vinculada ao cliente
- [x] 13.8 Baixar recebimento e lançar entrada
- [x] 13.9 Calcular status vencido
- [x] 13.10 Criar filtros, totais e alertas

## Etapa 14 — Dashboard e relatórios reais

- [x] 14.1 Remover todos os valores estáticos restantes
- [x] 14.2 Faturamento diário e mensal
- [x] 14.3 Atendimentos e agendamentos do dia
- [x] 14.4 Ticket médio e clientes atendidos
- [x] 14.5 Despesas e saldo do caixa
- [x] 14.6 Comissões pendentes
- [x] 14.7 Série temporal de faturamento
- [x] 14.8 Ranking de colaboradores
- [x] 14.9 Serviços mais vendidos
- [x] 14.10 Produtos mais vendidos
- [x] 14.11 Relatório financeiro
- [x] 14.12 Relatório de serviços
- [x] 14.13 Relatório de produtos e margem
- [x] 14.14 Relatório de colaboradores
- [x] 14.15 Relatório de clientes
- [x] 14.16 Filtros rápidos e período personalizado
- [x] 14.17 Exportação CSV/PDF

## Etapa 15 — Configurações e onboarding

- [x] 15.1 Editar dados e identidade da barbearia
- [x] 15.2 Upload de logo
- [x] 15.3 Aplicar cor principal com acessibilidade
- [x] 15.4 Configurar moeda e fuso horário
- [x] 15.5 Configurar horário geral de funcionamento
- [x] 15.6 Configurar estoque negativo e venda a prazo
- [x] 15.7 Criar estado de progresso do onboarding
- [x] 15.8 Implementar os cinco passos do primeiro acesso
- [x] 15.9 Permitir retomar ou dispensar onboarding

## Etapa 16 — Agendamento público

- [x] 16.1 Criar página pública por slug
- [x] 16.2 Exibir identidade e serviços ativos
- [x] 16.3 Filtrar profissionais habilitados
- [x] 16.4 Consultar dias e horários disponíveis
- [x] 16.5 Coletar nome e WhatsApp
- [x] 16.6 Localizar ou criar cliente com segurança
- [x] 16.7 Reservar horário de forma transacional
- [x] 16.8 Exibir confirmação
- [x] 16.9 Aplicar rate limiting e proteção antiabuso
- [x] 16.10 Testar disputa simultânea pelo último horário

## Etapa 17 — Notificações e integração futura

- [x] 17.1 Criar central de notificações real
- [x] 17.2 Notificar novo agendamento e cancelamento
- [x] 17.3 Notificar estoque baixo
- [x] 17.4 Notificar conta vencendo
- [x] 17.5 Notificar caixa não fechado
- [x] 17.6 Notificar comissão pendente
- [x] 17.7 Criar interface `MessageProvider`
- [x] 17.8 Criar provedor local/log para desenvolvimento
- [x] 17.9 Preparar templates de WhatsApp sem contratar API
- [x] 17.10 Criar processamento assíncrono/fila para mensagens

## Etapa 18 — Auditoria, observabilidade e backup

- [ ] 18.1 Criar serviço central de auditoria
- [ ] 18.2 Auditar alterações financeiras
- [ ] 18.3 Auditar descontos e cancelamentos
- [ ] 18.4 Auditar estoque e comissões
- [ ] 18.5 Criar consulta de logs para administradores
- [ ] 18.6 Mascarar dados sensíveis dos logs
- [ ] 18.7 Adicionar logs estruturados e correlation ID
- [ ] 18.8 Integrar monitoramento de erros
- [ ] 18.9 Criar health/readiness checks
- [ ] 18.10 Documentar rotina de backup PostgreSQL
- [ ] 18.11 Testar restauração de backup

## Etapa 19 — Testes e segurança final

- [ ] 19.1 Testes E2E de autenticação
- [ ] 19.2 Matriz completa de testes multi-tenant
- [ ] 19.3 Testes de conflito de agenda
- [ ] 19.4 Testes de finalização transacional
- [ ] 19.5 Testes de pagamento dividido
- [ ] 19.6 Testes de estoque concorrente
- [ ] 19.7 Testes de comissões
- [ ] 19.8 Testes de caixa
- [ ] 19.9 Testes de permissões por perfil
- [ ] 19.10 Testes responsivos e acessibilidade
- [ ] 19.11 Revisar XSS, CSRF, SQL injection e upload
- [ ] 19.12 Revisar dependências e segredos
- [ ] 19.13 Teste de carga da agenda pública

## Etapa 20 — Produção e comercialização

- [ ] 20.1 Criar Dockerfile da API
- [ ] 20.2 Criar pipeline CI de lint/test/build
- [ ] 20.3 Configurar ambiente de homologação
- [ ] 20.4 Configurar banco gerenciado
- [ ] 20.5 Configurar migrations de produção
- [ ] 20.6 Publicar frontend e API
- [ ] 20.7 Configurar domínio, HTTPS e CORS
- [ ] 20.8 Configurar backups e monitoramento
- [ ] 20.9 Executar smoke test pós-deploy
- [ ] 20.10 Preparar termos, privacidade e adequação à LGPD

---

## Ordem de entregas utilizáveis

1. **Base confiável:** etapas 0, 1 e 2.
2. **Agenda utilizável:** etapas 4, 5, 6, 7 e 9.
3. **Operação completa:** etapas 8, 10, 11 e 12.
4. **Gestão completa:** etapas 13, 14 e 15.
5. **SaaS comercial:** etapas 3, 16, 17, 18, 19 e 20.

## Próxima tarefa

Iniciar a **Etapa 18** pela centralização da auditoria (item 18.1). A aplicação do RLS permanece condicionada à separação segura dos papéis de banco documentada em `docs/SECURITY.md`. Mensagens externas continuam desacopladas pela interface `MessageProvider`; em desenvolvimento, o provedor local registra os envios sem contratar uma API.
