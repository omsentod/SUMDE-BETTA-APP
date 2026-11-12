'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Ably from 'ably';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { playNotificationChime } from '@/lib/notificationSound';
import { startTabTitleFlash } from '@/lib/tabFlashing';
import UserAvatar from '@/components/UserAvatar';
import styles from './CustomerChatWidget.module.css';

const formatCurrency = (val) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Built-in intelligent templates for Pos 4 (Order Detail) with paired Q&A
function getOrderTemplates(status) {
  switch (status) {
    case 'PENDING':
      return [
        {
          label: 'Kendala Bayar',
          text: 'Halo Admin, pembayaran QRIS/VA untuk pesanan ini sempat terkendala. Bagaimana cara bayar ulangnya?',
          answer: 'Halo Kak! Untuk melakukan pembayaran ulang, silakan klik tombol "Bayar Sekarang" pada rincian pesanan Anda. Anda akan diarahkan kembali ke DOKU Checkout untuk memilih metode pembayaran baru.',
        },
      ];
    case 'PAID':
    case 'PROCESSING':
      return [
        {
          label: 'Cek Resi Pengiriman',
          text: 'Halo Admin, kapan perkiraan nomor resi kurir pesanan saya keluar dan diserahkan ke kurir?',
          answer: 'Halo Kak! Pesanan yang sudah lunas akan disiapkan dan dipacking dengan standar oksigen murni. Penyerahan ke kurir (pickup Biteship) dilakukan sore hari pukul 15.00 - 18.00 WIB. Nomor resi kurir otomatis terbit di sistem segera setelah discan kurir.',
        },
        {
          label: 'Ubah Alamat Kirim',
          text: 'Halo Admin, bisakah saya mengganti detail alamat sebelum paket diserahkan ke ekspedisi?',
          answer: 'Halo Kak! Selama paket belum diserahkan ke kurir (status belum SHIPPED), perubahan alamat masih bisa kami bantu. Silakan ketik detail alamat baru lengkap beserta RT/RW, kecamatan, dan nomor HP penerima di sini ya.',
        },
      ];
    case 'SHIPPED':
      return [
        {
          label: 'Follow-up Kurir',
          text: 'Halo Admin, tracking resi kurir pesanan saya belum ada pergerakan, bisakah dibantu follow up ke ekspedisi?',
          answer: 'Halo Kak! Pelacakan waybill biasanya memerlukan waktu 2-4 jam setelah paket diterima sorting hub ekspedisi. Tim SUMDE BETTA juga turut memantau paket Anda. Jika ada kendala di perjalanan, kami akan langsung bantu koordinasi dengan kurir ekspedisi.',
        },
      ];
    case 'COMPLETED':
    case 'DELIVERED':
    default:
      return [
        {
          label: 'Klaim Garansi 100% DOA',
          text: 'Halo Admin, ikan saya terima dalam kondisi lemas/mati. Saya ingin klaim garansi 100% DOA (video unboxing tanpa jeda sudah siap).',
          answer: 'Halo Kak, kami turut prihatin atas kendala yang dialami. Garansi 100% DOA SUMDE BETTA menjamin penggantian ikan atau pengembalian dana. Mohon kirimkan link/video unboxing tanpa terpotong maksimal 2 jam sejak kurir mengantar paket, dan sebutkan nomor pesanan Anda.',
        },
        {
          label: 'Konsultasi Aklimatisasi',
          text: 'Halo Admin, bagaimana langkah aklimatisasi air yang tepat sebelum ikan dimasukkan ke soliter/tank utama?',
          answer: 'Halo Kak! Langkah aklimatisasi yang aman: 1) Apungkan kantong plastik di atas soliter selama 15-20 menit agar suhu setara. 2) Buka kantong, masukkan sedikit air soliter secara bertahap tiap 5 menit. 3) Sendok ikan keluar perlahan tanpa memasukkan air bekas packing ke soliter.',
        },
      ];
  }
}

