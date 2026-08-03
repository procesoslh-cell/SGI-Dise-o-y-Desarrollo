import crypto from 'crypto';

export const now = () => new Date().toISOString();
export const datePlus = (days, baseDate = new Date()) => {
  const base = baseDate instanceof Date ? baseDate : new Date(`${String(baseDate).slice(0, 10)}T00:00:00`);
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days || 0));
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
  { id: 'role_marketing', code: 'MARKETING', name: 'Marketing', description: 'Prepara calendario, entregables de lanzamiento y cierre comunicacional.', permissionIds: ['security:login','projects:read','checklist:update','workflow:read','workflow:execute','timeline:read','documents:upload','documents:review','calendar:read','dashboard:executive','launch:manage','marketing:manage','notifications:read'] },
  { id: 'role_diseno', code: 'DISENO', name: 'Diseño', description: 'Realiza edición, redimensiones, banners y piezas visuales.', permissionIds: operativePermissions.concat(['marketing:manage']) },
  { id: 'role_audiovisual', code: 'AUDIOVISUAL', name: 'Audiovisual', description: 'Produce y edita material audiovisual.', permissionIds: operativePermissions.concat(['marketing:manage']) },
  { id: 'role_comercial', code: 'COMERCIAL', name: 'Comercial', description: 'Participa en comunicaciones y materiales para asesores y clientes.', permissionIds: operativePermissions.concat(['marketing:manage']) },
  { id: 'role_rrhh', code: 'RRHH', name: 'Recursos Humanos', description: 'Participa en la comunicación interna de lanzamientos.', permissionIds: operativePermissions.concat(['marketing:manage']) }
];

const users = [
  { id: 1, name: 'Administrador SGI', email: 'admin@sgi.local', username: 'admin', roleId: 'role_admin', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 2, name: 'Jefe de Desarrollo', email: 'jefe@sgi.local', username: 'jefe', roleId: 'role_jefe', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 3, name: 'Brand Manager', email: 'brand@sgi.local', username: 'brand', roleId: 'role_brand', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 4, name: 'Analista Producto', email: 'analista@sgi.local', username: 'analista', roleId: 'role_analista', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 5, name: 'Marketing', email: 'marketing@sgi.local', username: 'marketing', roleId: 'role_marketing', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 6, name: 'Compras / Comex', email: 'compras@sgi.local', username: 'compras', roleId: 'role_compras', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 7, name: 'Desarrollador', email: 'desarrollador@sgi.local', username: 'desarrollador', roleId: 'role_desarrollador', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 8, name: 'Fábrica', email: 'fabrica@sgi.local', username: 'fabrica', roleId: 'role_fabrica', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 9, name: 'Diseño', email: 'diseno@sgi.local', username: 'diseno', roleId: 'role_diseno', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 10, name: 'Audiovisual', email: 'audiovisual@sgi.local', username: 'audiovisual', roleId: 'role_audiovisual', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 11, name: 'Comercial', email: 'comercial@sgi.local', username: 'comercial', roleId: 'role_comercial', passwordHash: hashPassword('1234'), active: true, createdAt: now() },
  { id: 12, name: 'Recursos Humanos', email: 'rrhh@sgi.local', username: 'rrhh', roleId: 'role_rrhh', passwordHash: hashPassword('1234'), active: true, createdAt: now() }
];

const businessUnits = [
  {
    "id": 1,
    "name": "AUTOPARTES",
    "code": "AUTOPA",
    "active": true
  },
  {
    "id": 2,
    "name": "CICLISMO",
    "code": "CICLIS",
    "active": true
  },
  {
    "id": 3,
    "name": "MOTOCICLISMO",
    "code": "MOTOCI",
    "active": true
  },
  {
    "id": 4,
    "name": "Movilidad Electrica",
    "code": "MOVILI",
    "active": true
  }
];

const segments = [
  {
    "id": 1,
    "businessUnitId": 1,
    "name": "AUTOPARTES",
    "active": true
  },
  {
    "id": 2,
    "businessUnitId": 2,
    "name": "BICIPARTES",
    "active": true
  },
  {
    "id": 3,
    "businessUnitId": 2,
    "name": "URBANO",
    "active": true
  },
  {
    "id": 4,
    "businessUnitId": 2,
    "name": "PRO",
    "active": true
  },
  {
    "id": 5,
    "businessUnitId": 3,
    "name": "MOTOCICLISMO",
    "active": true
  },
  {
    "id": 6,
    "businessUnitId": 4,
    "name": "MOVILIDAD ELECTRICA",
    "active": true
  }
];

const categories = [
  {
    "id": 1,
    "businessUnitId": 1,
    "segmentId": 1,
    "name": "Neumaticos",
    "active": true
  },
  {
    "id": 2,
    "businessUnitId": 2,
    "segmentId": 2,
    "name": "Accesorios",
    "active": true
  },
  {
    "id": 3,
    "businessUnitId": 2,
    "segmentId": 2,
    "name": "Indumentaria y Protección",
    "active": true
  },
  {
    "id": 4,
    "businessUnitId": 2,
    "segmentId": 3,
    "name": "Componentes",
    "active": true
  },
  {
    "id": 5,
    "businessUnitId": 2,
    "segmentId": 2,
    "name": "Componentes",
    "active": true
  },
  {
    "id": 6,
    "businessUnitId": 2,
    "segmentId": 2,
    "name": "Herramientas y Mantenimiento",
    "active": true
  },
  {
    "id": 7,
    "businessUnitId": 2,
    "segmentId": 2,
    "name": "Kit",
    "active": true
  },
  {
    "id": 8,
    "businessUnitId": 2,
    "segmentId": 4,
    "name": "Componentes",
    "active": true
  },
  {
    "id": 9,
    "businessUnitId": 2,
    "segmentId": 3,
    "name": "Accesorios",
    "active": true
  },
  {
    "id": 10,
    "businessUnitId": 2,
    "segmentId": 4,
    "name": "Bicicletas",
    "active": true
  },
  {
    "id": 11,
    "businessUnitId": 2,
    "segmentId": 3,
    "name": "Bicicletas",
    "active": true
  },
  {
    "id": 12,
    "businessUnitId": 2,
    "segmentId": 2,
    "name": "Bicicletas",
    "active": true
  },
  {
    "id": 13,
    "businessUnitId": 2,
    "segmentId": 4,
    "name": "Herramientas y Mantenimiento",
    "active": true
  },
  {
    "id": 14,
    "businessUnitId": 2,
    "segmentId": 3,
    "name": "Kit",
    "active": true
  },
  {
    "id": 15,
    "businessUnitId": 2,
    "segmentId": 4,
    "name": "Accesorios",
    "active": true
  },
  {
    "id": 16,
    "businessUnitId": 2,
    "segmentId": 3,
    "name": "Herramientas y Mantenimiento",
    "active": true
  },
  {
    "id": 17,
    "businessUnitId": 2,
    "segmentId": 3,
    "name": "Indumentaria y Protección",
    "active": true
  },
  {
    "id": 18,
    "businessUnitId": 2,
    "segmentId": 4,
    "name": "Indumentaria y Protección",
    "active": true
  },
  {
    "id": 19,
    "businessUnitId": 3,
    "segmentId": 5,
    "name": "Neumaticos",
    "active": true
  },
  {
    "id": 20,
    "businessUnitId": 3,
    "segmentId": 5,
    "name": "Indumentaria",
    "active": true
  },
  {
    "id": 21,
    "businessUnitId": 3,
    "segmentId": 5,
    "name": "Electricos",
    "active": true
  },
  {
    "id": 22,
    "businessUnitId": 3,
    "segmentId": 5,
    "name": "Motor",
    "active": true
  },
  {
    "id": 23,
    "businessUnitId": 3,
    "segmentId": 5,
    "name": "Rodamientos",
    "active": true
  },
  {
    "id": 24,
    "businessUnitId": 3,
    "segmentId": 5,
    "name": "Chasis",
    "active": true
  },
  {
    "id": 25,
    "businessUnitId": 3,
    "segmentId": 5,
    "name": "Accesorios",
    "active": true
  },
  {
    "id": 26,
    "businessUnitId": 4,
    "segmentId": 6,
    "name": "Ciclismo",
    "active": true
  },
  {
    "id": 27,
    "businessUnitId": 4,
    "segmentId": 6,
    "name": "Motoclismo",
    "active": true
  }
];

