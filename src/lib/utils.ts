import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createLookupMap<T extends Record<string, unknown>>(
  array: T[],
  keyField: keyof T,
  valueFormatter?: ((item: T) => unknown) | null
): Record<string, T | unknown> {
  if (!Array.isArray(array)) return {}
  return array.reduce((acc, item) => {
    const key = String(item[keyField])
    acc[key] = typeof valueFormatter === "function" ? valueFormatter(item) : item
    return acc
  }, {} as Record<string, T | unknown>)
}

export function createOptionsList<T extends Record<string, unknown>>(
  array: T[],
  valueKey: keyof T,
  labelFormatter: ((item: T) => string) | keyof T
): { value: string; label: string }[] {
  if (!Array.isArray(array)) return []
  return array.map((item) => ({
    value: String(item[valueKey] ?? ""),
    label:
      typeof labelFormatter === "function"
        ? labelFormatter(item)
        : String(item[labelFormatter] ?? item),
  }))
}
