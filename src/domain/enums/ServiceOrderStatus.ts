export enum ServiceOrderStatus {
  RECEBIDA = 'RECEBIDA',
  EM_DIAGNOSTICO = 'EM_DIAGNOSTICO',
  AGUARDANDO_APROVACAO = 'AGUARDANDO_APROVACAO',
  EM_EXECUCAO = 'EM_EXECUCAO',
  FINALIZADA = 'FINALIZADA',
  ENTREGUE = 'ENTREGUE',
}

export const STATUS_PRIORITY: Record<string, number> = {
  [ServiceOrderStatus.EM_EXECUCAO]: 1,
  [ServiceOrderStatus.AGUARDANDO_APROVACAO]: 2,
  [ServiceOrderStatus.EM_DIAGNOSTICO]: 3,
  [ServiceOrderStatus.RECEBIDA]: 4,
};

export const VALID_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  [ServiceOrderStatus.RECEBIDA]: [ServiceOrderStatus.EM_DIAGNOSTICO],
  [ServiceOrderStatus.EM_DIAGNOSTICO]: [ServiceOrderStatus.AGUARDANDO_APROVACAO],
  [ServiceOrderStatus.AGUARDANDO_APROVACAO]: [ServiceOrderStatus.EM_EXECUCAO, ServiceOrderStatus.FINALIZADA],
  [ServiceOrderStatus.EM_EXECUCAO]: [ServiceOrderStatus.FINALIZADA],
  [ServiceOrderStatus.FINALIZADA]: [ServiceOrderStatus.ENTREGUE],
  [ServiceOrderStatus.ENTREGUE]: [],
};
