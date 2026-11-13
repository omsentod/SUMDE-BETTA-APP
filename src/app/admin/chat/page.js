'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Ably from 'ably';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { playChatNotificationSound } from '@/lib/notificationSound';
import { startTabTitleFlash } from '@/lib/tabFlashing';
import UserAvatar from '@/components/UserAvatar';
import styles from './chat.module.css';

const formatCurrency = (val) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}j lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// Balasan Cepat Default untuk Penjual / Admin (Canned Responses)
const DEFAULT_SELLER_REPLIES = [
  {
    id: 'def_ready',
    chipLabel: 'Stok Ready',
    answerText: 'Halo Kak! Ikan cupang ini ready stock dan siap dikirim hari ini dengan standar packing oksigen murni. Silakan langsung diorder ya!',
  },
  {
    id: 'def_doa',
    chipLabel: 'Garansi 100% DOA',
    answerText: 'Halo Kak! Kami memberikan garansi 100% DOA (Death on Arrival). Jika ikan mati/lemas di perjalanan, kami ganti atau refund penuh. Cukup kirimkan video unboxing tanpa jeda ya.',
  },
  {
    id: 'def_shipping',
    chipLabel: 'Jadwal Kirim Sore',
    answerText: 'Halo Kak! Penyerahan paket ke kurir (pickup Biteship) dilakukan sore hari pukul 15.00 - 18.00 WIB. Resi akan update otomatis di rincian pesanan kakak.',
  },
  {
    id: 'def_aklim',
    chipLabel: 'Panduan Aklimatisasi',
    answerText: 'Halo Kak! Sebelum dimasukkan soliter, apungkan kantong di soliter 15-20 menit agar suhu setara, lalu tambahkan sedikit air soliter bertahap sebelum ikan dilepas perlahan ya.',
  },
  {
    id: 'def_flaring',
    chipLabel: 'Video Flaring',
    answerText: 'Halo Kak! Video flaring aktif untuk koleksi ini bisa dilihat langsung pada video di halaman produk, atau kami bantu kirimkan via WhatsApp.',
  },
];

// Helper untuk menyusun daftar Balasan Cepat Admin dari Template Toko yang memiliki jawaban
function buildQuickReplies(loadedTemplates) {
  const customAnswers = (loadedTemplates || [])
    .filter((x) => x.isActive && x.answerText && x.answerText.trim())
    .map((x) => ({
      id: x.id,
      chipLabel: x.chipLabel,
      answerText: x.answerText.trim(),
    }));

  const existingLabels = new Set(customAnswers.map((a) => a.chipLabel.toLowerCase()));
  const remainingDefaults = DEFAULT_SELLER_REPLIES.filter(
    (d) => !existingLabels.has(d.chipLabel.toLowerCase())
  );

  return [...customAnswers, ...remainingDefaults];
}

