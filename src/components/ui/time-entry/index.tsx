'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/src/lib/utils';
import { TimeEntryProps } from './time-entry.types';
import { timeEntryStyles as styles } from './time-entry.styles';
import { useLocalization } from '@/src/context/localization';
import { formatTime, parseTimeInput, TimeFormat } from '@/src/lib/date-time';

import './time-entry.css';

const clampMinuteStep = (step?: number) => {
  if (!step || step < 1) return 1;
  if (step > 30) return 30;
  return step;
};

export function TimeEntry({
  value,
  onChange,
  className,
  disabled = false,
  minTime,
  maxTime,
  minuteStep = 1,
}: TimeEntryProps) {
  const { t, language } = useLocalization();
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('24h');
  const step = clampMinuteStep(minuteStep);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshTimeFormat = () => {
      const stored = localStorage.getItem('timeFormat');
      setTimeFormat(stored === '12h' ? '12h' : '24h');
    };

    refreshTimeFormat();
    window.addEventListener('settingsUpdated', refreshTimeFormat);
    return () => window.removeEventListener('settingsUpdated', refreshTimeFormat);
  }, []);

  const safeDate = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();

  const parsedTime = useMemo(() => {
    const formatted = formatTime(safeDate, { timeFormat }, { language });
    const parsed = parseTimeInput(formatted, { timeFormat }, { language });

    if (parsed) return parsed;

    const hours = safeDate.getHours();
    return {
      hours24: hours,
      minutes: safeDate.getMinutes(),
      period: hours >= 12 ? 'PM' : 'AM',
    };
  }, [language, safeDate, timeFormat]);

  const minuteOptions = useMemo(() => {
    const list: number[] = [];
    for (let minute = 0; minute < 60; minute += step) {
      list.push(minute);
    }
    return list;
  }, [step]);

  const hourOptions = useMemo(() => {
    if (timeFormat === '12h') {
      return Array.from({ length: 12 }, (_, index) => index + 1);
    }
    return Array.from({ length: 24 }, (_, index) => index);
  }, [timeFormat]);

  const isTimeValid = (date: Date): boolean => {
    if (minTime && date < minTime) return false;
    if (maxTime && date > maxTime) return false;
    return true;
  };

  const applyTimeChange = (hours24: number, minutes: number) => {
    if (disabled) return;

    const nextDate = new Date(safeDate);
    nextDate.setHours(hours24, minutes, 0, 0);

    if (isTimeValid(nextDate)) {
      onChange(nextDate);
    }
  };

  const handleHourChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const hourValue = Number(event.target.value);

    if (timeFormat === '24h') {
      applyTimeChange(hourValue, parsedTime.minutes);
      return;
    }

    const isPM = parsedTime.period === 'PM';
    const hours24 = isPM
      ? (hourValue === 12 ? 12 : hourValue + 12)
      : (hourValue === 12 ? 0 : hourValue);

    applyTimeChange(hours24, parsedTime.minutes);
  };

  const handleMinuteChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    applyTimeChange(parsedTime.hours24, Number(event.target.value));
  };

  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPeriod = event.target.value as 'AM' | 'PM';
    const currentHour12 = parsedTime.hours24 % 12 || 12;
    const hours24 = nextPeriod === 'PM'
      ? (currentHour12 === 12 ? 12 : currentHour12 + 12)
      : (currentHour12 === 12 ? 0 : currentHour12);

    applyTimeChange(hours24, parsedTime.minutes);
  };

  const selectedHour = timeFormat === '12h' ? (parsedTime.hours24 % 12 || 12) : parsedTime.hours24;

  return (
    <div className={cn(styles.container, 'time-entry-container', className)}>
      <div className={cn(styles.dropdownRow, 'time-entry-dropdown-row')}>
        <label className={cn(styles.dropdownGroup, 'time-entry-dropdown-group')}>
          <span className={cn(styles.dropdownLabel, 'time-entry-dropdown-label')}>{t('Hours')}</span>
          <select
            className={cn(styles.select, 'time-entry-select')}
            value={selectedHour}
            onChange={handleHourChange}
            disabled={disabled}
            aria-label={t('Select hour')}
          >
            {hourOptions.map(hour => (
              <option key={hour} value={hour}>
                {hour.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
        </label>

        <label className={cn(styles.dropdownGroup, 'time-entry-dropdown-group')}>
          <span className={cn(styles.dropdownLabel, 'time-entry-dropdown-label')}>{t('Minutes')}</span>
          <select
            className={cn(styles.select, 'time-entry-select')}
            value={parsedTime.minutes}
            onChange={handleMinuteChange}
            disabled={disabled}
            aria-label={t('Select minute')}
          >
            {minuteOptions.map(minute => (
              <option key={minute} value={minute}>
                {minute.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
        </label>

        {timeFormat === '12h' && (
          <label className={cn(styles.periodGroup, 'time-entry-dropdown-group')}>
            <span className={cn(styles.dropdownLabel, 'time-entry-dropdown-label')}>{t('Period')}</span>
            <select
              className={cn(styles.select, 'time-entry-select')}
              value={parsedTime.period}
              onChange={handlePeriodChange}
              disabled={disabled}
              aria-label={t('Select period')}
            >
              <option value="AM">{t('AM')}</option>
              <option value="PM">{t('PM')}</option>
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

export default TimeEntry;
