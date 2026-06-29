# SGI Diseño y Desarrollo

Sistema para gestionar el proceso de diseño y desarrollo de productos desde la solicitud inicial hasta lanzamiento, marketing y cierre.

## Instalación

Ejecutar desde la carpeta raíz:

```bash
npm install --no-audit --no-fund --progress=false
npm run dev
```

Frontend:

```txt
http://localhost:5173
```

Backend:

```txt
http://localhost:4000
```

## Usuarios de prueba

```txt
admin / 1234
jefe / 1234
brand / 1234
analista / 1234
marketing / 1234
compras / 1234
desarrollador / 1234
fabrica / 1234
```

## Flujo operativo

Al crear un proyecto, el sistema genera automáticamente todas las etapas del proceso y asigna cada tarea al responsable correspondiente. El creador puede editar esas asignaciones antes de guardar el proyecto y también dentro del workspace.

Etapas principales:

1. Solicitud de desarrollo.
2. Análisis de tendencias.
3. Análisis del mercado.
4. Definición de oportunidades.
5. Validación de requerimientos de diseño.
6. Fase de simulación.
7. Armado de carpeta de diseño con LMAT inicial.
8. Desarrollo inicial de proveedores y viabilidad de importación.
9. Decisión de proveedor o descarte.
10. Costeo inicial.
11. Validación del proyecto.
12. Definición de ficha técnica.
13. Definición de estándares, compatibilidades y talles.
14. Desarrollo de proveedores.
15. Solicitud de diseño industrial o gráfico.
16. Iteraciones de diseño.
17. Solicitud de prototipo o muestras.
18. Llegada y armado de prototipo.
19. Validación técnica.
20. Decisión de diseño: validar o archivar.
21. LMAT final con lista de sustitutos.
22. Compra.
23. Actualización del maestro.
24. Carga en el MRP.
25. Producción inicial.
26. Lanzamiento.
27. Marketing y cierre del proyecto.

## Módulos

- Dashboard gerencial.
- Mis tareas.
- Proyectos.
- Brief y Producto.
- Calendario.
- Documentos.
- Workflow.
- Aprobaciones.
- Notificaciones.
- Administración.
- Configuración técnica.

## Comandos útiles

```bash
npm run dev
npm run build
npm run seed
npm run dev:backend
npm run dev:frontend
```
