# Checklist de seguridad — antes de desplegar a Azure

Plataforma de Selección — Aguas Nacionales EPM
Leyenda: 🔴 Bloqueante (no desplegar sin esto) · 🟡 Importante (hacerlo pronto) · 🟢 Recomendado (mejora continua)

---

## 1. Secretos y claves

- [x] 🔴 Generar un `SECRET_KEY` real y aleatorio (mínimo 32 bytes) para el módulo Login.
      Ejemplo para generarlo: `python3 -c "import secrets; print(secrets.token_hex(32))"`
      **Implementado:** los 3 módulos ahora se niegan a arrancar si `ENVIRONMENT=production`
      y `SECRET_KEY` sigue siendo el valor de ejemplo (ver `core/config.py` → `validar_configuracion_produccion()`), probado con el servidor real arrancando y fallando como corresponde.
- [x] 🔴 Usar **exactamente el mismo** `SECRET_KEY` en Login, Vacantes y Candidatos (los 3 validan el mismo JWT).
      (Ya era así desde que se construyeron los módulos; sigue documentado en cada `.env.example`.)
- [ ] 🔴 Mover los secretos a **Azure Key Vault**, inyectados como variables de entorno al desplegar — nunca committeados en el repositorio ni en archivos `.env` reales. *(pendiente — depende de la infraestructura de Azure)*
- [ ] 🟡 Documentar el procedimiento de rotación de `SECRET_KEY` (rotarlo invalida todas las sesiones activas — hay que avisar a los usuarios).
- [ ] 🟡 El primer admin (`scripts/crear_admin.py`) se corre una sola vez con una contraseña temporal fuerte, y se cambia inmediatamente después del primer login.

## 2. Autenticación y sesión

- [ ] 🟡 Evaluar mover el JWT de `localStorage` a una cookie `httpOnly` + `Secure` + `SameSite=Strict` — hoy el token es robable si alguien logra inyectar JavaScript malicioso (XSS).
      **Nota:** esto requiere primero decidir la topología de dominios en Azure (un solo dominio con
      API Gateway, o subdominios compartiendo `Domain=.aguasnacionales.com`) — una cookie `httpOnly`
      solo viaja automáticamente dentro del mismo dominio/subdominios configurados. Se deja pendiente
      a propósito hasta esa decisión de infraestructura, en vez de construir algo que haya que rehacer.
- [x] 🔴 Agregar **límite de intentos de login** (rate limiting).
      **Implementado:** `/login` (10/minuto) y `/registro` (5/minuto) en el módulo Login, con `slowapi`. Probado: el intento 11 de login y el 6 de registro devuelven `429` de verdad, no solo en teoría.
- [ ] 🟡 Bloqueo temporal de cuenta tras N intentos fallidos seguidos.
- [ ] 🟢 Agregar refresh tokens si se necesita que la sesión dure más de las 8 horas actuales sin volver a pedir contraseña.
- [ ] 🟢 Considerar CAPTCHA en `/registro` y `/login` para frenar bots.

## 3. Red y CORS

- [x] 🔴 Configurar `ALLOWED_ORIGINS` en los 3 módulos al dominio real de producción — nunca `*`, nunca dejar `localhost` en producción.
      **Implementado:** la misma validación de arranque ahora también rechaza `ALLOWED_ORIGINS` con `*` o `localhost` cuando `ENVIRONMENT=production`. La variable en sí sigue siendo responsabilidad de quien despliega (poner el dominio real).
- [ ] 🔴 Los backends (Login, Vacantes, Candidatos) **no deben quedar expuestos directamente a internet** — solo alcanzables dentro de la red privada (VNet) de Azure, con el frontend (o un API Gateway/Front Door) como única puerta pública. *(pendiente — depende de la infraestructura de Azure)*
- [ ] 🟡 Configurar Network Security Groups (NSG) restringiendo qué servicio puede hablarle a cuál (por ejemplo: Candidatos puede llamar a Vacantes; un usuario externo, no). *(pendiente — Azure)*
- [ ] 🔴 Forzar HTTPS en todo el tráfico externo (frontend ↔ backends), con redirección automática de HTTP a HTTPS. *(pendiente — Azure/hosting)*

## 4. Base de datos

- [ ] 🔴 Migrar de SQLite (desarrollo) a **PostgreSQL real** en los 3 módulos — cambiar `DATABASE_URL`.
- [ ] 🔴 Usar Azure Database for PostgreSQL (gestionada) en vez de una VM propia — backups automáticos y parches de seguridad los aplica Azure.
- [ ] 🟡 Cada módulo debe conectarse con un usuario de base de datos de **mínimo privilegio** (solo acceso a sus propias tablas, no a las de los otros módulos).
- [ ] 🟡 Forzar conexión SSL/TLS a la base de datos.
- [ ] 🟢 Probar el procedimiento de restauración de un backup al menos una vez (no basta con que existan).

## 5. Resiliencia entre microservicios

- [x] 🟡 Agregar reintentos con backoff en `vacantes_client.py`.
      **Implementado:** hasta 3 intentos con espera de 0.3s/0.8s ante fallas de red transitorias
      (timeout, conexión rechazada) — un 404 legítimo NO se reintenta, solo fallas de conectividad.
      Si los 3 intentos fallan, Candidatos responde `503` con un mensaje claro al aspirante en vez
      de un error genérico. Probado con 3 pruebas: éxito tras 2 fallos, falla definitiva tras agotar
      reintentos, y confirmación de que un 404 no dispara reintentos innecesarios.
