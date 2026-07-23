import { useState } from 'react'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import Dropdown from '../components/dashboard/Dropdown'
import CellMenu from '../components/dashboard/CellMenu'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import CrewDetailsModal from '../components/dashboard/CrewDetailsModal'
import NoteModal from '../components/dashboard/NoteModal'
import CreateJobModal from '../components/dashboard/CreateJobModal'
import { Icon } from '../components/dashboard/icons'
import { crewLeads, jobs as masterJobs, type Job } from '../lib/dashboardData'
import {
  scheduleJobs as initialScheduleJobs,
  initialScheduleAssignments,
  initialScheduleNotes,
  TODAY,
  toISO,
  fromISO,
  addDays,
  getMonday,
  weekdayShort,
  monthLabel,
  daysInMonth,
  formatMdy,
  type ScheduleJob,
} from '../lib/scheduleData'
import './ScheduleBoard.css'

type ViewMode = 'weekly' | 'monthly'

type Flow =
  | { type: 'none' }
  | { type: 'assignCrew'; jobId: string; date: string }
  | { type: 'addNote'; jobId: string; date: string }
  | { type: 'crewDetails'; jobId: string; date: string; assignmentId: string }
  | { type: 'viewNote'; jobId: string; date: string; noteId: string }
  | { type: 'editJob'; jobId: string }

const JOBNO_W = 72
const JOB_W = 230
const DIVIDER_W = 18
const META_WIDTHS = [90, 130, 130, 100]

function toJob(row: ScheduleJob, date: string): Job {
  const laborBudgetTotal = Math.round(row.contract * 0.3)
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    bidNo: row.jobNo,
    jobNo: row.jobNo,
    gc: row.gc,
    estimator: row.idsSuper,
    startDate: formatMdy(date),
    endDate: formatMdy(date),
    contractAmount: row.contract,
    laborBudgetUsed: Math.round(laborBudgetTotal * 0.35),
    laborBudgetTotal,
  }
}

