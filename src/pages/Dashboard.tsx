import { useState } from 'react'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import StatCard from '../components/dashboard/StatCard'
import ActivityList from '../components/dashboard/ActivityList'
import UnassignedCrewList from '../components/dashboard/UnassignedCrewList'
import AssignJobModal from '../components/dashboard/AssignJobModal'
import JobDetailsModal from '../components/dashboard/JobDetailsModal'
import AssignCrewModal from '../components/dashboard/AssignCrewModal'
import CrewDetailsModal from '../components/dashboard/CrewDetailsModal'
import CreateJobModal from '../components/dashboard/CreateJobModal'
import CreateCrewModal from '../components/dashboard/CreateCrewModal'
import { Icon } from '../components/dashboard/icons'
import {
  crewLeads,
  initialUnassignedCrews,
  jobs as initialJobs,
  type CrewLead,
  type Job,
  type UnassignedCrew,
} from '../lib/dashboardData'
import './Dashboard.css'

const TODAY = '13-07-2026'

type Flow =
  | { step: 'none' }
  | { step: 'assignJob'; crew: UnassignedCrew }
  | { step: 'jobDetails'; crew: UnassignedCrew; job: Job; note: string }
  | { step: 'assignCrew'; crew: UnassignedCrew; job: Job; note: string }
  | { step: 'crewDetails'; job: Job; crewLead: CrewLead; note: string }
  | { step: 'jobForm'; job?: Job }
  | { step: 'crewForm' }

let nextJobSeq = 1054

export default function Dashboard() {
  const [jobs, setJobs] = useState(initialJobs)
  const [unassigned, setUnassigned] = useState(initialUnassignedCrews)
  const [flow, setFlow] = useState<Flow>({ step: 'none' })

  return (
    <div className="dash">
      <Sidebar active="Dashboard" />

      <main className="dash__main">
        <Topbar
          onAddJob={() => setFlow({ step: 'jobForm' })}
          onCreateCrew={() => setFlow({ step: 'crewForm' })}
        />

        <h1 className="dash__title">Dashboard</h1>
        <p className="dash__subtitle">Overview of your operations</p>

        <div className="stat-grid">
          <StatCard icon={<Icon.Wrench />} label="Active Jobs" value="13" sub="24 Total Jobs" />
          <StatCard icon={<Icon.Users />} label="Crews Assigned" value="6" sub="34 Total Crew Members" />
          <StatCard
            icon={<Icon.Panel />}
            label="Weekly Labor Cost"
            value="$7,695"
            badge="▲ 13%"
            sub="Last week: $6,983"
          />
          <StatCard
            icon={<Icon.AlertCircle />}
            label="Jobs Over Budget"
            value="1"
            valueClass="text-danger"
            sub="+$1,213"
            subClass="text-danger"
          />
        </div>

        <div className="dash__columns">
          <ActivityList />
          <UnassignedCrewList
            crews={unassigned}
            onAssignJob={(crew) => setFlow({ step: 'assignJob', crew })}
          />
        </div>
      </main>

      {flow.step === 'assignJob' && (
        <AssignJobModal
          crew={flow.crew}
          date={TODAY}
          jobs={jobs}
          onCancel={() => setFlow({ step: 'none' })}
          onAssign={(jobId, note) => {
            const job = jobs.find((j) => j.id === jobId)
            if (!job) return
            setUnassigned((list) => list.filter((c) => c.id !== flow.crew.id))
            setFlow({ step: 'jobDetails', crew: flow.crew, job, note })
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
          onCancel={() => setFlow({ step: 'jobDetails', crew: flow.crew, job: flow.job, note: flow.note })}
          onAssign={(crewLeadId, note) => {
            const crewLead = crewLeads.find((c) => c.id === crewLeadId)
            if (!crewLead) return
            setFlow({ step: 'crewDetails', job: flow.job, crewLead, note })
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

      {flow.step === 'crewForm' && (
        <CreateCrewModal
          jobs={jobs}
          onCancel={() => setFlow({ step: 'none' })}
          onSubmit={(data) => {
            const lead = crewLeads.find((c) => c.id === data.crewLeadId)
            if (lead) {
              setUnassigned((list) => [
                ...list,
                { id: `u-${Date.now()}`, name: data.crewName, leadName: lead.name, rate: lead.rate },
              ])
            }
            setFlow({ step: 'none' })
          }}
        />
      )}
    </div>
  )
}
