# VitalTrek — Operations Web App

Aplicación web para la gestión operativa de expediciones de trekking: configuración de rutas, puntos de control, ventanas de tiempo esperadas, grupos de expedición, manifiestos de turistas y seguimiento de progreso en campo.

## Stack

- **Vue 3** (`<script setup>`) + **Vite**
- **Pinia** para estado de aplicación
- **Vue Router** para navegación
- **PrimeVue** + **PrimeFlex** + **PrimeIcons** para UI
- **Vue I18n** para internacionalización (español / inglés)
- **Axios** para consumo de API
- **json-server** como API mock para desarrollo local

## Arquitectura

El código en `src/` está organizado por **bounded contexts** (estilo DDD), cada uno con sus propias capas:

```
src/
├── expedition-setup/        # Configuración de rutas, checkpoints, grupos, manifiestos y workspace de Field Guide
│   ├── domain/model/        # Entidades: Route, Checkpoint, ExpectedTimeWindow, ExpeditionGroup, FieldGuide, ManifestEntry
│   ├── application/         # Store de Pinia del contexto
│   ├── infrastructure/      # Assemblers y cliente API
│   └── presentation/views/  # Vistas Vue
├── field-tracking/          # Seguimiento de progreso de grupos en campo
│   ├── domain/model/        # Entidad GroupProgress
│   ├── application/
│   ├── infrastructure/
│   └── presentation/views/
├── safety-monitoring/       # Evaluación de riesgo y alertas tempranas
│   ├── domain/model/        # Entidades: EarlyWarningAlert, RiskEvidence
│   ├── application/
│   ├── infrastructure/
│   └── presentation/views/
├── shared/                  # Componentes y utilidades compartidas (AppLayout, LanguageSwitcher, base API/endpoint, RoleSelectionView)
├── locales/                 # Traducciones (en.json, es.json)
├── router.js
├── pinia.js
└── i18n.js
```

### Contextos

- **Expedition Setup**: alta y configuración de rutas (`Route`), puntos de control ordenados (`Checkpoint`), ventanas de tiempo esperadas entre checkpoints (`ExpectedTimeWindow`), grupos de expedición con guía de campo asignado (`ExpeditionGroup`, `FieldGuide`) y manifiesto de turistas (`ManifestEntry`).
- **Field Tracking**: dashboard de progreso de grupos activos (`GroupProgress`), con estado (en curso / con retraso), riesgo y última sincronización.
- **Safety Monitoring**: alertas tempranas (`EarlyWarningAlert`) generadas a partir de condiciones de riesgo (retraso, anomalía vital, desvío de ruta), con su evidencia (`RiskEvidence`) y ciclo de vida (activa → reconocida → resuelta / descartada como falsa alarma).

La app separa dos espacios de trabajo (`workspace: 'operations' | 'field-guide'` en el meta de cada ruta), seleccionables desde `RoleSelectionView` en `/`: **Operations Administrator** (oficina) y **Field Guide** (campo).

## Rutas de la aplicación

| Path | Vista | Workspace | Descripción |
|---|---|---|---|
| `/` | `RoleSelectionView` | — | Selección de espacio de trabajo (demo) |
| `/operations/routes` | `RouteListView` | operations | Listado y filtros de rutas |
| `/operations/routes/new` | `RouteFormView` | operations | Alta de nueva ruta |
| `/operations/routes/:routeId/checkpoints` | `CheckpointConfigurationView` | operations | Configuración de puntos de control |
| `/operations/routes/:routeId/expected-time-windows` | `ExpectedTimeWindowConfigurationView` | operations | Configuración de ventanas de tiempo por tramo |
| `/operations/routes/:routeId/groups` | `ExpeditionGroupConfigurationView` | operations | Gestión de grupos de expedición |
| `/operations/progress` | `GroupProgressDashboardView` | operations | Seguimiento de progreso de grupos |
| `/operations/alerts` | `EarlyWarningAlertDashboardView` | operations | Alertas tempranas por grupo de expedición |
| `/field-guide/groups` | `FieldGuideWorkspaceView` | field-guide | Grupos asignados al guía de campo |
| `/field-guide/groups/:groupId/manifest` | `TouristManifestView` | field-guide | Manifiesto de turistas por grupo |

## Requisitos de negocio implementados

- Una ruta queda en estado `draft` hasta tener al menos un punto de control; luego puede habilitarse (`enabled`).
- No se permiten puntos de control duplicados en la misma posición de secuencia.
- Las ventanas de tiempo esperadas requieren que el tiempo máximo sea mayor al mínimo, y no se duplican por tramo.
- Los grupos de expedición solo se pueden crear sobre rutas habilitadas, y la fecha de salida no puede ser anterior a hoy.
- Se advierte si un guía de campo ya tiene otro grupo con salida en la misma fecha.
- El manifiesto valida documento de identidad único por grupo y por fecha de salida, y respeta la capacidad máxima del grupo.
- El dashboard de progreso muestra advertencia cuando no hay sincronización reciente.
- Una alerta temprana solo admite acciones (reconocer, resolver, descartar como falsa alarma) mientras esté `active` o `acknowledged`; una alerta `resolved`/`dismissed` queda cerrada de forma permanente.

## Puesta en marcha

```bash
npm install
```

### Variables de entorno

Crea un archivo `.env.development` (o `.env`) con las siguientes variables:

```
VITE_PRIME_UI_LICENSE_KEY=
VITE_VITALTREK_API_URL=
VITE_ROUTES_ENDPOINT_PATH=
VITE_CHECKPOINTS_ENDPOINT_PATH=
VITE_EXPECTED_TIME_WINDOWS_ENDPOINT_PATH=
VITE_EXPEDITION_GROUPS_ENDPOINT_PATH=
VITE_FIELD_GUIDES_ENDPOINT_PATH=
VITE_MANIFEST_ENTRIES_ENDPOINT_PATH=
VITE_GROUP_PROGRESS_ENDPOINT_PATH=
VITE_EARLY_WARNING_ALERTS_ENDPOINT_PATH=
```

### Levantar la API mock (json-server)

```bash
npm run api
```

Sirve `server/db.json` en `http://localhost:3000`, reescribiendo `/api/v1/*` según `server/routes.json`.

### Levantar el frontend

```bash
npm run dev
```

### Build de producción

```bash
npm run build
npm run preview
```

## Internacionalización

Las traducciones viven en `src/locales/en.json` y `src/locales/es.json`, cubriendo layout, formularios, validaciones, mensajes de error y estados del dominio. El idioma se puede cambiar desde `LanguageSwitcher` en el layout.
