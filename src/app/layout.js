import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import TopProgressBar from "@/components/TopProgressBar";
import InteractiveAtmosphereBackground from "@/components/InteractiveAtmosphereBackground";
import { CartProvider } from "@/context/CartContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProductProvider } from "@/context/ProductContext";
import { ToastProvider } from "@/context/ToastContext";
import { Inter } from "next/font/google";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

export const metadata = {
    title: "SUMDE BETTA | Koleksi Akuatik Eksklusif",
    description: "Beli Ikan Cupang Hias Kualitas Pilihan & Gallery Eksklusif. Pembayaran Otomatis Menggunakan QRIS.",
};

export default function RootLayout({ children }) {
    return (
        <html lang="id" className={inter.variable}>
            <head>
                <link rel="icon" href="/img/logo.png" type="image/png"/>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            </head>
            <body>
                <TopProgressBar />
                <InteractiveAtmosphereBackground />
                <ThemeProvider>
                    <AuthProvider>
                        <ProductProvider>
                            <CartProvider>
                                <ToastProvider>
                                    <LayoutWrapper>{children}</LayoutWrapper>
                                </ToastProvider>
                            </CartProvider>
                        </ProductProvider>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}