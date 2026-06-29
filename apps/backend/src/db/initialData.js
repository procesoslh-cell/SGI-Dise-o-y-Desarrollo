import crypto from 'crypto';

export const now = () => new Date().toISOString();
export const datePlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
export const uid = (prefix = 'id') => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

const event = (type, title, detail, by = 'Sistema', extra = {}) => ({
  id: uid('tl'),
  type,
  title,
  detail,
  by,
  createdAt: now(),
  ...extra
});

const permissionCatalog = [
  { id: 'security:login', name: 'Ingresar al sistema', area: 'Seguridad' },
  { id: 'security:reset-password', name: 'Solicitar recuperación de contraseña', area: 'Seguridad' },
  { id: 'admin:users', name: 'Administrar usuarios', area: 'Administración' },
  { id: 'admin:roles', name: 'Administrar roles y permisos', area: 'Administración' },
  { id: 'admin:catalogs', name: 'Administrar unidades, categorías y subcategorías', area: 'Administración' },
  { id: 'projects:read', name: 'Ver proyectos', area: 'Proyecto' },
  { id: 'projects:create', name: 'Crear proyectos', area: 'Proyecto' },
  { id: 'projects:update', name: 'Editar proyectos', area: 'Proyecto' },
  { id: 'projects:close', name: 'Cerrar proyectos', area: 'Proyecto' },
  { id: 'brief:update', name: 'Cargar y editar brief', area: 'Brief' },
  { id: 'analysis:update', name: 'Cargar análisis de producto', area: 'Analista de Producto' },
  { id: 'checklist:update', name: 'Actualizar checklist', area: 'Checklist' },
  { id: 'approvals:manage', name: 'Aprobar o rechazar instancias', area: 'Aprobaciones' },
  { id: 'decisions:manage', name: 'Registrar decisiones del flujograma', area: 'Decisiones' },
  { id: 'workflow:read', name: 'Ver workflow', area: 'Workflow' },
  { id: 'workflow:configure', name: 'Configurar workflow', area: 'Workflow' },
  { id: 'workflow:execute', name: 'Ejecutar etapas asignadas', area: 'Workflow' },
  { id: 'timeline:read', name: 'Ver timeline inalterable', area: 'Auditoría' },
  { id: 'documents:upload', name: 'Subir documentos', area: 'Documentos' },
  { id: 'documents:review', name: 'Observar y aprobar documentos', area: 'Documentos' },
  { id: 'calendar:read', name: 'Ver calendario de lanzamientos', area: 'Calendario' },
  { id: 'dashboard:executive', name: 'Ver dashboard gerencial', area: 'Dashboard' },
  { id: 'launch:manage', name: 'Gestionar calendario de lanzamientos', area: 'Lanzamientos' },
  { id: 'marketing:manage', name: 'Gestionar tareas y entregables de marketing', area: 'Marketing' },
  { id: 'notifications:read', name: 'Ver centro de notificaciones', area: 'Notificaciones' }
];

const allPermissions = permissionCatalog.map((p) => p.id);
const operativePermissions = ['security:login','projects:read','projects:update','checklist:update','workflow:read','workflow:execute','timeline:read','documents:upload','documents:review','calendar:read','notifications:read'];