const subcategories = [
  {
    "id": 1,
    "categoryId": 1,
    "name": "Cubiertas",
    "active": true
  },
  {
    "id": 2,
    "categoryId": 2,
    "name": "Seguridad",
    "active": true
  },
  {
    "id": 3,
    "categoryId": 3,
    "name": "Protección",
    "active": true
  },
  {
    "id": 4,
    "categoryId": 4,
    "name": "Neumáticos",
    "active": true
  },
  {
    "id": 5,
    "categoryId": 5,
    "name": "Ruedas y sus partes",
    "active": true
  },
  {
    "id": 6,
    "categoryId": 5,
    "name": "Caja y dirección",
    "active": true
  },
  {
    "id": 7,
    "categoryId": 3,
    "name": "Jerseys",
    "active": true
  },
  {
    "id": 8,
    "categoryId": 5,
    "name": "Pedales",
    "active": true
  },
  {
    "id": 9,
    "categoryId": 5,
    "name": "Transmisión",
    "active": true
  },
  {
    "id": 10,
    "categoryId": 5,
    "name": "Manubrio",
    "active": true
  },
  {
    "id": 11,
    "categoryId": 5,
    "name": "Cuadros y horquillas",
    "active": true
  },
  {
    "id": 12,
    "categoryId": 6,
    "name": "Infladores",
    "active": true
  },
  {
    "id": 13,
    "categoryId": 5,
    "name": "Asientos y sus partes",
    "active": true
  },
  {
    "id": 14,
    "categoryId": 4,
    "name": "Caja y dirección",
    "active": true
  },
  {
    "id": 15,
    "categoryId": 5,
    "name": "Frenos",
    "active": true
  },
  {
    "id": 16,
    "categoryId": 2,
    "name": "Luces",
    "active": true
  },
  {
    "id": 17,
    "categoryId": 7,
    "name": "Cuadros y horquillas",
    "active": true
  },
  {
    "id": 18,
    "categoryId": 5,
    "name": "Cambios",
    "active": true
  },
  {
    "id": 19,
    "categoryId": 8,
    "name": "Cuadros y horquillas",
    "active": true
  },
  {
    "id": 20,
    "categoryId": 9,
    "name": "Luces",
    "active": true
  },
  {
    "id": 21,
    "categoryId": 7,
    "name": "Ruedas y sus partes",
    "active": true
  },
  {
    "id": 22,
    "categoryId": 7,
    "name": "Transmisión",
    "active": true
  },
  {
    "id": 23,
    "categoryId": 7,
    "name": "Cambios",
    "active": true
  },
  {
    "id": 24,
    "categoryId": 7,
    "name": "Asientos y sus partes",
    "active": true
  },
  {
    "id": 25,
    "categoryId": 4,
    "name": "Cambios",
    "active": true
  },
  {
    "id": 26,
    "categoryId": 4,
    "name": "Ruedas y sus partes",
    "active": true
  },
  {
    "id": 27,
    "categoryId": 4,
    "name": "Cuadros y horquillas",
    "active": true
  },
  {
    "id": 28,
    "categoryId": 4,
    "name": "Manubrio",
    "active": true
  },
  {
    "id": 29,
    "categoryId": 4,
    "name": "Pedales",
    "active": true
  },
  {
    "id": 30,
    "categoryId": 4,
    "name": "Asientos y sus partes",
    "active": true
  },
  {
    "id": 31,
    "categoryId": 4,
    "name": "Frenos",
    "active": true
  },
  {
    "id": 32,
    "categoryId": 4,
    "name": "Transmisión",
    "active": true
  },
  {
    "id": 33,
    "categoryId": 10,
    "name": "MTB",
    "active": true
  },
  {
    "id": 34,
    "categoryId": 10,
    "name": "Ruta",
    "active": true
  },
  {
    "id": 35,
    "categoryId": 11,
    "name": "Lifestyle",
    "active": true
  },
  {
    "id": 36,
    "categoryId": 12,
    "name": "MTB",
    "active": true
  },
  {
    "id": 37,
    "categoryId": 11,
    "name": "MTB",
    "active": true
  },
  {
    "id": 38,
    "categoryId": 6,
    "name": "Herramientas",
    "active": true
  },
  {
    "id": 39,
    "categoryId": 6,
    "name": "Limpieza",
    "active": true
  },
  {
    "id": 40,
    "categoryId": 9,
    "name": "Hidratación",
    "active": true
  },
  {
    "id": 41,
    "categoryId": 13,
    "name": "Grasas y lubricantes",
    "active": true
  },
  {
    "id": 42,
    "categoryId": 7,
    "name": "Frenos",
    "active": true
  },
  {
    "id": 43,
    "categoryId": 8,
    "name": "Ruedas y sus partes",
    "active": true
  },
  {
    "id": 44,
    "categoryId": 7,
    "name": "Manubrio",
    "active": true
  },
  {
    "id": 45,
    "categoryId": 7,
    "name": "Caja y dirección",
    "active": true
  },
  {
    "id": 46,
    "categoryId": 7,
    "name": "Pedales",
    "active": true
  },
  {
    "id": 47,
    "categoryId": 10,
    "name": "Gravel",
    "active": true
  },
  {
    "id": 48,
    "categoryId": 8,
    "name": "Neumáticos",
    "active": true
  },
  {
    "id": 49,
    "categoryId": 3,
    "name": "Calzado",
    "active": true
  },
  {
    "id": 50,
    "categoryId": 12,
    "name": "Lifestyle",
    "active": true
  },
  {
    "id": 51,
    "categoryId": 3,
    "name": "Camperas",
    "active": true
  },
  {
    "id": 52,
    "categoryId": 9,
    "name": "Transporte",
    "active": true
  },
  {
    "id": 53,
    "categoryId": 8,
    "name": "Frenos",
    "active": true
  },
  {
    "id": 54,
    "categoryId": 5,
    "name": "Neumáticos",
    "active": true
  },
  {
    "id": 55,
    "categoryId": 3,
    "name": "Indumentaria casual",
    "active": true
  },
  {
    "id": 56,
    "categoryId": 10,
    "name": "Lifestyle",
    "active": true
  },
  {
    "id": 57,
    "categoryId": 8,
    "name": "Caja y dirección",
    "active": true
  },
  {
    "id": 58,
    "categoryId": 7,
    "name": "Luces",
    "active": true
  },
  {
    "id": 59,
    "categoryId": 11,
    "name": "Ruta",
    "active": true
  },
  {
    "id": 60,
    "categoryId": 11,
    "name": "Fija",
    "active": true
  },
  {
    "id": 61,
    "categoryId": 14,
    "name": "Cuadros y horquillas",
    "active": true
  },
  {
    "id": 62,
    "categoryId": 8,
    "name": "Transmisión",
    "active": true
  },
  {
    "id": 63,
    "categoryId": 8,
    "name": "Cambios",
    "active": true
  },
  {
    "id": 64,
    "categoryId": 15,
    "name": "Entrenamiento",
    "active": true
  },
  {
    "id": 65,
    "categoryId": 16,
    "name": "Herramientas",
    "active": true
  },
  {
    "id": 66,
    "categoryId": 7,
    "name": "Neumáticos",
    "active": true
  },
  {
    "id": 67,
    "categoryId": 6,
    "name": "Grasas y lubricantes",
    "active": true
  },
  {
    "id": 68,
    "categoryId": 2,
    "name": "Transporte",
    "active": true
  },
  {
    "id": 69,
    "categoryId": 2,
    "name": "Entrenamiento",
    "active": true
  },
  {
    "id": 70,
    "categoryId": 16,
    "name": "Infladores",
    "active": true
  },
  {
    "id": 71,
    "categoryId": 3,
    "name": "Calzas",
    "active": true
  },
  {
    "id": 72,
    "categoryId": 9,
    "name": "Seguridad",
    "active": true
  },
  {
    "id": 73,
    "categoryId": 17,
    "name": "Calzado",
    "active": true
  },
  {
    "id": 74,
    "categoryId": 17,
    "name": "Jerseys",
    "active": true
  },
  {
    "id": 75,
    "categoryId": 4,
    "name": "Eléctricos",
    "active": true
  },
  {
    "id": 76,
    "categoryId": 18,
    "name": "Camperas",
    "active": true
  },
  {
    "id": 77,
    "categoryId": 18,
    "name": "Calzas",
    "active": true
  },
  {
    "id": 78,
    "categoryId": 15,
    "name": "Hidratación",
    "active": true
  },
  {
    "id": 79,
    "categoryId": 18,
    "name": "Jerseys",
    "active": true
  },
  {
    "id": 80,
    "categoryId": 7,
    "name": "Eléctricos",
    "active": true
  },
  {
    "id": 81,
    "categoryId": 2,
    "name": "Hidratación",
    "active": true
  },
  {
    "id": 82,
    "categoryId": 7,
    "name": "Seguridad",
    "active": true
  },
  {
    "id": 83,
    "categoryId": 15,
    "name": "Luces",
    "active": true
  },
  {
    "id": 84,
    "categoryId": 12,
    "name": "Ruta",
    "active": true
  },
  {
    "id": 85,
    "categoryId": 18,
    "name": "Calzado",
    "active": true
  },
  {
    "id": 86,
    "categoryId": 14,
    "name": "Neumáticos",
    "active": true
  },
  {
    "id": 87,
    "categoryId": 18,
    "name": "Protección",
    "active": true
  },
  {
    "id": 88,
    "categoryId": 19,
    "name": "Camaras",
    "active": true
  },
  {
    "id": 89,
    "categoryId": 20,
    "name": "Guantes",
    "active": true
  },
  {
    "id": 90,
    "categoryId": 20,
    "name": "Traje De Lluvia",
    "active": true
  },
  {
    "id": 91,
    "categoryId": 21,
    "name": "Tableros",
    "active": true
  },
  {
    "id": 92,
    "categoryId": 22,
    "name": "Distribución",
    "active": true
  },
  {
    "id": 93,
    "categoryId": 21,
    "name": "Faro",
    "active": true
  },
  {
    "id": 94,
    "categoryId": 23,
    "name": "Rulemanes",
    "active": true
  },
  {
    "id": 95,
    "categoryId": 24,
    "name": "Ruedas",
    "active": true
  },
  {
    "id": 96,
    "categoryId": 22,
    "name": "Carburacion",
    "active": true
  },
  {
    "id": 97,
    "categoryId": 21,
    "name": "Lámpara",
    "active": true
  },
  {
    "id": 98,
    "categoryId": 24,
    "name": "Transmision",
    "active": true
  },
  {
    "id": 99,
    "categoryId": 22,
    "name": "Tapa De Cilindro",
    "active": true
  },
  {
    "id": 100,
    "categoryId": 24,
    "name": "Filtros",
    "active": true
  },
  {
    "id": 101,
    "categoryId": 22,
    "name": "Embragues",
    "active": true
  },
  {
    "id": 102,
    "categoryId": 21,
    "name": "Reguladores",
    "active": true
  },
  {
    "id": 103,
    "categoryId": 21,
    "name": "Estatores",
    "active": true
  },
  {
    "id": 104,
    "categoryId": 22,
    "name": "Valvulas",
    "active": true
  },
  {
    "id": 105,
    "categoryId": 24,
    "name": "Horquillas",
    "active": true
  },
  {
    "id": 106,
    "categoryId": 22,
    "name": "Filtros",
    "active": true
  },
  {
    "id": 107,
    "categoryId": 24,
    "name": "Carenados",
    "active": true
  },
  {
    "id": 108,
    "categoryId": 22,
    "name": "Piston",
    "active": true
  },
  {
    "id": 109,
    "categoryId": 19,
    "name": "Cubiertas",
    "active": true
  },
  {
    "id": 110,
    "categoryId": 20,
    "name": "Cascos",
    "active": true
  },
  {
    "id": 111,
    "categoryId": 24,
    "name": "Freno",
    "active": true
  },
  {
    "id": 112,
    "categoryId": 24,
    "name": "Pedalines",
    "active": true
  },
  {
    "id": 113,
    "categoryId": 22,
    "name": "Retenes",
    "active": true
  },
  {
    "id": 114,
    "categoryId": 22,
    "name": "Palanca",
    "active": true
  },
  {
    "id": 115,
    "categoryId": 22,
    "name": "Repuestos De Motor",
    "active": true
  },
  {
    "id": 116,
    "categoryId": 21,
    "name": "Baterías",
    "active": true
  },
  {
    "id": 117,
    "categoryId": 21,
    "name": "Llave De Contacto",
    "active": true
  },
  {
    "id": 118,
    "categoryId": 24,
    "name": "Cerradura De Asiento",
    "active": true
  },
  {
    "id": 119,
    "categoryId": 24,
    "name": "Bujes",
    "active": true
  },
  {
    "id": 120,
    "categoryId": 24,
    "name": "Cristos",
    "active": true
  },
  {
    "id": 121,
    "categoryId": 24,
    "name": "Tanque De Nafta",
    "active": true
  },
  {
    "id": 122,
    "categoryId": 24,
    "name": "Cables",
    "active": true
  },
  {
    "id": 123,
    "categoryId": 24,
    "name": "Espejos",
    "active": true
  },
  {
    "id": 124,
    "categoryId": 20,
    "name": "Protector Cervical",
    "active": true
  },
  {
    "id": 125,
    "categoryId": 24,
    "name": "Muletas Y Caballetes",
    "active": true
  },
  {
    "id": 126,
    "categoryId": 22,
    "name": "Juntas De Motor",
    "active": true
  },
  {
    "id": 127,
    "categoryId": 22,
    "name": "Cilindros",
    "active": true
  },
  {
    "id": 128,
    "categoryId": 24,
    "name": "Suspensión",
    "active": true
  },
  {
    "id": 129,
    "categoryId": 24,
    "name": "Manubrios",
    "active": true
  },
  {
    "id": 130,
    "categoryId": 24,
    "name": "Asiento",
    "active": true
  },
  {
    "id": 131,
    "categoryId": 25,
    "name": "Herramientas",
    "active": true
  },
  {
    "id": 132,
    "categoryId": 24,
    "name": "Soporte Tablero",
    "active": true
  },
  {
    "id": 133,
    "categoryId": 22,
    "name": "Bendix",
    "active": true
  },
  {
    "id": 134,
    "categoryId": 21,
    "name": "Motor De Arranque",
    "active": true
  },
  {
    "id": 135,
    "categoryId": 21,
    "name": "Bocina",
    "active": true
  },
  {
    "id": 136,
    "categoryId": 21,
    "name": "Llave De Giro",
    "active": true
  },
  {
    "id": 137,
    "categoryId": 21,
    "name": "Llave De Luz",
    "active": true
  },
  {
    "id": 138,
    "categoryId": 20,
    "name": "Cubre Boca",
    "active": true
  },
  {
    "id": 139,
    "categoryId": 22,
    "name": "Bomba De Aceite",
    "active": true
  },
  {
    "id": 140,
    "categoryId": 22,
    "name": "Escape",
    "active": true
  },
  {
    "id": 141,
    "categoryId": 22,
    "name": "Cigueñal",
    "active": true
  },
  {
    "id": 142,
    "categoryId": 25,
    "name": "Cubre Mano",
    "active": true
  },
  {
    "id": 143,
    "categoryId": 22,
    "name": "Engranajes",
    "active": true
  },
  {
    "id": 144,
    "categoryId": 22,
    "name": "Balancin",
    "active": true
  },
  {
    "id": 145,
    "categoryId": 20,
    "name": "Chaleco",
    "active": true
  },
  {
    "id": 146,
    "categoryId": 21,
    "name": "Cdi",
    "active": true
  },
  {
    "id": 147,
    "categoryId": 25,
    "name": "Seguridad",
    "active": true
  },
  {
    "id": 148,
    "categoryId": 24,
    "name": "Manijas",
    "active": true
  },
  {
    "id": 149,
    "categoryId": 21,
    "name": "Flotante De Nafta",
    "active": true
  },
  {
    "id": 150,
    "categoryId": 21,
    "name": "Relay",
    "active": true
  },
  {
    "id": 151,
    "categoryId": 21,
    "name": "Bulbos",
    "active": true
  },
  {
    "id": 152,
    "categoryId": 21,
    "name": "Llave De Arranque",
    "active": true
  },
  {
    "id": 153,
    "categoryId": 21,
    "name": "Bujias",
    "active": true
  },
  {
    "id": 154,
    "categoryId": 22,
    "name": "Eje De Cambio",
    "active": true
  },
  {
    "id": 155,
    "categoryId": 22,
    "name": "Eje De Arranque",
    "active": true
  },
  {
    "id": 156,
    "categoryId": 25,
    "name": "Cargadores",
    "active": true
  },
  {
    "id": 157,
    "categoryId": 25,
    "name": "Liquido Antipinchadura",
    "active": true
  },
  {
    "id": 158,
    "categoryId": 20,
    "name": "Chaqueta",
    "active": true
  },
  {
    "id": 159,
    "categoryId": 20,
    "name": "Botas",
    "active": true
  },
  {
    "id": 160,
    "categoryId": 20,
    "name": "Mochila",
    "active": true
  },
  {
    "id": 161,
    "categoryId": 22,
    "name": "Tapa De Encendido",
    "active": true
  },
  {
    "id": 162,
    "categoryId": 21,
    "name": "Volantes",
    "active": true
  },
  {
    "id": 163,
    "categoryId": 20,
    "name": "Proteccion Cross",
    "active": true
  },
  {
    "id": 164,
    "categoryId": 20,
    "name": "Pechera",
    "active": true
  },
  {
    "id": 165,
    "categoryId": 22,
    "name": "Caja De Cambio",
    "active": true
  },
  {
    "id": 166,
    "categoryId": 21,
    "name": "Comandos",
    "active": true
  },
  {
    "id": 167,
    "categoryId": 21,
    "name": "Bobina",
    "active": true
  },
  {
    "id": 168,
    "categoryId": 25,
    "name": "Infladores",
    "active": true
  },
  {
    "id": 169,
    "categoryId": 21,
    "name": "Acrilico Tablero",
    "active": true
  },
  {
    "id": 170,
    "categoryId": 25,
    "name": "Alforjas",
    "active": true
  },
  {
    "id": 171,
    "categoryId": 25,
    "name": "Baul",
    "active": true
  },
  {
    "id": 172,
    "categoryId": 25,
    "name": "Cobertor",
    "active": true
  },
  {
    "id": 173,
    "categoryId": 22,
    "name": "Tapa Piñon",
    "active": true
  },
  {
    "id": 174,
    "categoryId": 25,
    "name": "Puños",
    "active": true
  },
  {
    "id": 175,
    "categoryId": 24,
    "name": "Bajo Asiento",
    "active": true
  },
  {
    "id": 176,
    "categoryId": 24,
    "name": "Barrales",
    "active": true
  },
  {
    "id": 177,
    "categoryId": 22,
    "name": "Juntas De Escape",
    "active": true
  },
  {
    "id": 178,
    "categoryId": 26,
    "name": "Componentes",
    "active": true
  },
  {
    "id": 179,
    "categoryId": 26,
    "name": "Bicicletas",
    "active": true
  },
  {
    "id": 180,
    "categoryId": 27,
    "name": "Chasis",
    "active": true
  },
  {
    "id": 181,
    "categoryId": 27,
    "name": "Moto",
    "active": true
  },
  {
    "id": 182,
    "categoryId": 27,
    "name": "Electricos",
    "active": true
  },
  {
    "id": 183,
    "categoryId": 27,
    "name": "Suspension",
    "active": true
  },
  {
    "id": 184,
    "categoryId": 27,
    "name": "Ruedas",
    "active": true
  },
  {
    "id": 185,
    "categoryId": 27,
    "name": "Seguridad",
    "active": true
  },
  {
    "id": 186,
    "categoryId": 27,
    "name": "Motor",
    "active": true
  },
  {
    "id": 187,
    "categoryId": 27,
    "name": "Frenos",
    "active": true
  },
  {
    "id": 188,
    "categoryId": 27,
    "name": "Iluminacion",
    "active": true
  },
  {
    "id": 189,
    "categoryId": 27,
    "name": "Kit",
    "active": true
  }
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
  version: '1.8.2',
  active: true,
  description: 'Flujo operativo con tareas asignadas automáticamente por responsable y continuidad hasta marketing y cierre.',
  stageIds: stages.map((stage) => stage.id)
};

