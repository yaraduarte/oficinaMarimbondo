# language: pt
Funcionalidade: Saga orquestrada da Ordem de Serviço
  Como oficina com várias filiais
  Quero que abertura, orçamento, pagamento e execução da OS sejam coordenados entre microsserviços
  Para que uma falha em qualquer etapa desfaça as anteriores com segurança

  Contexto:
    Dado um cliente ativo com veículo cadastrado
    E um serviço de "Troca de óleo" custando 150 reais
    E uma peça "Filtro de óleo" custando 50 reais

  Cenário: Fluxo completo da OS passando por todos os microsserviços
    Quando o atendente abre uma OS com o serviço e 2 unidades da peça
    Então a OS fica "RECEBIDA" e a saga "AGUARDANDO_ORCAMENTO"
    E o comando "billing.GerarOrcamento" é enviado com total de 25000 centavos
    Quando o billing-service publica "billing.OrcamentoGerado"
    Então a OS fica "AGUARDANDO_APROVACAO" e a saga "AGUARDANDO_APROVACAO"
    Quando o billing-service publica "billing.OrcamentoAprovado"
    Então a OS fica "AGUARDANDO_PAGAMENTO" e a saga "AGUARDANDO_PAGAMENTO"
    Quando o billing-service publica "billing.PagamentoConfirmado"
    Então a OS fica "EM_FILA" e a saga "EM_EXECUCAO"
    E o comando "execution.IniciarExecucao" é enviado
    Quando o execution-service publica "execution.DiagnosticoIniciado"
    Então a OS fica "EM_DIAGNOSTICO" e a saga "EM_EXECUCAO"
    Quando o execution-service publica "execution.ReparoIniciado"
    Então a OS fica "EM_EXECUCAO" e a saga "EM_EXECUCAO"
    Quando o execution-service publica "execution.ExecucaoFinalizada"
    Então a OS fica "FINALIZADA" e a saga "CONCLUIDA"

  Cenário: Falta de estoque na execução estorna o pagamento e cancela o orçamento
    Dado uma OS com pagamento confirmado
    Quando o execution-service publica "execution.ExecucaoRecusada"
    Então a OS fica "CANCELADA" e a saga "COMPENSANDO"
    E o comando "billing.EstornarPagamento" é enviado
    Quando o billing-service publica "billing.PagamentoEstornado"
    Então o comando "billing.CancelarOrcamento" é enviado
    Quando o billing-service publica "billing.OrcamentoCancelado"
    Então a OS fica "CANCELADA" e a saga "COMPENSADA"

  Cenário: Evento reentregue pelo broker não é processado duas vezes
    Dado uma OS com pagamento confirmado
    Quando o mesmo evento "execution.ExecucaoRecusada" é entregue duas vezes
    Então apenas um comando "billing.EstornarPagamento" é enviado