const roles = [
  { id: 'role_admin', code: 'ADMIN', name: 'Administrador', description: 'Acceso total a la plataforma.', permissionIds: allPermissions },
  { id: 'role_jefe', code: 'JEFE_DESARROLLO', name: 'Jefe de Desarrollo', description: 'Gestiona proyectos, responsables, aprobaciones, workflow y cierre.', permissionIds: ['security:login','projects:read','projects:create','projects:update','projects:close','brief:update','analysis:update','checklist:update','approvals:manage','decisions:manage','workflow:read','workflow:configure','workflow:execute','timeline:read','documents:upload','documents:review','calendar:read','dashboard:executive','launch:manage','marketing:manage','notifications:read'] },
  { id: 'role_brand', code: 'BRAND_MANAGER', name: 'Brand Manager', description: 'Carga solicitudes, brief, oportunidades y seguimiento comercial del proyecto.', permissionIds: ['security:login','projects:read','projects:create','projects:update','brief:update','checklist:update','decisions:manage','workflow:read','workflow:execute','timeline:read','documents:upload','documents:review','calendar:read','dashboard:executive','launch:manage','marketing:manage','notifications:read'] },
  { id: 'role_analista', code: 'ANALISTA_PRODUCTO', name: 'Analista de Producto', description: 'Completa análisis, costeo, factibilidad y documentación técnica.', permissionIds: ['security:login','projects:read','analysis:update','checklist:update','decisions:manage','workflow:read','workflow:execute','timeline:read','documents:upload','documents:review','calendar:read','dashboard:executive','notifications:read'] },
  { id: 'role_desarrollador', code: 'DESARROLLADOR', name: 'Desarrollador', description: 'Trabaja simulación, diseño, ficha técnica, prototipos y validaciones.', permissionIds: operativePermissions.concat(['analysis:update','decisions:manage']) },
  { id: 'role_compras', code: 'COMPRAS_COMEX', name: 'Compras / Comex', description: 'Gestiona proveedores, viabilidad de importación, compra y MRP.', permissionIds: operativePermissions.concat(['decisions:manage']) },
  { id: 'role_fabrica', code: 'FABRICA', name: 'Fábrica', description: 'Acompaña producción inicial y armado productivo.', permissionIds: operativePermissions },
  { id: 'role_marketing', code: 'MARKETING', name: 'Marketing', description: 'Prepara calendario, entregables de lanzamiento y cierre comunicacional.', permissionIds: ['security:login','projects:read','checklist:update','workflow:read','workflow:execute','timeline:read','documents:upload','documents:review','calendar:read','dashboard:executive','launch:manage','marketing:manage','notifications:read'] }
];

const users = [
  { id: 1, name: 'Administrador SGI', email: 'admin@sgi.local', username: 'admin', roleId: 'role_admin', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 2, name: 'Jefe de Desarrollo', email: 'jefe@sgi.local', username: 'jefe', roleId: 'role_jefe', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 3, name: 'Brand Manager', email: 'brand@sgi.local', username: 'brand', roleId: 'role_brand', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 4, name: 'Analista Producto', email: 'analista@sgi.local', username: 'analista', roleId: 'role_analista', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 5, name: 'Marketing', email: 'marketing@sgi.local', username: 'marketing', roleId: 'role_marketing', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 6, name: 'Compras / Comex', email: 'compras@sgi.local', username: 'compras', roleId: 'role_compras', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 7, name: 'Desarrollador', email: 'desarrollador@sgi.local', username: 'desarrollador', roleId: 'role_desarrollador', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 8, name: 'Fábrica', email: 'fabrica@sgi.local', username: 'fabrica', roleId: 'role_fabrica', passwordHash: hashPassword('1234'), active: true, createdAt: now() }
];

const businessUnits = [
  { id: 1, name: 'Ciclismo', code: 'CIC', active: true },
  { id: 2, name: 'Motociclismo', code: 'MOT', active: true },
  { id: 3, name: 'Movilidad Eléctrica', code: 'ME', active: true },
  { id: 4, name: 'Automotor', code: 'AUT', active: true }
];

const categories = [
  { id: 1, businessUnitId: 1, name: 'Bicicletas', active: true },
  { id: 2, businessUnitId: 1, name: 'Bicipartes', active: true },
  { id: 3, businessUnitId: 2, name: 'Repuestos', active: true },
  { id: 4, businessUnitId: 2, name: 'Neumáticos', active: true },
  { id: 5, businessUnitId: 3, name: 'Scooters', active: true },
  { id: 6, businessUnitId: 4, name: 'Autopartes', active: true }
];

const subcategories = [
  { id: 1, categoryId: 1, name: 'MTB', active: true },
  { id: 2, categoryId: 1, name: 'Ruta', active: true },
  { id: 3, categoryId: 2, name: 'Transmisión', active: true },
  { id: 4, categoryId: 3, name: '110cc', active: true },
  { id: 5, categoryId: 4, name: 'Cubiertas', active: true },
  { id: 6, categoryId: 5, name: 'Urbano', active: true },
  { id: 7, categoryId: 6, name: 'Reposición', active: true }
];

