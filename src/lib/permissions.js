import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

/**
 * Master Definisi Hak Akses Sistem (Filament-Style Granular CRUD Matrix)
 * Dikelompokkan per modul ERP dengan aksi spesifik dan widget dashboard.
 */
export const SYSTEM_PERMISSIONS = [
  {
    module: 'dashboard',
    moduleLabel: 'Dashboard & Ringkasan Eksekutif',
    description: 'Hak akses halaman ikhtisar dan kontrol visibilitas widget metrik kartu KPI.',
    permissions: [
      {
        key: 'dashboard:view',
        action: 'view',
        label: 'Akses Menu Dashboard',
        description: 'Membuka dan melihat ringkasan overview dashboard admin.',
      },
      {
        key: 'dashboard:kpi_revenue',
        action: 'widget',
        label: 'Widget Total Omset',
        description: 'Melihat kartu metrik nominal total omset & pendapatan toko.',
      },
      {
        key: 'dashboard:kpi_orders',
        action: 'widget',
        label: 'Widget Total Pesanan',
        description: 'Melihat kartu jumlah transaksi pesanan dan alert pesanan baru.',
      },
      {
        key: 'dashboard:kpi_products',
        action: 'widget',
        label: 'Widget Katalog & Stok',
        description: 'Melihat kartu total ikan dan alert stok cupang menipis/habis.',
      },
      {
        key: 'dashboard:kpi_users',
        action: 'widget',
        label: 'Widget Total Pengguna',
        description: 'Melihat kartu statistik jumlah customer dan pengguna terdaftar.',
      },
    ],
  },
  {
    module: 'orders',
    moduleLabel: 'Manajemen Pesanan (Orders)',
    description: 'Hak akses pengelolaan transaksi pembelian, status pembayaran, dan pembatalan.',
    permissions: [
      {
        key: 'orders:view',
        action: 'view',
        label: 'Lihat Daftar & Detail Pesanan',
        description: 'Melihat daftar pesanan masuk dan detail item yang dibeli.',
      },
      {
        key: 'orders:update',
        action: 'update',
        label: 'Ubah Status Pesanan',
        description: 'Memperbarui status pesanan (Processing, Shipped, Completed).',
      },
      {
        key: 'orders:cancel',
        action: 'delete',
        label: 'Batalkan Pesanan',
        description: 'Membatalkan pesanan dan mengembalikan kuantitas stok.',
      },
      {
        key: 'orders:export',
        action: 'custom',
        label: 'Ekspor Data Pesanan',
        description: 'Mengunduh rekap riwayat pesanan ke file spreadsheet.',
      },
    ],
  },
  {
    module: 'shipping',
    moduleLabel: 'Logistik & Pengiriman (Shipping)',
    description: 'Hak akses operasional ekspedisi, request penjemputan paket, dan cetak resi kurir.',
    permissions: [
      {
        key: 'shipping:view',
        action: 'view',
        label: 'Lihat Status Ekspedisi & Resi',
        description: 'Melihat nomor waybill/AWB dan pelacakan kurir Biteship.',
      },
      {
        key: 'shipping:pickup',
        action: 'create',
        label: 'Panggil Kurir (Request Pickup)',
        description: 'Melakukan pemesanan penjemputan kurir Biteship (single & bulk).',
      },
      {
        key: 'shipping:label',
        action: 'custom',
        label: 'Cetak Label Thermal & Resi',
        description: 'Mencetak label alamat dan barcode resi thermal siap tempel.',
      },
    ],
  },
  {
    module: 'products',
    moduleLabel: 'Katalog Produk & Stok (Products)',
    description: 'Hak akses penambahan ikan cupang, update stok varian ukuran, dan import massal.',
    permissions: [
      {
        key: 'products:view',
        action: 'view',
        label: 'Lihat Katalog Produk',
        description: 'Melihat daftar ikan cupang, stok ukuran, dan harga jual.',
      },
      {
        key: 'products:create',
        action: 'create',
        label: 'Tambah Produk Baru',
        description: 'Menambahkan spesimen ikan cupang baru ke etalase.',
      },
      {
        key: 'products:update',
        action: 'update',
        label: 'Edit Produk & Stok',
        description: 'Mengubah deskripsi, harga, galeri foto, dan kuantitas stok.',
      },
      {
        key: 'products:delete',
        action: 'delete',
        label: 'Hapus / Arsip Produk',
        description: 'Menghapus atau mengarsipkan produk dari katalog.',
      },
      {
        key: 'products:import',
        action: 'custom',
        label: 'Bulk Import Excel & ZIP',
        description: 'Unggah massal data via Excel dan ekstraksi folder foto ZIP.',
      },
    ],
  },
  {
    module: 'events',
    moduleLabel: 'Promo & Event Banner (Events)',
    description: 'Hak akses penjadwalan banner event, flash sale, dan siaran live TikTok.',
    permissions: [
      {
        key: 'events:view',
        action: 'view',
        label: 'Lihat Daftar Event',
        description: 'Melihat daftar promo event dan jadwal aktif banner.',
      },
      {
        key: 'events:create',
        action: 'create',
        label: 'Tambah Event Baru',
        description: 'Membuat banner kampanye promosi baru.',
      },
      {
        key: 'events:update',
        action: 'update',
        label: 'Edit Data Event',
        description: 'Mengubah judul, link target, foto, dan status aktif.',
      },
      {
        key: 'events:delete',
        action: 'delete',
        label: 'Hapus Event',
        description: 'Menghapus banner kampanye promo dari sistem.',
      },
    ],
  },
  {
    module: 'reports',
    moduleLabel: 'Laporan & Finansial (Reports)',
    description: 'Hak akses grafik analisa omset penjualan dan ekspor akuntansi.',
    permissions: [
      {
        key: 'reports:view',
        action: 'view',
        label: 'Lihat Laporan Penjualan',
        description: 'Melihat grafik omset, tren transaksi harian, dan metrik revenue.',
      },
      {
        key: 'reports:export',
        action: 'custom',
        label: 'Ekspor Rekap Excel',
        description: 'Mengunduh laporan transaksi dalam workbook Excel lengkap.',
      },
    ],
  },
  {
    module: 'users',
    moduleLabel: 'Pengguna & Akun (Users)',
    description: 'Hak akses data pengguna pelanggan dan administrasi profil staf.',
    permissions: [
      {
        key: 'users:view',
        action: 'view',
        label: 'Lihat Daftar Pengguna',
        description: 'Melihat akun customer, email, nomor telepon, dan status verifikasi.',
      },
      {
        key: 'users:update',
        action: 'update',
        label: 'Ubah Data & Tetapkan Role',
        description: 'Memperbarui data pengguna dan menetapkan role jabatan akun.',
      },
      {
        key: 'users:delete',
        action: 'delete',
        label: 'Hapus Akun Pengguna',
        description: 'Menghapus akun pengguna dari database.',
      },
    ],
  },
  {
    module: 'roles',
    moduleLabel: 'Master Role & Hak Akses (RBAC)',
    description: 'Hak akses tingkat tinggi untuk konfigurasi struktur wewenang dan izin operasional.',
    permissions: [
      {
        key: 'roles:view',
        action: 'view',
        label: 'Lihat Master Role',
        description: 'Melihat daftar role jabatan dan ringkasan hak akses aktif.',
      },
      {
        key: 'roles:create',
        action: 'create',
        label: 'Tambah Role Baru',
        description: 'Membuat role kustom baru dari form awal.',
      },
      {
        key: 'roles:update',
        action: 'update',
        label: 'Konfigurasi Saklar Hak Akses',
        description: 'Mengatur saklar ON/OFF izin setiap modul dan aksi CRUD.',
      },
      {
        key: 'roles:delete',
        action: 'delete',
        label: 'Hapus Role',
        description: 'Menghapus role kustom yang sudah tidak dipakai user.',
      },
    ],
  },
];

