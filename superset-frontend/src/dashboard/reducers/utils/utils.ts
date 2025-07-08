export function safeJSONParse<T>(value: string | null): T | null {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getFromStorage<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  return safeJSONParse<T>(value) ?? fallback;
}