const stageBlueprint = [
  { phase: 'Solicitud', name: 'Solicitud de desarrollo', roleId: 'role_brand', slaDays: 1, doc: 'Solicitud formal de desarrollo', checklist: ['Solicitud formal cargada', 'Necesidad de mercado indicada', 'Unidad y categoría definidas'] },
  { phase: 'Investigación', name: 'Análisis de tendencias', roleId: 'role_jefe', slaDays: 2, doc: 'Ideas iniciales de desarrollo', checklist: ['Tendencias revisadas', 'Oportunidades preliminares registradas', 'Referencias cargadas'] },
  { phase: 'Investigación', name: 'Análisis del mercado', roleId: 'role_jefe', slaDays: 7, doc: 'Informe de análisis de mercado', checklist: ['Mercado objetivo analizado', 'Competidores relevados', 'Necesidad a satisfacer documentada'] },
  { phase: 'Investigación', name: 'Definición de oportunidades', roleId: 'role_brand', slaDays: 1, doc: 'Documento inicial de oportunidades', checklist: ['Oportunidad definida', 'Alcance inicial validado', 'Prioridad sugerida'] },
  { phase: 'Requerimientos', name: 'Validación de requerimientos de diseño', roleId: 'role_desarrollador', slaDays: 3, doc: 'Documento de requerimientos', checklist: ['Requerimientos cargados', 'Restricciones identificadas', 'Criterios de validación definidos'] },
  { phase: 'Requerimientos', name: 'Fase de simulación', roleId: 'role_desarrollador', slaDays: 5, doc: 'Simulación o referencia técnica', checklist: ['Simulación o referencia cargada', 'Riesgos preliminares detectados', 'Resultado documentado'] },
  { phase: 'Diseño', name: 'Armado de carpeta de diseño con LMAT inicial', roleId: 'role_desarrollador', slaDays: 1, doc: 'Carpeta de diseño y LMAT inicial', checklist: ['LMAT inicial cargada', 'Carpeta de diseño armada', 'Información compartida con responsables'] },
  { phase: 'Proveedores', name: 'Desarrollo inicial de proveedores y viabilidad de importación', roleId: 'role_compras', slaDays: 10, doc: 'Propuesta de proveedores y producto', checklist: ['Proveedor/es consultados', 'Viabilidad de importación revisada', 'Alternativas documentadas'] },
  { phase: 'Decisión', name: 'Decisión de proveedor o descarte', roleId: 'role_jefe', slaDays: 1, doc: 'Decisión de proveedor', checklist: ['Proveedor disponible validado', 'Decisión registrada', 'Próxima acción definida'] },
  { phase: 'Costeo', name: 'Costeo inicial', roleId: 'role_analista', slaDays: 3, doc: 'Costeo inicial', checklist: ['Costos preliminares cargados', 'Precio objetivo estimado', 'Riesgos comerciales indicados'] },
  { phase: 'Validación', name: 'Validación del proyecto', roleId: 'role_jefe', slaDays: 2, doc: 'Validación del proyecto', checklist: ['Factibilidad revisada', 'Aprobación o ajuste registrado', 'Responsable siguiente confirmado'] },
  { phase: 'Técnica', name: 'Definición de ficha técnica', roleId: 'role_desarrollador', slaDays: 2, doc: 'Ficha técnica', checklist: ['Ficha técnica creada', 'Atributos básicos definidos', 'Datos críticos completos'] },
  { phase: 'Técnica', name: 'Definición de estándares, compatibilidades y talles', roleId: 'role_desarrollador', slaDays: 20, doc: 'Estándares, compatibilidades y talles', checklist: ['Compatibilidades definidas', 'Talles o variantes cargados', 'Estándares técnicos validados'] },
  { phase: 'Proveedores', name: 'Desarrollo de proveedores', roleId: 'role_compras', slaDays: 20, doc: 'Desarrollo de proveedores', checklist: ['Proveedor seleccionado', 'Condiciones preliminares registradas', 'Muestras o alternativas coordinadas'] },
  { phase: 'Diseño', name: 'Solicitud de diseño industrial o gráfico', roleId: 'role_desarrollador', slaDays: 1, doc: 'Solicitud de diseño industrial o gráfico', checklist: ['Solicitud enviada', 'Brief de diseño adjunto', 'Fecha esperada registrada'] },
  { phase: 'Diseño', name: 'Iteraciones de diseño', roleId: 'role_desarrollador', slaDays: 20, doc: 'Renders, fotomontajes o bocetos', checklist: ['Iteraciones registradas', 'Observaciones respondidas', 'Propuesta final cargada'] },
  { phase: 'Prototipo', name: 'Solicitud de prototipo al proveedor o muestras', roleId: 'role_desarrollador', slaDays: 2, doc: 'Solicitud de prototipo o muestras', checklist: ['Solicitud enviada', 'Proveedor confirmado', 'Fecha estimada indicada'] },
  { phase: 'Prototipo', name: 'Llegada y armado de prototipo', roleId: 'role_desarrollador', slaDays: 20, doc: 'Registro de prototipo', checklist: ['Prototipo recibido', 'Armado realizado', 'Evidencia cargada'] },
  { phase: 'Validación', name: 'Validación técnica', roleId: 'role_desarrollador', slaDays: 3, doc: 'Informe de validación técnica', checklist: ['Pruebas realizadas', 'Resultado técnico cargado', 'Observaciones documentadas'] },
  { phase: 'Decisión', name: 'Decisión de diseño: validar o archivar', roleId: 'role_jefe', slaDays: 2, doc: 'Decisión final de diseño', checklist: ['Resultado técnico revisado', 'Diseño validado o archivado', 'Decisión registrada'] },
  { phase: 'Documentación', name: 'LMAT final con lista de sustitutos', roleId: 'role_desarrollador', slaDays: 3, doc: 'LMAT final con lista de sustitutos', checklist: ['LMAT final cargada', 'Sustitutos definidos', 'Documento enviado a compras'] },
  { phase: 'Compra', name: 'Compra', roleId: 'role_compras', slaDays: 10, doc: 'Orden o solicitud de compra', checklist: ['Compra solicitada', 'Proveedor confirmado', 'Condiciones registradas'] },
  { phase: 'Maestro', name: 'Actualización del maestro', roleId: 'role_compras', slaDays: 3, doc: 'Alta o actualización de maestro', checklist: ['Datos maestros revisados', 'Código/SKU confirmado', 'Atributos comerciales cargados'] },
  { phase: 'MRP', name: 'Carga en el MRP', roleId: 'role_compras', slaDays: 2, doc: 'Confirmación de carga en MRP', checklist: ['MRP cargado', 'Planificación informada', 'Restricciones indicadas'] },
  { phase: 'Producción', name: 'Producción inicial', roleId: 'role_fabrica', slaDays: 60, doc: 'Registro de producción inicial', checklist: ['Producción inicial planificada', 'Avance registrado', 'Resultado informado'] },
  { phase: 'Lanzamiento', name: 'Lanzamiento', roleId: 'role_marketing', slaDays: 1, doc: 'Evidencia de lanzamiento', checklist: ['Fecha de lanzamiento confirmada', 'Canales informados', 'Lanzamiento ejecutado'] },
  { phase: 'Marketing', name: 'Marketing y cierre del proyecto', roleId: 'role_marketing', slaDays: 5, doc: 'Entregables de marketing y cierre', checklist: ['Entregables completos', 'Comunicación comercial realizada', 'Proyecto listo para cierre'] }
];

