/**
 * Client & Server-safe Permission Utility Functions
 * Murni komputasi array/string tanpa dependensi Node.js / Prisma.
 */

export const LEGACY_ALIASES = {
  'orders:read': ['orders:view'],
  'orders:write': ['orders:update', 'orders:cancel'],
  'shipping:manage': ['shipping:pickup', 'shipping:label', 'shipping:view', 'shipping:packing'],
  'products:manage': ['products:create', 'products:update', 'products:delete', 'products:import', 'products:view'],
  'events:manage': ['events:create', 'events:update', 'events:delete', 'events:view', 'events:telegram', 'events:tiktok'],
  'reports:view': ['reports:view', 'reports:export'],
  'users:manage': ['users:view', 'users:update', 'users:delete'],
  'roles:manage': ['roles:view', 'roles:create', 'roles:update', 'roles:delete'],
  'chat:manage': ['chat:view', 'chat:reply', 'chat:templates'],
};

/**
 * Pemetaan implikasi izin (Hierarchy Implication):
 * Memiliki sub-aksi operasional otomatis mengimplikasikan izin 'view' modul terkait.
 * Menjamin fleksibilitas 100%: bahkan jika hanya 1 sub-fitur diaktifkan, user tetap
 * dapat melihat halaman modul tersebut dan tidak terlempar keluar dari admin portal.
 */
export const PERMISSION_IMPLICATIONS = {
  'dashboard:view': [
    'dashboard:kpi_revenue',
    'dashboard:kpi_orders',
    'dashboard:kpi_products',
    'dashboard:kpi_users',
  ],
  'orders:view': [
    'orders:update',
    'orders:cancel',
    'orders:export',
    'shipping:pickup',
    'shipping:label',
  ],
  'shipping:view': [
    'shipping:pickup',
    'shipping:label',
    'shipping:packing',
  ],
  'products:view': [
    'products:create',
    'products:update',
    'products:delete',
    'products:import',
  ],
  'events:view': [
    'events:create',
    'events:update',
    'events:delete',
    'events:telegram',
    'events:tiktok',
  ],
  'reports:view': [
    'reports:export',
  ],
  'users:view': [
    'users:update',
    'users:delete',
  ],
  'roles:view': [
    'roles:create',
    'roles:update',
    'roles:delete',
  ],
  'chat:view': [
    'chat:reply',
    'chat:templates',
  ],
};

/**
 * Mengecek apakah array permissions pengguna memenuhi target izin.
 * Mendukung pemetaan alias kompatibilitas mundur dua arah dan implikasi sub-izin.
 * 
 * @param {string[]} userPermissions Array string permission milik user/role
 * @param {string} targetKey Target permission key yang ingin diuji
 * @returns {boolean}
 */
export function checkPermissionMatch(userPermissions, targetKey) {
  if (!Array.isArray(userPermissions)) return false;
  if (userPermissions.includes(targetKey)) return true;

  // 1. Cek apakah user memiliki sub-permission yang mengimplikasikan targetKey (misal orders:update -> orders:view)
  const impliedBy = PERMISSION_IMPLICATIONS[targetKey];
  if (impliedBy && impliedBy.some((sub) => userPermissions.includes(sub))) {
    return true;
  }

  // 2. Cek jika targetKey adalah alias yang dipenuhi oleh salah satu sub izin baru
  const legacyMap = LEGACY_ALIASES[targetKey];
  if (legacyMap && legacyMap.some((sub) => userPermissions.includes(sub))) {
    return true;
  }

  // 3. Cek jika user memiliki legacy permission yang memayungi targetKey
  for (const [legacyKey, subKeys] of Object.entries(LEGACY_ALIASES)) {
    if (userPermissions.includes(legacyKey) && subKeys.includes(targetKey)) {
      return true;
    }
  }

  return false;
}

/**
 * Memeriksa hak akses user terhadap satu atau beberapa permission key (OR logic).
 * Otomatis memberikan akses penuh (bypass) jika user.role === 'admin'.
 * 
 * @param {object} user User object dari AuthContext atau session
 * @param {string|string[]} requiredPermission Key atau array of keys
 * @returns {boolean}
 */
export function canUser(user, requiredPermission) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const perms = Array.isArray(user.permissions) ? user.permissions : [];

  if (Array.isArray(requiredPermission)) {
    return requiredPermission.some((p) => checkPermissionMatch(perms, p));
  }

  return checkPermissionMatch(perms, requiredPermission);
}

/**
 * Mencari rute admin pertama yang dapat diakses oleh user berdasarkan fungsi `can`.
 * Memastikan staf dengan izin minimal (hanya 1 sub izin aktif) selalu memiliki
 * halaman tujuan yang valid dan tidak terlempar ke customer dashboard.
 * 
 * @param {Function} can Fungsi pengecek izin: (permKey) => boolean
 * @returns {string|null} Path route (misal '/admin/orders') atau null jika sama sekali tidak punya akses admin
 */
export function getFirstAccessibleAdminRoute(can) {
  if (typeof can !== 'function') return null;
  if (can('dashboard:view')) return '/admin/dashboard';
  if (can('orders:view')) return '/admin/orders';
  if (can('shipping:packing')) return '/admin/packing';
  if (can('shipping:label') || can('shipping:view')) return '/admin/generate-resi';
  if (can('chat:view')) return '/admin/chat';
  if (can('products:view')) return '/admin/products';
  if (can('products:delete')) return '/admin/recycle-bin';
  if (can('reports:view')) return '/admin/reports';
  if (can('users:view')) return '/admin/users';
  if (can('roles:view')) return '/admin/users';
  if (can('events:view')) return '/admin/events';
  if (can('events:telegram')) return '/admin/telegram';
  if (can('events:tiktok')) return '/admin/tiktok-live';
  return null;
}
