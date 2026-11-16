#!/bin/bash
# Cria os dados de demonstração da Fase 4 em produção (via API Gateway) e salva as variáveis em .demo.env.
# Os funcionários são cadastrados por dentro do cluster: o cadastro de funcionário não é publicado no Gateway.
# Uso: bash scripts/lab/seed-demo.sh   (requer a chave SSH em ../oficina-infra-k8s/oficina-k3s-key)
set -euo pipefail

G=${GATEWAY_URL:-https://l3t36ga0t1.execute-api.us-east-1.amazonaws.com}
HOST=${K3S_HOST:-52.0.25.64}
KEY=${K3S_KEY:-$(dirname "$0")/../../../oficina-infra-k8s/oficina-k3s-key}
OUT="$(dirname "$0")/.demo.env"
NS=oficina-marimb0ndo

j() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);const v=$1;if(v===undefined){console.error('campo ausente: $1 em',s);process.exit(1)}console.log(v)})"; }
rnd() { node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))"; }
cpf() { node -e "const d=[...Array(9)].map(()=>Math.floor(Math.random()*10));for(const n of [9,10]){const s=d.reduce((a,x,i)=>a+x*(n+1-i),0);const r=(s*10)%11%10;d.push(r)}console.log(d.join(''))"; }

ADMIN_EMAIL="admin.demo@oficina.com"; MECH_EMAIL="mecanico.demo@oficina.com"
if [ -f "$OUT" ] && grep -q '^ADMIN_PASS=' "$OUT"; then
  ADMIN_PASS=$(grep '^ADMIN_PASS=' "$OUT" | cut -d= -f2); MECH_PASS=$(grep '^MECH_PASS=' "$OUT" | cut -d= -f2)
else
  ADMIN_PASS="Adm-$(rnd)"; MECH_PASS="Mec-$(rnd)"
fi

echo "1) Funcionários (dentro do cluster)"
register() {
  ssh -i "$KEY" -o StrictHostKeyChecking=no -o LogLevel=ERROR ec2-user@"$HOST" \
    "sudo kubectl exec -n $NS deploy/oficina-api -- node -e \"fetch('http://localhost:3000/api/auth/register',{method:'POST',headers:{'content-type':'application/json','x-origin-verify':process.env.ORIGIN_VERIFY_SECRET},body:JSON.stringify({name:'$1',email:'$2',password:'$3',role:'$4'})}).then(r=>console.log('$2', r.status))\""
}
register "Admin Demo" "$ADMIN_EMAIL" "$ADMIN_PASS" ADMIN
register "Mecanico Demo" "$MECH_EMAIL" "$MECH_PASS" MECHANIC

login() { curl -sf -X POST "$G/os/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}" | j 'o.data.token'; }
ADMIN_TOKEN=$(login "$ADMIN_EMAIL" "$ADMIN_PASS")
MECH_TOKEN=$(login "$MECH_EMAIL" "$MECH_PASS")
A=(-H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json')

echo "2) Cliente, veículo, serviço e peças"
CLIENT_CPF=$(cpf)
CLIENT_ID=$(curl -sf -X POST "$G/os/api/clients" "${A[@]}" -d "{\"name\":\"Cliente Demo\",\"cpfCnpj\":\"$CLIENT_CPF\",\"email\":\"cliente.demo@example.com\",\"phone\":\"11999990000\"}" | j 'o.data.id')
PLATE="DMO$(node -e "console.log(Math.floor(1000+Math.random()*8999))")"
VEHICLE_ID=$(curl -sf -X POST "$G/os/api/vehicles" "${A[@]}" -d "{\"plate\":\"$PLATE\",\"brand\":\"Fiat\",\"model\":\"Argo\",\"year\":2022,\"clientId\":\"$CLIENT_ID\"}" | j 'o.data.id')
SERVICE_ID=$(curl -sf -X POST "$G/os/api/services" "${A[@]}" -d '{"name":"Troca de pastilhas","description":"Troca das pastilhas de freio dianteiras","price":120,"estimatedHours":1}' | j 'o.data.id')
PART_ID=$(curl -sf -X POST "$G/os/api/parts" "${A[@]}" -d '{"name":"Pastilha de freio","description":"Jogo dianteiro","unitPrice":80,"stockQuantity":50,"minStockAlert":5}' | j 'o.data.id')
PART_SEM_ESTOQUE_ID=$(curl -sf -X POST "$G/os/api/parts" "${A[@]}" -d '{"name":"Disco de freio","description":"Par dianteiro","unitPrice":150,"stockQuantity":50,"minStockAlert":5}' | j 'o.data.id')

echo "3) Estoque da execução (só a primeira peça tem saldo)"
curl -sf -X PUT "$G/execucao/estoque/$PART_ID" "${A[@]}" -d '{"available":10,"description":"Pastilha de freio"}' >/dev/null && echo "   estoque ok" || echo "   AVISO: execution-service indisponível, rode de novo depois do deploy"

cat > "$OUT" <<ENV
ADMIN_PASS=$ADMIN_PASS
MECH_PASS=$MECH_PASS
ADMIN_TOKEN=$ADMIN_TOKEN
MECH_TOKEN=$MECH_TOKEN
CLIENT_CPF=$CLIENT_CPF
CLIENT_ID=$CLIENT_ID
VEHICLE_ID=$VEHICLE_ID
SERVICE_ID=$SERVICE_ID
PART_ID=$PART_ID
PART_SEM_ESTOQUE_ID=$PART_SEM_ESTOQUE_ID
ENV
echo "Pronto. Variáveis salvas em $OUT (use: source $OUT)"
