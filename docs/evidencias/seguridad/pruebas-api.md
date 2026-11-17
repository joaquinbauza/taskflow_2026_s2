# Evidencia: pruebas de seguridad sobre la API (Clase 11, Módulo 2)

Fecha: 2026-11-16 22:10 -0300 · API local `npm run dev:server` con la base del seed (`npm run db:setup`) · Windows 11 · Node 22.23.5 · curl 8.19.0

## 1. Tokens

### Login de ana y bob

**Expectativa (escrita antes de probar):** 200 con token JWT para cada uno.

```bash
curl -s -i -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"ana@test.com","password":"Password1"}' | sed -E 's/("token":")[^"]{20}([^"]*)/\1<recortado>…/'
```

```http
HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 291
ETag: W/"123-40AvZpC6SC2NxRmvTsG68AzLMSI"
Date: Tue, 17 Nov 2026 01:10:45 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"user":{"id":"user-1","email":"ana@test.com","name":"Ana Pereira","createdAt":"2026-11-17T01:08:54.741Z"},"token":"<recortado>…"}
```

Payload del token de ana (base64url decodificado): `{"userId":1,"email":"ana@test.com","iat":1794877844,"exp":1794964244}`

## 2. Headers de seguridad

### Headers de /api/health

**Expectativa (escrita antes de probar):** Sin X-Powered-By; con X-Content-Type-Options, X-Frame-Options/CSP frame-ancestors, HSTS (en prod con TLS); CORS restringido al origen del front.

```bash
curl -s -I http://localhost:3000/api/health
```

```http
HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 15
ETag: W/"f-VaSQ4oDUiZblZNAEkkN+sX+q3Sg"
Date: Tue, 17 Nov 2026 01:10:45 GMT
Connection: keep-alive
Keep-Alive: timeout=5


```

### CORS desde un origen ajeno

**Expectativa (escrita antes de probar):** El origen https://evil.example no debería recibir Access-Control-Allow-Origin.

```bash
curl -s -I -H 'Origin: https://evil.example' http://localhost:3000/api/projects -H "Authorization: Bearer $ANA"
```

```http
HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 182
ETag: W/"b6-QEW3jAlRUyP6F675Trt3XbVox+Q"
Date: Tue, 17 Nov 2026 01:10:45 GMT
Connection: keep-alive
Keep-Alive: timeout=5


```

## 3. Control de acceso (IDOR) con dos usuarios

Proyectos de ana: `[{"id":"proj-1","name":"Rediseño del sitio","description":"Renovación completa del sitio institucional","ownerId":"user-1","archived":false,"createdAt":"2026-11-17T01:08:54.760Z"}]`

Proyectos de bob: `[{"id":"proj-1","name":"Rediseño del sitio","description":"Renovación completa del sitio institucional","ownerId":"user-1","archived":false,"createdAt":"2026-11-17T01:08:54.760Z"},{"id":"proj-2","name":"App móvil","description":"Primera versión de la app para Android e iOS","ownerId":"user-2","archived":false,"createdAt":"2026-11-17T01:08:54.765Z"},{"id":"proj-3","name":"Migración legacy","description":"Proyecto cerrado el año pasado","ownerId":"user-1","archived":true,"createdAt":"2026-11-17T01:08:54.771Z"}]`

Proyecto donde bob no es miembro: `proj-4` · tarea: `task-14`

### bob lista las tareas de un proyecto ajeno

**Expectativa (escrita antes de probar):** 403 FORBIDDEN.

```bash
curl -s -i http://localhost:3000/api/projects/proj-4/tasks -H "Authorization: Bearer $BOB"
```

```http
HTTP/1.1 403 Forbidden
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 92
ETag: W/"5c-tiazkpYDHery2DeXIE/GPLIQD44"
Date: Tue, 17 Nov 2026 01:10:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":{"code":"FORBIDDEN","message":"You are not a member of this project","details":[]}}
```

### bob lee una tarea ajena por id

**Expectativa (escrita antes de probar):** 403 FORBIDDEN.

```bash
curl -s -i http://localhost:3000/api/tasks/task-14 -H "Authorization: Bearer $BOB"
```

```http
HTTP/1.1 403 Forbidden
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 92
ETag: W/"5c-tiazkpYDHery2DeXIE/GPLIQD44"
Date: Tue, 17 Nov 2026 01:10:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":{"code":"FORBIDDEN","message":"You are not a member of this project","details":[]}}
```

### bob edita una tarea ajena

**Expectativa (escrita antes de probar):** 403 y el título no cambia.

```bash
curl -s -i -X PATCH http://localhost:3000/api/tasks/task-14 -H 'Content-Type: application/json' -H "Authorization: Bearer $BOB" -d '{"title":"Hackeado por bob"}'
```

