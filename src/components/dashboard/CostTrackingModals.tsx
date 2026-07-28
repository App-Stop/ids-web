import { useMemo, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import type { Job } from '../../lib/dashboardData'

export interface CostEntryData {
  jobId: string | null
  date: string
  laborCost: number
  dumpstersCount: number
  eachCost: number
  note: string
}

interface CostEntryModalProps {
  title: string
  submitLabel: string
  jobs: Job[]
  initial?: Partial<CostEntryData>
  onCancel: () => void
  onSubmit: (data: CostEntryData) => void
}

function useCostEntryState(initial?: Partial<CostEntryData>) {
  return useState<CostEntryData>({
    jobId: initial?.jobId ?? null,
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    laborCost: initial?.laborCost ?? 0,
    dumpstersCount: initial?.dumpstersCount ?? 1,
    eachCost: initial?.eachCost ?? 0,
    note: initial?.note ?? '',
  })
}

function CostEntryModal({ title, submitLabel, jobs, initial, onCancel, onSubmit }: CostEntryModalProps) {
  const [form, setForm] = useCostEntryState(initial)
  const selectedJob = useMemo(() => jobs.find((job) => job.id === form.jobId), [form.jobId, jobs])
  const canSubmit = Boolean(form.jobId && form.date.trim())
  const totalCost = form.laborCost > 0 ? form.laborCost : form.dumpstersCount * form.eachCost

  return (
    <Modal onClose={onCancel} width={560}>
      <div className="modal-head-row">
        <h2 className="modal-title">{title}</h2>
        {selectedJob && <span className="job-head__meta">#{selectedJob.bidNo}</span>}
      </div>

      <label className="field-label">Job</label>
      <Dropdown
        value={form.jobId}
        placeholder="-"
        onChange={(jobId) => setForm((prev) => ({ ...prev, jobId }))}
        selectedLabel={selectedJob?.name}
        options={jobs.map((job) => ({ id: job.id, label: job.name }))}
      />

      <label className="field-label">Date*</label>
      <input
        type="date"
        className="field-input"
        value={form.date}
        onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
      />

      <div className="field-row">
        {submitLabel === 'Update Entry' ? (
          <div>
            <label className="field-label">Labor Cost*</label>
            <div className="field-money">
              <span>$</span>
              <input
                type="number"
                value={form.laborCost}
                onChange={(e) => setForm((prev) => ({ ...prev, laborCost: Number(e.target.value) }))}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="field-label">Dumpsters Count*</label>
            <input
              className="field-input"
              type="number"
              min={1}
              value={form.dumpstersCount}
              onChange={(e) => setForm((prev) => ({ ...prev, dumpstersCount: Number(e.target.value) }))}
            />
          </div>
        )}
        {submitLabel === 'Update Entry' ? (
          <div>
            <label className="field-label">Dumpsters Count*</label>
            <input
              className="field-input"
              type="number"
              min={1}
              value={form.dumpstersCount}
              onChange={(e) => setForm((prev) => ({ ...prev, dumpstersCount: Number(e.target.value) }))}
            />
          </div>
        ) : (
          <div>
            <label className="field-label">Each Cost*</label>
            <div className="field-money">
              <span>$</span>
              <input
                type="number"
                value={form.eachCost}
                onChange={(e) => setForm((prev) => ({ ...prev, eachCost: Number(e.target.value) }))}
              />
            </div>
          </div>
        )}
      </div>

      {submitLabel === 'Add Entry' && (
        <>
          <label className="field-label">Add a note</label>
          <textarea
            className="field-textarea field-textarea--tall"
            placeholder="30 yard, fuel, etc"
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
          />
        </>
      )}

      <div className="jm-total-row">
        <span>Total Cost</span>
        <strong>${totalCost.toLocaleString('en-US')}</strong>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={!canSubmit} onClick={() => onSubmit(form)}>
          {submitLabel}
        </button>
      </div>
    </Modal>
  )
}

export function EditAccumulatedCostModal(props: {
  jobs: Job[]
  initial?: Partial<CostEntryData>
  onCancel: () => void
  onSubmit: (data: CostEntryData) => void
}) {
  return <CostEntryModal title="Edit Accumulated Cost" submitLabel="Update Entry" {...props} />
}

export function AddDailyDumpsterCountModal(props: {
  jobs: Job[]
  initial?: Partial<CostEntryData>
  onCancel: () => void
  onSubmit: (data: CostEntryData) => void
}) {
  return <CostEntryModal title="Add Daily Dumpster Count" submitLabel="Add Entry" {...props} />
}