const taskSpecificFields = {
  'Solicitud de desarrollo': [
    { key: 'solicitudOrigen', label: 'Origen de la solicitud', type: 'text', required: true },
    { key: 'necesidadDetectada', label: 'Necesidad u oportunidad detectada', type: 'textarea', required: true },
    { key: 'alcanceInicial', label: 'Alcance inicial solicitado', type: 'textarea', required: true }
  ],
  'Análisis de tendencias': [
    { key: 'tendenciasRelevadas', label: 'Tendencias relevadas', type: 'textarea', required: true },
    { key: 'fuentesConsultadas', label: 'Fuentes y referencias consultadas', type: 'textarea', required: true },
    { key: 'conclusionTendencias', label: 'Conclusión y oportunidades', type: 'textarea', required: true }
  ],
  'Análisis del mercado': [
    { key: 'mercadoObjetivo', label: 'Mercado y público objetivo', type: 'textarea', required: true },
    { key: 'competidoresModelos', label: 'Competidores y modelos relevados', type: 'textarea', required: true },
    { key: 'rangoPrecio', label: 'Rango de precios y posicionamiento', type: 'textarea', required: true },
    { key: 'demandaEstimada', label: 'Demanda o volumen estimado', type: 'textarea', required: false }
  ],
  'Definición de oportunidades': [
    { key: 'oportunidadPriorizada', label: 'Oportunidad priorizada', type: 'textarea', required: true },
    { key: 'argumentoContinuidad', label: 'Motivo para continuar el desarrollo', type: 'textarea', required: true }
  ],
  'Validación de requerimientos de diseño': [
    { key: 'requerimientosFuncionales', label: 'Requerimientos funcionales', type: 'textarea', required: true },
    { key: 'restricciones', label: 'Restricciones y condiciones', type: 'textarea', required: true },
    { key: 'criteriosAceptacion', label: 'Criterios de aceptación', type: 'textarea', required: true }
  ],
  'Fase de simulación': [
    { key: 'escenarioSimulado', label: 'Escenario o alternativa simulada', type: 'textarea', required: true },
    { key: 'resultadoSimulacion', label: 'Resultado de la simulación', type: 'textarea', required: true },
    { key: 'riesgosSimulacion', label: 'Riesgos detectados', type: 'textarea', required: false }
  ],
  'Armado de carpeta de diseño con LMAT inicial': [
    { key: 'versionLmat', label: 'Versión de LMAT inicial', type: 'text', required: true },
    { key: 'componentesCriticos', label: 'Componentes críticos o pendientes', type: 'textarea', required: true },
    { key: 'ubicacionCarpeta', label: 'Referencia de la carpeta de desarrollo', type: 'text', required: true }
  ],
  'Desarrollo inicial de proveedores y viabilidad de importación': [
    { key: 'proveedoresConsultados', label: 'Proveedores consultados', type: 'textarea', required: true },
    { key: 'condicionesImportacion', label: 'Puerto, términos de pago y condiciones', type: 'textarea', required: true },
    { key: 'viabilidad', label: 'Conclusión de viabilidad', type: 'select', options: ['Viable', 'Viable con ajustes', 'No viable'], required: true }
  ],
  'Decisión de proveedor o descarte': [
    { key: 'proveedorSeleccionado', label: 'Proveedor seleccionado', type: 'text', required: false },
    { key: 'decisionProveedor', label: 'Decisión', type: 'select', options: ['Continuar', 'Buscar alternativa', 'Descartar'], required: true },
    { key: 'fundamentoProveedor', label: 'Fundamento de la decisión', type: 'textarea', required: true }
  ],
  'Costeo inicial': [
    { key: 'costoObjetivo', label: 'Costo objetivo', type: 'number', required: true },
    { key: 'costoEstimado', label: 'Costo estimado', type: 'number', required: true },
    { key: 'precioReferencia', label: 'Precio de venta de referencia', type: 'number', required: false },
    { key: 'supuestosCosteo', label: 'Supuestos y observaciones del costeo', type: 'textarea', required: true }
  ],
  'Validación del proyecto': [
    { key: 'factibilidadTecnica', label: 'Factibilidad técnica', type: 'select', options: ['Aprobada', 'Con observaciones', 'No aprobada'], required: true },
    { key: 'factibilidadEconomica', label: 'Factibilidad económica', type: 'select', options: ['Aprobada', 'Con observaciones', 'No aprobada'], required: true },
    { key: 'decisionProyecto', label: 'Decisión de continuidad', type: 'select', options: ['Continuar', 'Ajustar', 'Archivar'], required: true }
  ],
  'Definición de ficha técnica': [
    { key: 'descripcionTecnica', label: 'Descripción técnica del producto', type: 'textarea', required: true },
    { key: 'atributosClave', label: 'Atributos y especificaciones clave', type: 'textarea', required: true },
    { key: 'variantes', label: 'Variantes, colores o presentaciones', type: 'textarea', required: false }
  ],
  'Definición de estándares, compatibilidades y talles': [
    { key: 'estandares', label: 'Estándares aplicables', type: 'textarea', required: true },
    { key: 'compatibilidades', label: 'Compatibilidades y sustitutos permitidos', type: 'textarea', required: true },
    { key: 'tallesMedidas', label: 'Talles, medidas o rangos', type: 'textarea', required: false }
  ],
  'Desarrollo de proveedores': [
    { key: 'proveedorDefinido', label: 'Proveedor definido', type: 'text', required: true },
    { key: 'productoDesarrollado', label: 'Producto desarrollado por el proveedor', type: 'textarea', required: true },
    { key: 'condicionesAcordadas', label: 'Condiciones y documentación para Compras', type: 'textarea', required: true }
  ],
  'Solicitud de diseño industrial o gráfico': [
    { key: 'tipoDiseno', label: 'Tipo de diseño solicitado', type: 'select', options: ['Industrial', 'Gráfico', 'Packaging', 'Otro'], required: true },
    { key: 'destinatarioDiseno', label: 'Diseñador interno, externo o proveedor', type: 'text', required: true },
    { key: 'requerimientoDiseno', label: 'Requerimiento y alcance del diseño', type: 'textarea', required: true }
  ],
  'Iteraciones de diseño': [
    { key: 'numeroIteracion', label: 'Número de iteración', type: 'number', required: true },
    { key: 'cambiosSolicitados', label: 'Cambios solicitados', type: 'textarea', required: true },
    { key: 'respuestaIteracion', label: 'Respuesta y versión presentada', type: 'textarea', required: true }
  ],
  'Solicitud de prototipo al proveedor o muestras': [
    { key: 'tipoMuestra', label: 'Tipo de prototipo o muestra', type: 'text', required: true },
    { key: 'cantidadMuestras', label: 'Cantidad solicitada', type: 'number', required: true },
    { key: 'fechaPrometida', label: 'Fecha prometida por el proveedor', type: 'date', required: true }
  ],
  'Llegada y armado de prototipo': [
    { key: 'fechaRecepcion', label: 'Fecha de recepción', type: 'date', required: true },
    { key: 'estadoRecepcion', label: 'Estado de recepción', type: 'select', options: ['Completo', 'Con faltantes', 'Dañado'], required: true },
    { key: 'resultadoArmado', label: 'Resultado del armado', type: 'textarea', required: true }
  ],
  'Validación técnica': [
    { key: 'pruebasRealizadas', label: 'Pruebas y verificaciones realizadas', type: 'textarea', required: true },
    { key: 'resultadoTecnico', label: 'Resultado técnico', type: 'select', options: ['Aprobado', 'Aprobado con observaciones', 'Rechazado'], required: true },
    { key: 'desviosTecnicos', label: 'Desvíos y correcciones necesarias', type: 'textarea', required: false }
  ],
  'Decisión de diseño: validar o archivar': [
    { key: 'decisionDiseno', label: 'Decisión sobre el diseño', type: 'select', options: ['Validar', 'Iterar', 'Archivar'], required: true },
    { key: 'fundamentoDiseno', label: 'Fundamento de la decisión', type: 'textarea', required: true }
  ],
  'LMAT final con lista de sustitutos': [
    { key: 'versionLmatFinal', label: 'Versión de LMAT final', type: 'text', required: true },
    { key: 'sustitutos', label: 'Sustitutos aprobados', type: 'textarea', required: true },
    { key: 'entregaCompras', label: 'Información entregada a Compras', type: 'textarea', required: true }
  ],
  'Compra': [
    { key: 'ordenCompra', label: 'Número o referencia de orden de compra', type: 'text', required: true },
    { key: 'proveedorCompra', label: 'Proveedor', type: 'text', required: true },
    { key: 'cantidadCompra', label: 'Cantidad comprada', type: 'number', required: true },
    { key: 'fechaEntregaCompra', label: 'Fecha estimada de entrega', type: 'date', required: true }
  ],
  'Actualización del maestro': [
    { key: 'skuCodigo', label: 'SKU o código creado/actualizado', type: 'text', required: true },
    { key: 'camposActualizados', label: 'Campos maestros actualizados', type: 'textarea', required: true },
    { key: 'sistemaMaestro', label: 'Sistema donde se realizó el alta', type: 'text', required: true }
  ],
  'Carga en el MRP': [
    { key: 'previsionMensual', label: 'Previsión mensual cargada', type: 'textarea', required: true },
    { key: 'fechaCargaMrp', label: 'Fecha de carga en MRP', type: 'date', required: true },
    { key: 'validacionFinanciera', label: 'Validación financiera', type: 'select', options: ['Aprobada', 'Pendiente', 'Observada'], required: true }
  ],
  'Producción inicial': [
    { key: 'cantidadPlanificada', label: 'Cantidad de primera producción', type: 'number', required: true },
    { key: 'fechaInicioProduccion', label: 'Fecha de inicio de producción', type: 'date', required: true },
    { key: 'resultadoProduccion', label: 'Resultado y desvíos de producción', type: 'textarea', required: true }
  ],
  'Lanzamiento': [
    { key: 'fechaLanzamientoReal', label: 'Fecha real de lanzamiento', type: 'date', required: true },
    { key: 'canalesLanzamiento', label: 'Canales utilizados', type: 'textarea', required: true },
    { key: 'evidenciaLanzamiento', label: 'Evidencia y enlaces de publicación', type: 'textarea', required: true }
  ],
  'Marketing y cierre del proyecto': [
    { key: 'entregablesMarketing', label: 'Entregables de Marketing completados', type: 'textarea', required: true },
    { key: 'resultadosIniciales', label: 'Resultados y observaciones iniciales', type: 'textarea', required: true },
    { key: 'pendientesCierre', label: 'Pendientes para cierre', type: 'textarea', required: false }
  ]
};

