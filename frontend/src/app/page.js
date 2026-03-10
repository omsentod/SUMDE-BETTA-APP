'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { products } from "@/data/products";


const HERO_SLIDES = [
    {
        id: 1,
        title: "Seni dari",
        highlight: "Betta Splendens",
        subtitle: "Temukan kurasi koleksi kehidupan akuatik elit kami. Setiap ikan adalah mahakarya hidup, dikembangkan untuk bentuk yang luar biasa.",
        image: "/betta-1.png",
        accent: "var(--primary)"
    },
    {
        id: 2,
        title: "Genetik",
        highlight: "Koi Galaxy",
        subtitle: "Perpaduan warna nebula yang langka dan menakjubkan. Koleksi terbatas bagi kolektor spesimen eksklusif.",
        image: "/betta-2.png",
        accent: "var(--secondary)"
    },
    {
        id: 3,
        title: "Kualitas",
        highlight: "Grade Kontes",
        subtitle: "Simetri sempurna dan mental petarung. Spesimen yang kami pilih secara khusus untuk standar kompetisi global.",
        image: "/betta-3.png",
        accent: "var(--accent)"
    }
];

const FARM_DOCS = [
    {
        id: 1,
        title: "Sistem Filtrasi Mandiri",
        desc: "Menjaga kualitas air tetap jernih dan bebas patogen 24/7 dengan teknologi biological filtration tercanggih yang menjamin kesehatan ekosistem.",
        image: "/farm-1.png"
    },
    {
        id: 2,
        title: "Ruang Karantina & Lab",
        desc: "Proses seleksi dan sterilisasi ketat sebelum ikan siap dilepas ke pasar. Kami memastikan setiap spesimen dalam kondisi puncak.",
        image: "/farm-2.png"
    },
    {
        id: 3,
        title: "Packaging Eksklusif",
        desc: "Sistem pengemasan oksigen murni dengan kotak isolasi termal premium untuk keamanan pengiriman maksimal ke seluruh penjuru dunia.",
        image: "/farm-3.png"
    }
];

