# SGI Diseño y Desarrollo · v1.8.2

Versión modular para gestionar desarrollos de producto, tareas, validaciones, calendario, Gantt y Plan de Marketing.

## Módulos

La operación diaria mantiene cinco módulos principales:

1. **Dashboard**: indicadores generales y filtro por proyecto.
2. **Mis tareas**: ejecución, avances parciales, SLA, entregables y validaciones.
3. **Proyectos**: workflow, Brief y Plan de Marketing.
4. **Calendario**: visual mensual de los períodos de todas las tareas.
5. **Gantt**: planificación temporal de workflow y Plan de Marketing.

El usuario administrador dispone además de **Usuarios**, para crear cuentas, asignar roles, cambiar contraseñas y activar o desactivar accesos.

## Plan de Marketing

Se incluye una plantilla base con 13 tareas de lanzamiento. Desde el Plan de Marketing se puede:

- Cargar las tareas de una sola vez.
- Asignar un usuario distinto a cada tarea.
- Calcular fechas de forma consecutiva según duración.
- Crear tareas individuales desde una plantilla o de forma personalizada.
- Reprogramar responsable y fechas.
- Adjuntar entregables y guardar avances parciales.
- Enviar tareas a validación del jefe del proyecto.

## Calendario y Gantt

- El Calendario asigna un color estable a cada tarea durante todo su período.
- El tooltip muestra proyecto, tipo, responsable, fechas, estado y avance.
- Se puede filtrar entre workflow, Plan de Marketing o ambos.
- El Gantt incluye las tareas de workflow y Plan de Marketing.

## Usuarios

El administrador puede:

- Crear usuarios.
- Definir nombre de acceso, email y contraseña inicial.
- Asignar roles.
- Cambiar rol o contraseña.
- Activar o desactivar cuentas.

## Alertas y correo

Cuando se crea o reasigna una tarea del Plan de Marketing:

- Se genera una notificación interna.
- La notificación aparece al iniciar sesión y en Mis tareas.
- Se registra un correo en `emailOutbox`.
- Si SMTP está configurado, el backend intenta enviarlo automáticamente.
- Si SMTP no está configurado, el correo queda pendiente sin bloquear el sistema.

## PostgreSQL

La rama `testing` utiliza PostgreSQL 16 como persistencia.

Las entidades operativas principales se almacenan en tablas independientes:

- `users`
- `projects`
- `project_stages`
- `marketing_tasks`
- `task_progress`
- `notifications`
- `email_outbox`

Las colecciones todavía no normalizadas se mantienen temporalmente en `app_state` como JSONB. Esta estrategia permite migrar de forma progresiva sin romper la API ni el frontend existente.

Al iniciar una base vacía, el backend crea el esquema automáticamente y carga los datos iniciales. Si detecta una instalación previa que todavía tiene las entidades principales embebidas en `app_state`, las migra a sus tablas específicas.

Variables requeridas:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=sgi_diseno_test
POSTGRES_USER=sgi_diseno
POSTGRES_PASSWORD=
POSTGRES_SSL=false
```

## Configuración SMTP

Copiar `backend/.env.example` a `backend/.env` o cargar las variables en el ambiente:

```env
APP_URL=http://localhost:5173
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=cuenta@empresa.com
SMTP_PASS=clave-o-app-password
SMTP_FROM="SGI Diseño y Desarrollo <cuenta@empresa.com>"
SMTP_REJECT_UNAUTHORIZED=true
```

## Arquitectura

```text
SGI-Dise-o-y-Desarrollo/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   ├── features/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── app.js
│   │   └── server.js
│   └── uploads/
├── frontend/
│   └── src/
├── shared/
├── docs/
├── Dockerfile
└── docker-compose.yml
```

Frontend y backend están separados en la raíz.

## Ejecución local

Requiere Node.js 20 o superior y PostgreSQL 16.

Con Docker:

```bash
cp backend/.env.example backend/.env
docker compose up -d --build
```

Sin Docker, con una instancia PostgreSQL disponible:

```bash
npm install
npm run seed
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health: `http://localhost:4000/api/health`

## Seed

Para regenerar los datos de prueba:

```bash
npm run seed
```

El seed reinicializa el estado PostgreSQL con los datos definidos en `backend/src/db/initialData.js`.

## Ambiente de testing

La rama destinada al ambiente de prueba es:

`testing`

La rama `main` queda reservada para versiones validadas y promoción controlada a producción.
