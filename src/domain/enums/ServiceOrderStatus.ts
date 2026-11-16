export enum ServiceOrderStatus {
  RECEBIDA = 'RECEBIDA',
  EM_DIAGNOSTICO = 'EM_DIAGNOSTICO',
  AGUARDANDO_APROVACAO = 'AGUARDANDO_APROVACAO',
  /** Fase 4: orçamento aprovado, aguardando confirmação do pagamento (Mercado Pago). */
  AGUARDANDO_PAGAMENTO = 'AGUARDANDO_PAGAMENTO',
  /** Fase 4: pago, aguardando entrada na fila do execution-service. */
  EM_FILA = 'EM_FILA',
  EM_EXECUCAO = 'EM_EXECUCAO',
  FINALIZADA = 'FINALIZADA',
  ENTREGUE = 'ENTREGUE',
  /** Fase 4: estado terminal de compensação da Saga (recusa, falha de pagamento ou de execução). */
  CANCELADA = 'CANCELADA',
}

/** Status que não aparecem na fila de OS ativas. */
export const INACTIVE_STATUSES: ServiceOrderStatus[] = [
  ServiceOrderStatus.FINALIZADA,
  ServiceOrderStatus.ENTREGUE,
  ServiceOrderStatus.CANCELADA,
];

/**
 * Ordem da fila de OS ativas (regra da Fase 1: Em execução > Aguardando aprovação >
 * Em diagnóstico > Recebida). Os status da Fase 4 entram sem alterar essa ordem relativa.
 */
export const STATUS_PRIORITY: Record<string, number> = {
  [ServiceOrderStatus.EM_EXECUCAO]: 1,
  [ServiceOrderStatus.AGUARDANDO_APROVACAO]: 2,
  [ServiceOrderStatus.AGUARDANDO_PAGAMENTO]: 3,
  [ServiceOrderStatus.EM_DIAGNOSTICO]: 4,
  [ServiceOrderStatus.EM_FILA]: 5,
  [ServiceOrderStatus.RECEBIDA]: 6,
};

export const VALID_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  [ServiceOrderStatus.RECEBIDA]: [
    ServiceOrderStatus.EM_DIAGNOSTICO,
    ServiceOrderStatus.AGUARDANDO_APROVACAO, // Saga: orçamento gerado pelo billing-service
    ServiceOrderStatus.CANCELADA,
  ],
  [ServiceOrderStatus.EM_DIAGNOSTICO]: [
    ServiceOrderStatus.AGUARDANDO_APROVACAO,
    ServiceOrderStatus.EM_EXECUCAO, // Saga: reparo iniciado após o diagnóstico
    ServiceOrderStatus.CANCELADA,
  ],
  [ServiceOrderStatus.AGUARDANDO_APROVACAO]: [
    ServiceOrderStatus.EM_EXECUCAO,
    ServiceOrderStatus.FINALIZADA,
    ServiceOrderStatus.AGUARDANDO_PAGAMENTO,
    ServiceOrderStatus.CANCELADA,
  ],
  [ServiceOrderStatus.AGUARDANDO_PAGAMENTO]: [ServiceOrderStatus.EM_FILA, ServiceOrderStatus.CANCELADA],
  [ServiceOrderStatus.EM_FILA]: [
    ServiceOrderStatus.EM_DIAGNOSTICO,
    ServiceOrderStatus.EM_EXECUCAO,
    ServiceOrderStatus.CANCELADA,
  ],
  [ServiceOrderStatus.EM_EXECUCAO]: [ServiceOrderStatus.FINALIZADA, ServiceOrderStatus.CANCELADA],
  [ServiceOrderStatus.FINALIZADA]: [ServiceOrderStatus.ENTREGUE],
  [ServiceOrderStatus.ENTREGUE]: [],
  [ServiceOrderStatus.CANCELADA]: [],
};
