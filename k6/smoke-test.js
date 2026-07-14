/**
 * Smoke test — validação rápida (1 usuário, 30s)
 * Rode antes do load-test para garantir que a API está respondendo.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed:   ['rate<0.01'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health status 200': (r) => r.status === 200,
    'body ok':           (r) => r.json('status') === 'ok',
  });
  sleep(1);
}