```http
HTTP/1.1 403 Forbidden
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 92
ETag: W/"5c-tiazkpYDHery2DeXIE/GPLIQD44"
Date: Tue, 17 Nov 2026 01:10:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":{"code":"FORBIDDEN","message":"You are not a member of this project","details":[]}}
```

### bob borra una tarea ajena

**Expectativa (escrita antes de probar):** 403 y la tarea sigue existiendo.

```bash
curl -s -i -X DELETE http://localhost:3000/api/tasks/task-14 -H "Authorization: Bearer $BOB"
```

```http
HTTP/1.1 403 Forbidden
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 92
ETag: W/"5c-tiazkpYDHery2DeXIE/GPLIQD44"
Date: Tue, 17 Nov 2026 01:10:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":{"code":"FORBIDDEN","message":"You are not a member of this project","details":[]}}
```

### bob lee los comentarios de una tarea ajena

**Expectativa (escrita antes de probar):** 403.

```bash
curl -s -i http://localhost:3000/api/tasks/task-14/comments -H "Authorization: Bearer $BOB"
```

```http
HTTP/1.1 403 Forbidden
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 92
ETag: W/"5c-tiazkpYDHery2DeXIE/GPLIQD44"
Date: Tue, 17 Nov 2026 01:10:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":{"code":"FORBIDDEN","message":"You are not a member of this project","details":[]}}
```

### bob edita y borra el proyecto ajeno

**Expectativa (escrita antes de probar):** 403 en ambos.

```bash
curl -s -o /dev/null -w 'PATCH %{http_code}\n' -X PATCH http://localhost:3000/api/projects/proj-4 -H 'Content-Type: application/json' -H "Authorization: Bearer $BOB" -d '{"name":"Hackeado"}'; curl -s -o /dev/null -w 'DELETE %{http_code}\n' -X DELETE http://localhost:3000/api/projects/proj-4 -H "Authorization: Bearer $BOB"
```

```http
PATCH 404
DELETE 404

```

### La tarea de ana sigue intacta

**Expectativa (escrita antes de probar):** 200 con el título original.

```bash
curl -s http://localhost:3000/api/tasks/task-14 -H "Authorization: Bearer $ANA"
```

```http
{"id":"task-14","projectId":"proj-4","title":"Plan secreto de ana","description":null,"status":"TODO","priority":"MEDIUM","assigneeId":null,"dueDate":null,"createdAt":"2026-11-17T01:10:45.963Z","updatedAt":"2026-11-17T01:10:45.963Z","tags":[]}
```

## 4. Inyecciones

### SQL injection en search (BUG-09)

**Expectativa (escrita antes de probar):** El texto se trata como dato: 200 con items vacío y total 0.

```bash
curl -s -G http://localhost:3000/api/projects/proj-1/tasks --data-urlencode "search=') > 0) OR 1=1 --" -H "Authorization: Bearer $BOB" | grep -oE '"(title|projectId)":"[^"]*"' | paste -sd ' ' | head -c 1500
```

```http
"projectId":"proj-1" "title":"Implementar login" "projectId":"proj-1" "title":"Revisar diseño de la home" "projectId":"proj-1" "title":"Migrar contenidos" "projectId":"proj-1" "title":"Configurar dominio" "projectId":"proj-1" "title":"Ajustar accesibilidad" "projectId":"proj-1" "title":"Optimizar imágenes" "projectId":"proj-2" "title":"Definir arquitectura" "projectId":"proj-2" "title":"Pantalla de onboarding" "projectId":"proj-2" "title":"Integrar notificaciones push" "projectId":"proj-2" "title":"Publicar beta interna" "projectId":"proj-2" "title":"Corregir crash al iniciar" "projectId":"proj-2" "title":"Escribir textos legales" "projectId":"proj-1" "title":"<img src=x onerror=alert(1)>" "projectId":"proj-4" "title":"Plan secreto de ana"

```

### XSS almacenado en título de tarea

**Expectativa (escrita antes de probar):** La API guarda el texto tal cual (no es su responsabilidad escapar) y el front lo muestra como texto, sin ejecutarlo.

```bash
curl -s -i -X POST http://localhost:3000/api/projects/proj-1/tasks -H 'Content-Type: application/json' -H "Authorization: Bearer $BOB" -d '{"title":"<img src=x onerror=alert(1)>"}'
```

```http
HTTP/1.1 201 Created
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 242
ETag: W/"f2-AjKVnd+JGO+G3zFFcH5ZriXGQBk"
Date: Tue, 17 Nov 2026 01:10:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":"task-15","projectId":"proj-1","title":"<img src=x onerror=alert(1)>","description":null,"status":"TODO","priority":"MEDIUM","assigneeId":null,"dueDate":null,"createdAt":"2026-11-17T01:10:46.953Z","updatedAt":"2026-11-17T01:10:46.953Z"}
```

