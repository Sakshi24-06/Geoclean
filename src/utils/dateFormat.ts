/**
 * Safe, cross-browser date and time formatting utilities for GeoClean.
 * Gracefully handles null, undefined, invalid strings, timestamps, and options.
 * Returns fallback (default "N/A") on invalid or missing dates and never throws an exception.
 */

export function parseSafeDate(dateInput?: string | number | Date | null): Date | null {
  if (!dateInput) return null;
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Formats date and time safely (e.g. "10 Sep 2026, 02:30 PM")
 */
export function formatRequestDateTime(dateInput?: string | number | Date | null, fallback = 'N/A'): string {
  const d = parseSafeDate(dateInput);
  if (!d) return fallback;

  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    try {
      return d.toLocaleString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fallback;
    }
  }
}

/**
 * Formats date safely (e.g. "10 Sep 2026")
 */
export function formatRequestDate(dateInput?: string | number | Date | null, fallback = 'N/A'): string {
  const d = parseSafeDate(dateInput);
  if (!d) return fallback;

  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    try {
      return d.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return fallback;
    }
  }
}

/**
 * Formats short date (e.g. "10 Sep")
 */
export function formatShortDate(dateInput?: string | number | Date | null, fallback = 'N/A'): string {
  const d = parseSafeDate(dateInput);
  if (!d) return fallback;

  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
    }).format(d);
  } catch {
    return fallback;
  }
}
