import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import MenuDropdown from './MenuDropdown'
import { type JobItem } from '../../api/jobApi'
import { useJobsList } from '../../hooks/useQueryHooks'
import { createDumpsterCost, getCostAdjustment, adjustCost, type DumpsterCostItem } from '../../api/dumpsterCostApi'
import { parseApiErrors } from '../../lib/errors'

export interface DumpsterCostModalProps {
  onCancel: () => void
  onSuccess?: (newEntry: DumpsterCostItem) => void
}

export function AddDailyDumpsterCountModal({ onCancel, onSuccess }: DumpsterCostModalProps) {
  const { data: jobs = [], isPending: loadingJobs } = useJobsList({ limit: 100 })

  const [jobId, setJobId] = useState<string | null>(null)
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [dumpsterCount, setDumpsterCount] = useState<string>('0')
  const [dumpsterCost, setDumpsterCost] = useState<string>('600')

  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string>('')

  const selectedJob = useMemo(() => jobs.find((j: JobItem) => j._id === jobId), [jobs, jobId])
  const parsedCount = Number(dumpsterCount) || 0
  const parsedCost = Number(dumpsterCost) || 0
  const calculatedTotalCost = (parsedCount > 0 && parsedCost > 0) ? parsedCount * parsedCost : 0

  const canSubmit = Boolean(jobId && date.trim() && dumpsterCount !== '' && dumpsterCost !== '' && !submitting)

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
          <div className="stepper-input">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => setDumpsterCount(String(Math.max(0, (Number(dumpsterCount) || 0) - 1)))}
              disabled={(Number(dumpsterCount) || 0) <= 0}
            >
              -
            </button>
            <input
              className="field-input stepper-field"
              type="number"
              min={0}
              value={dumpsterCount}
              onChange={(e) => setDumpsterCount(e.target.value)}
              placeholder="0"
            />
            <button
              type="button"
              className="stepper-btn"
              onClick={() => setDumpsterCount(String((Number(dumpsterCount) || 0) + 1))}
            >
              +
            </button>
          </div>
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
              placeholder="600"
            />
          </div>
        </div>
      </div>

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

export interface EditCostAdjustmentModalProps {
  jobId: string
  jobName?: string
  jobIdNumber?: number
  date: string
  onCancel: () => void
  onSuccess?: () => void
}

export function EditCostAdjustmentModal({
  jobId,
  jobName,
  jobIdNumber,
  date: initialDate,
  onCancel,
  onSuccess,
}: EditCostAdjustmentModalProps) {
  const [date, setDate] = useState<string>(initialDate)
  const [laborCost, setLaborCost] = useState<string>('0')
  const [dumpsterCount, setDumpsterCount] = useState<string>('0')
  const [dumpsterCost, setDumpsterCost] = useState<string>('600')
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [apiError, setApiError] = useState<string>('')

  useEffect(() => {
    let isMounted = true
    async function loadAdjustment() {
      setLoading(true)
      setApiError('')
      try {
        const res = await getCostAdjustment(jobId, date)
        if (isMounted && res.success && res.data) {
          setLaborCost(String(res.data.laborCost ?? 0))
          setDumpsterCount(String(res.data.dumpsterCount ?? 0))
          setDumpsterCost(String(res.data.dumpsterCost ? res.data.dumpsterCost : 600))
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to fetch cost adjustment:', err)
          setApiError(parseApiErrors(err).generalMessage || 'Failed to load cost details.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadAdjustment()
    return () => {
      isMounted = false
    }
  }, [jobId, date])

  const parsedLaborCost = Number(laborCost) || 0
  const parsedCount = Number(dumpsterCount) || 0
  const parsedDumpsterCost = Number(dumpsterCost) || 0
  const totalCost = parsedLaborCost + parsedCount * parsedDumpsterCost

  const canSubmit = Boolean(jobId && date.trim() && !submitting && !loading)

  async function handleSubmit() {
    if (!canSubmit) return

    setSubmitting(true)
    setApiError('')

    try {
      const response = await adjustCost({
        jobId,
        date,
        laborCost: parsedLaborCost,
        dumpsterCount: parsedCount,
        dumpsterCost: parsedDumpsterCost,
      })

      if (response.success) {
        if (onSuccess) onSuccess()
        onCancel()
      } else {
        setApiError(response.message || 'Failed to save cost adjustment.')
      }
    } catch (err: any) {
      console.error('Adjust cost error:', err)
      const parsed = parseApiErrors(err)
      const msg =
        parsed.generalMessage ||
        Object.values(parsed.fieldErrors).join(', ') ||
        err.response?.data?.message ||
        err.message ||
        'An error occurred while saving cost adjustment.'
      setApiError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onCancel} width={560}>
      <div className="modal-head-row">
        <h2 className="modal-title">Edit Accumulated Cost</h2>
        {jobIdNumber ? <span className="job-head__meta">#{jobIdNumber}</span> : null}
      </div>

      {jobName ? (
        <div style={{ marginBottom: '16px', fontWeight: 600, fontSize: '15px' }}>
          {jobName}
        </div>
      ) : null}

      <label className="field-label">Date*</label>
      <input
        type="date"
        className="field-input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={loading || submitting}
      />

      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)' }}>
          Loading cell cost details...
        </div>
      ) : (
        <>
          <div className="field-row">
            <div>
              <label className="field-label">Labor Cost*</label>
              <div className="field-money">
                <span>$</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="field-label">Dumpsters Count*</label>
              <div className="stepper-input">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setDumpsterCount(String(Math.max(0, (Number(dumpsterCount) || 0) - 1)))}
                  disabled={(Number(dumpsterCount) || 0) <= 0}
                >
                  -
                </button>
                <input
                  className="field-input stepper-field"
                  type="number"
                  min={0}
                  value={dumpsterCount}
                  onChange={(e) => setDumpsterCount(e.target.value)}
                  placeholder="0"
                />
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setDumpsterCount(String((Number(dumpsterCount) || 0) + 1))}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="field-row" style={{ marginTop: '12px' }}>
            <div>
              <label className="field-label">Dumpster Unit Cost*</label>
              <div className="field-money">
                <span>$</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={dumpsterCost}
                  onChange={(e) => setDumpsterCost(e.target.value)}
                  placeholder="600"
                />
              </div>
            </div>
          </div>

          <div className="jm-total-row" style={{ marginTop: '20px' }}>
            <span>Total Cost</span>
            <strong>${totalCost.toLocaleString('en-US')}</strong>
          </div>
        </>
      )}

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
          {submitting ? 'Updating...' : 'Update Entry'}
        </button>
      </div>
    </Modal>
  )
}

