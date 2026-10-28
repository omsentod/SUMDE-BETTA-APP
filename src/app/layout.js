import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import TopProgressBar from "@/components/TopProgressBar";
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
    description: "Beli Ikan Cupang Hias Kualitas Kontes & Premium. Pembayaran Otomatis Menggunakan QRIS.",
};

export default function RootLayout({ children }) {
    return (
        <html lang="id" className={inter.variable}>
            <head>
                <link rel="icon" href="/img/logo.png" type="image/png"/>
            </head>
            <body>
                <TopProgressBar />
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