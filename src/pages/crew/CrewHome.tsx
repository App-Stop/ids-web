import { useCallback, useEffect, useState } from 'react'
import {
  BellSimple,
  CalendarDots,
  CaretRight,
  MapPin,
  SignIn,
  SignOut,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { type JobItem } from '../../api/jobApi'
import { useJobsList } from '../../hooks/useQueryHooks'
import {
  WEEKLY_TARGET_HOURS,
  endShift,
  getOpenShift,
  hoursThisWeek,
  requestLocation,
  startShift,
  type OpenShift,
} from '../../lib/clock'
import './crew-home.css'

function greetingFor(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning,'
  if (hour < 18) return 'Good afternoon,'
  return 'Good evening,'
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

/** Job dates render as DD-MM-YYYY in the design. */
function formatJobDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`
}

/** `assignToCrew` comes back either populated or as a bare id. */
function crewNameOf(job: JobItem): string | null {
  const crew = job.assignToCrew
  if (!crew) return null
  if (typeof crew === 'string') return null
  return crew.name ?? crew.crewName ?? null
}

export default function CrewHome() {
  const { user, role } = useAuth()
  const isLead = role === 'crew-lead'

  const [now, setNow] = useState(() => new Date())
  const [open, setOpen] = useState<OpenShift | null>(() => getOpenShift())
  const [punching, setPunching] = useState(false)
  const jobQuery = useJobsList({ status: 'in-progress', limit: 1 })
  const job: JobItem | null = jobQuery.data?.[0] ?? null
  const jobError = Boolean(jobQuery.error)

  // Drives the clock readout and the running hours total.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const onPunch = useCallback(async () => {
    setPunching(true)
    try {
      if (open) {
        endShift()
        setOpen(null)
      } else {
        // Requesting a fix is what raises the OS location prompt in the design.
        const position = await requestLocation()
        setOpen(startShift(position ? (job?.siteAddress ?? null) : null))
      }
    } finally {
      setPunching(false)
    }
  }, [open, job])

  const worked = hoursThisWeek(now)
  const remaining = Math.max(0, WEEKLY_TARGET_HOURS - worked)
  const progress = Math.min(100, (worked / WEEKLY_TARGET_HOURS) * 100)
  const clockedInAt = open ? timeFormat.format(new Date(open.startedAt)) : null

  return (
    <div className="chome">
      <header className="chome-header">
        <div className="chome-greeting">
          <span className="chome-greeting__hello">{greetingFor(now)}</span>
          <span className="chome-greeting__name">
            {`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'there'}
          </span>
        </div>
        <button type="button" className="chome-icon-btn" aria-label="Notifications">
          <BellSimple size={22} />
        </button>
      </header>

      <div className="chome-clock">
        <div className="chome-now">
          <span className="chome-now__time">{timeFormat.format(now)}</span>
          <span className="chome-now__date">{dateFormat.format(now)}</span>
        </div>

        <div className="chome-punch">
          <button
            type="button"
            className={`chome-punch__btn${open ? ' is-out' : ''}`}
            onClick={onPunch}
            disabled={punching}
          >
            {open ? 'Clock Out' : 'Clock In'}
            {open ? <SignOut size={30} /> : <SignIn size={30} />}
          </button>
          <p className="chome-punch__note">
            {open ? (open.location ?? 'Location unavailable') : 'GPS location recorded'}
          </p>
        </div>

        <div className={`chome-status${open ? ' is-in' : ''}`}>
          {open ? `CLOCKED IN AT ${clockedInAt}` : 'NOT CLOCKED IN'}
        </div>
      </div>

      <div className="chome-sections">
        <section className="chome-section">
          <h2 className="chome-section__title">Current Job</h2>

          {job ? (
            <article className={`chome-card chome-card--job${isLead ? ' is-lead' : ''}`}>
              <div className="chome-job__head">
                <div className="chome-job__heading">
                  <span className="chome-job__name">{job.name}</span>
                  <div className="chome-job__meta">
                    <span>Job #{String(job.jobIdNumber).padStart(3, '0')}</span>
                    {job.generalContractor && (
                      <>
                        <span className="chome-job__dot" />
                        <span>{job.generalContractor}</span>
                      </>
                    )}
                  </div>
                </div>
                <CaretRight size={16} className="chome-job__caret" />
              </div>

              {crewNameOf(job) && (
                <div className="chome-job__row chome-job__row--crew">
                  <span className="chome-job__avatar" />
                  <span>{crewNameOf(job)}</span>
                </div>
              )}

              <div className="chome-job__row">
                <MapPin size={22} />
                <span>{job.siteAddress}</span>
              </div>

              <div className="chome-job__row">
                <CalendarDots size={22} />
                <div className="chome-job__dates">
                  <span>{formatJobDate(job.startDate)}</span>
                  <span>TO</span>
                  <span>{formatJobDate(job.endDate)}</span>
                </div>
              </div>

              {job.note && <p className="chome-job__note">{job.note}</p>}
            </article>
          ) : (
            <div className="chome-card">
              <p className="chome-empty">
                {jobError
                  ? "Couldn't load your current job."
                  : 'No job in progress right now.'}
              </p>
            </div>
          )}
        </section>

        <section className="chome-section">
          <h2 className="chome-section__title">Hours completed this week</h2>
          <div className="chome-card">
            <span className="chome-hours__total">{worked.toFixed(1)}h</span>
            <div className="chome-hours__bar">
              <div className="chome-hours__track">
                <div className="chome-hours__fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="chome-hours__legend">
                <span>
                  {worked.toFixed(1)} / {WEEKLY_TARGET_HOURS} hours
                </span>
                <span>{remaining.toFixed(1)}h remaining</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