const stages = stageBlueprint.map((item, index) => ({
  id: index + 1,
  workflowId: 1,
  order: index + 1,
  phase: item.phase,
  name: item.name,
  responsibleRoleId: item.roleId,
  slaDays: item.slaDays,
  formId: index + 1,
  checklistTemplateId: index + 1
}));

const workflow = {
  id: 1,
  code: 'WF-DYD-001',
  name: 'Proceso de Diseño y Desarrollo',
  version: '1.5.0',
  active: true,
  description: 'Flujo operativo con tareas asignadas automáticamente por responsable y continuidad hasta marketing y cierre.',
  stageIds: stages.map((stage) => stage.id)
};

const forms = stageBlueprint.map((item, index) => ({
  id: index + 1,
  name: item.name,
  description: `Formulario de trabajo para la etapa ${item.name}.`,
  fields: [
    { key: 'resultado', label: 'Resultado de la etapa', type: 'select', options: ['Pendiente', 'En proceso', 'Aprobado', 'Requiere ajustes', 'No aplica'] },
    { key: 'observaciones', label: 'Observaciones', type: 'textarea' },
    { key: 'bloqueos', label: 'Bloqueos o pendientes', type: 'textarea' }
  ]
}));

const checklistTemplates = stageBlueprint.map((item, index) => ({ id: index + 1, stageId: index + 1, items: item.checklist }));
const documentTemplates = stageBlueprint.map((item, index) => ({ id: index + 1, name: item.doc, stageId: index + 1, type: item.phase.toLowerCase(), required: true }));

