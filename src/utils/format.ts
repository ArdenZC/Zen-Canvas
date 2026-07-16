import type { Language } from "../i18n";

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value: string | null, language?: Language): string {
  if (!value) return "-";
  const numericValue = /^\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const locale = language === "zh" ? "zh-CN" : language === "en" ? "en-US" : undefined;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
