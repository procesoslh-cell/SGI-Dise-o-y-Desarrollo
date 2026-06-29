# Arquitectura - SGI Diseño y Desarrollo

## Estructura

```txt
apps/frontend     Interfaz React/Vite
apps/backend      API Express
packages/shared   Contratos compartidos
docs              Documentación técnica y funcional
```

## Backend

- API REST.
- Login por token.
- Roles y permisos.
- Proyectos.
- Workflow configurable.
- Documentos y versiones.
- Notificaciones.
- Timeline no editable.
- Calendario de lanzamiento.

## Datos

La versión local utiliza una base JSON para facilitar la prueba funcional. La capa de datos está separada para permitir migración posterior a PostgreSQL.

## Flujo guiado

Al crear un proyecto:

1. Se crea el proyecto.
2. Se generan todas las etapas del workflow.
3. Se asigna automáticamente un usuario responsable a cada etapa según el rol configurado.
4. Se habilita la primera etapa.
5. Se crean notificaciones para responsables activos y tareas programadas.
6. Cada usuario ve sus pendientes en el módulo Mis tareas.

Al completar una etapa:

1. Se registra el avance en timeline.
2. Se valida si requiere aprobación.
3. Si corresponde, se crea la aprobación.
4. Al aprobar o completar, se habilita la siguiente etapa.
5. El sistema notifica al nuevo responsable.

## Proceso

El workflow está alineado al proceso de diseño y desarrollo: solicitud, investigación, requerimientos, diseño, proveedores, costeo, validación, documentación, compra, MRP, producción inicial, lanzamiento, marketing y cierre.
