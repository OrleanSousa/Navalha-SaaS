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
- [ ] 5.8 Criar serviço backend de cálculo de disponibilidade
- [ ] 5.9 Testar jornada, intervalos, folgas e bloqueios

## Etapa 6 — Clientes

- [ ] 6.1 Criar cliente com telefone normalizado
- [ ] 6.2 Editar cliente
- [ ] 6.3 Arquivar e restaurar cliente
- [ ] 6.4 Buscar por nome, telefone e CPF
- [ ] 6.5 Paginar e ordenar listagem
- [ ] 6.6 Validar duplicidade configurável de CPF/telefone
- [ ] 6.7 Criar página de detalhes
- [ ] 6.8 Exibir histórico de serviços
- [ ] 6.9 Exibir produtos comprados
- [ ] 6.10 Calcular visitas, total gasto e último atendimento
- [ ] 6.11 Exibir próximo agendamento
- [ ] 6.12 Testar CRUD e isolamento

## Etapa 7 — Serviços e comissões específicas

- [ ] 7.1 Criar serviço
- [ ] 7.2 Editar serviço
- [ ] 7.3 Ativar/inativar serviço
- [ ] 7.4 Criar categorias de serviços
- [ ] 7.5 Validar preço monetário e duração
- [ ] 7.6 Definir comissão percentual ou fixa
- [ ] 7.7 Vincular profissionais habilitados ao serviço
- [ ] 7.8 Configurar comissão específica por profissional
- [ ] 7.9 Criar formulários e tela de detalhes
- [ ] 7.10 Testar prioridade das configurações

## Etapa 8 — Produtos e estoque

- [ ] 8.1 Criar produto
- [ ] 8.2 Editar produto
- [ ] 8.3 Ativar/inativar produto
- [ ] 8.4 Criar categorias de produtos
- [ ] 8.5 Validar SKU e código de barras por tenant
- [ ] 8.6 Registrar entrada de estoque
- [ ] 8.7 Registrar ajuste
- [ ] 8.8 Registrar perda
- [ ] 8.9 Registrar devolução
- [ ] 8.10 Criar extrato de movimentações
- [ ] 8.11 Criar alerta de estoque mínimo
- [ ] 8.12 Impedir estoque negativo conforme configuração
- [ ] 8.13 Testar concorrência na baixa de estoque

## Etapa 9 — Agenda e agendamentos

- [ ] 9.1 Criar DTO de novo agendamento
- [ ] 9.2 Validar cliente, profissional e serviços no mesmo tenant
- [ ] 9.3 Calcular duração e preço no backend
- [ ] 9.4 Criar endpoint de horários disponíveis
- [ ] 9.5 Impedir horário fora da jornada
- [ ] 9.6 Impedir horário em intervalo ou bloqueio
- [ ] 9.7 Impedir sobreposição transacional
- [ ] 9.8 Criar agendamento com múltiplos serviços
- [ ] 9.9 Editar e reagendar
- [ ] 9.10 Confirmar agendamento
- [ ] 9.11 Cancelar com motivo
- [ ] 9.12 Marcar não comparecimento
- [ ] 9.13 Implementar visualização diária real
- [ ] 9.14 Implementar visualização semanal
- [ ] 9.15 Implementar visualização mensal
- [ ] 9.16 Filtrar por profissional e status
- [ ] 9.17 Usar cor configurada do profissional
- [ ] 9.18 Testar duas requisições simultâneas para o mesmo horário

## Etapa 10 — Atendimento, venda e pagamento

- [ ] 10.1 Iniciar atendimento a partir do agendamento
- [ ] 10.2 Criar atendimento avulso
- [ ] 10.3 Adicionar/remover múltiplos serviços
- [ ] 10.4 Adicionar/remover produtos
- [ ] 10.5 Recalcular subtotal no backend
- [ ] 10.6 Aplicar desconto com permissão e motivo
- [ ] 10.7 Registrar uma forma de pagamento
- [ ] 10.8 Registrar pagamento dividido
- [ ] 10.9 Validar soma dos pagamentos contra total
- [ ] 10.10 Finalizar tudo em uma transação Prisma
- [ ] 10.11 Criar itens da venda
- [ ] 10.12 Baixar estoque atomicamente
- [ ] 10.13 Criar entrada financeira
- [ ] 10.14 Criar comissão sem duplicidade
- [ ] 10.15 Marcar agendamento como finalizado
- [ ] 10.16 Criar comprovante/resumo da venda
- [ ] 10.17 Testar rollback quando qualquer etapa falhar

## Etapa 11 — Comissões

- [ ] 11.1 Implementar prioridade de cálculo definida no briefing
- [ ] 11.2 Suportar percentual e valor fixo
- [ ] 11.3 Calcular comissão de serviços
- [ ] 11.4 Calcular comissão de produtos
- [ ] 11.5 Listar por profissional, período e status
- [ ] 11.6 Exibir resumo vendido/comissão/atendimentos
- [ ] 11.7 Marcar uma comissão como paga
- [ ] 11.8 Pagar comissões em lote
- [ ] 11.9 Registrar responsável, data e observação
- [ ] 11.10 Gerar saída financeira do pagamento
- [ ] 11.11 Auditar ajustes e pagamentos

