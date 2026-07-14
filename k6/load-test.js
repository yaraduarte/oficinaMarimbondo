import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas customizadas
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');

// Alvo — ajuste conforme ambiente:
// Local (docker-compose): http://localhost:3000
// Kubernetes (Kind):      http://localhost:30080
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Perfil de carga: ramp-up gradual para forçar HPA a escalar
export const options = {
  stages: [
    { duration: '30s', target: 5   },  // aquecimento
    { duration: '1m',  target: 20  },  // carga moderada
    { duration: '2m',  target: 50  },  // carga alta — HPA deve escalar aqui
    { duration: '1m',  target: 100 },  // pico
    { duration: '30s', target: 0   },  // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% das requisições em menos de 2s
    http_req_failed:   ['rate<0.05'],   // menos de 5% de erros
    errors:            ['rate<0.05'],
  },
};

// Obtém token JWT uma vez por VU (Virtual User)
function getToken() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: 'admin@oficina.com', password: 'Admin@123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  loginDuration.add(res.timings.duration);

  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  if (!ok) return null;

  return res.json('data.token');
}

export default function () {
  const token = getToken();
  if (!token) {
    errorRate.add(1);
    sleep(1);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 1. Health check (rota pública — mede disponibilidade básica)
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });
  errorRate.add(health.status !== 200 ? 1 : 0);

  // 2. Listagem de OS (rota autenticada — exercita DB + auth middleware)
  const list = http.get(`${BASE_URL}/api/service-orders`, { headers });
  check(list, { 'list OS 200': (r) => r.status === 200 });
  errorRate.add(list.status !== 200 ? 1 : 0);

  // 3. Listagem de clientes (rota autenticada)
  const clients = http.get(`${BASE_URL}/api/clients`, { headers });
  check(clients, { 'list clients 200': (r) => r.status === 200 });
  errorRate.add(clients.status !== 200 ? 1 : 0);

  sleep(1);
}
