'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function EventsPage() {
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'ongoing' | 'upcoming'

    useEffect(() => {
        const loadEvents = async () => {
            try {
                const res = await fetch('/api/events');
                if (res.ok) {
                    const data = await res.json();
                    setEvents(data);
                }
            } catch (error) {
                console.error('Gagal mengambil data event:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadEvents();
    }, []);

    // Filter out inactive or expired events for public view
    const publicEvents = useMemo(() => {
        const now = new Date();
        return events
            .filter(event => {
                if (!event.isActive) return false;
                if (event.endDate && new Date(event.endDate) < now) return false;
                return true;
            })
            .sort((a, b) => {
                const aOngoing = !a.startDate || new Date(a.startDate) <= now;
                const bOngoing = !b.startDate || new Date(b.startDate) <= now;
                if (aOngoing && !bOngoing) return -1;
                if (!aOngoing && bOngoing) return 1;
                return 0;
            });
    }, [events]);

    // Filter events based on tab
    const filteredEvents = useMemo(() => {
        const now = new Date();
        if (activeTab === 'all') {
            return publicEvents;
        } else if (activeTab === 'ongoing') {
            return publicEvents.filter(event => {
                const start = event.startDate ? new Date(event.startDate) : null;
                return !start || start <= now;
            });
        } else if (activeTab === 'upcoming') {
            return publicEvents.filter(event => {
                const start = event.startDate ? new Date(event.startDate) : null;
                return start && start > now;
            });
        }
        return publicEvents;
    }, [activeTab, publicEvents]);

    const formatEventDate = (dateStr) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="pageContainer" style={{ paddingTop: '100px', minHeight: '90vh', color: 'var(--text-main)' }}>
            <div className="container" style={{ margin: '3rem auto', paddingBottom: '5rem' }}>
                
                {/* Header Section */}
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
                        Jadwal & Penawaran
                    </span>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontStyle: 'italic', marginTop: '0.5rem', lineHeight: 1.2 }}>
                        Events & Promosi
                    </h1>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '1rem auto 0 auto', fontSize: '0.95rem' }}>
                        Ikuti berbagai keseruan live streaming, flash sale, dan rilis koleksi eksklusif cupang hias terbaik dari toko kami.
                    </p>
                </div>

                {/* Filter Tabs */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '1rem', 
                    marginBottom: '3rem',
                    flexWrap: 'wrap'
                }}>
                    {[
                        { id: 'all', name: 'Semua Event' },
                        { id: 'ongoing', name: 'Sedang Berlangsung' },
                        { id: 'upcoming', name: 'Segera Hadir' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
                            style={{ 
                                padding: '0.6rem 1.5rem', 
                                borderRadius: '30px', 
                                fontSize: '0.85rem',
                                fontWeight: '600'
                            }}
                        >
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '5rem 0' }}>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--text-muted)' }}>Memuat Jadwal Seru...</h3>
                    </div>
                ) : filteredEvents.length > 0 ? (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
                        gap: '2.5rem' 
                    }}>
                        {filteredEvents.map(event => {
                            const now = new Date();
                            const start = event.startDate ? new Date(event.startDate) : null;
                            const isUpcoming = start && start > now;
                            const isExternalUrl = event.targetUrl.startsWith('http://') || event.targetUrl.startsWith('https://');

                            return (
                                <div 
                                    key={event.id}
                                    style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '16px',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                    }}
                                    className="table-row-hover" // leverage row hover scale
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-6px)';
                                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
                                    }}
                                >
                                    {/* Event Banner Image */}
                                    <div style={{ position: 'relative', width: '100%', height: '180px', background: 'rgba(255,255,255,0.02)' }}>
                                        <Image
                                            src={event.image}
                                            alt={event.title}
                                            fill
                                            style={{ objectFit: 'cover' }}
                                        />
                                        
                                        {/* Status Badge */}
                                        <span style={{
                                            position: 'absolute',
                                            top: '1rem',
                                            left: '1rem',
                                            background: isUpcoming ? '#3B82F6' : '#10B981',
                                            color: '#000000',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            padding: '0.3rem 0.8rem',
                                            borderRadius: '30px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05rem',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                                        }}>
                                            {isUpcoming ? 'Segera Hadir' : 'Berlangsung'}
                                        </span>
                                    </div>

                                    {/* Event Content Details */}
                                    <div style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                                            {event.title}
                                        </h3>
                                        {event.subtitle && (
                                            <p style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05rem', marginBottom: '1rem' }}>
                                                {event.subtitle}
                                            </p>
                                        )}
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '1.5rem', flex: 1 }}>
                                            {event.description}
                                        </p>

                                        {/* Scheduling Details */}
                                        <div style={{ 
                                            background: 'rgba(255,255,255,0.01)', 
                                            border: '1px solid var(--border-color)', 
                                            borderRadius: '8px', 
                                            padding: '1rem', 
                                            fontSize: '0.8rem', 
                                            color: 'var(--text-muted)',
                                            marginBottom: '1.5rem',
                                            lineHeight: '1.5'
                                        }}>
                                            {event.startDate && (
                                                <div>
                                                    <strong style={{ color: 'var(--text-main)' }}>Mulai:</strong> {formatEventDate(event.startDate)}
                                                </div>
                                            )}
                                            {event.endDate && (
                                                <div style={{ marginTop: '0.25rem' }}>
                                                    <strong style={{ color: 'var(--text-main)' }}>Selesai:</strong> {formatEventDate(event.endDate)}
                                                </div>
                                            )}
                                            {!event.startDate && !event.endDate && (
                                                <div style={{ fontStyle: 'italic' }}>Event aktif tanpa batasan waktu.</div>
                                            )}
                                        </div>

                                        {/* CTA Action Button */}
                                        {isExternalUrl ? (
                                            <a 
                                                href={event.targetUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="btn btn-outline"
                                                style={{ textAlign: 'center', width: '100%', padding: '0.8rem 0', borderRadius: '30px' }}
                                            >
                                                {event.buttonText || 'Buka Link Event'}
                                            </a>
                                        ) : (
                                            <Link 
                                                href={event.targetUrl} 
                                                className="btn btn-outline"
                                                style={{ textAlign: 'center', width: '100%', padding: '0.8rem 0', borderRadius: '30px' }}
                                            >
                                                {event.buttonText || 'Buka Link Event'}
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Empty State */
                    <div style={{ 
                        padding: '6rem 2rem', 
                        textAlign: 'center', 
                        border: '1px dashed var(--border-color)', 
                        borderRadius: '16px',
                        background: 'var(--bg-card)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📅</div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Tidak Ada Event</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            Saat ini belum ada event atau promo terjadwal untuk kategori ini.
                        </p>
                        <button onClick={() => setActiveTab('all')} className="btn btn-outline" style={{ borderRadius: '30px' }}>
                            Lihat Semua Status
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