### XSS almacenado en comentario

**Expectativa (escrita antes de probar):** Se guarda tal cual; en el front se ve como texto.

```bash
curl -s -i -X POST http://localhost:3000/api/tasks/task-13/comments -H 'Content-Type: application/json' -H "Authorization: Bearer $BOB" -d '{"body":"<img src=x onerror=alert(1)>"}'
```

```http
HTTP/1.1 201 Created
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 134
ETag: W/"86-CQWgKAJfDiwHveNMhjoELNPJ9LM"
Date: Tue, 17 Nov 2026 01:10:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":"comment-7","taskId":"task-13","authorId":"user-2","body":"<img src=x onerror=alert(1)>","createdAt":"2026-11-17T01:10:47.144Z"}
```

## 5. Tokens manipulados

### JWT con alg: none

**Expectativa (escrita antes de probar):** 401 UNAUTHORIZED.

```bash
curl -s -i http://localhost:3000/api/projects -H "Authorization: Bearer $NONE_TOKEN"
```

```http
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 83
ETag: W/"53-gIPMFB/uBNXU8XqDUaX/blmX1bc"
Date: Tue, 17 Nov 2026 01:10:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":{"code":"UNAUTHORIZED","message":"Invalid or expired token","details":[]}}
```

### JWT con la firma alterada

**Expectativa (escrita antes de probar):** 401 UNAUTHORIZED.

```bash
curl -s -i http://localhost:3000/api/projects -H "Authorization: Bearer $ALTERED"
```

```http
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 83
ETag: W/"53-gIPMFB/uBNXU8XqDUaX/blmX1bc"
Date: Tue, 17 Nov 2026 01:10:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":{"code":"UNAUTHORIZED","message":"Invalid or expired token","details":[]}}
```

### JWT vencido (exp hace 1 hora)

**Expectativa (escrita antes de probar):** 401 'Invalid or expired token'.

```bash
curl -s -i http://localhost:3000/api/projects -H "Authorization: Bearer $EXPIRED"
```

```http
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 83
ETag: W/"53-gIPMFB/uBNXU8XqDUaX/blmX1bc"
Date: Tue, 17 Nov 2026 01:10:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":{"code":"UNAUTHORIZED","message":"Invalid or expired token","details":[]}}
```

### JWT forjado con el secreto por defecto del código ('taskflow-dev-secret', sin JWT_SECRET en .env)

**Expectativa (escrita antes de probar):** Si el servidor tuviera un secreto propio: 401. (Se escribe la expectativa de un sistema seguro.)

```bash
curl -s -i http://localhost:3000/api/projects -H "Authorization: Bearer $FORJADO" | head -12
```

```http
HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 327
ETag: W/"147-BrtQQR7hWnPm1Ljw3gL+XnN2wCU"
Date: Tue, 17 Nov 2026 01:10:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

[{"id":"proj-1","name":"Rediseño del sitio","description":"Renovación completa del sitio institucional","ownerId":"user-1","archived":false,"createdAt":"2026-11-17T01:08:54.760Z"},{"id":"proj-4","name":"Privado de ana 1794877845","description":null,"ownerId":"user-1","archived":false,"createdAt":"2026-11-17T01:10:45.871Z"}]
```

## 6. Fuerza bruta en login

### 8 intentos con contraseña incorrecta y luego la correcta

**Expectativa (escrita antes de probar):** Tras 5 fallos la cuenta se bloquea 15 min (US-02 c4): 401 'Account temporarily locked'. Idealmente, además, 429 por IP (rate limit).

```bash
for i in 1 2 3 4 5 6 7 8; do curl -s -o /dev/null -w "intento $i: %{http_code}\n" -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"victima-fb-1380@test.com","password":"Incorrecta1"}'; done; curl -s -w ' (%{http_code})\n' -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"victima-fb-1380@test.com","password":"Password1"}'
```

```http
intento 1: 401
intento 2: 401
intento 3: 401
intento 4: 401
intento 5: 401
intento 6: 401
intento 7: 401
intento 8: 401
{"error":{"code":"UNAUTHORIZED","message":"Invalid credentials","details":[]}} (401)

```

### Fuerza bruta distribuida en muchas cuentas (sin rate limit por IP)

**Expectativa (escrita antes de probar):** Algún 429 Too Many Requests.

```bash
for i in $(seq 1 30); do curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"noexiste$i@test.com\",\"password\":\"x\"}"; done; echo
```

```http
401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 

```