export const ALL_PERMISSION_KEYS = SYSTEM_PERMISSIONS.flatMap((m) =>
  m.permissions.map((p) => p.key)
);

import { LEGACY_ALIASES, checkPermissionMatch } from '@/lib/permission-utils';
export { LEGACY_ALIASES, checkPermissionMatch };

// Cache in-memory role permissions (TTL 30 detik untuk mitigasi load database)
const roleCache = new Map();
const CACHE_TTL_MS = 30_000;

export function invalidateRoleCache(slug) {
  if (slug) {
    roleCache.delete(slug);
  } else {
    roleCache.clear();
  }
}

/**
 * Memastikan default system roles ('admin' & 'customer') ada di database.
 */
export async function ensureSystemRoles() {
  try {
    const adminRole = await prisma.role.findUnique({ where: { slug: 'admin' } });
    if (!adminRole) {
      await prisma.role.create({
        data: {
          name: 'Administrator',
          slug: 'admin',
          description: 'Akses penuh tanpa batas ke seluruh modul dan aksi sistem (Superadmin).',
          permissions: ALL_PERMISSION_KEYS,
          isSystem: true,
        },
      });
    } else {
      // Pastikan admin selalu memiliki ALL_PERMISSION_KEYS terbaru
      const existing = Array.isArray(adminRole.permissions) ? adminRole.permissions : [];
      const hasAll = ALL_PERMISSION_KEYS.every((k) => existing.includes(k));
      if (!hasAll) {
        await prisma.role.update({
          where: { slug: 'admin' },
          data: { permissions: ALL_PERMISSION_KEYS },
        });
        invalidateRoleCache('admin');
      }
    }

    const customerRole = await prisma.role.findUnique({ where: { slug: 'customer' } });
    if (!customerRole) {
      await prisma.role.create({
        data: {
          name: 'Customer',
          slug: 'customer',
          description: 'Pelanggan standar toko SUMDE BETTA (tanpa akses panel admin).',
          permissions: [],
          isSystem: true,
        },
      });
    }
  } catch (err) {
    console.error('Error saat ensureSystemRoles:', err.message);
  }
}

