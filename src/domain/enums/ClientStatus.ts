/**
 * Situação cadastral do cliente.
 * Somente clientes ATIVO podem se autenticar (Lambda de auth) e abrir novas OS.
 */
export enum ClientStatus {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
  BLOQUEADO = 'BLOQUEADO',
}