const approvalStages = new Set([9, 11, 20, 26, 27]);
const transitions = stages.slice(0, -1).map((stage, index) => ({
  id: index + 1,
  workflowId: 1,
  fromStageId: stage.id,
  toStageId: stage.id + 1,
  action: `Avanzar a ${stages[index + 1].name}`,
  requiresApproval: approvalStages.has(stage.id),
  approverRoleId: approvalStages.has(stage.id) ? 'role_jefe' : null,
  decisionCode: `D${String(stage.id).padStart(2, '0')}`
}));

const flowchartDecisions = [
  { code: 'D01', name: 'Solicitud formal', question: '¿La solicitud de desarrollo está formalizada?', positive: 'Pasa a análisis de tendencias', negative: 'Vuelve al solicitante' },
  { code: 'D09', name: 'Proveedor que desarrolle', question: '¿Hay proveedor que pueda desarrollar?', positive: 'Avanza a costeo inicial', negative: 'Se evalúa descarte o búsqueda alternativa' },
  { code: 'D11', name: 'Validación del proyecto', question: '¿El proyecto es viable para continuar?', positive: 'Avanza a ficha técnica', negative: 'Se descarta o vuelve a análisis' },
  { code: 'D12', name: 'Bicicleta', question: '¿Es una bicicleta?', positive: 'Requiere estándares, compatibilidades y talles', negative: 'Continúa con documentación técnica aplicable' },
  { code: 'D20', name: 'Validación de diseño', question: '¿Se valida el diseño?', positive: 'Avanza a LMAT final', negative: 'Se archiva o vuelve a iteraciones' },
  { code: 'D26', name: 'Lanzamiento realizado', question: '¿El producto fue lanzado?', positive: 'Marketing completa entregables', negative: 'Mantiene seguimiento de lanzamiento' },
  { code: 'D27', name: 'Cierre', question: '¿Marketing completó entregables y el proyecto puede cerrarse?', positive: 'Proyecto cerrado', negative: 'Queda activo con tareas pendientes' }
];

const projects = [
  { id: 1, code: 'SGI-2026-0001', name: 'Bicicleta MTB R29 Pro', businessUnitId: 1, categoryId: 1, subcategoryId: 1, responsibleUserId: 2, targetDate: datePlus(120), status: 'Requerimientos', priority: 'Alta', workflowId: 1, createdBy: 1, createdAt: now(), updatedAt: now() },
  { id: 2, code: 'SGI-2026-0002', name: 'Kit transmisión RX150', businessUnitId: 2, categoryId: 3, subcategoryId: 4, responsibleUserId: 3, targetDate: datePlus(95), status: 'Solicitud', priority: 'Media', workflowId: 1, createdBy: 1, createdAt: now(), updatedAt: now() }
];

function defaultUserForRole(roleId) {
  return users.find((user) => user.roleId === roleId && user.active)?.id || null;
}

function makeProjectStages(projectId, openUntil = 1) {
  let start = 0;
  return stages.map((stage) => {
    const status = stage.order < openUntil ? 'Completa' : stage.order === openUntil ? 'En curso' : 'Bloqueada';
    const row = {
      id: projectId * 1000 + stage.id,
      projectId,
      workflowId: 1,
      stageId: stage.id,
      order: stage.order,
      phase: stage.phase,
      name: stage.name,
      responsibleRoleId: stage.responsibleRoleId,
      assignedUserId: defaultUserForRole(stage.responsibleRoleId),
      slaDays: stage.slaDays,
      startDate: datePlus(start),
      dueDate: datePlus(start + stage.slaDays),
      status,
      formData: status === 'Completa' ? { resultado: 'Aprobado', observaciones: 'Etapa completada en datos de prueba.' } : {},
      createdAt: now(),
      updatedAt: now()
    };
    if (status === 'Completa') row.completedAt = now();
    start += stage.slaDays;
    return row;
  });
}