export default function CustomerChatWidget() {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const {
    isOpen,
    toggleChat,
    closeChat,
    chatContextData,
    setChatContextData,
    unreadCount,
    setUnreadCount,
  } = useChat();

  const [showTemplates, setShowTemplates] = useState(false);
  const [isAdminViewing, setIsAdminViewing] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const adminViewingTimeoutRef = useRef(null);
  const adminTypingTimeoutRef = useRef(null);

  // Heartbeat presence jika user yang membuka website adalah admin
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;

    let cancelled = false;

    const sendHeartbeat = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        await fetch('/api/chat/heartbeat', { method: 'POST' });
      } catch {
        // Silent fail
      }
    };

    sendHeartbeat();
    const timer = setInterval(() => {
      if (!cancelled) sendHeartbeat();
    }, 40 * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser?.role]);

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Status & Jam Operasional
  const [settings, setSettings] = useState({
    computedStatus: 'ONLINE',
    operatingHoursStart: '08:00',
    operatingHoursEnd: '21:00',
    offlineMessage: '',
    emergencyWaNumber: '',
  });

  // Dynamic templates dari Admin (untuk posisi non-Pos 4)
  const [dynamicTemplates, setDynamicTemplates] = useState([]);

  const messagesEndRef = useRef(null);

  // Jangan render di halaman admin
  const isAdminRoute = pathname?.startsWith('/admin');

  // 1. Muat status toko & polling berkala tiap 15 detik selama widget terbuka / tab aktif
  useEffect(() => {
    if (isAdminRoute || !currentUser) return;
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const res = await fetch('/api/chat/settings');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (err) {
        console.warn('Gagal memuat status chat:', err.message);
      }
    };

    loadSettings();

    let timer = null;
    if (isOpen) {
      timer = setInterval(() => {
        if (!cancelled) loadSettings();
      }, 15000);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        loadSettings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOpen]);

  // 2. Muat percakapan customer
  useEffect(() => {
    if (isAdminRoute || !currentUser) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/chat/conversation');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setConversation(data.conversation);
          setMessages(data.messages || []);

          const unread = data.conversation?.unreadCustomerCount || 0;
          setUnreadCount(unread);

          if (isOpen && data.conversation?.id) {
            fetch('/api/chat/read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId: data.conversation.id }),
            }).catch(() => {});
            setUnreadCount(0);
          }
        }
      } catch (err) {
        console.error('Gagal fetch conversation:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, setUnreadCount, currentUser, isAdminRoute]);

  // 3. Muat template dinamis dari Admin
  useEffect(() => {
    let pos = 'ALL';
    if (chatContextData?.pos) {
      pos = chatContextData.pos;
    } else if (pathname?.startsWith('/produk/') && pathname !== '/produk') {
      pos = 'PRODUCT';
    } else if (pathname?.includes('/checkout')) {
      pos = 'CHECKOUT';
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/templates?pos=${pos}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setDynamicTemplates(data.templates || []);
        }
      } catch (err) {
        console.warn('Gagal memuat template pertanyaan dinamis:', err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, chatContextData]);

  // Auto scroll saat pesan bertambah
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Ref stabil untuk isOpen agar koneksi Ably tidak reconnect saat chat box dibuka/ditutup
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // 4. Setup Ably Realtime untuk Customer
  useEffect(() => {
    if (isAdminRoute || !currentUser) return;

    let cancelled = false;
    let ablyClient = null;
    let convoChannel = null;
    let statusChannel = null;

    async function initAbly() {
      try {
        const convoId = conversation?.id;
        const authUrl = `/api/chat/auth${convoId ? `?conversationId=${convoId}` : ''}`;

        ablyClient = new Ably.Realtime({
          authUrl,
          authMethod: 'GET',
        });
        ablyClient.connection.on(['failed', 'suspended', 'disconnected', 'closed'], () => {});

        if (cancelled) {
          try { ablyClient?.close(); } catch {}
          return;
        }

        // 1. Subscribe status channel untuk realtime online/offline lifetime presence
        statusChannel = ablyClient.channels.get('chat:status');
        statusChannel.subscribe('status-update', (msgEvent) => {
          if (cancelled) return;
          const incoming = msgEvent.data;
          if (incoming) {
            setSettings((prev) => ({ ...prev, ...incoming }));
          }
        }).catch(() => {});

        // 2. Subscribe percakapan untuk chat masuk baru, presence admin & typing indicator
        if (convoId) {
          convoChannel = ablyClient.channels.get(`chat:${convoId}`);

          // A. Sinyal Presence Admin Terhubung (Kursor/Obrolan dibuka oleh admin)
          convoChannel.subscribe('admin-presence', (msgEvent) => {
            if (cancelled) return;
            const isViewing = Boolean(msgEvent.data?.isViewing);
            setIsAdminViewing(isViewing);

            if (adminViewingTimeoutRef.current) clearTimeout(adminViewingTimeoutRef.current);
            if (isViewing) {
              adminViewingTimeoutRef.current = setTimeout(() => {
                setIsAdminViewing(false);
              }, 35000);
            }
          }).catch(() => {});

          // B. Sinyal Typing Indicator Admin ("Admin sedang mengetik...")
          convoChannel.subscribe('admin-typing', (msgEvent) => {
            if (cancelled) return;
            const isTyping = Boolean(msgEvent.data?.isTyping);
            setIsAdminTyping(isTyping);

            if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
            if (isTyping) {
              adminTypingTimeoutRef.current = setTimeout(() => {
                setIsAdminTyping(false);
              }, 3500);
            }
          }).catch(() => {});

          // C. Pesan baru masuk
          convoChannel.subscribe('new-message', (msgEvent) => {
            if (cancelled) return;
            const incoming = msgEvent.data;
            if (incoming) {
              if (incoming.senderRole === 'ADMIN') {
                setIsAdminTyping(false);
                playNotificationChime();
                if (typeof document !== 'undefined' && document.hidden) {
                  startTabTitleFlash('💬 (1) Balasan Admin — SUMDE BETTA');
                }
              }

              setMessages((prev) => {
                if (prev.some((m) => m.id === incoming.id)) return prev;

                // Jika ada temporary message optimistik dengan teks sama, gantikan
                const tempIdx = prev.findIndex(
                  (m) => String(m.id).startsWith('temp_') && m.message === incoming.message
                );
                if (tempIdx !== -1) {
                  const next = [...prev];
                  next[tempIdx] = incoming;
                  return next;
                }

                return [...prev, incoming];
              });

              if (incoming.senderRole === 'ADMIN') {
                if (isOpenRef.current) {
                  fetch('/api/chat/read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ conversationId: convoId }),
                  }).catch(() => {});
                } else {
                  setUnreadCount((prev) => prev + 1);
                }
              }
            }
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Ably customer init fallback:', err.message);
      }
    }

    initAbly();

    return () => {
      cancelled = true;
      if (adminViewingTimeoutRef.current) clearTimeout(adminViewingTimeoutRef.current);
      if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
      try { statusChannel?.unsubscribe(); } catch {}
      try { convoChannel?.unsubscribe(); } catch {}
      try { ablyClient?.close(); } catch {}
    };
  }, [conversation?.id, setUnreadCount, currentUser, isAdminRoute]);

  // Auto scroll saat admin sedang mengetik agar animasi terlihat
  useEffect(() => {
    if (isAdminTyping && isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isAdminTyping, isOpen]);

  // Mengirim Pesan
  const handleSendMessage = useCallback(
    async (textToSend = null, autoAnswer = null, templateId = null, explicitContext = null) => {
      const raw = (typeof textToSend === 'string' ? textToSend : inputText).trim();
      if (!raw || sending) return;

      setSending(true);

      const targetContext = explicitContext || chatContextData;

      const payload = {
        message: raw,
      };

      if (autoAnswer) {
        payload.autoAnswer = autoAnswer;
      }
      if (templateId && !String(templateId).startsWith('order_tmpl_')) {
        payload.templateId = templateId;
      }

      // Sertakan konteks lampiran jika ada
      if (targetContext?.attachedType) {
        payload.attachedType = targetContext.attachedType;
        payload.attachedId = targetContext.attachedId;
        payload.attachedMeta = targetContext.attachedMeta;
      }

      // Optimistic UI update: langsung munculkan pesan di layar
      const tempId = generateTempId();
      const optimisticMsg = {
        id: tempId,
        senderRole: 'CUSTOMER',
        message: raw,
        attachedType: payload.attachedType || null,
        attachedId: payload.attachedId || null,
        attachedMeta: payload.attachedMeta
          ? typeof payload.attachedMeta === 'string'
            ? payload.attachedMeta
            : JSON.stringify(payload.attachedMeta)
          : null,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setInputText('');

      try {
        const res = await fetch('/api/chat/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            setMessages((prev) => {
              // Jika pesan dengan ID ini sudah masuk via Ably realtime, cukup buang tempId
              const hasMsg = prev.some((m) => m.id === data.message.id);
              let next = hasMsg
                ? prev.filter((m) => m.id !== tempId)
                : prev.map((m) => (m.id === tempId ? data.message : m));

              // Tambahkan balasan otomatis toko jika ada dan belum ada di list
              if (data.autoReply && !next.some((m) => m.id === data.autoReply.id)) {
                next = [...next, data.autoReply];
              }
              return next;
            });
          }
          if (data.conversationId && !conversation?.id) {
            setConversation((prev) => ({ ...(prev || {}), id: data.conversationId }));
          }
          // Kosongkan draft konteks setelah berhasil terkirim
          setChatContextData(null);
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error('Gagal kirim pesan ke server:', errData);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          alert(errData.error || 'Gagal mengirimkan pesan. Silakan coba lagi.');
        }
      } catch (err) {
        console.error('Kendala koneksi:', err.message);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } finally {
        setSending(false);
      }
    },
    [inputText, sending, chatContextData, currentUser?.name, conversation, setChatContextData]
  );

  // Otomatis kirim pesan pertanyaan pesanan jika dipicu oleh tombol "Bantuan Pesanan"
  const lastSentNonceRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !chatContextData?.autoSend || !chatContextData?.sendNonce) return;
    if (lastSentNonceRef.current === chatContextData.sendNonce) return;
    lastSentNonceRef.current = chatContextData.sendNonce;

    const orderCode = String(chatContextData.attachedId).slice(-6).toUpperCase();
    const promptText = `Halo Admin, saya ingin menanyakan perihal Pesanan #${orderCode}`;
    const targetCtx = { ...chatContextData };

    const timer = setTimeout(() => {
      handleSendMessage(promptText, null, null, targetCtx);
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, chatContextData, handleSendMessage]);

  // Hanya tampil untuk user yang sudah login dan bukan di rute admin
  if (isAdminRoute || !currentUser) return null;

  // Cek apakah posisi ini adalah Pos 4 (Order Detail) atau template dinamis
  const isPos4Order =
    chatContextData?.attachedType === 'ORDER' || !!chatContextData?.orderStatus;

  // Template pertanyaan gabungan (konteks pesanan di depan jika ada, lalu seluruh template admin aktif)
  const orderTemplates = isPos4Order
    ? getOrderTemplates(chatContextData?.orderStatus).map((t, idx) => ({
        id: `order_tmpl_${idx}`,
        chipLabel: t.label || (t.text.length > 24 ? `${t.text.slice(0, 24)}...` : t.text),
        fullText: t.text,
        answer: t.answer,
        isOrderContext: true,
      }))
    : [];

  const adminDbTemplates = dynamicTemplates.map((t) => ({
    id: t.id,
    chipLabel: t.chipLabel || (t.messageText.length > 24 ? `${t.messageText.slice(0, 24)}...` : t.messageText),
    fullText: t.messageText,
    answer: t.answerText,
    isOrderContext: false,
  }));

  const availableTemplates = [...orderTemplates, ...adminDbTemplates];

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          className={styles.floatingTrigger}
          onClick={toggleChat}
          aria-label="Buka Live Chat Admin"
          title="Tanya Admin Langsung"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>

          {/* Indikator Online Admin */}
          {settings.computedStatus === 'ONLINE' && (
            <span className={styles.onlineIndicatorDot} title="Admin Online" />
          )}

          {/* Badge Pesan Masuk Belum Dibaca */}
          {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
        </button>
      )}

      {/* Jendela Chat */}
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.farmAvatar}>SB</div>
              <div>
                <h3 className={styles.headerTitle}>SUMDE BETTA</h3>
                <div className={styles.headerStatus}>
                  <span
                    className={`${styles.statusDot} ${
                      isAdminViewing
                        ? styles.statusDotConnected
                        : settings.computedStatus === 'ONLINE'
                        ? styles.statusDotOnline
                        : settings.computedStatus === 'AWAY'
                        ? styles.statusDotAway
                        : styles.statusDotOffline
                    }`}
                  />
                  <span>
                    {isAdminViewing
                      ? 'Terhubung dengan Admin'
                      : settings.computedStatus === 'ONLINE'
                      ? 'Admin Online'
                      : settings.computedStatus === 'AWAY'
                      ? 'Admin Sedang di Farm'
                      : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className={styles.closeBtn}
              onClick={closeChat}
              aria-label="Tutup Chat"
              title="Tutup Chat"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Offline Notice Banner jika Admin Offline */}
          {settings.computedStatus === 'OFFLINE' && (
            <div className={styles.offlineBanner}>
              <div>{settings.offlineMessage || 'Admin saat ini di luar jam operasional (08.00 - 21.00 WIB). Pesanmu tetap tersimpan.'}</div>
              {settings.emergencyWaNumber && (
                <div>
                  Klaim darurat DOA?{' '}
                  <a
                    href={`https://wa.me/${settings.emergencyWaNumber}?text=Halo%20Admin%20SUMDE%20BETTA,%20saya%20butuh%20bantuan%20darurat`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.waFallbackLink}
                  >
                    Hubungi WhatsApp Darurat
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Status Admin Sedang Membuka Obrolan Ini */}
          {isAdminViewing && (
            <div className={styles.adminConnectedBanner}>
              <span className={styles.adminConnectedPulse} />
              <span>Admin terhubung langsung di obrolan ini</span>
            </div>
          )}

          {/* Scroll Area Pesan */}
          <div className={styles.messagesContainer}>
            {loading ? (
              <div className={styles.emptyState}>Memuat pesan...</div>
            ) : messages.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>Konsultasi Ikan & Bantuan</div>
                <div className={styles.emptySubtitle}>
                  Ada pertanyaan seputar spesifikasi cupang, video flaring, garansi 100% DOA, atau paket pesananmu? Tanyakan langsung di sini.
                </div>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isCustomer = m.senderRole === 'CUSTOMER';
                let meta = null;
                if (m.attachedMeta) {
                  if (typeof m.attachedMeta === 'object') {
                    meta = m.attachedMeta;
                  } else {
                    try {
                      meta = JSON.parse(m.attachedMeta);
                    } catch {
                      meta = null;
                    }
                  }
                }

                return (
                  <div
                    key={`${m.id || 'msg'}-${idx}`}
                    className={`${styles.bubbleRow} ${
                      isCustomer ? styles.bubbleRowCustomer : styles.bubbleRowAdmin
                    }`}
                  >
                    {!isCustomer && (
                      <span className={styles.adminBubbleAvatar} title="SUMDE BETTA Official">
                        SB
                      </span>
                    )}

                    <div
                      className={`${styles.bubble} ${
                        isCustomer ? styles.bubbleCustomer : styles.bubbleAdmin
                      }`}
                    >
                      {!isCustomer && meta?.isAutoReply && (
                        <div className={styles.autoReplyBadge}>
                          ⚡ Balasan Otomatis Toko
                        </div>
                      )}
                      <div>{m.message}</div>

                      {/* Lampiran Kartu Produk */}
                      {m.attachedType === 'PRODUCT' && meta && (
                        <div className={styles.bubbleCard}>
                          {meta.image && (
                            <Image
                              src={meta.image}
                              alt={meta.name || 'Produk'}
                              width={40}
                              height={40}
                              className={styles.bubbleCardImg}
                            />
                          )}
                          <div className={styles.bubbleCardInfo}>
                            <div className={styles.bubbleCardName}>{meta.name}</div>
                            <div className={styles.bubbleCardSub}>
                              {formatCurrency(meta.price)}
                              {meta.selectedSize ? ` • Size: ${meta.selectedSize}` : ''}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Lampiran Info Pesanan Mewah Shopee-Style */}
                      {m.attachedType === 'ORDER' && meta && (
                        <div className={styles.bubbleOrderCard}>
                          {meta.image ? (
                            <Image
                              src={meta.image}
                              alt={meta.itemName || 'Pesanan'}
                              width={44}
                              height={44}
                              className={styles.bubbleCardImg}
                            />
                          ) : (
                            <div className={styles.orderIconBox}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                              </svg>
                            </div>
                          )}
                          <div className={styles.bubbleCardInfo}>
                            <div className={styles.bubbleOrderCardHeader}>
                              <span className={styles.bubbleOrderNumber}>
                                #{String(meta.orderId || m.attachedId).slice(-6).toUpperCase()}
                              </span>
                              <span className={styles.bubbleStatusBadge}>
                                {meta.status || '-'}
                              </span>
                            </div>
                            <div className={styles.bubbleCardName}>
                              {meta.itemName || 'Rincian Pesanan'}
                            </div>
                            <div className={styles.bubbleCardSub}>
                              {formatCurrency(meta.total)}
                            </div>
                          </div>
                          <Link
                            href="/customer/orders"
                            className={styles.bubbleOrderActionLink}
                            title="Buka rincian pesanan"
                          >
                            Lihat ↗
                          </Link>
                        </div>
                      )}

                      <span className={styles.bubbleTime}>{formatTime(m.createdAt)}</span>
                    </div>

                    {isCustomer && currentUser && (
                      <UserAvatar
                        user={currentUser}
                        size="xs"
                        className={styles.customerBubbleAvatar}
                      />
                    )}
                  </div>
                );
              })
            )}

            {/* Bubble Animasi "Admin sedang mengetik..." */}
            {isAdminTyping && (
              <div className={`${styles.bubbleRow} ${styles.bubbleRowAdmin}`}>
                <span className={styles.adminBubbleAvatar} title="SUMDE BETTA Official">
                  SB
                </span>
                <div className={`${styles.bubble} ${styles.bubbleAdmin} ${styles.typingBubble}`}>
                  <div className={styles.typingDots}>
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                  </div>
                  <span className={styles.typingText}>Admin sedang mengetik...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Area Komposer Bawah (Posisinya sama persis dengan Admin) */}
          <div className={styles.composerArea}>
            {/* 1. Lampiran Pesanan / Produk jika customer klik Bantuan Pesanan / Tanya Produk */}
            {chatContextData?.attachedMeta && (
              <div className={styles.shopeeAttachedCard}>
                {chatContextData.attachedMeta.image ? (
                  <Image
                    src={chatContextData.attachedMeta.image}
                    alt={chatContextData.attachedMeta.itemName || chatContextData.attachedMeta.name || 'Pesanan'}
                    width={44}
                    height={44}
                    className={styles.shopeeAttachedImg}
                  />
                ) : (
                  <div className={styles.orderIconBox}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                  </div>
                )}
                <div className={styles.shopeeAttachedDetails}>
                  <div className={styles.shopeeAttachedTitle}>
                    {chatContextData.attachedType === 'ORDER'
                      ? `Pesanan #${String(chatContextData.attachedId).slice(-6).toUpperCase()}`
                      : chatContextData.attachedMeta.name}
                  </div>
                  <div className={styles.shopeeAttachedSubtitle}>
                    {chatContextData.attachedType === 'ORDER'
                      ? `${chatContextData.attachedMeta.itemName || 'Pesanan'} • ${formatCurrency(chatContextData.attachedMeta.total)}`
                      : `${formatCurrency(chatContextData.attachedMeta.price)}${chatContextData.attachedMeta.selectedSize ? ` • Size: ${chatContextData.attachedMeta.selectedSize}` : ''}`}
                  </div>
                </div>

                {chatContextData.attachedType === 'ORDER' && (
                  <button
                    type="button"
                    className={styles.shopeeSendOrderBtn}
                    onClick={() => {
                      const orderCode = String(chatContextData.attachedId).slice(-6).toUpperCase();
                      handleSendMessage(`Halo Admin, saya ingin menanyakan perihal Pesanan #${orderCode}`);
                    }}
                    disabled={sending}
                    title="Kirim rincian pesanan ini ke obrolan"
                  >
                    Kirim Pesanan ↗
                  </button>
                )}

                <button
                  type="button"
                  className={styles.shopeeDismissBtn}
                  onClick={() => setChatContextData(null)}
                  title="Batal melampirkan"
                >
                  &times;
                </button>
              </div>
            )}

            {/* 2. Panel Pertanyaan Lengkap (Muncul jika tombol diaktifkan / showTemplates = true) */}
            {showTemplates && availableTemplates.length > 0 && (
              <div className={styles.customerExpandedTemplatesCard}>
                <div className={styles.customerExpandedTemplatesHeader}>
                  <div className={styles.customerExpandedHeaderTitle}>
                    <span>⚡ Pertanyaan Lengkap (1-Klik Kirim):</span>
                  </div>
                  <button
                    type="button"
                    className={styles.shopeeDismissBtn}
                    onClick={() => setShowTemplates(false)}
                    title="Tutup daftar pertanyaan"
                  >
                    &times;
                  </button>
                </div>
                <div className={styles.customerExpandedTemplatesList}>
                  {availableTemplates.map((t, idx) => (
                    <button
                      key={t.id || idx}
                      type="button"
                      className={styles.customerExpandedTemplateItem}
                      onClick={() => {
                        handleSendMessage(t.fullText, t.answer, t.id);
                        setShowTemplates(false);
                      }}
                      disabled={sending}
                      title="Klik untuk langsung mengirimkan pertanyaan ini"
                    >
                      <span className={styles.customerExpandedChipLabel}>{t.chipLabel}</span>
                      <p className={styles.customerExpandedFullText}>{t.fullText}</p>
                      <span className={styles.customerExpandedSendAction}>Kirim ↗</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Bilah Balasan Cepat Customer persis seperti di Admin (quickTemplatesBar) */}
            {availableTemplates.length > 0 && (
              <div className={styles.quickTemplatesBar}>
                <button
                  type="button"
                  className={`${styles.quickTemplatesBarTitleBtn} ${showTemplates ? styles.quickTitleBtnActive : ''}`}
                  onClick={() => setShowTemplates((prev) => !prev)}
                  title={showTemplates ? 'Tutup daftar pertanyaan lengkap' : 'Buka daftar pertanyaan lengkap'}
                >
                  ⚡ Pertanyaan {showTemplates ? '▾' : '▴'}
                </button>
                <div className={styles.quickChipsScroll}>
                  {availableTemplates.map((t, idx) => (
                    <button
                      key={t.id || idx}
                      type="button"
                      className={styles.quickTemplateChip}
                      onClick={() => {
                        handleSendMessage(t.fullText, t.answer, t.id);
                      }}
                      disabled={sending}
                      title={t.fullText}
                    >
                      {t.chipLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Form Input Pesan */}
            <form
              className={styles.composerForm}
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <textarea
                rows={1}
                className={styles.composerInput}
                placeholder="Tulis pesan ke admin..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className={styles.sendBtn}
                aria-label="Kirim Pesan"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
