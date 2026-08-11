import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export default async function AdminLayout({ children }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session || session.role !== 'admin') {
    redirect('/login');
  }
  return children;
}
