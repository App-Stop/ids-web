import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import PlaceholderDateTimeInput from './PlaceholderDateTimeInput'
import Dropdown from './Dropdown'
import Avatar from './Avatar'
import { Icon } from './icons'
import './crew-modals.css'
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
  type CrewAssignmentWindow,
  type JobItem,
} from '../../api/jobApi'
import { type UserItem } from '../../api/crewApi'
import { useCachedFetchers, useAvailableCrews } from '../../hooks/useQueryHooks'
import { parseApiErrors } from '../../lib/errors'
import { rangesOverlap, windowsCollide } from '../../lib/scheduleData'

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
 * One crew's stint on the job. A job can carry any number of these, and they
 * may freely share days and hours — several crews working the site at once is
 * normal, which is why each row owns its own window rather than the job owning
 * one schedule.
 *
 * `id` is present only for stints that already exist on the server; rows
 * without one are created on save, and stints missing from the list are
 * removed.
 */
interface AssignmentDraft {
  key: string
  id?: string
  /**
   * Crews sharing this row's window — the server makes one assignment per
   * crew. On a saved stint (`id` set) the stored assignment keeps one of them
   * and the rest are added as new assignments on save.
   */
  crewIds: string[]
  /** The crew the saved stint belongs to on the server. */
  savedCrewId?: string
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

/**
 * One crew stint row. The window is picked first and the crew list is whatever
 * /crews/available returns for it, so a busy crew can't be booked. Each row
 * owns its own lookup because each row owns its own window — hence a component
 * rather than inline JSX, which could not call the hook per row.
 */
function AssignmentRow({
  draft,
  allCrews,
  takenCrewIds,
  onPatch,
  onRemove,
  errors,
  duplicateCrewIds,
}: {
  draft: AssignmentDraft
  /** Every crew, used only to resolve a stint's existing crew while editing. */
  allCrews: AvailableCrewItem[]
  /** Crews already picked in the other rows — hidden from this row's list. */
  takenCrewIds: string[]
  onPatch: (patch: Partial<AssignmentDraft>) => void
  onRemove: () => void
  errors: string[]
  /** Crews on this row that another row already books over the same slot. */
  duplicateCrewIds: string[]
}) {
  // Daily times only narrow the window as a pair — half of one describes a
  // range the backend cannot evaluate.
  const windowParams = useMemo(() => {
    if (!draft.startDate) return null
    return {
      startDate: draft.startDate,
      ...(draft.endDate ? { endDate: draft.endDate } : {}),
      ...(draft.dailyStartTime && draft.dailyEndTime
        ? { dailyStartTime: draft.dailyStartTime, dailyEndTime: draft.dailyEndTime }
        : {}),
    }
  }, [draft.startDate, draft.endDate, draft.dailyStartTime, draft.dailyEndTime])

  const { data: available = [], isPending, isError } = useAvailableCrews(windowParams)
  const loadingCrews = Boolean(windowParams) && isPending

  /** Every crew free for this window, plus a saved stint's own crew. */
  const rowCrews: AvailableCrewItem[] = useMemo(() => {
    if (!windowParams) return []
    const mapped: AvailableCrewItem[] = available.map((c) => {
      const leadObj =
        typeof c.crewLead === 'object' && c.crewLead !== null ? (c.crewLead as UserItem) : null
      const leadName = leadObj ? `${leadObj.firstName || ''} ${leadObj.lastName || ''}`.trim() : c.name
      return {
        id: c._id,
        name: c.name,
        leadName: leadName || c.name,
        rate: leadObj?.hourlyRate ?? 0,
        color: c.crewColor || '#3b82f6',
      }
    })
    // A saved stint's own crew is busy on this very stint, so the endpoint
    // leaves it out — keep it selectable so a time-only edit still works.
    const current = draft.savedCrewId ? allCrews.find((c) => c.id === draft.savedCrewId) : undefined
    return current && !mapped.some((c) => c.id === current.id) ? [current, ...mapped] : mapped
  }, [available, windowParams, draft.savedCrewId, allCrews])

  // Editing the window can drop picked crews out of the available set. A
  // failed lookup says nothing about availability, so it leaves them alone.
  useEffect(() => {
    if (!windowParams || loadingCrews || isError || !draft.crewIds.length) return
    const kept = draft.crewIds.filter((id) => rowCrews.some((c) => c.id === id))
    if (kept.length !== draft.crewIds.length) onPatch({ crewIds: kept })
  }, [rowCrews, draft.crewIds, windowParams, loadingCrews, isError, onPatch])

  // Picked crews, resolved for their pills even before a window loads them. A
  // crew missing from both lists still gets a pill, so it can be seen and removed.
  const selectedCrews: AvailableCrewItem[] = draft.crewIds.map(
    (id) =>
      rowCrews.find((c) => c.id === id) ??
      allCrews.find((c) => c.id === id) ?? {
        id,
        name: `Crew #${id.slice(-4)}`,
        leadName: '',
        rate: 0,
        color: '#94a3b8',
      },
  )
  // Crews this row doesn't already hold, minus any picked in another row.
  const options = rowCrews.filter((c) => !draft.crewIds.includes(c.id) && !takenCrewIds.includes(c.id))
  const noneAvailable =
    Boolean(draft.startDate) && !loadingCrews && !isError && !draft.crewIds.length && !options.length
  const duplicateNames = duplicateCrewIds.map(
    (id) => selectedCrews.find((c) => c.id === id)?.name ?? 'A crew',
  )

  function crewPlaceholder() {
    if (!draft.startDate) return 'Select dates first'
    if (loadingCrews) return 'Loading available crews…'
    if (isError) return 'Could not load crews'
    if (!options.length) return draft.crewIds.length ? 'All available crews added' : 'No crews available'
    return draft.crewIds.length ? 'Add another crew' : 'Select crews'
  }

  function crewOption(c: AvailableCrewItem) {
    return {
      id: c.id,
      searchText: `${c.name} ${c.leadName}`,
      label: (
        <span className="dd__crew-label">
          <Avatar name={c.leadName} src={c.avatar} size={24} />
          <span className="dd__crew-label__text">{c.name}</span>
          <i className="dot" style={{ background: c.color }} />
        </span>
      ),
    }
  }

  const pickerDisabled = !draft.startDate || loadingCrews || !options.length

  return (
    <div className="job-assign-card">
      <div className="field-row">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>
            Start Date*
          </label>
          <PlaceholderDateTimeInput
            type="date"
            placeholder="DD-MM-YYYY"
            value={draft.startDate}
            onChange={(v) => onPatch({ startDate: v })}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>
            Start Time
          </label>
          <PlaceholderDateTimeInput
            type="time"
            placeholder="hh:mm"
            value={draft.dailyStartTime}
            onChange={(v) => onPatch({ dailyStartTime: v })}
          />
        </div>
      </div>

      <div className="field-row" style={{ marginTop: '0.75rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>
            End Date
          </label>
          <PlaceholderDateTimeInput
            type="date"
            placeholder="DD-MM-YYYY"
            value={draft.endDate}
            min={draft.startDate || undefined}
            onChange={(v) => onPatch({ endDate: v })}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="field-label" style={{ whiteSpace: 'nowrap' }}>
            End Time
          </label>
          <PlaceholderDateTimeInput
            type="time"
            placeholder="hh:mm"
            value={draft.dailyEndTime}
            onChange={(v) => onPatch({ dailyEndTime: v })}
          />
        </div>
      </div>
      <p className="job-assign__hint" style={{ margin: '0.35rem 0 0' }}>
        Same time on both ends keeps the crew on the job round the clock.
      </p>

      <label className="field-label" style={{ marginTop: '0.75rem' }}>
        Assign Crews*
      </label>
      <Dropdown
        value={null}
        disabled={pickerDisabled}
        placeholder={crewPlaceholder()}
        onChange={(id) => {
          if (id && !draft.crewIds.includes(id)) onPatch({ crewIds: [...draft.crewIds, id] })
        }}
        options={options.map(crewOption)}
      />
      {selectedCrews.length > 0 && (
        <div className="crew-chip-input" style={{ marginTop: '8px' }}>
          {selectedCrews.map((c) => (
            <span key={c.id} className="crew-chip-input__chip">
              <i
                aria-hidden
                style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }}
              />
              {c.name}
              <button
                type="button"
                className="crew-chip-input__remove"
                aria-label={`Remove ${c.name}`}
                onClick={() => onPatch({ crewIds: draft.crewIds.filter((id) => id !== c.id) })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {draft.id && draft.crewIds.length > 1 && (
        <p className="job-assign__hint" style={{ margin: '0.35rem 0 0' }}>
          The added crews are saved as their own assignments with these dates and hours.
        </p>
      )}
      {draft.id && draft.crewIds.length === 0 && (
        <p className="job-assign__hint" style={{ margin: '0.35rem 0 0' }}>
          With no crews left, this assignment is removed when you save.
        </p>
      )}
      {noneAvailable && (
        <p className="job-assign__hint" style={{ margin: '0.35rem 0 0' }}>
          No crews are free for this period. Try a different date or time range.
        </p>
      )}

      <div className="job-assign-card__foot">
        <label className="sb-check">
          <input
            type="checkbox"
            checked={draft.excludeWeekends}
            onChange={(e) => onPatch({ excludeWeekends: e.target.checked })}
          />
          <span>Exclude Weekends From Schedule</span>
        </label>
        <button
          type="button"
          className="job-assign-card__remove"
          aria-label="Remove this crew assignment"
          onClick={onRemove}
        >
          <Icon.Trash width={15} height={15} />
          <span>Remove</span>
        </button>
      </div>

      {draft.crewIds.length > 0 && !draft.startDate && (
        <span className="field-error-text">
          Pick a start date for {draft.crewIds.length === 1 ? 'this crew' : 'these crews'}.
        </span>
      )}
      {duplicateNames.length > 0 && (
        <span className="field-error-text">
          {duplicateNames.join(', ')} {duplicateNames.length === 1 ? 'is' : 'are'} already on this
          job over the same days and hours. One crew works one slot at a time — remove{' '}
          {duplicateNames.length === 1 ? 'it' : 'them'} here, or change the dates or hours.
        </span>
      )}
      {errors.map((message) => (
        <span key={message} className="field-error-text">{message}</span>
      ))}
    </div>
  )
}

let draftKeySeq = 0

/**
 * A blank row. Nothing is pre-filled — not the job's own start date, not a
 * default working window — because a guessed value looks identical to one the
 * user chose, and these dates decide when a crew actually turns up.
 */
function newAssignmentDraft(): AssignmentDraft {
  draftKeySeq += 1
  return {
    key: `draft-${draftKeySeq}`,
    crewIds: [],
    startDate: '',
    endDate: '',
    dailyStartTime: '',
    dailyEndTime: '',
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
                  crewIds: [a.crewId],
                  savedCrewId: a.crewId,
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

  const filledAssignments = assignments.filter((a) => a.crewIds.length > 0)
  const firstCrew = availableCrews.find((c) => c.id === filledAssignments[0]?.crewIds[0])
  const jobIdValid = typeof jobIdNumber === 'number' && jobIdNumber >= 10000 && jobIdNumber <= 99999
  // Two rows booking the same crew over the same slot can't be saved — the
  // server would reject them and, on create, take the whole job down with them.
  const hasDuplicateCrew = filledAssignments.some((draft) => duplicateCrewIds(draft).length > 0)
  // A crew row with no start date used to inherit the job's; now it simply
  // isn't saveable, so the day a crew turns up is always one someone chose.
  const missingStartDate = filledAssignments.some((a) => !a.startDate)
  const canSubmit =
    !isSubmitting &&
    !isLoadingData &&
    jobIdValid &&
    name.trim().length >= 2 &&
    !hasDuplicateCrew &&
    !missingStartDate

  function patchAssignment(key: string, patch: Partial<AssignmentDraft>) {
    setAssignments((list) => list.map((a) => (a.key === key ? { ...a, ...patch } : a)))
  }

  /**
   * Validation errors for one stint. The server reports them positionally
   * against the array it was sent — `crewAssignment.1.startDate` — so they are
   * matched back to the card by its position among the filled-in rows.
   */
  /**
   * Rows that book the same crew twice over the same days and hours.
   *
   * Two different crews sharing a slot is fine — that's the point of the list.
   * The same crew twice is not: it would have one crew in two places, which the
   * server rejects, so it is caught here before the whole atomic create fails.
   */
  function duplicateCrewIds(draft: AssignmentDraft) {
    if (!draft.crewIds.length || !draft.startDate) return []
    const clashing = new Set<string>()
    for (const other of filledAssignments) {
      if (other.key === draft.key || !other.startDate) continue
      const sameSlot =
        rangesOverlap(draft.startDate, draft.endDate || null, other.startDate, other.endDate || null) &&
        windowsCollide(
          { dailyStartTime: draft.dailyStartTime, dailyEndTime: draft.dailyEndTime },
          { dailyStartTime: other.dailyStartTime, dailyEndTime: other.dailyEndTime },
        )
      if (!sameSlot) continue
      for (const id of other.crewIds) {
        if (draft.crewIds.includes(id)) clashing.add(id)
      }
    }
    return [...clashing]
  }

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

  /**
   * A row's date/time window, in the shape both POST /jobs and the stint
   * endpoints take. Callers add who it's for: `crewIds` for a new row,
   * `crewId` for a saved stint.
   */
  function assignmentWindow(draft: AssignmentDraft): CrewAssignmentWindow {
    return {
      // Never falls back to the job's start date: submit is gated on every
      // crew row having its own, so an empty one can't be quietly backfilled
      // with a day nobody picked.
      startDate: toIsoDate(draft.startDate),
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
    // A saved row emptied of crews goes the same way as a removed row.
    const keptIds = new Set(filledAssignments.filter((a) => a.id).map((a) => a.id as string))
    for (const removedId of originalAssignmentIds) {
      if (!keptIds.has(removedId)) {
        // A stint that has already started can't be deleted server-side; that
        // rejection is surfaced rather than silently swallowed.
        await deleteCrewAssignment(jobId, removedId)
      }
    }

    for (const draft of filledAssignments) {
      if (draft.id) {
        // The stored assignment keeps its crew if it's still picked (otherwise
        // takes the first one); every other crew on the row is added as a new
        // assignment sharing the same window.
        const kept =
          draft.savedCrewId && draft.crewIds.includes(draft.savedCrewId) ? draft.savedCrewId : draft.crewIds[0]
        await updateCrewAssignment(jobId, draft.id, { ...assignmentWindow(draft), crewId: kept })
        const extras = draft.crewIds.filter((id) => id !== kept)
        if (extras.length) {
          await createCrewAssignment(jobId, { ...assignmentWindow(draft), crewIds: extras })
        }
      } else {
        // One call per row: the server books every crew in it, or none.
        await createCrewAssignment(jobId, { ...assignmentWindow(draft), crewIds: draft.crewIds })
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
      crewLeadId: filledAssignments[0]?.crewIds[0] ?? null,
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
            ? {
                crewAssignment: filledAssignments.map((draft) => ({
                  ...assignmentWindow(draft),
                  crewIds: draft.crewIds,
                })),
              }
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
                  5 digit ID
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

            <label className="field-label">General Contractor <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span></label>
            <input
              className={`field-input${fieldErrors.generalContractor || fieldErrors.gc ? ' field-input--error' : ''}`}
              placeholder="Enter GC Name"
              value={gc}
              onChange={(e) => setGc(e.target.value)}
            />
            {(fieldErrors.generalContractor || fieldErrors.gc) && (
              <span className="field-error-text">{fieldErrors.generalContractor || fieldErrors.gc}</span>
            )}

            <label className="field-label">GC Super <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Optional)</span></label>
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
              Add a row per crew
            </p>

            {assignments.map((draft) => (
              <AssignmentRow
                key={draft.key}
                draft={draft}
                allCrews={availableCrews}
                takenCrewIds={assignments
                  .filter((a) => a.key !== draft.key)
                  .flatMap((a) => a.crewIds)}
                onPatch={(patch) => patchAssignment(draft.key, patch)}
                onRemove={() =>
                  setAssignments((list) => list.filter((a) => a.key !== draft.key))
                }
                errors={assignmentErrors(draft)}
                duplicateCrewIds={duplicateCrewIds(draft)}
              />
            ))}

            <button
              type="button"
              className="btn btn--outline job-assign__add"
              onClick={() => setAssignments((list) => [...list, newAssignmentDraft()])}
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
