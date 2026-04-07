import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartSidebar from "@/components/CartSidebar";
import { CartProvider } from "@/context/CartContext";

export const metadata = {
    title: "SUMDE BETTA | Koleksi Akuatik Eksklusif",
    description: "Beli Ikan Cupang Hias Kualitas Kontes & Premium. Pembayaran Otomatis Menggunakan QRIS.",
};

export default function RootLayout({ children }) {
    return (
        <html lang="id">
            <head>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" />
            </head>
            <body>
                <CartProvider>
                    <Header />
                    <CartSidebar />
                    <main>{children}</main>
                    <Footer />
                </CartProvider>
            </body>
        </html>
    );
}