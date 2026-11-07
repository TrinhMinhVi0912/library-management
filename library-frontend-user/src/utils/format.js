import dayjs from 'dayjs';
import 'dayjs/locale/vi.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const DATE_FORMAT = 'DD/MM/YYYY HH:mm';
const moneyFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.locale('vi');
dayjs.tz.setDefault(TIMEZONE);

export function formatDate(value, format = DATE_FORMAT) {
  if (value == null || value === '') return '—';

  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? dayjs.tz(value, TIMEZONE)
    : dayjs(value).tz(TIMEZONE);

  return date.isValid() ? date.locale('vi').format(format) : '—';
}

export function formatRelativeTime(value) {
  if (value == null || value === '') return '—';
  const date = dayjs(value);
  return date.isValid() ? date.locale('vi').fromNow() : '—';
}

export function formatMoney(value) {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? `${moneyFormatter.format(amount)}đ` : '—';
}

export { dayjs, TIMEZONE };