const projectStages = [...makeProjectStages(1, 5), ...makeProjectStages(2, 1)];

function makeChecklistItems() {
  let id = 1;
  return projectStages.flatMap((projectStage) => {
    const template = checklistTemplates.find((tpl) => tpl.stageId === projectStage.stageId);
    const completed = projectStage.status === 'Completa';
    return (template?.items || []).map((label, index) => ({
      id: id++,
      projectId: projectStage.projectId,
      projectStageId: projectStage.id,
      stageId: projectStage.stageId,
      label,
      required: index < 3,
      done: completed,
      doneBy: completed ? projectStage.assignedUserId : null,
      doneAt: completed ? now() : null,
      createdAt: now()
    }));
  });
}

const checklistItems = makeChecklistItems();

const projectBriefs = [
  { id: 1, projectId: 1, origenSolicitud: 'Brand Manager', necesidad: 'Lanzar una MTB R29 con mejor percepción de valor para canal mayorista.', clienteObjetivo: 'Bicicleterías y clientes de gama media/alta', fechaObjetivo: datePlus(120), oportunidad: 'Aprovechar demanda de reposición antes de temporada.', createdAt: now(), updatedAt: now() },
  { id: 2, projectId: 2, origenSolicitud: 'Comercial', necesidad: 'Armar kit de transmisión competitivo para RX150.', clienteObjetivo: 'Mostrador y mayorista moto', fechaObjetivo: datePlus(95), oportunidad: '', createdAt: now(), updatedAt: now() }
];

const productAnalyses = [
  { id: 1, projectId: 1, segmento: 'MTB recreativo / sport', competidores: 'Modelos R29 de entrada con transmisión básica.', precioReferencia: 420000, volumenEstimado: 250, riesgos: 'Costo final sensible al tipo de cambio y componentes.', recomendacion: 'Avanzar', analystUserId: 4, updatedAt: now() }
];

const launchPlans = [
  { id: 1, projectId: 1, targetLaunchDate: datePlus(115), preLaunchDate: datePlus(100), launchDate: datePlus(115), postLaunchDate: datePlus(122), channels: ['Mayorista', 'E-commerce'], mainMessage: 'MTB R29 lista para temporada con excelente relación precio/producto.', campaignName: 'Temporada R29 Pro', budgetEstimate: 850000, marketingOwnerUserId: 5, status: 'Pendiente', updatedAt: now() },
  { id: 2, projectId: 2, targetLaunchDate: datePlus(95), preLaunchDate: datePlus(80), launchDate: datePlus(95), postLaunchDate: datePlus(102), channels: ['Mayorista'], mainMessage: 'Kit RX150 listo para mostrador con solución completa.', campaignName: 'Kit RX150 mostrador', budgetEstimate: 250000, marketingOwnerUserId: 5, status: 'Pendiente', updatedAt: now() }
];

const launchMilestones = [
  { id: 1, projectId: 1, title: 'Pre-lanzamiento comercial', date: datePlus(100), type: 'Pre lanzamiento', status: 'Pendiente', ownerRoleId: 'role_marketing', createdAt: now(), updatedAt: now() },
  { id: 2, projectId: 1, title: 'Lanzamiento MTB R29 Pro', date: datePlus(115), type: 'Lanzamiento', status: 'Pendiente', ownerRoleId: 'role_marketing', createdAt: now(), updatedAt: now() },
  { id: 3, projectId: 2, title: 'Lanzamiento Kit RX150', date: datePlus(95), type: 'Lanzamiento', status: 'Pendiente', ownerRoleId: 'role_marketing', createdAt: now(), updatedAt: now() }
];

const marketingTasks = [
  { id: 1, projectId: 1, title: 'Preparar piezas de lanzamiento', channel: 'Marketing', status: 'Pendiente', priority: 'Alta', dueDate: datePlus(98), ownerUserId: 5, required: true, notes: 'Banners, placas, textos y ficha corta.', createdAt: now(), updatedAt: now() },
  { id: 2, projectId: 1, title: 'Material comercial para vendedores', channel: 'Comercial', status: 'Pendiente', priority: 'Media', dueDate: datePlus(105), ownerUserId: 3, required: true, notes: 'Argumentario y comparativa.', createdAt: now(), updatedAt: now() }
];

