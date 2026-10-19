/**
 * Client & Server-safe Permission Utility Functions
 * Murni komputasi array/string tanpa dependensi Node.js / Prisma.
 */

export const LEGACY_ALIASES = {
  'orders:read': ['orders:view'],
  'orders:write': ['orders:update', 'orders:cancel'],
  'shipping:manage': ['shipping:pickup', 'shipping:label', 'shipping:view'],
  'products:manage': ['products:create', 'products:update', 'products:delete', 'products:import', 'products:view'],
  'events:manage': ['events:create', 'events:update', 'events:delete', 'events:view'],
  'reports:view': ['reports:view', 'reports:export'],
  'users:manage': ['users:view', 'users:update', 'users:delete'],
  'roles:manage': ['roles:view', 'roles:create', 'roles:update', 'roles:delete'],
};

/**
 * Mengecek apakah array permissions pengguna memenuhi target izin.
 * Mendukung pemetaan alias kompatibilitas mundur dua arah.
 * 
 * @param {string[]} userPermissions Array string permission milik user/role
 * @param {string} targetKey Target permission key yang ingin diuji
 * @returns {boolean}
 */
export function checkPermissionMatch(userPermissions, targetKey) {
  if (!Array.isArray(userPermissions)) return false;
  if (userPermissions.includes(targetKey)) return true;

  // Cek jika targetKey adalah alias yang dipenuhi oleh salah satu sub izin baru
  const legacyMap = LEGACY_ALIASES[targetKey];
  if (legacyMap && legacyMap.some((sub) => userPermissions.includes(sub))) {
    return true;
  }

  // Cek jika user memiliki legacy permission yang memayungi targetKey
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