const commonTaskFields = [
  { key: 'resultado', label: 'Resultado general de la tarea', type: 'select', options: ['Completado', 'Requiere ajustes', 'No aplica'], required: true },
  { key: 'detalleTrabajo', label: 'Resumen del trabajo realizado', type: 'textarea', required: true },
  { key: 'entregable', label: 'Entregable o evidencia generada', type: 'textarea', required: true },
  { key: 'bloqueos', label: 'Bloqueos o pendientes', type: 'textarea', required: false },
  { key: 'proximaAccion', label: 'Próxima acción sugerida', type: 'textarea', required: false }
];

const forms = stageBlueprint.map((item, index) => ({
  id: index + 1,
  name: item.name,
  description: `Plantilla de trabajo para documentar avances y resultado de ${item.name}.`,
  fields: [...(taskSpecificFields[item.name] || []), ...commonTaskFields]
}));

const checklistTemplates = stageBlueprint.map((item, index) => ({ id: index + 1, stageId: index + 1, items: item.checklist }));
const documentTemplates = stageBlueprint.map((item, index) => ({ id: index + 1, name: item.doc, stageId: index + 1, type: item.phase.toLowerCase(), required: true }));

const transitions = stages.map((stage, index) => ({
  id: index + 1,
  workflowId: 1,
  fromStageId: stage.id,
  toStageId: stages[index + 1]?.id || null,
  action: stages[index + 1] ? `Validar ${stage.name} y avanzar a ${stages[index + 1].name}` : `Validar ${stage.name} y cerrar el proyecto`,
  requiresApproval: true,
  approverRoleId: 'role_jefe',
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


const marketingBaseFields = [
  { key: 'resultado', label: 'Resultado general', type: 'select', options: ['Completado', 'Requiere ajustes', 'No aplica'], required: true },
  { key: 'detalleTrabajo', label: 'Detalle del trabajo realizado', type: 'textarea', required: true },
  { key: 'entregable', label: 'Entregable o enlace a la evidencia', type: 'textarea', required: true },
  { key: 'bloqueos', label: 'Bloqueos, observaciones o pendientes', type: 'textarea', required: false }
];

const marketingTemplate = (id, title, area, durationDays, specificFields = []) => ({
  id,
  code: `MKT-${String(id).padStart(2, '0')}`,
  title,
  area,
  durationDays,
  active: true,
  form: {
    name: title,
    description: `Plantilla de ejecución para ${title.toLowerCase()}.`,
    fields: [...specificFields, ...marketingBaseFields]
  }
});

const marketingTaskTemplates = [
  marketingTemplate(1, 'Brief de producto para preparación campaña de comunicación', 'Producto / Marketing', 2, [
    { key: 'descripcionProducto', label: 'Descripción breve del producto', type: 'textarea', required: true },
    { key: 'publicoObjetivo', label: 'Público objetivo', type: 'textarea', required: true },
    { key: 'diferenciales', label: 'Diferenciales y atributos principales', type: 'textarea', required: true },
    { key: 'mensajePrincipal', label: 'Mensaje principal de campaña', type: 'textarea', required: true }
  ]),
  marketingTemplate(2, 'Realización de fotos con fondo blanco', 'Marketing', 2, [
    { key: 'productosFotografiados', label: 'Productos o variantes fotografiadas', type: 'textarea', required: true },
    { key: 'cantidadTomas', label: 'Cantidad de tomas finales', type: 'number', required: true },
    { key: 'formatosFotos', label: 'Formatos y encuadres generados', type: 'textarea', required: true }
  ]),
  marketingTemplate(3, 'Edición de fotos/redimensiones', 'Diseño', 2, [
    { key: 'archivosEditados', label: 'Archivos editados', type: 'textarea', required: true },
    { key: 'medidasFormatos', label: 'Medidas, formatos y destinos', type: 'textarea', required: true },
    { key: 'versiones', label: 'Versiones generadas', type: 'textarea', required: false }
  ]),
  marketingTemplate(4, 'Producción audiovisual en exterior', 'Marketing', 2, [
    { key: 'conceptoGuion', label: 'Concepto o guion utilizado', type: 'textarea', required: true },
    { key: 'locacion', label: 'Locación y fecha de producción', type: 'textarea', required: true },
    { key: 'piezasCapturadas', label: 'Piezas o tomas realizadas', type: 'textarea', required: true }
  ]),
  marketingTemplate(5, 'Edición material producción exterior', 'Audiovisual', 4, [
    { key: 'materialEditado', label: 'Material editado', type: 'textarea', required: true },
    { key: 'duracionFormatos', label: 'Duración, resolución y formatos finales', type: 'textarea', required: true },
    { key: 'versionesAudiovisuales', label: 'Versiones y adaptaciones', type: 'textarea', required: false }
  ]),
  marketingTemplate(6, 'Armado de news técnicos / envío asesores', 'Marketing / Comercial', 1, [
    { key: 'resumenTecnico', label: 'Resumen técnico comunicado', type: 'textarea', required: true },
    { key: 'destinatariosAsesores', label: 'Destinatarios o equipos comerciales', type: 'textarea', required: true },
    { key: 'fechaEnvio', label: 'Fecha de envío', type: 'date', required: true }
  ]),
  marketingTemplate(7, 'Envío difusión WhatsApp', 'Marketing', 1, [
    { key: 'segmentoWhatsapp', label: 'Segmento o lista de difusión', type: 'textarea', required: true },
    { key: 'textoWhatsapp', label: 'Texto enviado', type: 'textarea', required: true },
    { key: 'fechaWhatsapp', label: 'Fecha de envío', type: 'date', required: true }
  ]),
  marketingTemplate(8, 'Realización de piezas RRSS', 'Marketing', 2, [
    { key: 'plataformas', label: 'Plataformas y formatos', type: 'textarea', required: true },
    { key: 'copyRrss', label: 'Copy o mensaje de las publicaciones', type: 'textarea', required: true },
    { key: 'fechaProgramacion', label: 'Fecha de programación o publicación', type: 'date', required: false }
  ]),
  marketingTemplate(9, 'Realización Mailing B2C', 'Marketing', 1, [
    { key: 'asuntoMailingB2c', label: 'Asunto del mailing', type: 'text', required: true },
    { key: 'segmentoB2c', label: 'Segmento B2C destinatario', type: 'textarea', required: true },
    { key: 'contenidoB2c', label: 'Contenido o resumen del mailing', type: 'textarea', required: true }
  ]),
  marketingTemplate(10, 'Realización Banners web (desktop + mobile)', 'Marketing', 1, [
    { key: 'ubicacionesBanners', label: 'Ubicaciones web previstas', type: 'textarea', required: true },
    { key: 'medidasBanners', label: 'Medidas desktop y mobile', type: 'textarea', required: true },
    { key: 'fechaPublicacionWeb', label: 'Fecha prevista de publicación', type: 'date', required: false }
  ]),
  marketingTemplate(11, 'Disponibilización de material externo para clientes B2B', 'Marketing', 1, [
    { key: 'materialB2b', label: 'Material preparado para clientes B2B', type: 'textarea', required: true },
    { key: 'ubicacionMaterialB2b', label: 'Ubicación o enlace de acceso', type: 'textarea', required: true },
    { key: 'destinatariosB2b', label: 'Clientes, asesores o canales destinatarios', type: 'textarea', required: true }
  ]),
  marketingTemplate(12, 'Comunicación interna del lanzamiento para todos los colaboradores', 'Marketing / RRHH', 1, [
    { key: 'audienciaInterna', label: 'Audiencia interna', type: 'textarea', required: true },
    { key: 'canalInterno', label: 'Canal interno utilizado', type: 'text', required: true },
    { key: 'mensajeInterno', label: 'Mensaje comunicado', type: 'textarea', required: true }
  ]),
  marketingTemplate(13, 'Envío mailing lanzamiento a BBDD', 'Marketing', 1, [
    { key: 'bbddSegmento', label: 'Base de datos o segmento destinatario', type: 'textarea', required: true },
    { key: 'asuntoLanzamiento', label: 'Asunto del mailing de lanzamiento', type: 'text', required: true },
    { key: 'contenidoLanzamiento', label: 'Contenido o resumen del envío', type: 'textarea', required: true },
    { key: 'fechaEnvioLanzamiento', label: 'Fecha de envío', type: 'date', required: true }
  ])
];

const projects = [
  { id: 1, code: 'SGI-2026-0001', name: 'Bicicleta MTB R29 Pro', businessUnitId: 2, segmentId: 4, categoryId: 10, subcategoryId: 33, responsibleUserId: 2, startDate: datePlus(-18), targetDate: datePlus(120), status: 'Requerimientos', priority: 'Alta', workflowId: 1, projectMode: 'iniciado', designOrigin: 'Diseño propio', createdBy: 1, importedAt: now(), createdAt: now(), updatedAt: now() },
  { id: 2, code: 'SGI-2026-0002', name: 'Kit transmisión RX150', businessUnitId: 3, segmentId: 5, categoryId: 24, subcategoryId: 98, responsibleUserId: 3, startDate: datePlus(0), targetDate: datePlus(95), status: 'Solicitud', priority: 'Media', workflowId: 1, projectMode: 'nuevo', designOrigin: 'Diseño del proveedor', createdBy: 1, createdAt: now(), updatedAt: now() }
];

function defaultUserForRole(roleId) {
  return users.find((user) => user.roleId === roleId && user.active)?.id || null;
}

function makeProjectStages(projectId, openUntil = 1) {
  let start = 0;
  const projectStartDate = projects.find((project) => project.id === projectId)?.startDate || datePlus(0);
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
      startDate: datePlus(start, projectStartDate),
      dueDate: datePlus(start + stage.slaDays - 1, projectStartDate),
      status,
      formData: status === 'Completa' ? { resultado: 'Completado', detalleTrabajo: 'Etapa completada en datos de prueba.', entregable: 'Registro histórico aprobado.' } : {},
      createdAt: now(),
      updatedAt: now()
    };
    if (status === 'Completa') row.completedAt = `${row.dueDate}T18:00:00.000Z`;
    if (status === 'Completa') row.historicalLoad = true;
    start += stage.slaDays;
    return row;
  });
}