const documents = [
  { id: 1, name: 'Solicitud formal MTB R29 Pro.pdf', storedName: null, mimeType: 'application/pdf', size: 284000, url: null, projectId: 1, projectStageId: 1001, templateId: 1, status: 'Aprobado', versionNumber: 1, versionGroupId: 'docgrp_solicitud_mtb', uploadedBy: 3, reviewedBy: 2, reviewedAt: now(), createdAt: now(), updatedAt: now() },
  { id: 2, name: 'Informe de mercado MTB.xlsx', storedName: null, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 89000, url: null, projectId: 1, projectStageId: 1003, templateId: 3, status: 'Aprobado', versionNumber: 1, versionGroupId: 'docgrp_mercado_mtb', uploadedBy: 2, reviewedBy: 2, reviewedAt: now(), createdAt: now(), updatedAt: now() },
  { id: 3, name: 'Referencias visuales lanzamiento.png', storedName: null, mimeType: 'image/png', size: 142000, url: null, projectId: 1, projectStageId: null, templateId: null, status: 'Cargado', versionNumber: 1, versionGroupId: 'docgrp_ref_visual_mtb', uploadedBy: 5, reviewedBy: null, reviewedAt: null, createdAt: now(), updatedAt: now() }
];

const documentComments = [];

const approvalRequests = [
  { id: 1, projectId: 1, projectStageId: 1005, transitionId: 5, title: 'Avanzar a Fase de simulación', status: 'Pendiente', requestedBy: 7, approverRoleId: 'role_jefe', comment: 'Requerimientos listos para revisión.', createdAt: now(), resolvedAt: null, resolvedBy: null }
];

const decisions = [
  { id: 1, code: 'D01', projectId: 1, projectStageId: 1001, title: 'Solicitud formal revisada', decision: 'Aprobado', rationale: 'La solicitud tiene datos suficientes para iniciar el proceso.', byUserId: 2, createdAt: now() }
];

const timeline = [
  event('project', 'Proyecto creado', 'SGI-2026-0001 · Bicicleta MTB R29 Pro', 'Administrador SGI', { projectId: 1 }),
  event('workflow', 'Etapa habilitada', 'Solicitud de desarrollo asignada a Brand Manager.', 'Sistema', { projectId: 1, projectStageId: 1001 }),
  event('project', 'Proyecto creado', 'SGI-2026-0002 · Kit transmisión RX150', 'Administrador SGI', { projectId: 2 }),
  event('workflow', 'Etapa habilitada', 'Solicitud de desarrollo asignada a Brand Manager.', 'Sistema', { projectId: 2, projectStageId: 2001 })
];

const notifications = [
  { id: 1, title: 'Aprobación pendiente', message: 'Requerimientos listos para revisión.', userId: 2, roleId: 'role_jefe', projectId: 1, projectStageId: 1005, type: 'approval', read: false, createdAt: now() },
  { id: 2, title: 'Nueva tarea asignada', message: 'Solicitud de desarrollo · Kit transmisión RX150.', userId: 3, roleId: 'role_brand', projectId: 2, projectStageId: 2001, type: 'task', read: false, createdAt: now() },
  { id: 3, title: 'Tarea programada', message: 'Costeo inicial · Bicicleta MTB R29 Pro.', userId: 4, roleId: 'role_analista', projectId: 1, projectStageId: 1010, type: 'task-planned', read: false, createdAt: now() }
];

export const initialData = {
  meta: { product: 'SGI Diseño y Desarrollo', version: '1.5.0', createdAt: now(), sprint: 'Guided Operational Flow' },
  permissionCatalog,
  roles,
  users,
  sessions: [],
  passwordRecoveryRequests: [],
  businessUnits,
  categories,
  subcategories,
  workflows: [workflow],
  stages,
  transitions,
  slas: stages.map((s) => ({ id: s.id, stageId: s.id, days: s.slaDays, calendar: 'laboral', notifyBeforeDays: 2 })),
  forms,
  checklistTemplates,
  checklistItems,
  documentTemplates,
  flowchartDecisions,
  projectBriefs,
  productAnalyses,
  launchPlans,
  launchMilestones,
  marketingTasks,
  approvalRequests,
  decisions,
  projects,
  projectStages,
  documents,
  documentComments,
  timeline,
  notifications
};