export default function ScheduleBoard() {
  const [jobs, setJobs] = useState(initialScheduleJobs)
  const [assignments, setAssignments] = useState(initialScheduleAssignments)
  const [notes, setNotes] = useState(initialScheduleNotes)

  const [viewMode, setViewMode] = useState<ViewMode>('weekly')
  const [monthlyCompact, setMonthlyCompact] = useState(false)
  const [anchor, setAnchor] = useState(() => fromISO(TODAY))
  const [search, setSearch] = useState('')
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [metaVisible, setMetaVisible] = useState(false)

  const [cellMenu, setCellMenu] = useState<{ x: number; y: number; jobId: string; date: string } | null>(null)
  const [flow, setFlow] = useState<Flow>({ type: 'none' })

  const weekStart = getMonday(anchor)
  const weekDays = [0, 1, 2, 3, 4, 5].map((i) => addDays(weekStart, i))
  const monthDays = Array.from({ length: daysInMonth(anchor) }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1))
  const visibleDays = viewMode === 'weekly' ? weekDays : monthDays
  const compact = viewMode === 'monthly' && monthlyCompact
  const dayW = viewMode === 'weekly' ? 150 : compact ? 46 : 150

  const rangeLabel =
    viewMode === 'weekly'
      ? `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[5].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${weekDays[5].getFullYear()}`
      : monthLabel(anchor)

  const filteredJobs = jobs.filter((j) => {
    const matchesSearch = !search || j.name.toLowerCase().includes(search.toLowerCase()) || j.jobNo.includes(search)
    const matchesFilter = !jobFilter || j.name === jobFilter
    return matchesSearch && matchesFilter
  })

  function goPrev() {
    setAnchor(viewMode === 'weekly' ? addDays(anchor, -7) : new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))
  }
  function goNext() {
    setAnchor(viewMode === 'weekly' ? addDays(anchor, 7) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))
  }

  function openCellMenu(e: React.MouseEvent, jobId: string, date: string) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setCellMenu({ x: rect.left, y: rect.bottom + 6, jobId, date })
  }

  const activeRow = flow.type !== 'none' && 'jobId' in flow ? jobs.find((j) => j.id === flow.jobId) : undefined

  return (
    <div className="dash">
      <Sidebar active="Schedule Board" />

      <main className="dash__main">
        <Topbar onAddJob={() => {}} onCreateCrew={() => {}} />

        <h1 className="dash__title">Job Schedules</h1>
        <p className="dash__subtitle">{viewMode === 'weekly' ? 'Weekly' : 'Monthly'} crew assignments</p>

        <div className="sb-toolbar">
          <button type="button" className="icon-btn icon-btn--bordered sb-nav-btn" onClick={goPrev}>
            <Icon.ArrowLeft width={16} height={16} />
          </button>
          <span className="sb-range">{rangeLabel}</span>
          <button type="button" className="icon-btn icon-btn--bordered sb-nav-btn" onClick={goNext}>
            <Icon.ArrowRight width={16} height={16} />
          </button>

          <div className="sb-jump">
            <button type="button" className="btn btn--outline" onClick={() => setJumpOpen((o) => !o)}>
              Jump to date
              <Icon.Calendar width={16} height={16} />
            </button>
            {jumpOpen && (
              <input
                type="date"
                className="sb-jump__input"
                autoFocus
                onChange={(e) => {
                  if (e.target.value) {
                    setAnchor(fromISO(e.target.value))
                    setJumpOpen(false)
                  }
                }}
                onBlur={() => setJumpOpen(false)}
              />
            )}
          </div>

          <label className="sb-search">
            <Icon.Search width={16} height={16} />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>

          <div className="sb-toggle">
            <button
              type="button"
              className={viewMode === 'weekly' ? 'is-active' : ''}
              onClick={() => setViewMode('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={viewMode === 'monthly' ? 'is-active' : ''}
              onClick={() => setViewMode('monthly')}
            >
              Monthly
            </button>
          </div>

          {viewMode === 'monthly' && (
            <div className="sb-toggle sb-toggle--icons">
              <button
                type="button"
                className={!monthlyCompact ? 'is-active' : ''}
                onClick={() => setMonthlyCompact(false)}
                aria-label="Detailed view"
                title="Detailed"
              >
                <Icon.List width={15} height={15} />
              </button>
              <button
                type="button"
                className={monthlyCompact ? 'is-active' : ''}
                onClick={() => setMonthlyCompact(true)}
                aria-label="Color view"
                title="Colors"
              >
                <Icon.Grid width={15} height={15} />
              </button>
            </div>
          )}

          <Dropdown
            value={jobFilter}
            placeholder="All Jobs"
            onChange={setJobFilter}
            selectedLabel={jobFilter}
            options={masterJobs.map((j) => ({ id: j.name, label: j.name }))}
          />
        </div>

        <div className="sb-table-wrap">
          <table className="sb-table">
            <colgroup>
              <col style={{ width: JOBNO_W }} />
              <col style={{ width: JOB_W }} />
              <col style={{ width: DIVIDER_W }} />
              {metaVisible && META_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
              {visibleDays.map((d) => (
                <col key={toISO(d)} style={{ width: dayW }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="sb-col-jobno">Job #</th>
                <th className="sb-col-job">Job</th>
                <th className="sb-col-divider" />
                {metaVisible && (
                  <>
                    <th className="sb-col-meta">IDS Super</th>
                    <th className="sb-col-meta">GC Super</th>
                    <th className="sb-col-meta">General Contractor</th>
                    <th className="sb-col-meta">Contract</th>
                  </>
                )}
                {visibleDays.map((d) => {
                  const iso = toISO(d)
                  const isToday = iso === TODAY
                  return (
                    <th key={iso} className={`sb-day-head ${isToday ? 'is-today' : ''} ${compact ? 'sb-day-head--compact' : ''}`}>
                      {viewMode === 'weekly' ? (
                        <>
                          <div>{isToday ? 'Today, ' + weekdayShort(d) : weekdayShort(d)}</div>
                          <div className="sb-day-head__date">{d.getMonth() + 1}-{String(d.getDate()).padStart(2, '0')}-{String(d.getFullYear()).slice(2)}</div>
                        </>
                      ) : (
                        d.getDate()
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((row, rowIndex) => (
                <tr key={row.id} className="sb-row">
                  <td className="sb-col-jobno">
                    <i className="sb-row-bar" style={{ background: row.color }} />
                    {row.jobNo}
                  </td>
                  <td className="sb-col-job">
                    <span className="sb-job-name" title={row.name}>{row.name}</span>
                    <Icon.ChevronRight width={14} height={14} />
                  </td>
                  {rowIndex === 0 && (
                    <td className="sb-col-divider" rowSpan={filteredJobs.length}>
                      <div className="sb-divider-inner">
                        <button
                          type="button"
                          className="sb-divider-btn"
                          onClick={() => setMetaVisible((v) => !v)}
                          aria-label={metaVisible ? 'Hide job details' : 'Show job details'}
                        >
                          <Icon.MoreVertical width={14} height={14} />
                        </button>
                      </div>
                    </td>
                  )}
                  {metaVisible && (
                    <>
                      <td className="sb-col-meta">{row.idsSuper}</td>
                      <td className="sb-col-meta">{row.gcSuper}</td>
                      <td className="sb-col-meta">{row.gc}</td>
                      <td className="sb-col-meta">${row.contract.toLocaleString('en-US')}</td>
                    </>
                  )}
                  {visibleDays.map((d) => {
                    const iso = toISO(d)
                    const assignment = assignments.find((a) => a.jobId === row.id && a.date === iso)
                    const note = notes.find((n) => n.jobId === row.id && n.date === iso)

                    if (assignment) {
                      return (
                        <td key={iso} className={compact ? 'sb-cell sb-cell--compact' : 'sb-cell'}>
                          <button
                            type="button"
                            className="sb-pill"
                            title={`${assignment.crewName} · ${assignment.hours}`}
                            style={compact ? { background: row.color } : { background: `${row.color}1A`, borderColor: row.color }}
                            onClick={() => setFlow({ type: 'crewDetails', jobId: row.id, date: iso, assignmentId: assignment.id })}
                          >
                            {!compact && (
                              <>
                                <span className="sb-pill__name">{assignment.crewName}</span>
                                <span className="sb-pill__hours">{assignment.hours}</span>
                              </>
                            )}
                          </button>
                          {!compact && assignment.note && (
                            <span className="sb-pill__note-badge">
                              <Icon.Note width={12} height={12} />
                            </span>
                          )}
                        </td>
                      )
                    }

                    if (note) {
                      return (
                        <td key={iso} className={compact ? 'sb-cell sb-cell--compact' : 'sb-cell'}>
                          <button
                            type="button"
                            className="sb-note-pill"
                            title={note.text}
                            onClick={() => setFlow({ type: 'viewNote', jobId: row.id, date: iso, noteId: note.id })}
                          >
                            {!compact && note.text}
                          </button>
                        </td>
                      )
                    }

                    return (
                      <td key={iso} className={compact ? 'sb-cell sb-cell--compact' : 'sb-cell'}>
                        {compact ? (
                          <button type="button" className="sb-empty" onClick={(e) => openCellMenu(e, row.id, iso)} />
                        ) : (
                          <button type="button" className="sb-add" onClick={(e) => openCellMenu(e, row.id, iso)}>
                            <Icon.Plus width={14} height={14} />
                            Add
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {cellMenu && (
        <CellMenu
          x={cellMenu.x}
          y={cellMenu.y}
          onClose={() => setCellMenu(null)}
          onAssignCrew={() => setFlow({ type: 'assignCrew', jobId: cellMenu.jobId, date: cellMenu.date })}
          onAddNote={() => setFlow({ type: 'addNote', jobId: cellMenu.jobId, date: cellMenu.date })}
        />
      )}

      {flow.type === 'assignCrew' && activeRow && (
        <AssignCrewModal
          job={toJob(activeRow, flow.date)}
          onCancel={() => setFlow({ type: 'none' })}
          onAssign={(crewLeadId, note) => {
            const lead = crewLeads.find((c) => c.id === crewLeadId)
            if (!lead) return
            setAssignments((list) => [
              ...list,
              {
                id: `sa-${Date.now()}`,
                jobId: flow.jobId,
                date: flow.date,
                crewName: lead.name,
                hours: '0h 00m',
                rate: lead.rate,
                workers: 1,
                note: note || undefined,
              },
            ])
            setFlow({ type: 'none' })
          }}
        />
      )}

      {flow.type === 'addNote' && (
        <NoteModal
          note={null}
          onCancel={() => setFlow({ type: 'none' })}
          onDelete={() => {}}
          onSave={(text) => {
            setNotes((list) => [...list, { id: `sn-${Date.now()}`, jobId: flow.jobId, date: flow.date, text }])
            setFlow({ type: 'none' })
          }}
        />
      )}

      {flow.type === 'viewNote' &&
        (() => {
          const target = notes.find((n) => n.id === flow.noteId)
          if (!target) return null
          return (
            <NoteModal
              note={target.text}
              onCancel={() => setFlow({ type: 'none' })}
              onSave={(text) => {
                setNotes((list) => list.map((n) => (n.id === target.id ? { ...n, text } : n)))
                setFlow({ type: 'none' })
              }}
              onDelete={() => {
                setNotes((list) => list.filter((n) => n.id !== target.id))
                setFlow({ type: 'none' })
              }}
            />
          )
        })()}

      {flow.type === 'crewDetails' &&
        activeRow &&
        (() => {
          const assignment = assignments.find((a) => a.id === flow.assignmentId)
          if (!assignment) return null
          return (
            <CrewDetailsModal
              job={toJob(activeRow, flow.date)}
              crewLead={{ id: assignment.id, name: assignment.crewName, rate: assignment.rate }}
              note={assignment.note ?? ''}
              hoursWorked={assignment.hours}
              workers={assignment.workers}
              onDone={() => setFlow({ type: 'none' })}
              onEditJob={() => setFlow({ type: 'editJob', jobId: flow.jobId })}
            />
          )
        })()}

      {flow.type === 'editJob' && activeRow && (
        <CreateJobModal
          job={toJob(activeRow, TODAY)}
          onCancel={() => setFlow({ type: 'none' })}
          onSubmit={(data) => {
            setJobs((list) =>
              list.map((r) =>
                r.id === flow.jobId ? { ...r, name: data.name, gc: data.gc, color: data.color, contract: data.contractAmount } : r,
              ),
            )
            setFlow({ type: 'none' })
          }}
        />
      )}
    </div>
  )
}
