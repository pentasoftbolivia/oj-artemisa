import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function createLookupMap(array, keyField, valueFormatter) {
  if (!Array.isArray(array)) return {};
  return array.reduce((acc, item) => {
    acc[item[keyField]] = typeof valueFormatter === 'function' ? valueFormatter(item) : item;
    return acc;
  }, {});
}

export function createOptionsList(array, valueKey, labelFormatter) {
  if (!Array.isArray(array)) return [];
  return array.map((item) => ({
    value: item[valueKey]?.toString() || "",
    label: typeof labelFormatter === 'function' ? labelFormatter(item) : item[labelFormatter] || String(item)
  }));
}
