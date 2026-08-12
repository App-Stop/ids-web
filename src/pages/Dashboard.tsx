import { useEffect, useState } from 'react'
import Sidebar from '../components/dashboard/Sidebar'
import StatCard from '../components/dashboard/StatCard'
import UnassignedCrewList from '../components/dashboard/UnassignedCrewList'
import AssignJobModal from '../components/dashboard/AssignJobModal'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import CrewDetailsModal from '../components/dashboard/CrewDetailsModal'
import CreateJobModal from '../components/dashboard/CreateJobModal'
import { Hammer, Users, Money, WarningCircle } from '@phosphor-icons/react'
import {
  formatMoney,
  jobs as initialJobs,
  type CrewLead,
  type Job,
  type UnassignedCrew,
} from '../lib/dashboardData'
import './Dashboard.css'
import {
  getDashboardSummary,
  type DashboardSummaryData,
  type UnassignedJobItem,
} from '../api/dashboardApi'

const TODAY = '13-07-2026'

function formatDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

/** Adapt an API unassigned job into the shape the modals expect. */
function toJob(item: UnassignedJobItem): Job {
  return {
    id: item._id,
    name: item.Name,
    color: '#4193f7',
    bidNo: String(item.jobIdNumber),
    jobNo: String(item.jobIdNumber).padStart(3, '0'),
    gc: item.generalContractor,
    estimator: 'TBD',
    startDate: formatDate(item.startDate),
    endDate: formatDate(item.endDate),
    contractAmount: 0,
    laborBudgetUsed: 0,
    laborBudgetTotal: 0,
  }
}

type Flow =
  | { step: 'none' }
  | { step: 'assignJob'; crew: UnassignedCrew }
  | { step: 'jobDetails'; crew: UnassignedCrew; job: Job; note: string }
  | { step: 'assignCrew'; crew: UnassignedCrew; job: Job; note: string }
  | { step: 'crewDetails'; job: Job; crewLead: CrewLead; note: string }
  | { step: 'jobForm'; job?: Job }

let nextJobSeq = 1054

