import Link from 'next/link';
import { CONTACT, waLink, WA_DEFAULT_MESSAGE } from '@/lib/constants';

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
                            <li><Link href="/event">Event</Link></li>
                            <li><Link href="/tentang">Tentang Kami</Link></li>
                        </ul>
                    </div>
                    <div className="footer-contact">
                        <h4>Hubungi Kami</h4>
                        <ul className="footer-contact-list">
                            <li className="footer-contact-item">
                                <svg className="footer-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="2" y="4" width="20" height="16" rx="2" />
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                </svg>
                                <a href={`mailto:${CONTACT.email}`} className="footer-contact-link" aria-label="Kirim Email ke Sumde Betta">
                                    {CONTACT.email}
                                </a>
                            </li>
                            <li className="footer-contact-item">
                                <svg className="footer-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                                <a
                                    href={waLink({ text: WA_DEFAULT_MESSAGE })}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="footer-contact-link"
                                    aria-label="Hubungi Sumde Betta via WhatsApp"
                                >
                                    {CONTACT.waDisplayNumber}
                                </a>
                            </li>
                            <li className="footer-contact-item">
                                <svg className="footer-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                <a
                                    href={CONTACT.locationLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="footer-contact-link"
                                    aria-label="Lokasi SUMDE BETTA di Google Maps"
                                >
                                    {CONTACT.location}
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; {currentYear} SUMDE BETTA. Semua Hak Dilindungi.</p>
                </div>
            </div>
        </footer>
    );
}
