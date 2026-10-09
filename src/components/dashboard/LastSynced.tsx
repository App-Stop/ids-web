import { useFingercheckSyncStatus } from '../../hooks/useQueryHooks'
import type { FingercheckSyncKey } from '../../api/integrationApi'

/** "10-08-2026, 2:05 PM" in the viewer's own timezone. */
function formatSyncedAt(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const date = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}

/**
 * When Fingercheck last synced cleanly — sits above the sheet on each page.
 *
 * `source` is the sync that feeds the page's data. The crew-assignment sync can
 * be switched off server-side, so a source that has never run falls back to
 * the other one rather than reading as never synced.
 */
export default function LastSynced({ source }: { source: FingercheckSyncKey }) {
  const { data, isPending } = useFingercheckSyncStatus()
  const other: FingercheckSyncKey = source === 'timeEntries' ? 'crewAssignments' : 'timeEntries'
  const lastSuccessAt = data?.[source]?.lastSuccessAt ?? data?.[other]?.lastSuccessAt
  const syncedAt = lastSuccessAt ? formatSyncedAt(lastSuccessAt) : null

  return (
    <p className="last-synced">
      Last Synced : <span className="last-synced__time">{syncedAt ?? (isPending ? '…' : '-')}</span>
    </p>
  )
}
