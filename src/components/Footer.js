import Link from 'next/link';

export default function Footer() {
    const currentYear = new Date().getFullYear();
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-content">
                    <div className="footer-brand">
                        <h2 className="logo-text">SUMDE <span className="logo-highlight">BETTA</span></h2>
                        <p>Kurasi Ikan Cupang Hias Eksklusif & Kualitas Kontes. Seni Kehidupan Dalam Air.</p>
                    </div>
                    <div className="footer-links">
                        <h4>Navigasi</h4>
                        <ul>
                            <li><Link href="/">Beranda</Link></li>
                            <li><Link href="/produk">Produk</Link></li>
                            <li><Link href="/tentang">Partai</Link></li>
                            <li><Link href="/kontak">Kontak</Link></li>
                        </ul>
                    </div>
                    <div className="footer-contact">
                        <h4>Hubungi Kami</h4>
                        <p>Email: sumdebetta@gmail.com</p>
                        <p>WhatsApp: +62 812 3456 7890</p>
                        <p>Lokasi: Tulungagung, Indonesia</p>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; {currentYear} SUMDE BETTA. Semua Hak Dilindungi.</p>
                </div>
            </div>
        </footer>
    );
}