## Etapa 12 — Caixa e lançamentos financeiros

- [ ] 12.1 Abrir caixa com saldo inicial
- [ ] 12.2 Impedir dois caixas abertos conforme regra configurada
- [ ] 12.3 Listar movimentações do caixa
- [ ] 12.4 Criar entrada manual
- [ ] 12.5 Criar saída manual
- [ ] 12.6 Editar/cancelar lançamento com auditoria
- [ ] 12.7 Consolidar valores por forma de pagamento
- [ ] 12.8 Calcular saldo esperado
- [ ] 12.9 Fechar caixa com saldo contado
- [ ] 12.10 Calcular e registrar diferença
- [ ] 12.11 Impedir fechamento duplicado
- [ ] 12.12 Criar histórico de caixas
- [ ] 12.13 Testar abertura, movimentação e fechamento

## Etapa 13 — Contas a pagar e receber

- [ ] 13.1 Adicionar entidades/migrations específicas
- [ ] 13.2 CRUD de fornecedores e categorias
- [ ] 13.3 Criar conta a pagar
- [ ] 13.4 Marcar conta como paga e lançar saída
- [ ] 13.5 Calcular status vencida
- [ ] 13.6 Criar recorrência de despesas
- [ ] 13.7 Criar conta a receber vinculada ao cliente
- [ ] 13.8 Baixar recebimento e lançar entrada
- [ ] 13.9 Calcular status vencido
- [ ] 13.10 Criar filtros, totais e alertas

## Etapa 14 — Dashboard e relatórios reais

- [ ] 14.1 Remover todos os valores estáticos restantes
- [ ] 14.2 Faturamento diário e mensal
- [ ] 14.3 Atendimentos e agendamentos do dia
- [ ] 14.4 Ticket médio e clientes atendidos
- [ ] 14.5 Despesas e saldo do caixa
- [ ] 14.6 Comissões pendentes
- [ ] 14.7 Série temporal de faturamento
- [ ] 14.8 Ranking de colaboradores
- [ ] 14.9 Serviços mais vendidos
- [ ] 14.10 Produtos mais vendidos
- [ ] 14.11 Relatório financeiro
- [ ] 14.12 Relatório de serviços
- [ ] 14.13 Relatório de produtos e margem
- [ ] 14.14 Relatório de colaboradores
- [ ] 14.15 Relatório de clientes
- [ ] 14.16 Filtros rápidos e período personalizado
- [ ] 14.17 Exportação CSV/PDF

## Etapa 15 — Configurações e onboarding

- [ ] 15.1 Editar dados e identidade da barbearia
- [ ] 15.2 Upload de logo
- [ ] 15.3 Aplicar cor principal com acessibilidade
- [ ] 15.4 Configurar moeda e fuso horário
- [ ] 15.5 Configurar horário geral de funcionamento
- [ ] 15.6 Configurar estoque negativo e venda a prazo
- [ ] 15.7 Criar estado de progresso do onboarding
- [ ] 15.8 Implementar os cinco passos do primeiro acesso
- [ ] 15.9 Permitir retomar ou dispensar onboarding

## Etapa 16 — Agendamento público

- [ ] 16.1 Criar página pública por slug
- [ ] 16.2 Exibir identidade e serviços ativos
- [ ] 16.3 Filtrar profissionais habilitados
- [ ] 16.4 Consultar dias e horários disponíveis
- [ ] 16.5 Coletar nome e WhatsApp
- [ ] 16.6 Localizar ou criar cliente com segurança
- [ ] 16.7 Reservar horário de forma transacional
- [ ] 16.8 Exibir confirmação
- [ ] 16.9 Aplicar rate limiting e proteção antiabuso
- [ ] 16.10 Testar disputa simultânea pelo último horário

## Etapa 17 — Notificações e integração futura

- [ ] 17.1 Criar central de notificações real
- [ ] 17.2 Notificar novo agendamento e cancelamento
- [ ] 17.3 Notificar estoque baixo
- [ ] 17.4 Notificar conta vencendo
- [ ] 17.5 Notificar caixa não fechado
- [ ] 17.6 Notificar comissão pendente
- [ ] 17.7 Criar interface `MessageProvider`
- [ ] 17.8 Criar provedor local/log para desenvolvimento
- [ ] 17.9 Preparar templates de WhatsApp sem contratar API
- [ ] 17.10 Criar processamento assíncrono/fila para mensagens

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

Continuar a **Etapa 5** criando o serviço backend de cálculo de disponibilidade (item 5.8). A aplicação do RLS permanece condicionada à separação segura dos papéis de banco documentada em `docs/SECURITY.md`. O envio real de e-mail da recuperação de senha será conectado ao provedor da etapa 17; em desenvolvimento, o link é disponibilizado localmente.
