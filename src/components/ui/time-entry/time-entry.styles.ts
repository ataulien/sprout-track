export const timeEntryStyles = {
  container: 'w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm',
  dropdownRow: 'grid grid-cols-2 gap-3 sm:grid-cols-3',
  dropdownGroup: 'flex min-w-0 flex-col gap-1',
  periodGroup: 'flex min-w-0 flex-col gap-1 col-span-2 sm:col-span-1',
  dropdownLabel: 'text-xs font-medium uppercase tracking-wide text-slate-500',
  select: 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:cursor-not-allowed disabled:opacity-60',
} as const;
