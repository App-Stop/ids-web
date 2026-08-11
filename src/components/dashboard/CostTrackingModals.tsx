import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import MenuDropdown from './MenuDropdown'
import { getJobs, type JobItem } from '../../api/jobApi'
import { createDumpsterCost, type DumpsterCostItem } from '../../api/dumpsterCostApi'
import { parseApiErrors } from '../../lib/errors'

export interface DumpsterCostModalProps {
  onCancel: () => void
  onSuccess?: (newEntry: DumpsterCostItem) => void
}

export function AddDailyDumpsterCountModal({ onCancel, onSuccess }: DumpsterCostModalProps) {
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)

  const [jobId, setJobId] = useState<string | null>(null)
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [dumpsterCount, setDumpsterCount] = useState<string>('1')
  const [dumpsterCost, setDumpsterCost] = useState<string>('')
  const [note, setNote] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string>('')

  useEffect(() => {
    let isMounted = true
    async function loadJobs() {
      setLoadingJobs(true)
      try {
        const res = await getJobs({ limit: 100 })
        if (isMounted && res.data) {
          setJobs(res.data)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load jobs:', err)
        }
      } finally {
        if (isMounted) setLoadingJobs(false)
      }
    }
    loadJobs()
    return () => {
      isMounted = false
    }
  }, [])

  const selectedJob = useMemo(() => jobs.find((j) => j._id === jobId), [jobs, jobId])
  const parsedCount = Number(dumpsterCount)
  const parsedCost = Number(dumpsterCost)
  const calculatedTotalCost = (parsedCount > 0 && parsedCost > 0) ? parsedCount * parsedCost : 0

  const canSubmit = Boolean(jobId && date.trim() && dumpsterCount && dumpsterCost && !submitting)

  async function handleSubmit() {
    if (!canSubmit || !jobId) return

    setSubmitting(true)
    setApiError('')

    try {
      const payload = {
        jobId,
        date,
        dumpsterCount: parsedCount,
        dumpsterCost: parsedCost,
        ...(note.trim() ? { note: note.trim() } : {}),
      }

      const response = await createDumpsterCost(payload)
      if (response.success) {
        if (onSuccess) {
          onSuccess(response.data)
        }
        onCancel()
      } else {
        setApiError(response.message || 'Failed to create dumpster cost entry.')
      }
    } catch (err: any) {
      console.error('Create dumpster cost error:', err)
      const parsed = parseApiErrors(err)
      const msg = parsed.generalMessage || Object.values(parsed.fieldErrors).join(', ') || err.response?.data?.message || err.message || 'An error occurred while creating dumpster cost.'
      setApiError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const jobOptions = useMemo(
    () => jobs.map((job) => ({ id: job._id, label: job.name })),
    [jobs],
  )

  return (
    <Modal onClose={onCancel} width={560}>
      <div className="modal-head-row">
        <h2 className="modal-title">Add Daily Dumpster Count</h2>
        {selectedJob && <span className="job-head__meta">#{selectedJob.jobIdNumber}</span>}
      </div>

      <label className="field-label">Job*</label>
      <MenuDropdown
        options={jobOptions}
        value={jobId}
        onChange={(id) => setJobId(id)}
        placeholder={loadingJobs ? 'Loading jobs...' : 'Select job'}
        includeAll={false}
        showDot={false}
        className="ct-modal-dropdown"
      />

      <label className="field-label">Date*</label>
      <input
        type="date"
        className="field-input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <div className="field-row">
        <div>
          <label className="field-label">Dumpsters Count*</label>
          <input
            className="field-input"
            type="number"
            min={1}
            value={dumpsterCount}
            onChange={(e) => setDumpsterCount(e.target.value)}
            placeholder="1"
          />
        </div>
        <div>
          <label className="field-label">Dumpster Cost*</label>
          <div className="field-money">
            <span>$</span>
            <input
              type="number"
              min={0}
              step="any"
              value={dumpsterCost}
              onChange={(e) => setDumpsterCost(e.target.value)}
              placeholder="500"
            />
          </div>
        </div>
      </div>

      <label className="field-label">Add a note</label>
      <textarea
        className="field-textarea field-textarea--tall"
        placeholder="30 yard, fuel, etc"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="jm-total-row">
        <span>Total Cost</span>
        <strong>${calculatedTotalCost.toLocaleString('en-US')}</strong>
      </div>

      {apiError && (
        <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>
          {apiError}
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? 'Adding...' : 'Add Entry'}
        </button>
      </div>
    </Modal>
  )
}

