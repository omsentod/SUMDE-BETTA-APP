'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartSidebar from '@/components/CartSidebar';
import AdminHeader from '@/components/AdminHeader';
import AdminSidebar from '@/components/AdminSidebar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { ChatProvider } from '@/context/ChatContext';
import CustomerChatWidget from '@/components/chat/CustomerChatWidget';
import WhatsAppFloatingButton from '@/components/WhatsAppFloatingButton';
import styles from './LayoutWrapper.module.css';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname() || '';
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (adminSidebarOpen) setAdminSidebarOpen(false);
  }

  const toggleAdminSidebar = useCallback(() => {
    setAdminSidebarOpen((prev) => !prev);
  }, []);

  const closeAdminSidebar = useCallback(() => {
    setAdminSidebarOpen(false);
  }, []);

  const isAdminRoute = pathname.startsWith('/admin');
  const isPrintableRoute =
    (pathname.includes('/admin/orders/') && pathname.endsWith('/label')) ||
    pathname === '/admin/orders/labels-batch' ||
    pathname.startsWith('/admin/packing/manifest');

  // Halaman /produk/[id] pakai action bar sticky sendiri; MobileBottomNav
  // self-hide di sana (cek di dalam komponen supaya SSR/CSR konsisten,
  // jangan conditional render di sini karena bikin hydration mismatch).

  if (isPrintableRoute) {
    // Printable page — render raw children with no headers/footers/sidebars
    return <main>{children}</main>;
  }

  if (isAdminRoute) {
    return (
      <ChatProvider>
        <div className={styles.adminShell}>
          <AdminHeader onToggleSidebar={toggleAdminSidebar} isSidebarOpen={adminSidebarOpen} />
          <div className={styles.adminBody}>
            <AdminSidebar open={adminSidebarOpen} onClose={closeAdminSidebar} />
            <main className={styles.adminMain}>{children}</main>
          </div>
        </div>
      </ChatProvider>
    );
  }

  return (
    <ChatProvider>
      <Header />
      <CartSidebar />
      <main className="has-mobile-bottom-nav">{children}</main>
      <Footer />
      <CustomerChatWidget />
      <WhatsAppFloatingButton />
      <MobileBottomNav />
    </ChatProvider>
  );
}
