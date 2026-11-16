/**
 * Định dạng tiền tệ VND (VD: 150.000 ₫)
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return '0 ₫';
  }
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(numeric);
}

/**
 * Định dạng ngày giờ chuẩn Việt Nam (VD: 14/11/2026 22:30)
 */
export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Định dạng ngày (VD: 14/11/2026)
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Định dạng số lượng (bỏ số 0 thừa sau dấu phẩy)
 */
export function formatQuantity(qty: number | string | undefined | null): string {
  if (qty === undefined || qty === null || isNaN(Number(qty))) {
    return '0';
  }
  const numeric = typeof qty === 'string' ? parseFloat(qty) : qty;
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 4,
  }).format(numeric);
}
