import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { Icon } from './icons'
import LocationPickerInput from './LocationPickerInput'
import { crewColors, type Job } from '../../lib/dashboardData'
import {
  createJob,
  updateJob,
  createCrewAssignment,
  updateCrewAssignment,
  deleteCrewAssignment,
  getCrewAssignments,
  type CreateJobPayload,
  type UpdateJobPayload,
  type CrewAssignmentPayloadItem,
  type JobItem,
} from '../../api/jobApi'
import { type UserItem } from '../../api/crewApi'
import { useCachedFetchers } from '../../hooks/useQueryHooks'
import { parseApiErrors } from '../../lib/errors'

export interface JobFormData {
  name: string
  siteAddress: string
  gc: string
  startDate: string
  endDate: string
  contractAmount: number
  laborBudgetTotal: number
  crewLeadId: string | null
  note: string
  color: string
  status: string
}

/** Job dates are stored as MM-DD-YYYY; native date inputs use YYYY-MM-DD. */
function toIsoDate(mdy: string) {
  if (!mdy) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(mdy)) return mdy
  const parts = mdy.split('-')
  if (parts.length !== 3) return ''
  const [mm, dd, yyyy] = parts
  if (!mm || !dd || !yyyy) return ''
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function toMdyDate(iso: string) {
  if (!iso) return ''
  if (/^\d{2}-\d{2}-\d{4}$/.test(iso)) return iso
  const parts = iso.split('-')
  if (parts.length !== 3) return ''
  const [yyyy, mm, dd] = parts
  return `${mm}-${dd}-${yyyy}`
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function DatePickerField({
  value,
  onChange,
  placeholder = 'MM-DD-YYYY',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const iso = toIsoDate(value)

  return (
    <div className="field-date">
      <button
        type="button"
        className="field-date__trigger"
        onClick={() => {
          const input = ref.current
          if (!input) return
          if ('showPicker' in input && typeof input.showPicker === 'function') {
            input.showPicker()
          } else {
            input.focus()
            input.click()
          }
        }}
      >
        <span className={value ? undefined : 'field-date__placeholder'}>{value || placeholder}</span>
        <Icon.Calendar width={16} height={16} />
      </button>
      <input
        ref={ref}
        type="date"
        className="field-date__native"
        value={iso}
        onChange={(e) => onChange(toMdyDate(e.target.value))}
      />
    </div>
  )
}

interface AvailableCrewItem {
  id: string
  name: string
  leadName: string
  rate: number
  color: string
  avatar?: string
}

/**
 * One crew's stint on the job. A job can carry any number of these — several
 * crews may share a day as long as their daily hours differ, which is why each
 * row owns its own time window rather than the job owning one schedule.
 *
 * `id` is present only for stints that already exist on the server; rows
 * without one are created on save, and stints missing from the list are
 * removed.
 */
interface AssignmentDraft {
  key: string
  id?: string
  crewId: string | null
  /** YYYY-MM-DD — the date half of the datetime-local inputs. */
  startDate: string
  endDate: string
  /**
   * The daily window, "HH:mm". Equal times wrap the whole way around the
   * clock, which is how a crew that holds the job all day is expressed.
   */
  dailyStartTime: string
  dailyEndTime: string
  excludeWeekends: boolean
}

let draftKeySeq = 0
function newAssignmentDraft(startDate = ''): AssignmentDraft {
  draftKeySeq += 1
  return {
    key: `draft-${draftKeySeq}`,
    crewId: null,
    startDate,
    endDate: '',
    dailyStartTime: '08:00',
    dailyEndTime: '17:00',
    excludeWeekends: false,
  }
}

export default function CreateJobModal({
  job,
  presetJobs,
  onCancel,
  onSubmit,
}: {
  job?: Job
  /** Existing sheet jobs — picking one prefills the create form. */
  presetJobs?: Job[]
  onCancel: () => void
  onSubmit: (data: JobFormData, apiJob?: JobItem) => void
}) {
  const isEdit = !!job
  const [jobIdNumber, setJobIdNumber] = useState<number | ''>('')
  const [name, setName] = useState(job?.name ?? '')
  const [siteAddress, setSiteAddress] = useState('')
  const [gc, setGc] = useState(job?.gc ?? '')
  const [gcSuper, setGcSuper] = useState('')
  const [startDate, setStartDate] = useState(job?.startDate ?? '')
  const [endDate, setEndDate] = useState(job?.endDate ?? '')
  const [contractAmount, setContractAmount] = useState<number | ''>(job?.contractAmount ?? '')
  const [laborBudgetTotal, setLaborBudgetTotal] = useState<number | ''>(job?.laborBudgetTotal ?? '')
  const [note, setNote] = useState<string>('')
  const [status, setStatus] = useState<string>(job?.status || 'awarded')

  const [assignments, setAssignments] = useState<AssignmentDraft[]>([])
  /** Stints loaded from the server, so save can tell removals from additions. */
  const [originalAssignmentIds, setOriginalAssignmentIds] = useState<string[]>([])
  const [presetId, setPresetId] = useState<string>('')
  const [availableCrews, setAvailableCrews] = useState<AvailableCrewItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const { fetchCrewsSummary, fetchJobById } = useCachedFetchers()
  const [apiError, setApiError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const color = job?.color ?? crewColors[0]

  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true)
      try {
        const crewsRes = await fetchCrewsSummary()
        if (crewsRes.success && Array.isArray(crewsRes.data)) {
          const crews: AvailableCrewItem[] = crewsRes.data.map((c) => {
            const leadObj = typeof c.crewLead === 'object' && c.crewLead !== null ? (c.crewLead as UserItem) : null
            const leadName = leadObj ? `${leadObj.firstName || ''} ${leadObj.lastName || ''}`.trim() : c.name
            return {
              id: c._id,
              name: c.name,
              leadName: leadName || c.name,
              rate: leadObj?.hourlyRate ?? 0,
              color: c.crewColor || '#3b82f6',
              avatar: `https://i.pravatar.cc/64?img=${(c._id.charCodeAt(0) || 5) % 70}`,
            }
          })
          setAvailableCrews(crews)
        }

        if (isEdit && job?.id) {
          const [jobRes, assignmentsRes] = await Promise.all([
            fetchJobById(job.id),
            getCrewAssignments(job.id).catch(() => null),
          ])

          if (jobRes && jobRes.success && jobRes.data) {
            const j = jobRes.data
            if (j.jobIdNumber !== undefined && j.jobIdNumber !== null) setJobIdNumber(j.jobIdNumber)
            setName(j.name || '')
            setSiteAddress(j.siteAddress || '')
            setGc(j.generalContractor || '')
            if (j.gcSuper) setGcSuper(j.gcSuper)
            if (j.startDate) setStartDate(toMdyDate(j.startDate.slice(0, 10)))
            if (j.endDate) setEndDate(toMdyDate(j.endDate.slice(0, 10)))
            setContractAmount(j.contractAmount !== undefined && j.contractAmount !== null ? j.contractAmount : '')
            setLaborBudgetTotal(j.laborBudget !== undefined && j.laborBudget !== null ? j.laborBudget : '')
            if (j.note) setNote(j.note)
            if (j.status) setStatus(j.status)
          }

          const rows = assignmentsRes?.data ?? []
          if (rows.length) {
            setOriginalAssignmentIds(rows.map((a) => a._id))
            setAssignments(
              rows.map((a) => {
                draftKeySeq += 1
                return {
                  key: `existing-${a._id}`,
                  id: a._id,
                  crewId: a.crewId,
                  startDate: a.startDate.slice(0, 10),
                  endDate: a.endDate ? a.endDate.slice(0, 10) : '',
                  // A stint stored without a window runs all day, which shows
                  // here as the equal times that wrap round the clock.
                  dailyStartTime: a.dailyStartTime ?? '00:00',
                  dailyEndTime: a.dailyEndTime ?? '00:00',
                  excludeWeekends: false,
                }
              }),
            )
          }
        }
      } catch (err) {
        console.error('Failed to fetch modal details:', err)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()
  }, [isEdit, job?.id])

  const filledAssignments = assignments.filter((a) => a.crewId)
  const firstCrew = availableCrews.find((c) => c.id === filledAssignments[0]?.crewId)
  const jobIdValid = typeof jobIdNumber === 'number' && jobIdNumber >= 10000 && jobIdNumber <= 99999
  const canSubmit = !isSubmitting && !isLoadingData && jobIdValid && name.trim().length >= 2

  function patchAssignment(key: string, patch: Partial<AssignmentDraft>) {
    setAssignments((list) => list.map((a) => (a.key === key ? { ...a, ...patch } : a)))
  }

  /**
   * Validation errors for one stint. The server reports them positionally
   * against the array it was sent — `crewAssignment.1.startDate` — so they are
   * matched back to the card by its position among the filled-in rows.
   */
  function assignmentErrors(draft: AssignmentDraft) {
    const index = filledAssignments.findIndex((a) => a.key === draft.key)
    const prefixes =
      index >= 0 ? [`crewAssignment.${index}.`, 'crewAssignment.'] : ['crewAssignment.']
    return Object.entries(fieldErrors)
      .filter(([path]) => prefixes.some((prefix) => path.startsWith(prefix)))
      .map(([, message]) => message)
  }

  function applyPreset(id: string) {
    setPresetId(id)
    const preset = presetJobs?.find((j) => j.id === id)
    if (!preset) return
    setName(preset.name)
    setGc(preset.gc)
    setStartDate(preset.startDate)
    setEndDate(preset.endDate)
    setContractAmount(preset.contractAmount)
    setLaborBudgetTotal(preset.laborBudgetTotal)
    setSiteAddress(preset.name)
    if (preset.status) setStatus(preset.status)
  }

  /** A draft row in the shape both POST /jobs and the stint endpoints take. */
  function assignmentPayload(draft: AssignmentDraft): CrewAssignmentPayloadItem {
    return {
      crewId: draft.crewId as string,
      startDate: toIsoDate(draft.startDate) || toIsoDate(startDate) || todayIso(),
      ...(draft.endDate ? { endDate: toIsoDate(draft.endDate) } : {}),
      // Both times or neither — the server rejects a half-specified window.
      ...(draft.dailyStartTime && draft.dailyEndTime
        ? { dailyStartTime: draft.dailyStartTime, dailyEndTime: draft.dailyEndTime }
        : {}),
      excludeWeekends: draft.excludeWeekends,
    }
  }

  /**
   * Reconciles the job's stints against what the form now shows: rows dropped
   * from the list are deleted, existing ones patched, new ones created.
   *
   * Only the edit path needs this — a new job carries its crews inline in the
   * create request, which the server applies atomically.
   */
  async function syncAssignments(jobId: string) {
    const keptIds = new Set(assignments.filter((a) => a.id).map((a) => a.id as string))
    for (const removedId of originalAssignmentIds) {
      if (!keptIds.has(removedId)) {
        // A stint that has already started can't be deleted server-side; that
        // rejection is surfaced rather than silently swallowed.
        await deleteCrewAssignment(jobId, removedId)
      }
    }

    for (const draft of filledAssignments) {
      if (draft.id) {
        await updateCrewAssignment(jobId, draft.id, assignmentPayload(draft))
      } else {
        await createCrewAssignment(jobId, assignmentPayload(draft))
      }
    }
  }

  async function handleSubmit() {
    setApiError('')
    setFieldErrors({})

    if (!jobIdValid) {
      setFieldErrors({ jobIdNumber: 'Enter a 5 digit job ID number' })
      return
    }

    setIsSubmitting(true)

    const contractVal = contractAmount !== '' ? Number(contractAmount) : undefined
    const laborVal = laborBudgetTotal !== '' ? Number(laborBudgetTotal) : undefined

    const formData: JobFormData = {
      name,
      siteAddress,
      gc,
      startDate,
      endDate,
      contractAmount: contractVal ?? 0,
      laborBudgetTotal: laborVal ?? 0,
      crewLeadId: filledAssignments[0]?.crewId ?? null,
      note,
      color: firstCrew?.color ?? color,
      status,
    }

    // The IDS super is the crew lead now — there is no separate input. The
    // Job model still requires the field, so it is filled from the first
    // assigned crew's lead.
    const derivedIdsSuper = firstCrew?.leadName || 'Unassigned'

    try {
      let savedJob: JobItem
      if (!isEdit) {
        const payload: CreateJobPayload = {
          jobIdNumber: Number(jobIdNumber),
          name: name.trim(),
          generalContractor: gc.trim(),
          gcSuper: gcSuper.trim() || undefined,
          idsSuper: derivedIdsSuper,
          siteAddress: siteAddress.trim() || undefined,
          startDate: toIsoDate(startDate) || undefined,
          endDate: toIsoDate(endDate) || undefined,
          contractAmount: contractVal,
          laborBudget: laborVal,
          note: note.trim() || undefined,
          status,
          // Every crew goes in with the job itself. The server applies them
          // atomically, so a rejected stint takes the job down with it rather
          // than leaving a half-assigned job behind.
          ...(filledAssignments.length
            ? { crewAssignment: filledAssignments.map(assignmentPayload) }
            : {}),
        }
        const res = await createJob(payload)
        savedJob = res.data
      } else {
        if (!job?.id) return
        const patchPayload: UpdateJobPayload = {
          jobIdNumber: Number(jobIdNumber),
          name: name.trim(),
          generalContractor: gc.trim(),
          gcSuper: gcSuper.trim() || null,
          idsSuper: derivedIdsSuper,
          siteAddress: siteAddress.trim() || undefined,
          startDate: toIsoDate(startDate) || undefined,
          endDate: toIsoDate(endDate) || undefined,
          contractAmount: contractVal,
          laborBudget: laborVal,
          note: note.trim() || undefined,
          status,
        }
        const res = await updateJob(job.id, patchPayload)
        savedJob = res.data
      }

      // On create the stints travelled with the job; only an edit has to
      // reconcile them against what was already stored.
      if (isEdit) {
        try {
          await syncAssignments(savedJob._id)
        } catch (assignErr) {
          const parsedAssign = parseApiErrors(
            assignErr,
            'Job was updated, but the crew assignments could not all be saved.',
          )
          setApiError(parsedAssign.generalMessage)
          setFieldErrors(parsedAssign.fieldErrors)
          return
        }
      }

      onSubmit(formData, savedJob)
    } catch (err) {
      const parsed = parseApiErrors(err, `Failed to ${isEdit ? 'update' : 'create'} job. Please check inputs and try again.`)
      setApiError(parsed.generalMessage)
      setFieldErrors(parsed.fieldErrors)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal onClose={onCancel} width={980}>
      <div className="job-form-modal">
        <div className="modal-head-row job-form-modal__head">
          <h2 className="modal-title">{isEdit ? 'Edit Job' : 'Create Job'}</h2>
          {isEdit && (
            <span className="job-head__meta job-form-modal__meta">
              Bid #{job!.bidNo} &middot; Job #{job!.jobNo}
            </span>
          )}
        </div>

        {isLoadingData && (
          <div style={{ padding: '0.4rem 0', color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
            Loading job details…
          </div>
        )}

        {apiError && (
          <div className="form-error-alert">
            <Icon.AlertCircle width={18} height={18} />
            <span>{apiError}</span>
          </div>
        )}

        <fieldset disabled={isLoadingData || isSubmitting} style={{ border: 'none', padding: 0, margin: 0, opacity: isLoadingData ? 0.6 : 1 }}>
        <div className="job-form-modal__grid">
          <div className="job-form-modal__main">
            {!isEdit && presetJobs && presetJobs.length > 0 && (
              <>
                <label className="field-label">Select Job from Sheet</label>
                <Dropdown
                  value={presetId}
                  placeholder="Choose a job to populate fields"
                  onChange={applyPreset}
                  selectedLabel={presetJobs.find((j) => j.id === presetId)?.name}
                  options={presetJobs.map((j) => ({
                    id: j.id,
                    label: j.name,
                  }))}
                />
              </>
            )}

            <div className="field-row">
              <div style={{ flex: '0 0 160px' }}>
                <label className="field-label">Job ID Number*</label>
                <input
                  type="number"
                  className={`field-input${fieldErrors.jobIdNumber ? ' field-input--error' : ''}`}
                  placeholder="e.g. 48271"
                  value={jobIdNumber}
                  onChange={(e) => setJobIdNumber(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '3px', display: 'block', lineHeight: 1.2 }}>
                  5 digits, chosen by you
                </span>
                {fieldErrors.jobIdNumber && <span className="field-error-text">{fieldErrors.jobIdNumber}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Name*</label>
                <input
                  className={`field-input${fieldErrors.name ? ' field-input--error' : ''}`}
                  placeholder="Enter Job Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {fieldErrors.name && <span className="field-error-text">{fieldErrors.name}</span>}
              </div>
            </div>

            <label className="field-label">
              Site Address <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span>
            </label>
            <LocationPickerInput
              value={siteAddress}
              onChange={setSiteAddress}
              hasError={Boolean(fieldErrors.siteAddress)}
              placeholder="Start typing address..."
              disabled={isLoadingData || isSubmitting}
            />
            {fieldErrors.siteAddress && <span className="field-error-text">{fieldErrors.siteAddress}</span>}

            <label className="field-label">General Contractor</label>
            <input
              className={`field-input${fieldErrors.generalContractor || fieldErrors.gc ? ' field-input--error' : ''}`}
              placeholder="Enter GC Name"
              value={gc}
              onChange={(e) => setGc(e.target.value)}
            />
            {(fieldErrors.generalContractor || fieldErrors.gc) && (
              <span className="field-error-text">{fieldErrors.generalContractor || fieldErrors.gc}</span>
            )}

            <label className="field-label">GC Super</label>
            <input
              className={`field-input${fieldErrors.gcSuper ? ' field-input--error' : ''}`}
              placeholder="General Contractor Superintendent"
              value={gcSuper}
              onChange={(e) => setGcSuper(e.target.value)}
            />
            {fieldErrors.gcSuper && <span className="field-error-text">{fieldErrors.gcSuper}</span>}

            <div className="field-row job-form-modal__date-row">
              <div className={fieldErrors.startDate ? 'field-date--error' : ''}>
                <label className="field-label">Start Date*</label>
                <DatePickerField value={startDate} onChange={setStartDate} />
                {fieldErrors.startDate && <span className="field-error-text">{fieldErrors.startDate}</span>}
              </div>
              <div className={fieldErrors.endDate ? 'field-date--error' : ''}>
                <label className="field-label">End Date <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span></label>
                <DatePickerField value={endDate} onChange={setEndDate} />
                {fieldErrors.endDate && <span className="field-error-text">{fieldErrors.endDate}</span>}
              </div>
            </div>

            <div className="field-row job-form-modal__money-row">
              <div>
                <label className="field-label">
                  Contract Amount <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span>
                </label>
                <div className={`field-money${fieldErrors.contractAmount ? ' field-money--error' : ''}`}>
                  <span>$</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={contractAmount}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value)
                      setContractAmount(val)
                      if (val === '') {
                        setLaborBudgetTotal('')
                      } else {
                        setLaborBudgetTotal(Math.round(val * 0.4))
                      }
                    }}
                  />
                </div>
                {fieldErrors.contractAmount && <span className="field-error-text">{fieldErrors.contractAmount}</span>}
              </div>
              <div>
                <label className="field-label">
                  Labor Budget <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span>
                </label>
                <div className={`field-money${fieldErrors.laborBudget ? ' field-money--error' : ''}`}>
                  <span>$</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={laborBudgetTotal}
                    onChange={(e) => setLaborBudgetTotal(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                {fieldErrors.laborBudget && <span className="field-error-text">{fieldErrors.laborBudget}</span>}
              </div>
            </div>

            <div style={{ marginTop: '0.85rem' }}>
              <label className="field-label">Status*</label>
              <Dropdown
                value={status}
                placeholder="Select status"
                onChange={(id) => setStatus(id)}
                selectedLabel={
                  status === 'in-progress'
                    ? 'In Progress'
                    : status === 'completed'
                    ? 'Complete'
                    : status === 'awarded'
                    ? 'Awarded'
                    : 'Select status'
                }
                options={[
                  { id: 'awarded', label: 'Awarded' },
                  { id: 'in-progress', label: 'In Progress' },
                  { id: 'completed', label: 'Complete' },
                ]}
              />
              {fieldErrors.status && <span className="field-error-text">{fieldErrors.status}</span>}
            </div>
          </div>

          <div className="job-form-modal__side">
            <label className="field-label">Assign Crew</label>
            <p className="job-assign__hint">
              Add a row per crew. Crews can share the same days as long as their hours differ.
            </p>

            {assignments.map((draft) => {
              const selected = availableCrews.find((c) => c.id === draft.crewId)
              const errors = assignmentErrors(draft)
              return (
                <div key={draft.key} className="job-assign-card">
                  <div className="job-assign-card__head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Dropdown
                        value={draft.crewId ?? ''}
                        placeholder="Select crew"
                        onChange={(id) => patchAssignment(draft.key, { crewId: id || null })}
                        selectedLabel={
                          selected && (
                            <span className="dd__avatar-label">
                              <Avatar name={selected.name} src={selected.avatar} size={24} />
                              {selected.name}
                            </span>
                          )
                        }
                        options={availableCrews.map((c) => ({
                          id: c.id,
                          label: (
                            <span className="dd__crew-label">
                              <Avatar name={c.leadName} src={c.avatar} size={24} />
                              <span className="dd__crew-label__text">{c.name}</span>
                              <i className="dot" style={{ background: c.color }} />
                            </span>
                          ),
                        }))}
                      />
                    </div>
                    <button
                      type="button"
                      className="job-assign-card__remove"
                      aria-label="Remove this crew assignment"
                      onClick={() =>
                        setAssignments((list) => list.filter((a) => a.key !== draft.key))
                      }
                    >
                      <Icon.Trash width={16} height={16} />
                    </button>
                  </div>

                  <div className="field-row">
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <label className="field-label" style={{ whiteSpace: 'nowrap' }}>
                        Start Date &amp; Time*
                      </label>
                      <input
                        type="datetime-local"
                        className="field-input"
                        value={draft.startDate ? `${draft.startDate}T${draft.dailyStartTime || '08:00'}` : ''}
                        onChange={(e) => {
                          const [d, t] = e.target.value.split('T')
                          patchAssignment(draft.key, {
                            startDate: d || '',
                            ...(t ? { dailyStartTime: t } : {}),
                          })
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <label className="field-label" style={{ whiteSpace: 'nowrap' }}>
                        End Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        className="field-input"
                        value={draft.endDate ? `${draft.endDate}T${draft.dailyEndTime || '17:00'}` : ''}
                        min={draft.startDate ? `${draft.startDate}T${draft.dailyStartTime || '08:00'}` : undefined}
                        onChange={(e) => {
                          const [d, t] = e.target.value.split('T')
                          patchAssignment(draft.key, {
                            endDate: d || '',
                            ...(t ? { dailyEndTime: t } : {}),
                          })
                        }}
                      />
                    </div>
                  </div>
                  <p className="job-assign__hint" style={{ margin: '0.35rem 0 0' }}>
                    Same time on both ends keeps the crew on the job round the clock.
                  </p>

                  <label className="sb-check">
                    <input
                      type="checkbox"
                      checked={draft.excludeWeekends}
                      onChange={(e) => patchAssignment(draft.key, { excludeWeekends: e.target.checked })}
                    />
                    <span>Exclude Weekends From Schedule</span>
                  </label>

                  {errors.map((message) => (
                    <span key={message} className="field-error-text">{message}</span>
                  ))}
                </div>
              )
            })}

            <button
              type="button"
              className="btn btn--outline job-assign__add"
              onClick={() =>
                // Seeded from the job's own start date, in the ISO form the
                // datetime inputs read.
                setAssignments((list) => [...list, newAssignmentDraft(toIsoDate(startDate) || todayIso())])
              }
            >
              <Icon.Plus width={16} height={16} />
              {assignments.length === 0 ? 'Assign Crew' : 'Assign More'}
            </button>
          </div>
        </div>

        <div className="modal-actions job-form-modal__actions">
          <button type="button" className="btn btn--outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update Job' : 'Create Job'}
          </button>
        </div>
        </fieldset>
      </div>
    </Modal>
  )
}
