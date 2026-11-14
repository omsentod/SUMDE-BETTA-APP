import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { getRolePermissions, getFirstAccessibleAdminRoute } from '@/lib/permissions';
import { canUser } from '@/lib/permission-utils';

export default async function AdminRootPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    redirect('/login');
  }

  if (session.role === 'customer') {
    redirect('/customer/dashboard');
  }

  if (session.role === 'admin') {
    redirect('/admin/dashboard');
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions || permissions.length === 0) {
    redirect('/customer/dashboard');
  }

  const userObj = { role: session.role, permissions };
  const target = getFirstAccessibleAdminRoute((p) => canUser(userObj, p)) || '/admin/dashboard';
  redirect(target);
}
