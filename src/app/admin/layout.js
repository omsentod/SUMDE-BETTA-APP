import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { getRolePermissions } from '@/lib/permissions';

export default async function AdminLayout({ children }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    redirect('/login');
  }

  // Superadmin selalu diizinkan
  if (session.role === 'admin') {
    return children;
  }

  // Customer biasa dialihkan ke dashboard customer
  if (session.role === 'customer') {
    redirect('/customer/dashboard');
  }

  // Role custom: verifikasi apakah memiliki hak akses modul
  const permissions = await getRolePermissions(session.role);
  if (permissions.length === 0) {
    redirect('/customer/dashboard');
  }

  return children;
}