- [x] 🟢 Definir qué le responde Candidatos al aspirante si Vacantes está caído.
      **Implementado:** "No se pudo verificar la vacante en este momento. Intenta de nuevo en unos minutos." (antes sería un 500 crudo).

## 6. Dependencias y código

- [x] 🔴 Correr `npm audit` (frontend) y `pip-audit` (backends) y resolver vulnerabilidades altas antes de desplegar.
      **Hecho:** se encontró que `python-jose` arrastraba `ecdsa` con una vulnerabilidad sin parche disponible (`PYSEC-2026-1325`). Como los 3 módulos solo firman/validan con HS256 (HMAC), no con curvas elípticas, se migró de `python-jose` a `PyJWT` en los 3 backends — `pip-audit` ahora reporta 0 vulnerabilidades en los 3. Las 37 pruebas de backend se corrieron de nuevo después del cambio y siguen pasando.
      **Frontend:** `npm audit` reporta una vulnerabilidad "alta" en `react-router-dom` (CSRF en modo RSC — React Server Components). **No aplica a este proyecto**: es una SPA con Vite que no usa RSC en ninguna parte (confirmado por búsqueda en el código). No existe todavía una versión parcheada dentro de la misma serie 7.x — la única "corrección" que ofrece `npm audit fix --force` es *bajar* a una versión anterior (7.11.0), lo cual es un cambio que rompe cosas sin reducir un riesgo real en nuestro caso. Recomendación: dejarlo así y revisar cuando salga un parche real, en vez de forzar un downgrade innecesario.
- [ ] 🟢 Definir un proceso periódico (mensual o cada release) para revisar y actualizar dependencias, no solo una vez antes de lanzar.
- [x] 🟢 Verificar que la fijación de `bcrypt==4.0.1` (bug de compatibilidad con `passlib` que encontramos) se mantenga hasta confirmar una combinación de versiones más nueva que funcione. *(sigue vigente, sin cambios)*

## 7. Datos personales (Ley 1581 de 2012)

- [x] 🟡 Definir política de retención: ¿cuánto tiempo se guardan los datos de un candidato no seleccionado?
      **Implementado (punto de partida, pendiente de validar con Legal):** `RETENCION_MESES_NO_SELECCIONADOS = 6`
      en el módulo Candidatos. Pasado ese tiempo, las solicitudes de candidatos NO aceptados se
      **anonimizan** automáticamente (nombre, cédula, correo, teléfono, dirección → "ANONIMIZADO"),
      conservando estado/evaluación/fechas para estadísticas. Las solicitudes con estado "Aceptada"
      NUNCA se anonimizan por esta vía (pasan a expediente laboral, con otras reglas). Hoy se dispara
      manualmente vía `POST /api/v1/solicitudes/admin/anonimizar-vencidas` (protegido, solo gestor_humano/admin)
      — en producción debe ser un job programado (Azure Function con timer trigger), no manual.
- [x] 🟡 Habilitar un mecanismo real para que un candidato ejerza su derecho de supresión/actualización de datos.
      **Implementado:** `DELETE /api/v1/solicitudes/{radicado}` (el candidato elimina POR COMPLETO su propia
      solicitud, no un borrado lógico — bloqueado si ya fue "Aceptada") y `DELETE /api/v1/auth/me` (elimina
      la cuenta completa, con protección para no dejar el sistema sin ningún admin). Ambos con botón real
      en el frontend ("Eliminar" en Mis Postulaciones). 8 pruebas nuevas cubren ambos flujos.
- [ ] 🟢 Confirmar cifrado en reposo de la base de datos (Azure Database for PostgreSQL lo trae por defecto) y en tránsito (TLS ya cubierto arriba).

## 8. Monitoreo y logs

- [ ] 🟡 Centralizar logs de los 3 módulos en Azure Monitor / Application Insights.
- [ ] 🟢 Alertas automáticas ante picos de errores 401/403 (posible intento de ataque) o 500 (posible caída de un módulo).
- [ ] 🔴 Confirmar que ningún log imprime contraseñas, tokens completos, ni el `SECRET_KEY` (revisado hoy: los `logger.info` actuales solo registran arranque/apagado del servicio, no hay datos sensibles).

## 9. Frontend

- [ ] 🟡 Configurar Content Security Policy (CSP) headers para mitigar XSS.
- [ ] 🟢 Confirmar que ninguna variable `VITE_*` contenga un secreto — estas variables quedan **visibles en el bundle público** del navegador (las URLs de los backends está bien que sean públicas; una clave secreta ahí sería un error).
- [ ] 🟢 Configurar cache headers apropiados para los assets estáticos vía CDN de Azure.

---

## Qué ya se implementó en esta sesión

- ✅ Migración de `python-jose` a `PyJWT` en los 3 backends (elimina la dependencia vulnerable `ecdsa`; 0 vulnerabilidades ahora).
- ✅ Rate limiting real en `/login` y `/registro` del módulo Login (probado con servidor real devolviendo 429).
- ✅ Validación de arranque: los 3 módulos se niegan a iniciar en `ENVIRONMENT=production` si detectan `SECRET_KEY` de ejemplo o CORS abierto/localhost (probado arrancando el servidor real en ambos escenarios).
- ✅ Auditoría completa de dependencias (backend y frontend), con el hallazgo de `react-router-dom` documentado y explicado por qué no aplica a este proyecto.

## Lo que sigue dependiendo de Azure/infraestructura

Key Vault, VNet/NSG, PostgreSQL gestionado, HTTPS gestionado — quedan documentados arriba en sus
secciones respectivas para cuando lleguemos a esa parte del despliegue.