const projectStages = [...makeProjectStages(1, 5), ...makeProjectStages(2, 1)];
const pendingValidationSample = projectStages.find((stage) => stage.id === 1005);
if (pendingValidationSample) pendingValidationSample.status = 'Pendiente validación';

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
  { id: 1, projectId: 1, templateId: 2, title: marketingTaskTemplates[1].title, area: marketingTaskTemplates[1].area, channel: 'Marketing', durationDays: 2, status: 'Pendiente', priority: 'Alta', startDate: datePlus(93), dueDate: datePlus(94), ownerUserId: 5, required: true, progressPercent: 0, templateData: {}, notes: 'Fotografiar todas las variantes aprobadas del producto.', createdAt: now(), updatedAt: now() },
  { id: 2, projectId: 1, templateId: 6, title: marketingTaskTemplates[5].title, area: marketingTaskTemplates[5].area, channel: 'Marketing / Comercial', durationDays: 1, status: 'Pendiente', priority: 'Media', startDate: datePlus(100), dueDate: datePlus(100), ownerUserId: 11, required: true, progressPercent: 0, templateData: {}, notes: 'Preparar información técnica y distribuir a los asesores.', createdAt: now(), updatedAt: now() }
];

const documents = [
  { id: 1, name: 'Solicitud formal MTB R29 Pro.pdf', storedName: null, mimeType: 'application/pdf', size: 284000, url: null, projectId: 1, projectStageId: 1001, templateId: 1, status: 'Aprobado', versionNumber: 1, versionGroupId: 'docgrp_solicitud_mtb', uploadedBy: 3, reviewedBy: 2, reviewedAt: now(), createdAt: now(), updatedAt: now() },
  { id: 2, name: 'Informe de mercado MTB.xlsx', storedName: null, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 89000, url: null, projectId: 1, projectStageId: 1003, templateId: 3, status: 'Aprobado', versionNumber: 1, versionGroupId: 'docgrp_mercado_mtb', uploadedBy: 2, reviewedBy: 2, reviewedAt: now(), createdAt: now(), updatedAt: now() },
  { id: 3, name: 'Referencias visuales lanzamiento.png', storedName: null, mimeType: 'image/png', size: 142000, url: null, projectId: 1, projectStageId: null, templateId: null, status: 'Cargado', versionNumber: 1, versionGroupId: 'docgrp_ref_visual_mtb', uploadedBy: 5, reviewedBy: null, reviewedAt: null, createdAt: now(), updatedAt: now() }
];

const documentComments = [];

const approvalRequests = [
  { id: 1, projectId: 1, projectStageId: 1005, transitionId: 5, title: 'Validar requerimientos y habilitar Fase de simulación', status: 'Pendiente', requestedBy: 7, approverRoleId: 'role_jefe', approverUserId: 2, comment: 'Requerimientos listos para revisión.', createdAt: now(), resolvedAt: null, resolvedBy: null }
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
  meta: { product: 'SGI Diseño y Desarrollo', version: '1.8.2', createdAt: now() },
  permissionCatalog,
  roles,
  users,
  sessions: [],
  passwordRecoveryRequests: [],
  businessUnits,
  segments,
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
  marketingTaskTemplates,
  marketingTasks,
  approvalRequests,
  decisions,
  projects,
  projectStages,
  documents,
  documentComments,
  timeline,
  notifications,
  taskProgress: [],
  emailOutbox: []
};
