/**
 * Identidade dos tokens validados pelo authorizer do API Gateway.
 * Precisa estar em sincronia com oficina-lambda-auth/src/lib/jwtConfig.js.
 */
export const JWT_STAFF_ISSUER = 'oficina-marimb0ndo-os';
export const JWT_CLIENT_ISSUER = 'oficina-marimb0ndo-auth';
export const JWT_AUDIENCE = 'oficina-marimb0ndo-api';