export default function Home() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [currentFarmSlide, setCurrentFarmSlide] = useState(0);

    const nextFarmSlide = () => {
        setCurrentFarmSlide((prev) => (prev + 1) % FARM_DOCS.length);
    };

    const prevFarmSlide = () => {
        setCurrentFarmSlide((prev) => (prev - 1 + FARM_DOCS.length) % FARM_DOCS.length);
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
        }, 6000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="homePage">
            <section className="heroCarousel">
                {HERO_SLIDES.map((slide, index) => (
                    <div
                        key={slide.id}
                        className={`heroSlide ${index === currentSlide ? "heroSlideActive" : ""}`}
                    >
                        <div className="heroImageWrapper">
                            <Image
                                src={slide.image}
                                alt={slide.highlight}
                                fill
                                style={{ objectFit: 'contain', objectPosition: 'right center' }}
                                priority={index === 0}
                            />
                        </div>
                        <div className="container">
                            <div className="heroTextOverlay">
                                <span style={{ color: slide.accent, letterSpacing: '0.3rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '1rem' }}>
                                    Est. 2020 — Akuisisi Pilihan
                                </span>
                                <h1 className="heroTitle" style={{ fontSize: '4.5rem', lineHeight: '1.1' }}>
                                    {slide.title} <br />
                                    <span style={{ color: slide.accent }} className="heroGlowText">{slide.highlight}</span>
                                </h1>
                                <p className="heroSubtitle" style={{ margin: '2rem 0', color: 'rgba(255,255,255,0.7)' }}>
                                    {slide.subtitle}
                                </p>
                                <div className="heroActions">
                                    <Link href="/produk" className="btn btn-primary">Masuk Galeri</Link>
                                    <Link href="/produk" className="btn btn-outline">Lihat Koleksi</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                <div className="carouselIndicators">
                    {HERO_SLIDES.map((_, index) => (
                        <div
                            key={index}
                            className={`indicator ${index === currentSlide ? "indicatorActive" : ""}`}
                            onClick={() => setCurrentSlide(index)}
                        ></div>
                    ))}
                </div>
            </section>

            <section id="galeri" style={{ padding: '10rem 0' }}>
                <div className="container">
                    <div style={{ marginBottom: '5rem', textAlign: 'center' }}>
                        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '4rem', fontStyle: 'italic', marginBottom: '1rem' }}>Galeri Keindahan</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', letterSpacing: '0.2rem', textTransform: 'uppercase' }}>Mahakarya Hidup dari Sumde Betta</p>
                    </div>

                    <div className="visualGallery">
                        {[
                            { id: 1, name: "Halfmoon Rosetail Elite", desc: "Simetri sirip sempurna dengan gradasi warna nebula.", img: "/betta-1.png" },
                            { id: 2, name: "Plakat Koi Galaxy Multi", desc: "Mutasi warna langka hasil seleksi genetik ketat.", img: "/betta-2.png" },
                            { id: 3, name: "Crowntail King Black", desc: "Karakter kuat dengan mental juara kontes.", img: "/betta-3.png" },
                            { id: 4, name: "Avatar Gordon Copper", desc: "Kilau metalik yang berpendar dalam kegelapan.", img: "/betta-1.png" },
                            { id: 5, name: "HMPK Blue Rim High Grade", desc: "Kebersihan warna putih dengan garis rim presisi.", img: "/betta-2.png" },
                            { id: 6, name: "Hellboy Red Dragon", desc: "Warna merah pekat yang dominan dan agresif.", img: "/betta-3.png" }
                        ].map((item) => (
                            <div key={item.id} className="galleryItem">
                                <Image src={item.img} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                <div className="galleryCaption">
                                    <h3 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.4rem' }}>{item.name}</h3>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '4rem' }}>
                        <Link href="/produk" className="btn btn-outline" style={{ padding: '1.2rem 3rem' }}>
                            Lihat Katalog & Ukur Spesimen
                        </Link>
                    </div>
                </div>
            </section>

            <section className="achievementSection">
                <div className="container">
                    <div className="trustGrid">
                        <div className="trustCard">
                            <span className="trustIcon">📦</span>
                            <div className="statNumber">500+</div>
                            <h3 style={{ margin: '1rem 0' }}>Pengiriman Aman</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Teknologi pengemasan oksigen murni dengan tingkat keberhasilan hidup 100% ke seluruh Indonesia.</p>
                        </div>
                        <div className="trustCard">
                            <span className="trustIcon">🏆</span>
                            <div className="statNumber">25+</div>
                            <h3 style={{ margin: '1rem 0' }}>Juara Kontes</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Indukan pilihan yang telah memenangkan berbagai kompetisi IBC di tingkat nasional maupun internasional.</p>
                        </div>
                        <div className="trustCard">
                            <span className="trustIcon">🤝</span>
                            <div className="statNumber">1k+</div>
                            <h3 style={{ margin: '1rem 0' }}>Kolektor Loyal</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Komunitas kolektor eksklusif yang mempercayakan akuisisi spesimen mereka kepada keahlian kami.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="historySection">
                <div className="container">
                    <div className="historyContent">
                        <div className="historyText">
                            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '3.5rem', fontStyle: 'italic', marginBottom: '2rem' }}>Sebuah Legasi <br /> Dari Kedalaman</h2>
                            <p style={{ color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '2rem' }}>
                                Dimulai pada tahun 2018 di sebuah sudut kecil di Jakarta, Sumde Betta lahir dari gairah yang mendalam terhadap estetika akuatik. Apa yang awalnya merupakan hobi koleksi pribadi, berkembang menjadi dedikasi untuk mengkurasi dan menghasilkan ikan cupang hias dengan standar genetik tertinggi.
                            </p>
                            <div className="timelineItem">
                                <h4>2020 — Awal Mula</h4>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Fokus pada pengumpulan indukan Grade A dari berbagai farm elit Asia Tenggara.</p>
                            </div>
                            <div className="timelineItem">
                                <h4>2021 — Inovasi Genetik</h4>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Mulai mengembangkangkan line koi galaxy dan avatar secara mandiri dengan seleksi ketat.</p>
                            </div>
                            <div className="timelineItem">
                                <h4>2024 — Era Digital</h4>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Transformasi menjadi platform akuisisi eksklusif dengan jaminan pengiriman global yang aman.</p>
                            </div>
                        </div>
                        <div style={{ position: 'relative', height: '600px', borderRadius: '2rem', overflow: 'hidden' }}>
                            <Image src="/betta-2.png" alt="Origins" fill style={{ objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #000 0%, transparent 40%)' }}></div>
                        </div>
                    </div>
                </div>
            </section>

            <section style={{ padding: '10rem 0', background: '#050505' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '3.5rem', fontStyle: 'italic' }}>Dokumentasi Farm</h2>
                        <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2rem', marginTop: '1rem' }}>Fasilitas & Standar Perawatan kami</p>
                    </div>

                    <div className="farmCarouselContainer">
                        <div
                            className="farmCarouselTrack"
                            style={{ transform: `translateX(-${currentFarmSlide * 100}%)` }}
                        >
                            {FARM_DOCS.map((doc, index) => (
                                <div
                                    key={doc.id}
                                    className={`farmSlide ${index === currentFarmSlide ? "farmSlideActive" : ""}`}
                                >
                                    <Image
                                        src={doc.image}
                                        alt={doc.title}
                                        fill
                                        style={{ objectFit: 'cover' }}
                                    />
                                    <div className="farmTextContainer">
                                        <h3 className="farmOverlayTitle">{doc.title}</h3>
                                        <p className="farmOverlayDesc">{doc.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="farmNavBtn farmNavBtnPrev" onClick={prevFarmSlide}>←</button>
                        <button className="farmNavBtn farmNavBtnNext" onClick={nextFarmSlide}>→</button>

                        <div className="farmCarouselIndicators">
                            {FARM_DOCS.map((_, index) => (
                                <div
                                    key={index}
                                    className={`farmIndicator ${index === currentFarmSlide ? "farmIndicatorActive" : ""}`}
                                    onClick={() => setCurrentFarmSlide(index)}
                                ></div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section style={{ padding: '10rem 0', borderTop: '1px solid var(--glass-border)' }}>
                <div className="container" style={{ display: 'flex', gap: '5rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', fontStyle: 'italic', marginBottom: '2rem' }}>Komitmen Kualitas</h2>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {[
                                { t: "Seleksi Individu", d: "Setiap ikan dipilih secara personal oleh kurator kami berdasarkan bentuk, warna, dan mental." },
                                { t: "Karantina Mandiri", d: "Proses pembersihan dan penguatan daya tahan selama 7 hari sebelum siap dikirim ke alamat Anda." },
                                { t: "Jaminan Hidup (DOA)", d: "Garansi uang kembali 100% atau penggantian spesimen jika ikan tidak sampai dalam keadaan hidup." }
                            ].map((point, i) => (
                                <li key={i} style={{ marginBottom: '2.5rem' }}>
                                    <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>{point.t}</h4>
                                    <p style={{ color: 'var(--text-muted)' }}>{point.d}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: '500px', borderRadius: '2rem', overflow: 'hidden' }}>
                        <Image src="/betta-1.png" alt="QC Process" fill style={{ objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <p style={{ fontSize: '1.2rem', fontWeight: '600' }}>Proses QC 24 Jam</p>
                                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Standar Tertinggi Industri</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
