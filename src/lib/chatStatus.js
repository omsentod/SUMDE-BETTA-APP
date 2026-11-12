// src/lib/chatStatus.js
// Utility terpusat untuk kalkulasi jam operasional dan status online/offline admin

// Batas toleransi heartbeat admin (2 menit = 120.000 ms).
// Jika tidak ada ping dari admin dalam 2 menit, status otomatis dianggap offline/sesi habis.
export const HEARTBEAT_TTL_MS = 2 * 60 * 1000;

export function getWibTime() {
  const now = new Date();
  // Formatter untuk zona waktu Asia/Jakarta (WIB: UTC+7)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}

export function computeChatStatus(setting) {
  if (!setting) {
    return {
      adminStatus: 'AUTO',
      computedStatus: 'OFFLINE',
      statusReason: 'NO_SETTING',
      isRecentActive: false,
      currentWibTime: getWibTime(),
      operatingHoursStart: '08:00',
      operatingHoursEnd: '21:00',
      offlineMessage: '',
      emergencyWaNumber: null,
      adminLastActiveAt: null,
    };
  }

  const currentWibTime = getWibTime();
  const isRecentActive = Boolean(
    setting.adminLastActiveAt &&
      Date.now() - new Date(setting.adminLastActiveAt).getTime() < HEARTBEAT_TTL_MS
  );

  const startHour = setting.operatingHoursStart || '08:00';
  const endHour = setting.operatingHoursEnd || '21:00';

  const isWithinHours = currentWibTime >= startHour && currentWibTime <= endHour;

  let computedStatus = setting.adminStatus || 'AUTO';
  let statusReason = 'MANUAL_OVERRIDE';

  if (setting.adminStatus === 'AUTO') {
    if (!isWithinHours) {
      computedStatus = 'OFFLINE';
      statusReason = 'OUTSIDE_OPERATING_HOURS';
    } else if (isRecentActive) {
      computedStatus = 'ONLINE';
      statusReason = 'ADMIN_ACTIVE_IN_OPERATING_HOURS';
    } else {
      computedStatus = 'OFFLINE';
      statusReason = 'ADMIN_SESSION_INACTIVE';
    }
  }

  return {
    adminStatus: setting.adminStatus || 'AUTO',
    computedStatus,
    statusReason,
    isRecentActive,
    adminLastActiveAt: setting.adminLastActiveAt,
    currentWibTime,
    operatingHoursStart: startHour,
    operatingHoursEnd: endHour,
    offlineMessage: setting.offlineMessage || '',
    emergencyWaNumber: setting.emergencyWaNumber || null,
  };
}