export default function Dashboard() {
  const [jobs, setJobs] = useState(initialJobs)
  const [unassigned, setUnassigned] = useState<UnassignedCrew[]>([])
  const [unassignedJobs, setUnassignedJobs] = useState<UnassignedJobItem[]>([])
  const [flow, setFlow] = useState<Flow>({ step: 'none' })

  const [cardData, setCardData] = useState<DashboardSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchDashboardData() {
    try {
      setLoading(true)
      setError(null)
      const res = await getDashboardSummary()
      const data = res.data
      setCardData(data)
      setUnassignedJobs(data.unassignedJobsList ?? [])
      setUnassigned(
        (data.unassignedCrewsList ?? []).map((crew) => ({
          id: crew._id,
          name: crew.name,
          leadName: crew.name,
          rate: 0,
          color: crew.crewColor,
          memberCount: crew.members?.length ?? 0,
        })),
      )
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const overBudget = cardData?.jobsOverBudget ?? []
  const overBudgetAmount = overBudget.reduce((sum, job) => sum + (job.overBudgetBy ?? 0), 0)
  const percentChange = cardData?.laborCost.percentChange ?? 0

  return (
    <div className="dash">
      <Sidebar active="Dashboard" />

      <main className="dash__main">

        <h1 className="dash__title">Dashboard</h1>
        <p className="dash__subtitle">Overview of your operations</p>

        {error && <p className="dash__error">{error}</p>}

        <div className="stat-grid">
          <StatCard
            icon={<Hammer size={18} weight="regular" />}
            label="Active Jobs"
            value={loading ? '—' : String(cardData?.jobs.activeJobs ?? 0)}
            sub={`${cardData?.jobs.totalJobs ?? 0} Total Jobs`}
          />
          <StatCard
            icon={<Users size={18} weight="regular" />}
            label="Crews Assigned"
            value={loading ? '—' : String(cardData?.crews.totalCrewsAssigned ?? 0)}
            sub={`${cardData?.crews.totalCrewMembers ?? 0} Total Crew Members`}
          />
          <StatCard
            icon={<Money size={18} weight="regular" />}
            label="Weekly Labor Cost"
            value={loading ? '—' : formatMoney(cardData?.laborCost.thisWeek ?? 0)}
            badge={percentChange ? `${percentChange > 0 ? '▲' : '▼'} ${Math.abs(percentChange)}%` : undefined}
            sub={`Last week: ${formatMoney(cardData?.laborCost.lastWeek ?? 0)}`}
          />
          <StatCard
            icon={<WarningCircle size={18} weight="regular" />}
            label="Jobs Over Budget"
            value={loading ? '—' : String(overBudget.length)}
            valueClass={overBudget.length ? 'text-danger' : ''}
            sub={overBudgetAmount ? `+${formatMoney(overBudgetAmount)}` : 'On budget'}
            subClass={overBudgetAmount ? 'text-danger' : ''}
          />
        </div>

        <div className="dash__columns">
          <UnassignedCrewList
            crews={unassigned}
            onAssignJob={(crew) => setFlow({ step: 'assignJob', crew })}
          />
          <div className="panel">
            <div className="panel__head">
              <h2>Unassigned Jobs</h2>
            </div>
            {unassignedJobs.length === 0 ? (
              <p className="empty-state">{loading ? 'Loading…' : 'All jobs are assigned.'}</p>
            ) : (
              <ul className="unassigned-list">
                {unassignedJobs.map((item) => (
                  <li key={item._id} className="unassigned-item">
                    <span className="unassigned-item__name">{item.Name}</span>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() =>
                        setFlow({
                          step: 'assignCrew',
                          crew: unassigned[0] ?? { id: 'tmp', name: 'Unassigned', leadName: 'TBD', rate: 0 },
                          job: toJob(item),
                          note: '',
                        })
                      }
                    >
                      Assign Crew
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      {flow.step === 'assignJob' && (
        <AssignJobModal
          crew={flow.crew}
          date={TODAY}
          onCancel={() => setFlow({ step: 'none' })}
          onSuccess={() => {
            fetchDashboardData()
            setFlow({ step: 'none' })
          }}
        />
      )}

      {flow.step === 'jobDetails' && (
        <JobDetailsModal
          job={flow.job}
          crew={flow.crew}
          note={flow.note}
          onDone={() => setFlow({ step: 'none' })}
          onChangeCrew={() => setFlow({ step: 'assignCrew', crew: flow.crew, job: flow.job, note: flow.note })}
          onRemoveCrew={() => {
            setUnassigned((list) => [...list, flow.crew])
            setFlow({ step: 'none' })
          }}
        />
      )}

      {flow.step === 'assignCrew' && (
        <AssignCrewModal
          job={flow.job}
          jobId={flow.job?.id}
          onCancel={() => setFlow({ step: 'none' })}
          onSuccess={() => {
            fetchDashboardData()
            setFlow({ step: 'none' })
          }}
        />
      )}

      {flow.step === 'crewDetails' && (
        <CrewDetailsModal
          job={flow.job}
          crewLead={flow.crewLead}
          note={flow.note}
          onDone={() => setFlow({ step: 'none' })}
          onEditJob={() => setFlow({ step: 'jobForm', job: flow.job })}
        />
      )}

      {flow.step === 'jobForm' && (
        <CreateJobModal
          job={flow.job}
          onCancel={() => setFlow({ step: 'none' })}
          onSubmit={(data) => {
            if (flow.job) {
              const updated = { ...flow.job, ...data, laborBudgetTotal: data.laborBudgetTotal }
              setJobs((list) => list.map((j) => (j.id === flow.job!.id ? updated : j)))
            } else {
              const seq = nextJobSeq++
              const newJob: Job = {
                id: `j${seq}`,
                name: data.name,
                color: data.color,
                bidNo: String(seq),
                jobNo: String(jobs.length + 1).padStart(3, '0'),
                gc: data.gc,
                estimator: 'TBD',
                startDate: data.startDate,
                endDate: data.endDate,
                contractAmount: data.contractAmount,
                laborBudgetUsed: 0,
                laborBudgetTotal: data.laborBudgetTotal,
              }
              setJobs((list) => [...list, newJob])
            }
            setFlow({ step: 'none' })
          }}
        />
      )}
    </div>
  )
}