/**
 * Mengambil daftar permission keys untuk suatu role slug.
 * Superadmin 'admin' selalu mendapat seluruh permission.
 */
export async function getRolePermissions(roleSlug) {
  if (!roleSlug || roleSlug === 'customer') {
    return [];
  }
  if (roleSlug === 'admin') {
    return ALL_PERMISSION_KEYS;
  }

  const cached = roleCache.get(roleSlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.permissions;
  }

  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  if (!role) {
    return [];
  }

  const perms = Array.isArray(role.permissions) ? role.permissions : [];
  roleCache.set(roleSlug, { permissions: perms, timestamp: Date.now() });
  return perms;
}


/**
 * Mengecek apakah role memiliki permission tertentu.
 */
export async function hasPermission(roleSlug, permissionKey) {
  if (!roleSlug) return false;
  if (roleSlug === 'admin') return true; // Superadmin bypass

  const perms = await getRolePermissions(roleSlug);
  return checkPermissionMatch(perms, permissionKey);
}

/**
 * Guard endpoint API berbasis Permission.
 * Mengembalikan session jika diizinkan, atau melempar error status 401/403 jika ditolak.
 * 
 * @param {Request} request Next.js request
 * @param {string|string[]} requiredPermission Key permission atau array of keys (OR)
 */
export async function requirePermission(request, requiredPermission) {
  const session = await requireUser(request);

  if (session.role === 'admin') {
    return session; // Superadmin wildcard
  }

  const perms = await getRolePermissions(session.role);

  const isAllowed = Array.isArray(requiredPermission)
    ? requiredPermission.some((p) => checkPermissionMatch(perms, p))
    : checkPermissionMatch(perms, requiredPermission);

  if (!isAllowed) {
    const permLabel = Array.isArray(requiredPermission)
      ? requiredPermission.join(' atau ')
      : requiredPermission;
    const err = new Error(`Akses ditolak: Anda tidak memiliki izin (${permLabel}).`);
    err.status = 403;
    throw err;
  }

  return session;
}
