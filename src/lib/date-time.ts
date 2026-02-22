export type TimeFormat = '24h' | '12h';
export type DateFormat = 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export interface DateTimePreferences {
  timeFormat?: TimeFormat;
  dateFormat?: DateFormat;
}

export interface DateTimeFormatOptions {
  locale?: string;
  timeZone?: string;
  language?: string;
}

export const DEFAULT_TIME_FORMAT: TimeFormat = '24h';
export const DEFAULT_DATE_FORMAT: DateFormat = 'MM/DD/YYYY';

export const getDefaultDateFormat = (language?: string): DateFormat => {
  if (!language) return DEFAULT_DATE_FORMAT;
  return language.toLowerCase().startsWith('fr') ? 'DD.MM.YYYY' : DEFAULT_DATE_FORMAT;
};

export const getDateTimePreferences = (
  preferences?: DateTimePreferences | null,
  language?: string
): Required<DateTimePreferences> => ({
  timeFormat: preferences?.timeFormat ?? DEFAULT_TIME_FORMAT,
  dateFormat: preferences?.dateFormat ?? getDefaultDateFormat(language),
});

const toDate = (input: string | Date | null | undefined): Date | null => {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const getDateParts = (date: Date, locale?: string, timeZone?: string) => {
  const formatter = new Intl.DateTimeFormat(locale ?? 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parts.find(part => part.type === 'year')?.value ?? '',
    month: parts.find(part => part.type === 'month')?.value ?? '',
    day: parts.find(part => part.type === 'day')?.value ?? '',
  };
};

export const formatTime = (
  input: string | Date | null | undefined,
  preferences?: DateTimePreferences | null,
  options?: DateTimeFormatOptions
): string => {
  const date = toDate(input);
  if (!date) return '';

  const { timeFormat } = getDateTimePreferences(preferences, options?.language);
  const formatter = new Intl.DateTimeFormat(options?.locale ?? 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
    timeZone: options?.timeZone,
  });

  return formatter.format(date);
};

export const formatDate = (
  input: string | Date | null | undefined,
  preferences?: DateTimePreferences | null,
  options?: DateTimeFormatOptions
): string => {
  const date = toDate(input);
  if (!date) return '';

  const { dateFormat } = getDateTimePreferences(preferences, options?.language);
  const { year, month, day } = getDateParts(date, options?.locale, options?.timeZone);

  if (dateFormat === 'YYYY-MM-DD') {
    return [year, month, day].join('-');
  }

  const ordered = dateFormat === 'DD.MM.YYYY' ? [day, month, year] : [month, day, year];
  return ordered.join('/');
};

export const formatDateTime = (
  input: string | Date | null | undefined,
  preferences?: DateTimePreferences | null,
  options?: DateTimeFormatOptions
): string => {
  const date = toDate(input);
  if (!date) return '';

  const datePart = formatDate(date, preferences, options);
  const timePart = formatTime(date, preferences, options);
  if (!datePart) return timePart;
  if (!timePart) return datePart;
  return `${datePart} ${timePart}`;
};


export interface ParsedTimeInput {
  hours24: number;
  minutes: number;
  period: 'AM' | 'PM';
}

export const parseTimeInput = (
  value: string | null | undefined,
  preferences?: DateTimePreferences | null,
  _options?: DateTimeFormatOptions
): ParsedTimeInput | null => {
  if (!value) return null;

  const normalized = value.trim().toUpperCase().replace(/ /g, ' ');
  const match = normalized.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(AM|PM)?/);
  if (!match) return null;

  const rawHour = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = match[3] as 'AM' | 'PM' | undefined;
  const { timeFormat } = getDateTimePreferences(preferences);

  if (!Number.isInteger(rawHour) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (timeFormat === '12h' || suffix) {
    if (rawHour < 1 || rawHour > 12) return null;
    const period: 'AM' | 'PM' = suffix ?? 'AM';
    const hours24 = period === 'PM'
      ? (rawHour === 12 ? 12 : rawHour + 12)
      : (rawHour === 12 ? 0 : rawHour);

    return { hours24, minutes, period };
  }

  if (rawHour < 0 || rawHour > 23) return null;

  return {
    hours24: rawHour,
    minutes,
    period: rawHour >= 12 ? 'PM' : 'AM',
  };
};
const resolveLocale = (options?: DateTimeFormatOptions): string => {
  if (options?.locale) return options.locale;
  if (options?.language) {
    if (options.language.toLowerCase().startsWith('fr')) return 'fr-FR';
    if (options.language.toLowerCase().startsWith('es')) return 'es-ES';
    if (options.language.toLowerCase().startsWith('de')) return 'de-DE';
    return 'en-US';
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
};

export const formatDuration = (
  durationMs: number | null | undefined,
  preferences?: DateTimePreferences | null,
  options?: DateTimeFormatOptions
): string => {
  if (durationMs === null || durationMs === undefined) return '';
  if (!Number.isFinite(durationMs)) return '';
  if (durationMs < 0) return '';

  const totalMinutes = Math.round(durationMs / 60000);
  if (totalMinutes < 60) {
    const locale = resolveLocale(options);
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'minute',
      unitDisplay: 'short',
    }).format(totalMinutes);
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

export const parseDateInput = (
  value: string | null | undefined,
  preferences?: DateTimePreferences | null,
  options?: DateTimeFormatOptions
): Date | null => {
  if (!value) return null;
  const { dateFormat } = getDateTimePreferences(preferences, options?.language);

  const separator = dateFormat === 'YYYY-MM-DD' ? '-' : '/';
  const parts = value.split(separator).map(part => part.trim());
  if (parts.length !== 3) return null;

  let year: number;
  let month: number;
  let day: number;

  if (dateFormat === 'YYYY-MM-DD') {
    [year, month, day] = parts.map(Number);
  } else if (dateFormat === 'DD.MM.YYYY') {
    [day, month, year] = parts.map(Number);
  } else {
    [month, day, year] = parts.map(Number);
  }

  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return isNaN(parsed.getTime()) ? null : parsed;
};
