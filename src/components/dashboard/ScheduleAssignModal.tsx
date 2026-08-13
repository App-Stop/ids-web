import { useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import ConfirmModal from './ConfirmModal'
import { crewColorFor } from '../../lib/scheduleData'
import type { CrewSummaryItem } from '../../api/crewApi'
import type { CrewAssignment } from '../../api/jobApi'

export interface StintDraft {
  crewId: string
  startDate: string
  /** Empty string = open-ended. */
  endDate: string
  excludeWeekends?: boolean
  note: string
}

function crewLeadName(crew: CrewSummaryItem) {
  const lead = crew.crewLead
  if (lead && typeof lead === 'object') {
    return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || ''
  }
  return ''
}

/**
 * Create or edit one crew stint on a job.
 *
 * The backend rejects overlapping stints (409) and past start dates (400);
 * those come back through `error` rather than being pre-validated here, since
 * only the server knows the full assignment picture.
 */
export default function ScheduleAssignModal({
  jobName,
  jobNo,
  crews,
  assignment,
  defaultStartDate,
  error,
  saving = false,
  canDelete = false,
  onCancel,
  onSubmit,
  onDelete,
}: {
  jobName: string
  jobNo: string | number
  crews: CrewSummaryItem[]
  /** Present when editing an existing stint. */
  assignment?: CrewAssignment | null
  defaultStartDate: string
  error?: string | null
  saving?: boolean
  canDelete?: boolean
  onCancel: () => void
  onSubmit: (draft: StintDraft) => void
  onDelete?: () => void
}) {
  const isEdit = Boolean(assignment)
  const [crewId, setCrewId] = useState<string | null>(assignment?.crewId ?? null)
  const [startDate, setStartDate] = useState(assignment?.startDate?.slice(0, 10) ?? defaultStartDate)
  const [endDate, setEndDate] = useState(assignment?.endDate?.slice(0, 10) ?? '')
  const [excludeWeekends, setExcludeWeekends] = useState(assignment?.excludeWeekends ?? false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const selected = crews.find((c) => c._id === crewId)

  if (confirmingDelete) {
    return (
      <ConfirmModal
        title="Are you sure you want to remove this assignment?"
        message="This action is irreversible."
        confirmLabel="Yes Remove"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false)
          onDelete?.()
        }}
      />
    )
  }

  return (
    <Modal onClose={onCancel} width={440}>
      <h2 className="modal-title">{isEdit ? 'Edit Crew Assignment' : 'Assign Crew'}</h2>
      <p className="job-head__meta" style={{ marginTop: '0.15rem' }}>Job #{jobNo}</p>
      <p className="assign-crew__job-name">{jobName}</p>

      <label className="field-label">Assign Crew</label>
      <Dropdown
        value={crewId}
        placeholder="-"
        onChange={setCrewId}
        selectedLabel={
          selected && (
            <span className="dd__crew-label">
              <Avatar name={crewLeadName(selected) || selected.name || ''} size={24} />
              <span className="dd__crew-label__text">{selected.name}</span>
              <i className="dot" style={{ background: crewColorFor(selected._id, selected.crewColor) }} />
            </span>
          )
        }
        options={crews.map((c) => ({
          id: c._id,
          label: (
            <span className="dd__crew-label">
              <Avatar name={crewLeadName(c) || c.name || ''} size={24} />
              <span className="dd__crew-label__text">{c.name}</span>
              <i className="dot" style={{ background: crewColorFor(c._id, c.crewColor) }} />
            </span>
          ),
        }))}
      />

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Start Date</label>
          <input
            type="date"
            className="field-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">End Date</label>
          <input
            type="date"
            className="field-input"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <p className="field-hint" style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.7 }}>
        Leave End Date empty for an open-ended assignment.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#475569', marginTop: '0.85rem' }}>
        <input
          type="checkbox"
          checked={excludeWeekends}
          onChange={(e) => setExcludeWeekends(e.target.checked)}
        />
        <span>Exclude Weekends From Schedule</span>
      </label>

      {error && (
        <div style={{ color: '#ef4444', marginTop: '1rem', fontSize: '0.875rem' }}>{error}</div>
      )}

      <div className={canDelete ? 'modal-actions modal-actions--split' : 'modal-actions'}>
        {canDelete && (
          <button type="button" className="btn btn--danger" disabled={saving} onClick={() => setConfirmingDelete(true)}>
            Remove
          </button>
        )}
        <div className="modal-actions__group">
          <button type="button" className="btn btn--outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!crewId || !startDate || saving}
            onClick={() => {
              if (crewId) onSubmit({ crewId, startDate, endDate, excludeWeekends, note: '' })
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Assign Crew'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
