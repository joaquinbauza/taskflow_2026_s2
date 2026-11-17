#!/usr/bin/env bash
# Pruebas manuales de seguridad contra la API local (http://localhost:3000/api).
# Uso: bash sec.sh > docs/evidencias/seguridad/pruebas-api.md
API=http://localhost:3000/api
NODE_BIN="$NODE_BIN"
J='Content-Type: application/json'

prueba() { # titulo, expectativa, comando
  echo "### $1"; echo; echo "**Expectativa (escrita antes de probar):** $2"; echo
  echo '```bash'; echo "$3"; echo '```'; echo; echo '```http'
  eval "$3" 2>&1 | sed -r 's/\r$//' | head -40
  echo; echo '```'; echo
}

login() { curl -s -X POST $API/auth/login -H "$J" -d "{\"email\":\"$1\",\"password\":\"Password1\"}"; }
ANA_JSON=$(login ana@test.com); BOB_JSON=$(login bob@test.com)
ANA=$(echo "$ANA_JSON" | sed -E 's/.*"token":"([^"]+)".*/\1/'); BOB=$(echo "$BOB_JSON" | sed -E 's/.*"token":"([^"]+)".*/\1/')
export ANA BOB

echo "# Evidencia: pruebas de seguridad sobre la API (Clase 11, Módulo 2)"
echo; echo "Fecha: $(date '+%Y-%m-%d %H:%M %z') · API local \`npm run dev:server\` con la base del seed (\`npm run db:setup\`) · Windows 11 · Node 22.23.5 · curl $(curl --version | head -1 | cut -d' ' -f2)"; echo
echo "## 1. Tokens"; echo
prueba "Login de ana y bob" "200 con token JWT para cada uno." \
  "curl -s -i -X POST $API/auth/login -H '$J' -d '{\"email\":\"ana@test.com\",\"password\":\"Password1\"}' | sed -E 's/(\"token\":\")[^\"]{20}([^\"]*)/\\1<recortado>…/'"
echo "Payload del token de ana (base64url decodificado): \`$(echo "$ANA" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null)\`"; echo

echo "## 2. Headers de seguridad"; echo
prueba "Headers de /api/health" "Sin X-Powered-By; con X-Content-Type-Options, X-Frame-Options/CSP frame-ancestors, HSTS (en prod con TLS); CORS restringido al origen del front." \
  "curl -s -I $API/health"
prueba "CORS desde un origen ajeno" "El origen https://evil.example no debería recibir Access-Control-Allow-Origin." \
  "curl -s -I -H 'Origin: https://evil.example' $API/projects -H \"Authorization: Bearer \$ANA\""

echo "## 3. Control de acceso (IDOR) con dos usuarios"; echo
PROJ_ANA=$(curl -s $API/projects -H "Authorization: Bearer $ANA")
echo "Proyectos de ana: \`$(echo "$PROJ_ANA" | head -c 600)\`"; echo
PROJ_BOB=$(curl -s $API/projects -H "Authorization: Bearer $BOB")
echo "Proyectos de bob: \`$(echo "$PROJ_BOB" | head -c 600)\`"; echo
# En el seed bob es miembro de todos los proyectos de ana, así que ana crea uno privado.
AJENO=$(curl -s -X POST $API/projects -H "$J" -H "Authorization: Bearer $ANA" -d "{\"name\":\"Privado de ana $(date +%s)\"}" | grep -oE "proj-[0-9]+" | head -1)
curl -s -X POST $API/projects/$AJENO/tasks -H "$J" -H "Authorization: Bearer $ANA" -d "{\"title\":\"Plan secreto de ana\"}" > /dev/null
export AJENO
TASK_AJENA=$(curl -s "$API/projects/$AJENO/tasks" -H "Authorization: Bearer $ANA" | grep -oE '"id":"task-[0-9]+"' | head -1 | grep -oE 'task-[0-9]+')
export TASK_AJENA
echo "Proyecto donde bob no es miembro: \`$AJENO\` · tarea: \`$TASK_AJENA\`"; echo
prueba "bob lista las tareas de un proyecto ajeno" "403 FORBIDDEN." "curl -s -i $API/projects/$AJENO/tasks -H \"Authorization: Bearer \$BOB\""
prueba "bob lee una tarea ajena por id" "403 FORBIDDEN." "curl -s -i $API/tasks/$TASK_AJENA -H \"Authorization: Bearer \$BOB\""
prueba "bob edita una tarea ajena" "403 y el título no cambia." "curl -s -i -X PATCH $API/tasks/$TASK_AJENA -H '$J' -H \"Authorization: Bearer \$BOB\" -d '{\"title\":\"Hackeado por bob\"}'"
prueba "bob borra una tarea ajena" "403 y la tarea sigue existiendo." "curl -s -i -X DELETE $API/tasks/$TASK_AJENA -H \"Authorization: Bearer \$BOB\""
prueba "bob lee los comentarios de una tarea ajena" "403." "curl -s -i $API/tasks/$TASK_AJENA/comments -H \"Authorization: Bearer \$BOB\""
prueba "bob edita y borra el proyecto ajeno" "403 en ambos." "curl -s -o /dev/null -w 'PATCH %{http_code}\n' -X PATCH $API/projects/$AJENO -H '$J' -H \"Authorization: Bearer \$BOB\" -d '{\"name\":\"Hackeado\"}'; curl -s -o /dev/null -w 'DELETE %{http_code}\n' -X DELETE $API/projects/$AJENO -H \"Authorization: Bearer \$BOB\""
prueba "La tarea de ana sigue intacta" "200 con el título original." "curl -s $API/tasks/$TASK_AJENA -H \"Authorization: Bearer \$ANA\""

