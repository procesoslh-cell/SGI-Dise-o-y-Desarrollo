# Controles realizados · v1.8.2

## Controles automáticos completados

- Sintaxis de todos los archivos JavaScript del backend con `node --check`.
- Sintaxis JSX de todos los archivos del frontend mediante el parser de TypeScript.
- Validación de rutas de importación locales.
- Generación correcta del archivo `backend/data/db.json` mediante el seed.
- Verificación del bootstrap para el usuario administrador.
- Verificación de 12 usuarios, 12 roles y 13 plantillas del Plan de Marketing.
- Verificación de formularios específicos para cada tarea de Marketing.
- Verificación de fechas inclusivas: una tarea de 5 días ocupa del día 1 al día 5.
- Verificación de alerta interna y registro de correo al asignar una tarea de Marketing.
- Verificación de creación del registro de correo en `emailOutbox` cuando SMTP no está configurado.
- Verificación de integridad del ZIP final.

## Pruebas manuales recomendadas

1. Ingresar como `admin / 1234` y abrir Usuarios.
2. Crear un usuario y asignarle un rol.
3. Abrir un proyecto y entrar en Plan de Marketing.
4. Presionar Cargar plan modelo.
5. Revisar responsables, fechas y duraciones de las 13 tareas.
6. Crear el plan y entrar con uno de los usuarios asignados.
7. Confirmar que aparece la alerta interna.
8. Abrir la tarea desde Mis tareas, guardar un avance y adjuntar un archivo.
9. Revisar el Calendario y confirmar colores diferentes por tarea.
10. Revisar el Gantt y confirmar que aparecen las tareas del Plan de Marketing.
11. Configurar SMTP y repetir una asignación con una dirección de correo real.

## Limitación del entorno de generación

No se pudo ejecutar `npm install` ni el build completo de Vite porque el registro npm disponible en el entorno devolvió un error 404 al solicitar Vite. No se incorporaron dependencias nuevas; el envío SMTP utiliza módulos nativos de Node.js.
