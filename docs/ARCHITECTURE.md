# Decisões de arquitetura

## Multi-tenancy

Modelo compartilhado (`shared database/shared schema`) com `barbershopId` obrigatório nas entidades da empresa. É econômico para dezenas ou centenas de negócios e mantém migrations simples. O contexto autenticado é a única fonte do tenant. Em produção, recomenda-se adicionar PostgreSQL Row Level Security como segunda barreira.

## Autenticação e autorização

JWT curto identifica `sub`, `barbershopId` e `role`. O backend valida status do usuário e da barbearia no login. RBAC granular evolui sobre roles e permissões sem depender da visibilidade de botões no frontend.

## Concorrência da agenda

Antes de inserir, a API deve consultar sobreposição por profissional (`startAt < novoFim AND endAt > novoInicio`) dentro de uma transação serializável. Para alta concorrência, usar constraint de exclusão PostgreSQL com range temporal.

## Atendimento

Finalização é uma única transação: cria venda e itens, valida/soma pagamentos, lança financeiro, calcula comissão pela prioridade configurada, baixa estoque com guarda contra negativo e conclui o agendamento. Qualquer falha reverte tudo.
