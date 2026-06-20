import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartSidebar from "@/components/CartSidebar";
import { CartProvider } from "@/context/CartContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProductProvider } from "@/context/ProductContext";

export const metadata = {
    title: "SUMDE BETTA | Koleksi Akuatik Eksklusif",
    description: "Beli Ikan Cupang Hias Kualitas Kontes & Premium. Pembayaran Otomatis Menggunakan QRIS.",
};

export default function RootLayout({ children }) {
    return (
        <html lang="id">
            <head>
                <link rel="icon" href="/logo.png" type="image/png"/>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap" />
            </head>
            <body>
                <ThemeProvider>
                    <AuthProvider>
                        <ProductProvider>
                            <CartProvider>
                                <Header />
                                <CartSidebar />
                                <main>{children}</main>
                                <Footer />
                            </CartProvider>
                        </ProductProvider>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}