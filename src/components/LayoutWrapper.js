'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartSidebar from '@/components/CartSidebar';
import WhatsAppFloatingButton from '@/components/WhatsAppFloatingButton';
import AdminHeader from '@/components/AdminHeader';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname() || '';

  // Check if current route is under /admin
  const isAdminRoute = pathname.startsWith('/admin');
  const isLabelRoute = pathname.includes('/admin/orders/') && pathname.endsWith('/label');

  if (isLabelRoute) {
    // Printable label page — render raw children with no headers/footers
    return <main>{children}</main>;
  }

  if (isAdminRoute) {
    // Dedicated Admin Area layout
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        <AdminHeader />
        <main>{children}</main>
      </div>
    );
  }

  // Customer facing layout
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
