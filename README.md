# SGI Diseño y Desarrollo · v1.8.2

Versión simplificada y modular para gestionar desarrollos de producto, tareas, validaciones, calendario, Gantt y Plan de Marketing.

## Módulos

La operación diaria mantiene cinco módulos principales:

1. **Dashboard**: indicadores generales y filtro por proyecto.
2. **Mis tareas**: ejecución, avances parciales, SLA, entregables y validaciones.
3. **Proyectos**: workflow, Brief y Plan de Marketing.
4. **Calendario**: visual mensual de los períodos de todas las tareas.
5. **Gantt**: planificación temporal de workflow y Plan de Marketing.

El usuario administrador dispone además de **Usuarios**, para crear cuentas, asignar roles, cambiar contraseñas y activar o desactivar accesos.

## Cambios de la v1.8.2

### Plan de Marketing

Se incorporó una plantilla base con 13 tareas:

1. Brief de producto para preparación campaña de comunicación — 2 días.
2. Realización de fotos con fondo blanco — 2 días.
3. Edición de fotos/redimensiones — 2 días.
4. Producción audiovisual en exterior — 2 días.
5. Edición material producción exterior — 4 días.
6. Armado de news técnicos / envío asesores — 1 día.
7. Envío difusión WhatsApp — 1 día.
8. Realización de piezas RRSS — 2 días.
9. Realización Mailing B2C — 1 día.
10. Realización Banners web (desktop + mobile) — 1 día.
11. Disponibilización de material externo para clientes B2B — 1 día.
12. Comunicación interna del lanzamiento para todos los colaboradores — 1 día.
13. Envío mailing lanzamiento a BBDD — 1 día.

Desde el Plan de Marketing se puede:

- Cargar las 13 tareas de una sola vez.
- Asignar un usuario distinto a cada tarea.
- Calcular las fechas de forma consecutiva según la duración.
- Crear tareas individuales desde una plantilla o como tarea personalizada.
- Reprogramar responsable y fechas desde la propia tarea.
- Adjuntar entregables y guardar avances parciales.
- Enviar la tarea a validación del jefe del proyecto.

Cada plantilla tiene campos específicos según la actividad.

### Calendario y Gantt

- El Calendario asigna un color estable y diferente a cada tarea durante todo su período.
- El tooltip muestra proyecto, tipo, responsable, fechas, estado y avance.
- Se puede filtrar entre workflow, Plan de Marketing o ambos.
- El Gantt incluye de forma explícita todas las tareas del Plan de Marketing.
- El Gantt identifica cada fila como Workflow o Plan de Marketing.

### Usuarios

El administrador puede:

- Crear usuarios.
- Elegir nombre de acceso, email y contraseña inicial.
- Asignar roles.
- Cambiar el rol o la contraseña.
- Activar o desactivar cuentas.

Se agregaron roles de prueba para Diseño, Audiovisual, Comercial y Recursos Humanos.

### Alertas y correo

Cuando se crea o reasigna una tarea del Plan de Marketing:

- Se genera inmediatamente una notificación interna.
- La notificación aparece en el popup al iniciar sesión y en Mis tareas.
- Se registra un correo en `emailOutbox`.
- Si SMTP está configurado, el backend intenta enviarlo automáticamente.
- Si SMTP no está configurado, queda con estado `Pendiente configuración SMTP` sin bloquear el sistema.

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

El envío SMTP está implementado con módulos nativos de Node.js, sin dependencias adicionales.

## Arquitectura modular

```text
SGI-Dise-o-y-Desarrollo-v1.8.2/
├── backend/
│   ├── data/
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
│       ├── api/
│       ├── components/
│       ├── features/
│       ├── pages/
│       └── utils/
├── shared/
└── docs/
```

No existe una carpeta `apps`; frontend y backend están separados en la raíz.

## Ejecución local

Requiere Node.js 20 o superior.

```bash
npm install
npm run seed
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Usuarios de prueba

Todos usan contraseña `1234`.

| Usuario | Rol |
|---|---|
| `admin` | Administrador |
| `jefe` | Jefe de Desarrollo |
| `brand` | Brand Manager |
| `analista` | Analista de Producto |
| `marketing` | Marketing |
| `compras` | Compras / Comex |
| `desarrollador` | Desarrollador |
| `fabrica` | Fábrica |
| `diseno` | Diseño |
| `audiovisual` | Audiovisual |
| `comercial` | Comercial |
| `rrhh` | Recursos Humanos |

## Persistencia

La versión de prueba utiliza `backend/data/db.json`. Para regenerar los datos de prueba:

```bash
npm run seed
```

Esto sobrescribe la base local de prueba.