function generateAdminTempId() {
  return `temp_admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function AdminChatInner() {
  const { currentUser } = useAuth();
  const { toast, confirmDialog } = useToast();

  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'templates' | 'settings'

  // ==========================================
  // STATE TAB 1: INBOX & PESAN
  // ==========================================
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'CLOSED'
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const replyInputRef = useRef(null);

  // WhatsApp-Style Feature States (Edit, Delete, Multi-Select)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [editingMessage, setEditingMessage] = useState(null); // { id, message }
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);

  const convoChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Quick reply (Balasan Cepat Penjual) untuk admin saat membalas
  const [quickReplies, setQuickReplies] = useState(DEFAULT_SELLER_REPLIES);

  // ==========================================
  // STATE TAB 2: KELOLA TEMPLATE PERTANYAAN & JAWABAN
  // ==========================================
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatePosFilter, setTemplatePosFilter] = useState('ALL');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    chipLabel: '',
    messageText: '',
    answerText: '',
    isAutoReply: true,
    targetPos: 'GLOBAL',
    sortOrder: 0,
    isActive: true,
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // ==========================================
  // STATE TAB 3: PENGATURAN STATUS & JAM KERJA
  // ==========================================
  const [settings, setSettings] = useState({
    adminStatus: 'AUTO',
    computedStatus: 'ONLINE',
    operatingHoursStart: '08:00',
    operatingHoursEnd: '21:00',
    offlineMessage: '',
    emergencyWaNumber: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Auto scroll ke pesan terbawah
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Muat status operasional
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.warn('Gagal memuat status chat:', err.message);
    }
  }, []);

  // Polling berkala tiap 15 detik agar status operasional & kehadiran admin selalu realtime
  useEffect(() => {
    const timer = setInterval(() => {
      fetchSettings();
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchSettings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchSettings]);

  // Muat daftar percakapan
  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/admin/chat/conversations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Gagal fetch percakapan:', err.message);
    } finally {
      setLoadingConvos(false);
    }
  }, [statusFilter, searchQuery]);

  // Muat detail percakapan terpilih
  const fetchActiveConversation = useCallback(async (convoId) => {
    if (!convoId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/admin/chat/conversations/${convoId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConvo(data.conversation);
        setMessages(data.messages || []);

        // Tandai telah dibaca oleh admin
        fetch(`/api/admin/chat/conversations/${convoId}/read`, { method: 'POST' }).catch(() => {});
        // Update badge unread lokal
        setConversations((prev) =>
          prev.map((c) => (c.id === convoId ? { ...c, unreadAdminCount: 0 } : c))
        );
      }
    } catch (err) {
      console.error('Gagal fetch pesan:', err.message);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const handleSelectConversation = (id) => {
    setSelectedId(id);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setEditingMessage(null);
    setActiveMenuMessageId(null);
    setReplyText('');
    fetchActiveConversation(id);
  };

  // Muat daftar template pertanyaan untuk Tab 2 dan untuk quick reply di Tab 1
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/admin/chat/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setQuickReplies(buildQuickReplies(data.templates));
      }
    } catch (err) {
      console.error('Gagal fetch templates:', err.message);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Inisialisasi awal aman tanpa cascading render
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        if (searchQuery.trim()) params.set('q', searchQuery.trim());

        const [sRes, cRes, tRes] = await Promise.all([
          fetch('/api/chat/settings'),
          fetch(`/api/admin/chat/conversations?${params.toString()}`),
          fetch('/api/admin/chat/templates'),
        ]);

        if (cancelled) return;
        if (sRes.ok) {
          const s = await sRes.json();
          setSettings(s);
        }
        if (cRes.ok) {
          const c = await cRes.json();
          setConversations(c.conversations || []);
        }
        if (tRes.ok) {
          const t = await tRes.json();
          setTemplates(t.templates || []);
          setQuickReplies(buildQuickReplies(t.templates));
        }
      } catch (err) {
        console.warn('Gagal memuat data chat:', err.message);
      } finally {
        if (!cancelled) setLoadingConvos(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [statusFilter, searchQuery]);

  // Auto scroll saat pesan berubah
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Ref stabil untuk callback realtime agar koneksi Ably tidak reconnect saat filter/search berubah
  const fetchConversationsRef = useRef(fetchConversations);
  const currentUserNameRef = useRef(currentUser?.name);

  useEffect(() => {
    fetchConversationsRef.current = fetchConversations;
  }, [fetchConversations]);

  useEffect(() => {
    currentUserNameRef.current = currentUser?.name;
  }, [currentUser?.name]);

  // Setup koneksi Ably Realtime untuk Admin
  useEffect(() => {
    let cancelled = false;
    let ablyClient = null;
    let adminChannel = null;
    let convoChannel = null;
    let statusChannel = null;

    async function initAbly() {
      try {
        ablyClient = new Ably.Realtime({
          authUrl: '/api/chat/auth',
          authMethod: 'GET',
        });
        ablyClient.connection.on(['failed', 'suspended', 'disconnected', 'closed'], () => {});

        if (cancelled) {
          try { ablyClient?.close(); } catch {}
          return;
        }

        // 1. Subscribe channel global admin untuk notif chat masuk baru & status update
        adminChannel = ablyClient.channels.get('admin:chat');
        adminChannel.subscribe('new-inbound-chat', () => {
          if (!cancelled) {
            fetchConversationsRef.current?.();
            playChatNotificationSound();
            if (typeof document !== 'undefined' && document.hidden) {
              startTabTitleFlash();
            }
          }
        }).catch(() => {});
        adminChannel.subscribe('status-update', (msgEvent) => {
          if (!cancelled && msgEvent?.data) {
            setSettings((prev) => ({ ...prev, ...msgEvent.data }));
          }
        }).catch(() => {});

        // 2. Subscribe channel status chat umum
        statusChannel = ablyClient.channels.get('chat:status');
        statusChannel.subscribe('status-update', (msgEvent) => {
          if (!cancelled && msgEvent?.data) {
            setSettings((prev) => ({ ...prev, ...msgEvent.data }));
          }
        }).catch(() => {});

        // 3. Subscribe channel percakapan aktif jika ada obrolan yang dibuka
        if (selectedId) {
          convoChannel = ablyClient.channels.get(`chat:${selectedId}`);
          convoChannelRef.current = convoChannel;

          // Beritahu customer bahwa Admin telah membuka obrolan ini (Presence Connected)
          convoChannel.publish('admin-presence', {
            isViewing: true,
            adminName: currentUserNameRef.current || 'Admin',
          }).catch(() => {});

          convoChannel.subscribe('new-message', (msgEvent) => {
            if (cancelled) return;
            const incoming = msgEvent.data;
            if (incoming) {
              setMessages((prev) => {
                // Hindari duplikasi jika pesan real dengan ID sama sudah ada
                if (prev.some((m) => m.id === incoming.id)) return prev;

                // Jika ada optimistic message dengan temp_admin_ dan teks sama, gantikan
                const tempIdx = prev.findIndex(
                  (m) => String(m.id).startsWith('temp_admin_') && m.message === incoming.message
                );
                if (tempIdx !== -1) {
                  const next = [...prev];
                  next[tempIdx] = incoming;
                  return next;
                }

                return [...prev, incoming];
              });

              // Jika pesan dari customer, bunyikan audio notifikasi chat & tandai dibaca
              if (incoming.senderRole === 'CUSTOMER') {
                playChatNotificationSound();
                if (typeof document !== 'undefined' && document.hidden) {
                  startTabTitleFlash();
                }
                fetch(`/api/admin/chat/conversations/${selectedId}/read`, { method: 'POST' }).catch(() => {});
              }
            }
          }).catch(() => {});

          // D. Pembaruan pesan (WhatsApp Edit)
          convoChannel.subscribe('message-updated', (msgEvent) => {
            if (cancelled) return;
            const updated = msgEvent?.data;
            if (updated?.id) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === updated.id
                    ? {
                        ...m,
                        message: updated.message,
                        isEdited: true,
                        editedAt: updated.editedAt || new Date().toISOString(),
                      }
                    : m
                )
              );
            }
          }).catch(() => {});

          // E. Penghapusan pesan tunggal (WhatsApp Soft Delete)
          convoChannel.subscribe('message-deleted', (msgEvent) => {
            if (cancelled) return;
            const deleted = msgEvent?.data;
            if (deleted?.id) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === deleted.id
                    ? {
                        ...m,
                        isDeleted: true,
                        message: 'Pesan ini telah dihapus',
                        attachedType: null,
                        attachedId: null,
                        attachedMeta: null,
                        deletedAt: deleted.deletedAt || new Date().toISOString(),
                      }
                    : m
                )
              );
            }
          }).catch(() => {});

          // F. Penghapusan banyak pesan (WhatsApp Batch Delete)
          convoChannel.subscribe('messages-deleted', (msgEvent) => {
            if (cancelled) return;
            const ids = msgEvent?.data?.ids;
            if (Array.isArray(ids)) {
              const idSet = new Set(ids);
              setMessages((prev) =>
                prev.map((m) =>
                  idSet.has(m.id)
                    ? {
                        ...m,
                        isDeleted: true,
                        message: 'Pesan ini telah dihapus',
                        attachedType: null,
                        attachedId: null,
                        attachedMeta: null,
                        deletedAt: new Date().toISOString(),
                      }
                    : m
                )
              );
            }
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Ably admin init fallback:', err.message);
      }
    }

    initAbly();

    // Heartbeat presence berkala tiap 20 detik jika obrolan masih dibuka admin
    let presenceTimer = null;
    if (selectedId) {
      presenceTimer = setInterval(() => {
        if (!cancelled && convoChannelRef.current) {
          convoChannelRef.current.publish('admin-presence', {
            isViewing: true,
            adminName: currentUserNameRef.current || 'Admin',
          }).catch(() => {});
        }
      }, 20000);
    }

    return () => {
      cancelled = true;
      if (presenceTimer) clearInterval(presenceTimer);
      if (convoChannelRef.current) {
        convoChannelRef.current.publish('admin-presence', { isViewing: false }).catch(() => {});
        convoChannelRef.current = null;
      }
      try { adminChannel?.unsubscribe(); } catch {}
      try { statusChannel?.unsubscribe(); } catch {}
      try { convoChannel?.unsubscribe(); } catch {}
      try { ablyClient?.close(); } catch {}
    };
  }, [selectedId]);

  // Tutup menu popover pesan jika klik di luar
  useEffect(() => {
    if (!activeMenuMessageId) return;
    const handleOutside = () => setActiveMenuMessageId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [activeMenuMessageId]);

  // Tombol Escape untuk membatalkan seleksi atau mode edit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activeMenuMessageId) {
          setActiveMenuMessageId(null);
        } else if (isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedIds(new Set());
        } else if (editingMessage) {
          setEditingMessage(null);
          setReplyText('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMenuMessageId, isSelectionMode, editingMessage]);

  // ==========================================
  // WHATSAPP FEATURE HANDLERS (EDIT, SELECT, DELETE)
  // ==========================================
  const handleStartEdit = (msg) => {
    setEditingMessage({ id: msg.id, message: msg.message });
    setReplyText(msg.message);
    setActiveMenuMessageId(null);
    setTimeout(() => {
      replyInputRef.current?.focus();
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setReplyText('');
  };

  const handleCopyMessage = (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success('Teks pesan berhasil disalin.');
    }
    setActiveMenuMessageId(null);
  };

  const handleEnterSelectMode = (initialId) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([initialId]));
    setActiveMenuMessageId(null);
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExitSelectMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleCopySelected = () => {
    const selectedMsgs = messages.filter((m) => selectedIds.has(m.id) && !m.isDeleted);
    if (selectedMsgs.length === 0) {
      toast.info('Tidak ada teks pesan untuk disalin.');
      return;
    }
    const combined = selectedMsgs.map((m) => m.message).join('\n\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(combined);
      toast.success(`${selectedMsgs.length} pesan berhasil disalin.`);
    }
    handleExitSelectMode();
  };

  const handleTriggerSingleDelete = async (msgId) => {
    setActiveMenuMessageId(null);
    const ok = await confirmDialog({
      title: 'Hapus Pesan?',
      message: 'Pesan ini akan dihapus untuk semua orang dalam obrolan.',
      confirmText: 'Hapus untuk Semua',
      cancelText: 'Batal',
      isDanger: true,
    });
    if (!ok) return;

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              isDeleted: true,
              message: 'Pesan ini telah dihapus',
              attachedType: null,
              attachedId: null,
              attachedMeta: null,
              deletedAt: new Date().toISOString(),
            }
          : m
      )
    );

    try {
      const res = await fetch(`/api/chat/messages/${msgId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Gagal menghapus pesan.');
      } else {
        toast.success('Pesan berhasil dihapus.');
      }
    } catch {
      toast.error('Gagal menghubungi server saat menghapus pesan.');
    }
  };

  const handleTriggerBatchDelete = async () => {
    const idsArray = Array.from(selectedIds);
    if (idsArray.length === 0) return;

    const ok = await confirmDialog({
      title: `Hapus ${idsArray.length} Pesan?`,
      message: `${idsArray.length} pesan terpilih akan dihapus untuk semua orang.`,
      confirmText: 'Hapus Semua',
      cancelText: 'Batal',
      isDanger: true,
    });
    if (!ok) return;

    const idSet = new Set(idsArray);
    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) =>
        idSet.has(m.id)
          ? {
              ...m,
              isDeleted: true,
              message: 'Pesan ini telah dihapus',
              attachedType: null,
              attachedId: null,
              attachedMeta: null,
              deletedAt: new Date().toISOString(),
            }
          : m
      )
    );
    handleExitSelectMode();

    try {
      const res = await fetch('/api/chat/messages/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: idsArray }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Gagal menghapus pesan terpilih.');
      } else {
        toast.success(`${idsArray.length} pesan berhasil dihapus.`);
      }
    } catch {
      toast.error('Gagal menghubungi server saat memproses hapus banyak pesan.');
    }
  };

  // Handler saat admin mengetik balasan (Kirim sinyal typing indicator ke customer)
  const handleReplyTextChange = (e) => {
    const val = e.target.value;
    setReplyText(val);

    if (convoChannelRef.current && selectedId) {
      convoChannelRef.current.publish('admin-typing', { isTyping: true }).catch(() => {});

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        convoChannelRef.current?.publish('admin-typing', { isTyping: false }).catch(() => {});
      }, 2500);
    }
  };

  // Mengirim balasan admin
  const handleSendReply = async (e) => {
    e?.preventDefault();
    const text = replyText.trim();
    if (!text || !selectedId || sending) return;

    // Bersihkan status typing segera saat pesan dikirim
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (convoChannelRef.current) {
      convoChannelRef.current.publish('admin-typing', { isTyping: false }).catch(() => {});
    }

    // A. JIKA SEDANG MODE EDIT PESAN
    if (editingMessage) {
      const editId = editingMessage.id;
      setSending(true);
      setEditingMessage(null);
      setReplyText('');

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editId
            ? {
                ...m,
                message: text,
                isEdited: true,
                editedAt: new Date().toISOString(),
              }
            : m
        )
      );

      try {
        const res = await fetch(`/api/chat/messages/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        if (res.ok) {
          toast.success('Pesan berhasil diperbarui.');
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || 'Gagal mengedit pesan.');
        }
      } catch {
        toast.error('Terjadi kendala saat mengedit pesan.');
      } finally {
        setSending(false);
      }
      return;
    }

    // B. JIKA MENGIRIM PESAN BARU
    setSending(true);
    setReplyText('');

    // Optimistic UI update: langsung munculkan pesan di layar
    const tempId = generateAdminTempId();
    const optimisticMsg = {
      id: tempId,
      conversationId: selectedId,
      senderRole: 'ADMIN',
      message: text,
      attachedType: null,
      attachedId: null,
      attachedMeta: null,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch(`/api/admin/chat/conversations/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => {
            // Jika pesan real sudah masuk via Ably realtime, cukup buang tempId
            const alreadyHasReal = prev.some((m) => m.id === data.message.id);
            if (alreadyHasReal) {
              return prev.filter((m) => m.id !== tempId);
            }
            // Gantikan tempId dengan data resmi dari server
            return prev.map((m) => (m.id === tempId ? data.message : m));
          });
        }
        fetchConversations();
      } else {
        const err = await res.json().catch(() => ({}));
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setReplyText(text); // Kembalikan teks ke input agar tidak hilang
        toast.error(err.error || 'Gagal mengirim pesan');
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setReplyText(text);
      toast.error('Terjadi kendala jaringan saat mengirim balasan.');
    } finally {
      setSending(false);
    }
  };

  // Toggle status obrolan (OPEN <-> CLOSED)
  const handleToggleStatus = async () => {
    if (!activeConvo) return;
    const nextStatus = activeConvo.status === 'OPEN' ? 'CLOSED' : 'OPEN';

    try {
      const res = await fetch(`/api/admin/chat/conversations/${activeConvo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        setActiveConvo((prev) => ({ ...prev, status: nextStatus }));
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConvo.id ? { ...c, status: nextStatus } : c))
        );
        toast.success(nextStatus === 'CLOSED' ? 'Percakapan ditandai selesai.' : 'Percakapan dibuka kembali.');
      }
    } catch {
      toast.error('Gagal memperbarui status percakapan.');
    }
  };

  // ==========================================
  // HANDLERS TAB 2: TEMPLATE PERTANYAAN
  // ==========================================
  const handleOpenAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      chipLabel: '',
      messageText: '',
      answerText: '',
      isAutoReply: true,
      targetPos: 'GLOBAL',
      sortOrder: (templates.length + 1) * 10,
      isActive: true,
    });
    setTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tmpl) => {
    setEditingTemplate(tmpl);
    setTemplateForm({
      chipLabel: tmpl.chipLabel,
      messageText: tmpl.messageText,
      answerText: tmpl.answerText || '',
      isAutoReply: typeof tmpl.isAutoReply === 'boolean' ? tmpl.isAutoReply : true,
      targetPos: tmpl.targetPos,
      sortOrder: tmpl.sortOrder || 0,
      isActive: tmpl.isActive,
    });
    setTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.chipLabel.trim() || !templateForm.messageText.trim()) {
      toast.error('Label dan isi teks pertanyaan wajib diisi.');
      return;
    }

    setSavingTemplate(true);
    try {
      const url = editingTemplate
        ? `/api/admin/chat/templates/${editingTemplate.id}`
        : '/api/admin/chat/templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm),
      });

      if (res.ok) {
        toast.success(editingTemplate ? 'Template berhasil diperbarui.' : 'Template baru berhasil ditambahkan.');
        setTemplateModalOpen(false);
        fetchTemplates();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal menyimpan template.');
      }
    } catch {
      toast.error('Terjadi kendala saat menyimpan template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = (tmpl) => {
    confirmDialog({
      title: 'Hapus Template Pertanyaan',
      message: `Apakah Anda yakin ingin menghapus template "${tmpl.chipLabel}"?`,
      confirmText: 'Hapus',
      cancelText: 'Batal',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/chat/templates/${tmpl.id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('Template berhasil dihapus.');
            fetchTemplates();
          }
        } catch {
          toast.error('Gagal menghapus template.');
        }
      },
    });
  };

  // ==========================================
  // HANDLERS TAB 3: PENGATURAN STATUS OPERASIONAL
  // ==========================================
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/chat/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast.success('Pengaturan chat & status operasional berhasil disimpan.');
        fetchSettings();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal menyimpan pengaturan.');
      }
    } catch {
      toast.error('Terjadi kendala saat menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Filter templates sesuai pos di Tab 2
  const filteredTemplates = templates.filter((t) => {
    if (templatePosFilter === 'ALL') return true;
    return t.targetPos === templatePosFilter;
  });

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadAdminCount || 0), 0);

  return (
    <div className={styles.container}>
      {/* Top Bar Header & Tab Navigation */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <div className={styles.titleArea}>
            <h1 className={styles.pageTitle}>Pusat Pesan & Live Chat</h1>
            <span
              className={`${styles.statusIndicator} ${
                settings.computedStatus === 'ONLINE'
                  ? styles.statusIndicatorOnline
                  : settings.computedStatus === 'AWAY'
                  ? styles.statusIndicatorAway
                  : styles.statusIndicatorOffline
              }`}
            >
              <span className={styles.statusDot} />
              {settings.computedStatus}
            </span>
          </div>
        </div>

        <div className={styles.tabsList}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'inbox' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            Obrolan Masuk
            {totalUnread > 0 && <span className={styles.tabBadge}>{totalUnread}</span>}
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'templates' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            Template Q&A & Balasan Cepat
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab('settings');
              fetchSettings();
            }}
          >
            Status & Jam Kerja
          </button>
        </div>
      </div>

      {/* ========================================================
          TAB 1: INBOX OBROLAN
          ======================================================== */}
      {activeTab === 'inbox' && (
        <div className={`${styles.inboxLayout} ${selectedId ? styles.inboxLayoutActiveChat : ''}`}>
          {/* Kolom Kiri: Daftar Percakapan */}
          <div className={styles.convoSidebar}>
            <div className={styles.convoFilterBar}>
              <input
                type="text"
                placeholder="Cari pelanggan / email..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className={styles.filterChips}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${statusFilter === 'ALL' ? styles.filterChipActive : ''}`}
                  onClick={() => setStatusFilter('ALL')}
                >
                  Semua
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${statusFilter === 'OPEN' ? styles.filterChipActive : ''}`}
                  onClick={() => setStatusFilter('OPEN')}
                >
                  Terbuka
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${statusFilter === 'CLOSED' ? styles.filterChipActive : ''}`}
                  onClick={() => setStatusFilter('CLOSED')}
                >
                  Selesai
                </button>
              </div>
            </div>

            <ul className={styles.convoList}>
              {loadingConvos ? (
                <li className={styles.emptyConversationState}>
                  Memuat obrolan...
                </li>
              ) : conversations.length === 0 ? (
                <li className={styles.emptyConversationState}>
                  Belum ada pesan pelanggan.
                </li>
              ) : (
                conversations.map((c) => {
                  const isSelected = c.id === selectedId;

                  return (
                    <li
                      key={c.id}
                      className={`${styles.convoItem} ${isSelected ? styles.convoItemActive : ''}`}
                      onClick={() => handleSelectConversation(c.id)}
                    >
                      <UserAvatar
                        user={{
                          name: c.customerName,
                          avatarUrl: c.avatarUrl,
                        }}
                        size="md"
                        className={styles.convoAvatar}
                        fallback={c.isGuest ? 'TM' : (c.customerName || 'CS').slice(0, 2).toUpperCase()}
                      />
                      <div className={styles.convoContent}>
                        <div className={styles.convoHeader}>
                          <span className={styles.convoName}>{c.customerName}</span>
                          <span className={styles.convoTime}>{formatRelativeTime(c.lastMessageAt)}</span>
                        </div>
                        <p className={styles.convoPreview}>
                          {c.lastSenderRole === 'ADMIN' ? 'Anda: ' : ''}
                          {c.lastMessagePreview || 'Percakapan baru'}
                        </p>
                        <div className={styles.convoMetaRow}>
                          {c.isGuest ? (
                            <span className={styles.guestBadge}>Tamu</span>
                          ) : (
                            <span className={styles.convoEmail}>
                              {c.customerEmail}
                            </span>
                          )}
                          {c.unreadAdminCount > 0 && (
                            <span className={styles.unreadCount}>{c.unreadAdminCount}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Kolom Tengah: Thread Pesan */}
          <div className={styles.chatArea}>
            {selectedId && activeConvo ? (
              <>
                {/* Header Obrolan Aktif */}
                <div className={styles.chatHeader}>
                  <div className={styles.chatHeaderLeft}>
                    <UserAvatar
                      user={{
                        name: activeConvo.customerName,
                        avatarUrl: activeConvo.avatarUrl,
                      }}
                      size="md"
                      className={styles.headerAvatar}
                      fallback={activeConvo.isGuest ? 'TM' : (activeConvo.customerName || 'CS').slice(0, 2).toUpperCase()}
                    />
                    <div>
                      <h2 className={styles.chatHeaderName}>{activeConvo.customerName}</h2>
                      <div className={styles.chatHeaderSubtitle}>
                        {activeConvo.isGuest ? 'Pengunjung Tanpa Akun (Tamu)' : activeConvo.customerEmail}
                        {activeConvo.customerPhone ? ` • ${activeConvo.customerPhone}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className={styles.chatHeaderActions}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${
                        activeConvo.status === 'OPEN' ? styles.actionBtnResolve : ''
                      }`}
                      onClick={handleToggleStatus}
                    >
                      {activeConvo.status === 'OPEN' ? 'Tandai Selesai' : 'Buka Kembali'}
                    </button>
                  </div>
                </div>

                {/* Bilah Seleksi Pesan Ala WhatsApp */}
                {isSelectionMode && (
                  <div className={styles.selectionBar}>
                    <div className={styles.selectionBarLeft}>
                      <button
                        type="button"
                        className={styles.selectionCloseBtn}
                        onClick={handleExitSelectMode}
                        title="Batal memilih (Esc)"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                      <span className={styles.selectionCount}>
                        {selectedIds.size} pesan dipilih
                      </span>
                    </div>
                    <div className={styles.selectionBarRight}>
                      <button
                        type="button"
                        className={styles.selectionActionBtn}
                        onClick={handleCopySelected}
                        disabled={selectedIds.size === 0}
                        title="Salin pesan terpilih"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Salin</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.selectionActionBtn} ${styles.selectionDeleteBtn}`}
                        onClick={handleTriggerBatchDelete}
                        disabled={selectedIds.size === 0}
                        title="Hapus pesan terpilih"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Pesan Berjalan */}
                <div className={styles.messagesScroll}>
                  {loadingMessages ? (
                    <div className={styles.emptyConversationState}>Memuat pesan...</div>
                  ) : messages.length === 0 ? (
                    <div className={styles.emptyConversationState}>Belum ada riwayat pesan.</div>
                  ) : (
                    messages.map((m, idx) => {
                      const isAdmin = m.senderRole === 'ADMIN';
                      const isSelected = selectedIds.has(m.id);
                      const isMenuOpen = activeMenuMessageId === m.id;
                      const isDeleted = !!m.isDeleted;
                      const isEdited = !!m.isEdited;
                      const canEdit = !isDeleted && isAdmin;
                      const canDelete = !isDeleted;

                      let metaObj = null;
                      if (!isDeleted && m.attachedMeta) {
                        if (typeof m.attachedMeta === 'object') {
                          metaObj = m.attachedMeta;
                        } else {
                          try {
                            metaObj = JSON.parse(m.attachedMeta);
                          } catch {
                            metaObj = null;
                          }
                        }
                      }

                      return (
                        <div
                          key={`${m.id || 'msg'}-${idx}`}
                          className={`${styles.bubbleRow} ${
                            isAdmin ? styles.bubbleRowAdmin : styles.bubbleRowCustomer
                          } ${isSelectionMode ? styles.bubbleRowSelectMode : ''} ${
                            isSelected ? styles.bubbleRowSelected : ''
                          }`}
                          onClick={() => {
                            if (isSelectionMode && m.id) {
                              handleToggleSelect(m.id);
                            }
                          }}
                        >
                          {/* Lingkaran seleksi pesan WhatsApp */}
                          {isSelectionMode && (
                            <div
                              className={`${styles.selectCheckbox} ${
                                isSelected ? styles.selectCheckboxActive : ''
                              }`}
                            >
                              {isSelected && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          )}

                          {!isAdmin && (
                            <UserAvatar
                              user={{
                                name: activeConvo.customerName,
                                avatarUrl: activeConvo.avatarUrl,
                              }}
                              size="xs"
                              className={styles.msgAvatarCustomer}
                              fallback={activeConvo.isGuest ? 'TM' : (activeConvo.customerName || 'CS').slice(0, 2).toUpperCase()}
                            />
                          )}

                          <div
                            className={`${styles.bubble} ${
                              isAdmin ? styles.bubbleAdmin : styles.bubbleCustomer
                            }`}
                          >
                            {/* Tombol Trigger Opsi Pesan WhatsApp */}
                            {!isSelectionMode && m.id && (
                              <button
                                type="button"
                                className={`${styles.bubbleTriggerBtn} ${
                                  isMenuOpen ? styles.bubbleTriggerBtnActive : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuMessageId(isMenuOpen ? null : m.id);
                                }}
                                title="Opsi pesan"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                            )}

                            {/* Dropdown Menu Popover WhatsApp */}
                            {isMenuOpen && (
                              <div
                                className={styles.bubbleMenuDropdown}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {canEdit && (
                                  <button
                                    type="button"
                                    className={styles.bubbleMenuItem}
                                    onClick={() => handleStartEdit(m)}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    <span>Edit Pesan</span>
                                  </button>
                                )}

                                {!isDeleted && (
                                  <button
                                    type="button"
                                    className={styles.bubbleMenuItem}
                                    onClick={() => handleCopyMessage(m.message)}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    <span>Salin Teks</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className={styles.bubbleMenuItem}
                                  onClick={() => handleEnterSelectMode(m.id)}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 11l3 3L22 4" />
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                  </svg>
                                  <span>Pilih Pesan</span>
                                </button>

                                {canDelete && (
                                  <button
                                    type="button"
                                    className={`${styles.bubbleMenuItem} ${styles.bubbleMenuItemDanger}`}
                                    onClick={() => handleTriggerSingleDelete(m.id)}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                    <span>Hapus Pesan</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Teks Pesan / Status Hapus */}
                            {isDeleted ? (
                              <div className={styles.deletedMessage}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                                <span>Pesan ini telah dihapus</span>
                              </div>
                            ) : (
                              <div>{m.message}</div>
                            )}

                            {/* Lampiran Kartu Produk */}
                            {!isDeleted && m.attachedType === 'PRODUCT' && metaObj && (
                              <div className={styles.attachedCard}>
                                {metaObj.image && (
                                  <Image
                                    src={metaObj.image}
                                    alt={metaObj.name || 'Produk'}
                                    width={44}
                                    height={44}
                                    className={styles.attachedThumb}
                                  />
                                )}
                                <div className={styles.attachedInfo}>
                                  <div className={styles.attachedTitle}>{metaObj.name}</div>
                                  <div className={styles.attachedSub}>
                                    {formatCurrency(metaObj.price)}
                                    {metaObj.selectedSize ? ` • Size: ${metaObj.selectedSize}` : ''}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Lampiran Info Pesanan Shopee-Style */}
                            {!isDeleted && m.attachedType === 'ORDER' && metaObj && (
                              <div className={styles.orderBannerCard}>
                                {metaObj.image ? (
                                  <Image
                                    src={metaObj.image}
                                    alt={metaObj.itemName || 'Pesanan'}
                                    width={48}
                                    height={48}
                                    className={styles.orderBannerImg}
                                  />
                                ) : (
                                  <div className={styles.orderBannerIconBox}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                      <line x1="3" y1="6" x2="21" y2="6" />
                                      <path d="M16 10a4 4 0 0 1-8 0" />
                                    </svg>
                                  </div>
                                )}
                                <div className={styles.orderBannerInfo}>
                                  <div className={styles.orderBannerHeader}>
                                    <span className={styles.orderBannerCode}>
                                      #{String(metaObj.orderId || m.attachedId).slice(-6).toUpperCase()}
                                    </span>
                                    <span className={styles.orderBannerStatus}>
                                      {metaObj.status || '-'}
                                    </span>
                                  </div>
                                  <div className={styles.orderBannerTitle}>
                                    {metaObj.itemName || 'Rincian Pesanan Pelanggan'}
                                  </div>
                                  <div className={styles.orderBannerPrice}>
                                    Total: {formatCurrency(metaObj.total)}
                                  </div>
                                </div>
                                <Link
                                  href={`/admin/orders?highlightOrder=${metaObj.orderId || m.attachedId}`}
                                  className={styles.orderBannerBtn}
                                  title="Buka dan periksa pesanan ini di halaman Pesanan"
                                >
                                  Periksa ↗
                                </Link>
                              </div>
                            )}

                            <div className={styles.bubbleFooter}>
                              <span className={styles.bubbleTime}>{formatTime(m.createdAt)}</span>
                              {isEdited && !isDeleted && (
                                <span className={styles.bubbleEdited}>• diedit</span>
                              )}
                            </div>
                          </div>

                          {isAdmin && (
                            <UserAvatar
                              user={currentUser}
                              size="xs"
                              className={styles.msgAvatarAdmin}
                              fallback="AD"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Komposer Pesan Balasan */}
                <div className={styles.composerArea}>
                  {/* Banner Mode Edit Pesan ala WhatsApp */}
                  {editingMessage && (
                    <div className={styles.editingBanner}>
                      <div className={styles.editingBannerLeft}>
                        <div className={styles.editingBannerIcon}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </div>
                        <div className={styles.editingBannerContent}>
                          <span className={styles.editingBannerTitle}>Mengedit pesan</span>
                          <span className={styles.editingBannerPreview}>{editingMessage.message}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.editingCancelBtn}
                        onClick={handleCancelEdit}
                        title="Batal edit (Esc)"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Bilah Balasan Cepat Admin (Canned Answers) */}
                  {!editingMessage && quickReplies.length > 0 && (
                    <div className={styles.quickTemplatesBar}>
                      <span className={styles.quickTemplatesBarTitle}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        Balasan Cepat:
                      </span>
                      {quickReplies.slice(0, 8).map((qr) => (
                        <button
                          key={qr.id}
                          type="button"
                          className={styles.quickTemplateChip}
                          onClick={() => setReplyText((prev) => (prev ? `${prev} ${qr.answerText}` : qr.answerText))}
                          title={qr.answerText}
                        >
                          {qr.chipLabel}
                        </button>
                      ))}
                    </div>
                  )}

                  <form className={styles.composerForm} onSubmit={handleSendReply}>
                    <textarea
                      ref={replyInputRef}
                      rows={1}
                      className={styles.composerTextarea}
                      placeholder={
                        editingMessage
                          ? 'Perbarui pesan... (Enter untuk simpan, Esc untuk batal)'
                          : 'Ketik balasan admin... (Enter untuk kirim, Shift+Enter baris baru)'
                      }
                      value={replyText}
                      onChange={handleReplyTextChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim() || sending}
                      className={styles.sendBtn}
                    >
                      {sending ? 'Memproses...' : editingMessage ? 'Simpan' : 'Kirim'}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className={styles.emptyConversationState}>
                <svg className={styles.emptyStateIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <div className={styles.emptyStateTitle}>Pilih Obrolan untuk Memulai</div>
                <div className={styles.emptyStateSubtitle}>
                  Pilih salah satu pesan pelanggan di sebelah kiri untuk melihat riwayat dan membalas secara langsung.
                </div>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Detail Customer */}
          {activeConvo && (
            <div className={styles.customerSidebar}>
              <div className={styles.profileCard}>
                <UserAvatar
                  user={{
                    name: activeConvo.customerName,
                    avatarUrl: activeConvo.avatarUrl,
                  }}
                  size="xl"
                  className={styles.profileAvatarImg}
                  fallback={activeConvo.isGuest ? 'TM' : (activeConvo.customerName || 'CS').slice(0, 2).toUpperCase()}
                />
                <h3 className={styles.profileName}>{activeConvo.customerName}</h3>
                <div className={styles.profileEmail}>
                  {activeConvo.isGuest ? 'Tamu Tanpa Akun' : activeConvo.customerEmail}
                </div>
              </div>

              <div>
                <div className={styles.sidebarSectionTitle}>Informasi Pelanggan</div>
                <div className={styles.infoRows}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Status Akun</span>
                    <span className={styles.infoValue}>
                      {activeConvo.isGuest ? 'Guest' : 'Member Terdaftar'}
                    </span>
                  </div>
                  {activeConvo.customerPhone && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Telepon</span>
                      <span className={styles.infoValue}>{activeConvo.customerPhone}</span>
                    </div>
                  )}
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Total Order</span>
                    <span className={styles.infoValue}>{activeConvo.totalOrdersCount || 0} pesanan</span>
                  </div>
                </div>
              </div>

              {activeConvo.recentOrders && activeConvo.recentOrders.length > 0 && (
                <div>
                  <div className={styles.sidebarSectionTitle}>Pesanan Terakhir</div>
                  {activeConvo.recentOrders.map((ord) => (
                    <div key={ord.id} className={styles.orderItemCard}>
                      <div className={styles.orderItemRow}>
                        <Link
                          href={`/admin/orders?highlightOrder=${ord.id}`}
                          style={{ fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}
                          title="Buka dan sorot pesanan ini"
                        >
                          #{String(ord.id).slice(-6).toUpperCase()}
                        </Link>
                        <span style={{ fontWeight: 600 }}>{ord.status}</span>
                      </div>
                      <div className={styles.orderItemRow} style={{ color: 'var(--text-muted)' }}>
                        <span>{new Date(ord.createdAt).toLocaleDateString('id-ID')}</span>
                        <span>{formatCurrency(ord.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: KELOLA TEMPLATE PERTANYAAN
          ======================================================== */}
      {activeTab === 'templates' && (
        <div className={styles.templatesContainer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Kelola Template Pertanyaan & Jawaban Toko
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Pasangkan pertanyaan pelanggan dengan jawaban otomatis toko (auto-reply bot) yang juga berfungsi sebagai bilah Balasan Cepat Admin.
            </p>
          </div>

          <div className={styles.templatesTopRow}>
            <div className={styles.filterChips}>
              {['ALL', 'PRODUCT', 'VIP_GALLERY', 'CHECKOUT', 'GLOBAL'].map((pos) => (
                <button
                  key={pos}
                  type="button"
                  className={`${styles.filterChip} ${templatePosFilter === pos ? styles.filterChipActive : ''}`}
                  onClick={() => setTemplatePosFilter(pos)}
                >
                  {pos === 'ALL'
                    ? 'Semua Posisi'
                    : pos === 'PRODUCT'
                    ? 'Detail Produk'
                    : pos === 'VIP_GALLERY'
                    ? 'VIP Chamber'
                    : pos === 'CHECKOUT'
                    ? 'Checkout'
                    : 'Global / Umum'}
                </button>
              ))}
            </div>

            <button type="button" className={styles.addBtn} onClick={handleOpenAddTemplate}>
              + Tambah Template
            </button>
          </div>

          {loadingTemplates ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              Memuat template pertanyaan...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              Belum ada template pertanyaan untuk filter ini. Klik tombol Tambah Template untuk membuat baru.
            </div>
          ) : (
            <div className={styles.templatesGrid}>
              {filteredTemplates.map((t) => (
                <div key={t.id} className={styles.templateCard}>
                  <div className={styles.templateCardTop}>
                    <span className={styles.templateLabelBadge}>{t.chipLabel}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className={styles.posBadge}>{t.targetPos}</span>
                      <span className={t.isAutoReply ? styles.autoReplyBadgeSmall : styles.manualReplyBadgeSmall}>
                        {t.isAutoReply ? 'Auto-Reply' : 'Manual'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardQuestionBox}>
                    <span className={styles.cardSectionBadge}>Pertanyaan Pelanggan:</span>
                    <p className={styles.templateMessage}>{t.messageText}</p>
                  </div>

                  <div className={styles.cardAnswerBox}>
                    <span className={styles.cardSectionBadge}>Jawaban Toko / Balasan Cepat:</span>
                    <p className={styles.templateMessage}>
                      {t.answerText || <em style={{ color: 'var(--text-muted)' }}>(Belum ada jawaban otomatis)</em>}
                    </p>
                  </div>

                  <div className={styles.templateCardFooter}>
                    <div>
                      Status:{' '}
                      <strong style={{ color: t.isActive ? 'var(--status-success)' : 'var(--text-muted)' }}>
                        {t.isActive ? 'Aktif' : 'Nonaktif'}
                      </strong>
                    </div>

                    <div className={styles.templateActions}>
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => handleOpenEditTemplate(t)}
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteTemplate(t)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 3: PENGATURAN STATUS OPERASIONAL & JAM KERJA
          ======================================================== */}
      {activeTab === 'settings' && (
        <div className={styles.settingsContainer}>
          <form className={styles.settingsCard} onSubmit={handleSaveSettings}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Mode Status Admin</label>
              <select
                className={styles.formSelect}
                value={settings.adminStatus}
                onChange={(e) => setSettings({ ...settings, adminStatus: e.target.value })}
              >
                <option value="AUTO">Otomatis (Jam Operasional + Kehadiran Admin)</option>
                <option value="ONLINE">Paksa Selalu Online</option>
                <option value="AWAY">Sibuk / Sedang di Farm</option>
                <option value="OFFLINE">Toko Tutup / Offline</option>
              </select>

              <div className={styles.statusDetailCard}>
                <div className={styles.statusDetailRow}>
                  <span>Status Saat Ini (Dilihat Customer):</span>
                  <strong style={{
                    color: settings.computedStatus === 'ONLINE' ? 'var(--status-success)' : 'var(--text-muted)'
                  }}>
                    {settings.computedStatus === 'ONLINE' ? (
                      <><span className={styles.statusDotGreen} />ONLINE</>
                    ) : settings.computedStatus === 'AWAY' ? (
                      <><span className={styles.statusDotYellow} />SEDANG DI FARM</>
                    ) : (
                      <><span className={styles.statusDotGray} />OFFLINE</>
                    )}
                  </strong>
                </div>

                <div className={styles.statusDetailRow}>
                  <span>Deteksi Kehadiran Admin (Lifetime Presence):</span>
                  <span>
                    {settings.isRecentActive ? (
                      <><span className={styles.statusDotGreen} />Sesi Admin Aktif (Membuka Website)</>
                    ) : (
                      <><span className={styles.statusDotGray} />Tidak Ada Sesi Admin Aktif (&gt;3 menit / browser tertutup)</>
                    )}
                  </span>
                </div>

                {settings.adminLastActiveAt && (
                  <div className={styles.statusDetailRow}>
                    <span>Aktivitas Admin Terakhir:</span>
                    <span>{new Date(settings.adminLastActiveAt).toLocaleTimeString('id-ID')} WIB</span>
                  </div>
                )}

                <span className={styles.formHelper} style={{ marginTop: '4px' }}>
                  Pada mode Otomatis (AUTO), status akan <strong>ONLINE</strong> hanya jika saat ini berada di dalam jam operasional DAN ada admin yang sedang membuka website dengan sesi login aktif. Jika tab ditutup atau sesi login habis, status otomatis beralih ke <strong>OFFLINE</strong> dalam 3 menit.
                </span>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Jam Operasional Toko (WIB)</label>
              <div className={styles.timeRow}>
                <input
                  type="text"
                  placeholder="08:00"
                  className={styles.formInput}
                  style={{ width: '120px' }}
                  value={settings.operatingHoursStart}
                  onChange={(e) => setSettings({ ...settings, operatingHoursStart: e.target.value })}
                />
                <span>sampai</span>
                <input
                  type="text"
                  placeholder="21:00"
                  className={styles.formInput}
                  style={{ width: '120px' }}
                  value={settings.operatingHoursEnd}
                  onChange={(e) => setSettings({ ...settings, operatingHoursEnd: e.target.value })}
                />
              </div>
              <span className={styles.formHelper}>Format waktu 24 jam (JJ:MM) waktu Indonesia Barat.</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Pesan Otomatis saat Toko Tutup / Offline</label>
              <textarea
                rows={3}
                className={styles.formTextarea}
                value={settings.offlineMessage}
                onChange={(e) => setSettings({ ...settings, offlineMessage: e.target.value })}
              />
              <span className={styles.formHelper}>
                Pesan ini otomatis muncul ke customer saat mengirim chat di luar jam operasional.
              </span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nomor WhatsApp Darurat (Opsional)</label>
              <input
                type="text"
                placeholder="6281234567890"
                className={styles.formInput}
                value={settings.emergencyWaNumber || ''}
                onChange={(e) => setSettings({ ...settings, emergencyWaNumber: e.target.value })}
              />
              <span className={styles.formHelper}>
                Ditampilkan kepada customer saat offline untuk kasus mendesak seperti klaim garansi unboxing ikan lemas.
              </span>
            </div>

            <button type="submit" disabled={savingSettings} className={styles.saveSettingsBtn}>
              {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================
          MODAL TAMBAH / UBAH TEMPLATE PERTANYAAN
          ======================================================== */}
      {templateModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setTemplateModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingTemplate ? 'Ubah Template Pertanyaan & Jawaban' : 'Tambah Template Pertanyaan & Jawaban'}
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setTemplateModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Label Tombol / Chip</label>
                <input
                  type="text"
                  placeholder="Contoh: Garansi 100% DOA / Video Flaring"
                  className={styles.formInput}
                  value={templateForm.chipLabel}
                  onChange={(e) => setTemplateForm({ ...templateForm, chipLabel: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Target Posisi Halaman</label>
                <select
                  className={styles.formSelect}
                  value={templateForm.targetPos}
                  onChange={(e) => setTemplateForm({ ...templateForm, targetPos: e.target.value })}
                >
                  <option value="PRODUCT">Detail Produk (/produk/[id])</option>
                  <option value="VIP_GALLERY">VIP ✦ Gallery Chamber</option>
                  <option value="CHECKOUT">Halaman Keranjang & Checkout</option>
                  <option value="GLOBAL">Widget Mengambang Beranda / Umum</option>
                  <option value="ALL">Semua Posisi Halaman</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Teks Pertanyaan Pelanggan (Wajib)</label>
                <textarea
                  rows={2}
                  placeholder="Isi pertanyaan lengkap yang otomatis dikirim saat customer mengeklik template ini..."
                  className={styles.formTextarea}
                  value={templateForm.messageText}
                  onChange={(e) => setTemplateForm({ ...templateForm, messageText: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Teks Jawaban Toko / Balasan Cepat Admin (Disarankan)</label>
                <textarea
                  rows={3}
                  placeholder="Jawaban resmi toko yang otomatis dibalas sistem ke customer saat pertanyaan dipilih, dan juga muncul sebagai opsi Balasan Cepat Admin..."
                  className={styles.formTextarea}
                  value={templateForm.answerText}
                  onChange={(e) => setTemplateForm({ ...templateForm, answerText: e.target.value })}
                />
                <span className={styles.formHelper}>
                  Jawaban ini akan dibalas otomatis oleh bot toko jika opsi Auto-Reply di bawah diaktifkan.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className={styles.formGroup} style={{ flex: 1, minWidth: '140px' }}>
                  <label className={styles.formLabel}>Urutan Tampil (Sort Order)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={templateForm.sortOrder}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, sortOrder: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                </div>

                <div className={styles.formGroup} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                  <input
                    type="checkbox"
                    id="isAutoReplyToggle"
                    checked={templateForm.isAutoReply}
                    onChange={(e) => setTemplateForm({ ...templateForm, isAutoReply: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="isAutoReplyToggle" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    Auto-Reply Bot
                  </label>
                </div>

                <div className={styles.formGroup} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    checked={templateForm.isActive}
                    onChange={(e) => setTemplateForm({ ...templateForm, isActive: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="isActiveToggle" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    Aktif
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnCancel}
                  onClick={() => setTemplateModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" disabled={savingTemplate} className={styles.btnSubmit}>
                  {savingTemplate ? 'Menyimpan...' : 'Simpan Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminChatPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center' }}>Memuat live chat...</div>}>
      <AdminChatInner />
    </Suspense>
  );
}
