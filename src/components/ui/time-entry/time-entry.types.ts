/**
 * Type definitions for the TimeEntry component
 */

export interface TimeEntryProps {
  value: Date | null;
  onChange: (date: Date) => void;
  className?: string;
  disabled?: boolean;
  minTime?: Date;
  maxTime?: Date;
  minuteStep?: number;
}
