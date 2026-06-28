import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { ServiceOrderStatus } from '../../../domain/enums/ServiceOrderStatus';

function makeOrder(status: ServiceOrderStatus): ServiceOrder {
  return new ServiceOrder({
    id: 'order-1',
    orderNumber: 'OS-2024-001',
    status,
    clientId: 'client-1',
    vehicleId: 'vehicle-1',
    services: [],
    parts: [],
    budget: 0,
    notes: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

describe('ServiceOrder Status Transitions', () => {
  it('RECEBIDA → EM_DIAGNOSTICO deve ser válido', () => {
    const order = makeOrder(ServiceOrderStatus.RECEBIDA);
    expect(order.canTransitionTo(ServiceOrderStatus.EM_DIAGNOSTICO)).toBe(true);
  });

  it('RECEBIDA → EM_EXECUCAO deve ser inválido', () => {
    const order = makeOrder(ServiceOrderStatus.RECEBIDA);
    expect(order.canTransitionTo(ServiceOrderStatus.EM_EXECUCAO)).toBe(false);
  });

  it('EM_DIAGNOSTICO → AGUARDANDO_APROVACAO deve ser válido', () => {
    const order = makeOrder(ServiceOrderStatus.EM_DIAGNOSTICO);
    expect(order.canTransitionTo(ServiceOrderStatus.AGUARDANDO_APROVACAO)).toBe(true);
  });

  it('EM_DIAGNOSTICO → ENTREGUE deve ser inválido', () => {
    const order = makeOrder(ServiceOrderStatus.EM_DIAGNOSTICO);
    expect(order.canTransitionTo(ServiceOrderStatus.ENTREGUE)).toBe(false);
  });

  it('AGUARDANDO_APROVACAO → EM_EXECUCAO deve ser válido (aprovação)', () => {
    const order = makeOrder(ServiceOrderStatus.AGUARDANDO_APROVACAO);
    expect(order.canTransitionTo(ServiceOrderStatus.EM_EXECUCAO)).toBe(true);
  });

  it('AGUARDANDO_APROVACAO → FINALIZADA deve ser válido (rejeição)', () => {
    const order = makeOrder(ServiceOrderStatus.AGUARDANDO_APROVACAO);
    expect(order.canTransitionTo(ServiceOrderStatus.FINALIZADA)).toBe(true);
  });

  it('EM_EXECUCAO → FINALIZADA deve ser válido', () => {
    const order = makeOrder(ServiceOrderStatus.EM_EXECUCAO);
    expect(order.canTransitionTo(ServiceOrderStatus.FINALIZADA)).toBe(true);
  });

  it('FINALIZADA → ENTREGUE deve ser válido', () => {
    const order = makeOrder(ServiceOrderStatus.FINALIZADA);
    expect(order.canTransitionTo(ServiceOrderStatus.ENTREGUE)).toBe(true);
  });

  it('ENTREGUE → qualquer status deve ser inválido', () => {
    const order = makeOrder(ServiceOrderStatus.ENTREGUE);
    expect(order.canTransitionTo(ServiceOrderStatus.FINALIZADA)).toBe(false);
    expect(order.canTransitionTo(ServiceOrderStatus.RECEBIDA)).toBe(false);
    expect(order.canTransitionTo(ServiceOrderStatus.EM_EXECUCAO)).toBe(false);
  });
});
