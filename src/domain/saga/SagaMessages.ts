/**
 * Contratos das mensagens da Saga da OS.
 * Fonte da verdade: docs/fase4/EVENTOS.md
 */

export const Exchanges = {
  COMMANDS: 'oficina.commands',
  EVENTS: 'oficina.events',
  DLX: 'oficina.dlx',
} as const;

export const RoutingKeys = {
  BILLING: 'billing',
  EXECUTION: 'execution',
} as const;

export const Commands = {
  GERAR_ORCAMENTO: 'billing.GerarOrcamento',
  CANCELAR_ORCAMENTO: 'billing.CancelarOrcamento',
  ESTORNAR_PAGAMENTO: 'billing.EstornarPagamento',
  INICIAR_EXECUCAO: 'execution.IniciarExecucao',
} as const;

export const Events = {
  ORCAMENTO_GERADO: 'billing.OrcamentoGerado',
  ORCAMENTO_APROVADO: 'billing.OrcamentoAprovado',
  ORCAMENTO_RECUSADO: 'billing.OrcamentoRecusado',
  ORCAMENTO_CANCELADO: 'billing.OrcamentoCancelado',
  PAGAMENTO_CONFIRMADO: 'billing.PagamentoConfirmado',
  PAGAMENTO_RECUSADO: 'billing.PagamentoRecusado',
  PAGAMENTO_ESTORNADO: 'billing.PagamentoEstornado',
  ESTORNO_FALHOU: 'billing.EstornoFalhou',
  EXECUCAO_INICIADA: 'execution.ExecucaoIniciada',
  EXECUCAO_RECUSADA: 'execution.ExecucaoRecusada',
  DIAGNOSTICO_INICIADO: 'execution.DiagnosticoIniciado',
  REPARO_INICIADO: 'execution.ReparoIniciado',
  EXECUCAO_FINALIZADA: 'execution.ExecucaoFinalizada',
  EXECUCAO_FALHOU: 'execution.ExecucaoFalhou',
  /** Evento interno do orquestrador (não trafega no broker). */
  TIMEOUT_APROVACAO: 'saga.TimeoutAprovacao',
} as const;

export type EventType = (typeof Events)[keyof typeof Events];
export type CommandType = (typeof Commands)[keyof typeof Commands];

/** Envelope padrão de todas as mensagens (comandos e eventos). */
export interface MessageEnvelope<P = Record<string, unknown>> {
  messageId: string;
  type: string;
  version: number;
  sagaId: string;
  correlationId: string;
  causationId: string | null;
  osId: string;
  occurredAt: string;
  producer: string;
  payload: P;
}

/** Comando decidido pela Saga, ainda sem envelope (o orquestrador completa os metadados). */
export interface SagaCommand {
  type: CommandType;
  exchange: string;
  routingKey: string;
  payload: Record<string, unknown>;
}
