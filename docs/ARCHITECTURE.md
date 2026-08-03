# Arquitectura v1.8.2

## Objetivo

Separar claramente interfaz, API, dominio y persistencia para evitar volver a concentrar toda la aplicación en un único archivo.

## Frontend

- `pages/`: Dashboard, Mis tareas, Proyectos, Calendario, Gantt y Usuarios para administradores.
- `features/projects/`: workflow, Brief, Plan de Marketing y creación de proyectos.
- `components/`: modales, layout, estados y elementos reutilizables.
- `api/`: cliente HTTP y sesión.
- `utils/`: fechas, normalización y colores estables de tareas.

## Backend

- `routes/`: autenticación, proyectos, tareas, archivos, notificaciones y usuarios.
- `services/`: correo SMTP, alertas por vencimiento y lógica transversal.
- `features/`: autenticación, serialización y motor de workflow.
- `db/`: persistencia JSON y datos iniciales.
- `app.js`: composición de middlewares y routers.
- `server.js`: arranque del servidor.

## Entidades principales

- Proyecto.
- Etapa o tarea del workflow.
- Tarea del Plan de Marketing.
- Plantilla específica de Marketing.
- Usuario y rol.
- Avance parcial.
- Checklist.
- Entregable.
- Solicitud de validación.
- Brief.
- Plan de Marketing.
- Notificación interna.
- Correo en `emailOutbox`.
