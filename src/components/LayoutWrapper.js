'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartSidebar from '@/components/CartSidebar';
import WhatsAppFloatingButton from '@/components/WhatsAppFloatingButton';
import AdminHeader from '@/components/AdminHeader';
import AdminSidebar from '@/components/AdminSidebar';
import styles from './LayoutWrapper.module.css';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname() || '';

  const isAdminRoute = pathname.startsWith('/admin');
  const isLabelRoute =
    (pathname.includes('/admin/orders/') && pathname.endsWith('/label')) ||
    pathname === '/admin/orders/labels-batch';

  if (isLabelRoute) {
    // Printable label page — render raw children with no headers/footers
    return <main>{children}</main>;
  }

  if (isAdminRoute) {
    return (
      <div className={styles.adminShell}>
        <AdminHeader />
        <div className={styles.adminBody}>
          <AdminSidebar />
          <main className={styles.adminMain}>{children}</main>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <CartSidebar />
      <main>{children}</main>
      <Footer />
      <WhatsAppFloatingButton />
    </>
  );
}
