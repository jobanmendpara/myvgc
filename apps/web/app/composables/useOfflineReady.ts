import type { OfflineReadyNotice } from '@/lib/offline-ready'

/** How long "Ready to use offline" stays before it closes on its own. */
export const READY_SHOWN_FOR = 8_000

/**
 * The offline notice on screen (DEV-246): set by the offline-ready plugin as the service worker
 * downloads the app's files on a device's first visit, and cleared when the User closes it.
 */
export const useOfflineReady = () => useState<OfflineReadyNotice>('offline-ready', () => 'none')

/** Whether the sync bar is at the bottom of the screen, so the notice sits above it. */
export const useSyncBarShown = () => useState('sync-bar-shown', () => false)
