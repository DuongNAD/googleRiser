/**
 * Vietnamese Formatting Utilities for SME AutoPilot
 */

export function formatVietnameseCurrency(amountVnd: number): string {
  if (isNaN(amountVnd) || amountVnd === null || amountVnd === undefined) {
    return '0 ₫';
  }

  // Handle extreme billions (tỷ)
  if (Math.abs(amountVnd) >= 1_000_000_000) {
    const billions = amountVnd / 1_000_000_000;
    // Format as 10 tỷ ₫ or 1.5 tỷ ₫
    return `${billions.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫`;
  }

  return `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`;
}

export function formatDateTimeVi(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return isoString;
  }
}

export function formatRelativeTimeVi(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${Math.max(1, diffSec)} giây trước`;
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    return `${diffDay} ngày trước`;
  } catch {
    return isoString;
  }
}

export function formatPhoneNumberVi(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}
