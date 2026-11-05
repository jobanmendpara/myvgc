// Values kept per device in localStorage.

// Storage can throw (private windows, blocked site data); whatever was being kept
// then just lasts until the page is closed.
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore: see above.
  }
}