echo "## 4. Inyecciones"; echo
PROY_BOB_ID=$(echo "$PROJ_BOB" | grep -oE '"id":"proj-[0-9]+"' | head -1 | grep -oE 'proj-[0-9]+'); export PROY_BOB_ID
prueba "SQL injection en search (BUG-09)" "El texto se trata como dato: 200 con items vacío y total 0." \
  "curl -s -G $API/projects/$PROY_BOB_ID/tasks --data-urlencode \"search=') > 0) OR 1=1 --\" -H \"Authorization: Bearer \$BOB\" | grep -oE '\"(title|projectId)\":\"[^\"]*\"' | paste -sd ' ' | head -c 1500"
prueba "XSS almacenado en título de tarea" "La API guarda el texto tal cual (no es su responsabilidad escapar) y el front lo muestra como texto, sin ejecutarlo." \
  "curl -s -i -X POST $API/projects/$PROY_BOB_ID/tasks -H '$J' -H \"Authorization: Bearer \$BOB\" -d '{\"title\":\"<img src=x onerror=alert(1)>\"}'"
XSS_TASK=$(curl -s "$API/projects/$PROY_BOB_ID/tasks" -H "Authorization: Bearer $BOB" | grep -oE '"id":"task-[0-9]+","projectId":"[^"]+","title":"<img' | grep -oE 'task-[0-9]+' | head -1)
prueba "XSS almacenado en comentario" "Se guarda tal cual; en el front se ve como texto." \
  "curl -s -i -X POST $API/tasks/$XSS_TASK/comments -H '$J' -H \"Authorization: Bearer \$BOB\" -d '{\"body\":\"<img src=x onerror=alert(1)>\"}'"

echo "## 5. Tokens manipulados"; echo
HDR_NONE=$(printf '{"alg":"none","typ":"JWT"}' | base64 | tr '+/' '-_' | tr -d '=\n')
PAY=$(echo "$ANA" | cut -d. -f2)
export NONE_TOKEN="$HDR_NONE.$PAY."
export ALTERED="${ANA%?????}AAAAA"
prueba "JWT con alg: none" "401 UNAUTHORIZED." "curl -s -i $API/projects -H \"Authorization: Bearer \$NONE_TOKEN\""
prueba "JWT con la firma alterada" "401 UNAUTHORIZED." "curl -s -i $API/projects -H \"Authorization: Bearer \$ALTERED\""
export EXPIRED=$("$NODE_BIN" -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:1,email:'ana@test.com',iat:Math.floor(Date.now()/1000)-90000,exp:Math.floor(Date.now()/1000)-3600},'taskflow-dev-secret'))")
prueba "JWT vencido (exp hace 1 hora)" "401 'Invalid or expired token'." "curl -s -i $API/projects -H \"Authorization: Bearer \$EXPIRED\""
export FORJADO=$("$NODE_BIN" -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:1,email:'ana@test.com'},'taskflow-dev-secret',{expiresIn:'24h'}))")
prueba "JWT forjado con el secreto por defecto del código ('taskflow-dev-secret', sin JWT_SECRET en .env)" "Si el servidor tuviera un secreto propio: 401. (Se escribe la expectativa de un sistema seguro.)" \
  "curl -s -i $API/projects -H \"Authorization: Bearer \$FORJADO\" | head -12"

echo "## 6. Fuerza bruta en login"; echo
curl -s -X POST $API/auth/register -H "$J" -d '{"email":"victima-fb-$$@test.com","password":"Password1"}' > /dev/null
prueba "8 intentos con contraseña incorrecta y luego la correcta" "Tras 5 fallos la cuenta se bloquea 15 min (US-02 c4): 401 'Account temporarily locked'. Idealmente, además, 429 por IP (rate limit)." \
  "for i in 1 2 3 4 5 6 7 8; do curl -s -o /dev/null -w \"intento \$i: %{http_code}\n\" -X POST $API/auth/login -H '$J' -d '{\"email\":\"victima-fb-$$@test.com\",\"password\":\"Incorrecta1\"}'; done; curl -s -w ' (%{http_code})\n' -X POST $API/auth/login -H '$J' -d '{\"email\":\"victima-fb-$$@test.com\",\"password\":\"Password1\"}'"
prueba "Fuerza bruta distribuida en muchas cuentas (sin rate limit por IP)" "Algún 429 Too Many Requests." \
  "for i in \$(seq 1 30); do curl -s -o /dev/null -w '%{http_code} ' -X POST $API/auth/login -H '$J' -d \"{\\\"email\\\":\\\"noexiste\$i@test.com\\\",\\\"password\\\":\\\"x\\\"}\"; done; echo"
