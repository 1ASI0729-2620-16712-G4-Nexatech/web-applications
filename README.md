# VitalTrek — Frontend Web Applications

Frontend académico con Vue 3, Vite, PrimeVue, Pinia, Vue Router, Axios y Vue I18n. Inglés por defecto y español disponible. Esta entrega usa exclusivamente json-server.

## Ejecución local

```powershell
npm install
npm run api
```

En otra terminal:

```powershell
npm run dev
```

Frontend: http://127.0.0.1:5173. Fake API: http://localhost:3000/api/v1. Vite redirige `/api/v1` al puerto 3000 para usar el mismo origen en el navegador. Los endpoints tienen valores predeterminados; `.env.example` contiene la configuración opcional.

`npm run api` persiste cambios en `server/db.json`. Como alternativa, `npm run api:demo` inicia una API **en memoria**: los cambios desaparecen al detener ese proceso y no afectan los fixtures. Ejecutar una sola API a la vez.

`npm run api:reset` reemplaza los datos persistidos por `server/demo-seed.json`, descartando los cambios de demostraciones anteriores. Detener la API antes de ejecutarlo.

## Experiencias y cuentas

| Experiencia | Rol | Usuario |
| --- | --- | --- |
| Operaciones | Administrador | `admin@vitaltrek.demo` |
| Operaciones | Guía Elena, Huayhuash programado | `guide@vitaltrek.demo` |
| Operaciones | Guía Diego, Santa Cruz activo | `guide2@vitaltrek.demo` |
| Turista | Valeria, Huayhuash | `tourist@vitaltrek.demo` |
| Otra agencia sin datos | Administrador | `other@vitaltrek.demo` |

Contraseña inicial: **`VitalTrek123!`**. El login incluye botones para completar las tres cuentas principales.

Administrador y guía comparten la aplicación operativa con capacidades distintas. El administrador configura rutas, checkpoints, ventanas, grupos, guías, cuentas, notas y protocolos; supervisa las expediciones y gestiona escalamiento y comunicaciones simuladas. El guía accede a sus grupos, manifiestos, asignación de wearables, inicio, llegadas, captura, sincronización, alertas, incidentes y cierre. El turista consulta sus propias expediciones y gestiona contacto de emergencia, consentimiento y activación.

El registro público crea una agencia y su administrador. Este registra guías y vincula sus cuentas. Las cuentas de turista se vinculan con un documento existente en el manifiesto de la agencia. No se puede seleccionar libremente otra identidad ni crear dos cuentas para la misma identidad dentro de una agencia.

IAM es simulado: cuentas ficticias en JSON, sesión en sessionStorage durante un máximo de 12 horas, guards por rol/agencia/grupo e interceptor HTTP. Las restricciones de interfaz no sustituyen autorización en servidor: json-server no protege datos ni contraseñas. Usar datos de demostración.

## Arquitectura DDD

Cada BC mantiene domain/model, application, infrastructure y presentation. Entidades y reglas sin Vue/HTTP; Pinia coordina casos de uso; APIs y assemblers mapean recursos; las vistas componen los flujos.

| Contexto | Implementación frontend |
| --- | --- |
| expedition-setup | Rutas, checkpoints con coordenadas/Bluetooth, ventanas por tramo, grupos, guías, manifiestos, preparación, inventario, notas y protocolos. |
| field-tracking | Inicio condicionado a preparación, llegadas ordenadas, captura local simulada y experiencia del turista. |
| checkpoint-sync | Validación de lotes, orden por captura, deduplicación, historial, reintento conservando pendientes y progreso. |
| safety-monitoring | Reglas de demostración de retraso, pulso y desviación; evidencia con hora original; alertas por prioridad y actualización del riesgo operativo. |
| incident-response | Registro manual o asociado a alerta, confirmación, emergencia, comunicaciones simuladas, rescate y acciones de campo con cola offline. |
| tour-closure | Confirmación de pendientes, devolución por condición y resumen consolidado. |
| iam | Cuentas, sesión, roles, guards, interceptor y vínculo con agencia/guía/documento. |
| shared | Layout, idioma, errores, solicitudes, almacenamiento y diagrama de ruta. |

Los flujos se componen en ExpeditionWorkspaceView.vue. El turista tiene una vista independiente que guarda contenido de sus expediciones y su propia preparación. Los resúmenes no incluyen contactos ni lecturas privadas de otros participantes.

## Recorrido de demostración

1. Turista: registrar contacto ficticio, aceptar consentimiento, activar el wearable ya asignado y guardar ruta offline.
2. Guía Elena: abrir Huayhuash, comprobar preparación e iniciar. Los demás participantes del fixture ya están preparados.
3. Registrar llegada al primer checkpoint y lecturas simuladas. Se guardan localmente; operaciones todavía no las recibe. Usar 160 bpm o desviación de 150 m para probar alertas de demostración.
4. En sincronización, seleccionar el checkpoint alcanzado y enviar el lote. Se actualizan progreso y alertas; captura y recepción conservan marcas distintas.
5. Guía/administrador: confirmar o descartar una alerta, registrar incidente y confirmarlo. El administrador declara emergencia y registra comunicaciones y rescate ficticios. No se envían mensajes ni se contactan servicios externos.
6. Guía: registrar y sincronizar acciones de evacuación; finalizar indicando la condición de cada wearable. Mantenimiento y perdidos no vuelven al inventario disponible. El resumen queda accesible para operaciones y turista.

Si se cierra con incidentes abiertos o datos pendientes, se exige confirmación y el resumen conserva las advertencias. Las alertas terminales no pueden reabrirse mediante las acciones normales.

## Consulta offline y PWA

```powershell
npm run build
npm run preview
```

El service worker solo se registra en producción/preview. Visitar primero las pantallas online y usar **Guardar ruta para usar offline**. En la misma sesión activa, ruta, checkpoints, notas y preparación guardada pueden consultarse sin API. La interfaz identifica las copias potencialmente desactualizadas. Los guías conservan una copia del grupo visitado y pueden registrar llegadas, telemetría y evacuación localmente.

Las lecturas quedan en localStorage hasta sincronizar. Una carga interrumpida conserva la cola; al reintentar se reconocen IDs recibidos. Solo el guía asignado sincroniza. Consentimiento, inicio y otras operaciones remotas requieren conexión.

El mapa es un **diagrama esquemático offline de coordenadas de demostración**. No descarga cartografía de un proveedor ni representa un trazado navegable verificado. Bluetooth, GPS, sensores, evaluación médica, mensajería y rescate reales quedan fuera de la simulación.

La versión instalada de PrimeUI puede mostrar un aviso de licencia en producción/preview. El proyecto local conserva su configuración de desarrollo; para publicar se necesita una clave válida para el entorno en `VITE_PRIME_UI_LICENSE_KEY`. No se altera el mecanismo de licencias del proveedor.

## Verificación

```powershell
npm test
npm run build
```

Las pruebas usan una API aislada en memoria: fechas locales, credenciales, vencimiento, permisos por rol/agencia/grupo, preparación obligatoria, cola local, sincronización interrumpida y reintento sin duplicados, alertas, escalamiento, evacuación y cierre con devolución de inventario.

Para despliegue estático, configurar VITE_VITALTREK_API_URL con una Fake API accesible por HTTPS. El proxy de Vite solo existe en desarrollo/preview. vercel.json resuelve navegación SPA; no despliega json-server.
