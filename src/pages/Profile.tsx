import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import MemberFormModal, { type MemberFormData } from '../components/dashboard/MemberFormModal'
import { Icon } from '../components/dashboard/icons'
import { crewMenuOptions } from '../lib/crewData'
import './Dashboard.css'
import './Profile.css'

type Tab = 'settings' | 'team' | 'notifications'

const TEAM_MEMBERS = [
  { id: 'r68', rosterId: '#8742', member: 'Hank Williams', joinDate: '02-21-2026', role: 'Super Admin', rate: '30' },
  { id: 'r64a', rosterId: '#4638', member: 'Tammy Tomlinson', joinDate: '02-21-2026', role: 'Controller', rate: '40' },
]

const NOTIFICATION_ITEMS = [
  {
    title: 'Budget Overruns',
    description: 'Get notified when a job exceeds its labor budget.',
    inApp: true,
    email: false,
  },
  {
    title: 'Crew Schedule Changes',
    description: 'Get notified when a crew schedule is modified.',
    inApp: true,
    email: false,
  },
  {
    title: 'New Crew Assignments',
    description: 'Receive alerts for new crew member assignments.',
    inApp: true,
    email: true,
  },
  {
    title: 'Daily Briefing Updates',
    description: 'Stay informed with daily updates on crew briefings.',
    inApp: false,
    email: false,
  },
  {
    title: 'Daily Cost Logs',
    description: 'Get a summary when daily costs are logged.',
    inApp: true,
    email: false,
  },
]

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button type="button" className={`profile-tab ${active ? 'is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

function ToggleChip({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className={`profile-toggle ${checked ? 'is-active' : ''}`}>
      <span className="profile-toggle__box">{checked ? <Icon.Check width={12} height={12} /> : null}</span>
      {label}
    </span>
  )
}

export default function Profile() {
  const [tab, setTab] = useState<Tab>('settings')
  const [teamMembers, setTeamMembers] = useState(TEAM_MEMBERS)
  const [activeMember, setActiveMember] = useState<(typeof TEAM_MEMBERS)[number] | null>(null)
  const navigate = useNavigate()

  function openMemberModal(member: (typeof TEAM_MEMBERS)[number]) {
    setActiveMember(member)
  }

  function closeMemberModal() {
    setActiveMember(null)
  }

  function handleSubmitMember(data: MemberFormData) {
    if (!activeMember) return

    setTeamMembers((list) =>
      list.map((member) =>
        member.id === activeMember.id
          ? {
              ...member,
              member: `${data.firstName} ${data.lastName}`.trim(),
              role: data.role,
              rate: data.rate,
            }
          : member,
      ),
    )

    closeMemberModal()
  }

  return (
    <div className="dash profile-page">
      <Sidebar active="Profile" />

      <main className="dash__main profile-page__main">
        <Topbar onAddJob={() => {}} onCreateCrew={() => {}} />

        <div className="profile-page__header">
          <div>
            <h1 className="dash__title profile-page__title">Profile</h1>
            <p className="dash__subtitle">Manage your account settings and preferences</p>
          </div>

          <button type="button" className="profile-logout" onClick={() => navigate('/')}>
            <Icon.ArrowRight width={16} height={16} />
            Log Out
          </button>
        </div>

        <div className="profile-tabs" role="tablist" aria-label="Profile sections">
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
            Profile Settings
          </TabButton>
          <TabButton active={tab === 'team'} onClick={() => setTab('team')}>
            Manage Team
          </TabButton>
          <TabButton active={tab === 'notifications'} onClick={() => setTab('notifications')}>
            Notifications
          </TabButton>
        </div>

        {tab === 'settings' && (
          <section className="profile-card profile-card--settings">
            <div className="profile-photo-row">
              <div className="profile-photo">H</div>
              <button type="button" className="btn profile-upload-btn">
                Upload Photo
              </button>
            </div>

            <div className="profile-grid">
              <label className="profile-field">
                <span>First Name</span>
                <input defaultValue="Hank" />
              </label>
              <label className="profile-field">
                <span>Last Name</span>
                <input defaultValue="Yokum" />
              </label>
              <label className="profile-field">
                <span>Email Address</span>
                <input defaultValue="Hank" />
              </label>
              <label className="profile-field">
                <span>Role</span>
                <input defaultValue="Admin" readOnly />
              </label>
            </div>

            <div className="profile-password">
              <h2>Change Password</h2>
              <div className="profile-password__grid">
                <label className="profile-field profile-field--full">
                  <span>Current Password</span>
                  <input placeholder="Enter your current password" type="password" />
                </label>
                <label className="profile-field profile-field--full">
                  <span>New Password</span>
                  <input placeholder="Enter new password" type="password" />
                </label>
                <label className="profile-field profile-field--full">
                  <span>Confirm New Password</span>
                  <input placeholder="Re-enter new password" type="password" />
                </label>
              </div>
            </div>

            <div className="profile-actions">
              <button type="button" className="btn profile-secondary-btn">
                Reset
              </button>
              <button type="button" className="btn btn--primary">
                Save Changes
              </button>
            </div>
          </section>
        )}

        {tab === 'team' && (
          <section className="profile-team">
            <div className="profile-card profile-card--team">
              <div className="profile-table">
              <div className="profile-table__head">
                <span />
                <span>ID</span>
                <span>Member</span>
                <span>Join Date</span>
                <span>Role</span>
                <span>Action</span>
              </div>
              {teamMembers.map((member) => (
                <div className="profile-table__row" key={member.id}>
                  <span className="profile-table__check">
                    <input type="checkbox" aria-label={`Select ${member.member}`} />
                  </span>
                  <span>{member.rosterId}</span>
                  <span className="profile-member">
                    <span className="profile-member__avatar">{member.member.charAt(0)}</span>
                    {member.member}
                  </span>
                  <span>{member.joinDate}</span>
                  <span>
                    <button type="button" className="profile-role-pill">
                      {member.role}
                      <Icon.ChevronDown width={14} height={14} />
                    </button>
                  </span>
                  <span>
                    <button
                      type="button"
                      className="profile-edit-btn"
                      aria-label={`Edit ${member.member}`}
                      onClick={() => openMemberModal(member)}
                    >
                      <Icon.Edit width={16} height={16} />
                    </button>
                  </span>
                </div>
              ))}
              </div>
            </div>

            <div className="profile-team__footer">
              <button type="button" className="btn btn--primary profile-add-team-btn">
                <Icon.Plus width={16} height={16} />
                Add Team
              </button>
            </div>
          </section>
        )}

        {tab === 'notifications' && (
          <section className="profile-card profile-card--notifications">
            <h2>Notification Preferences</h2>
            <div className="profile-notifications">
              {NOTIFICATION_ITEMS.map((item) => (
                <div className="profile-notification" key={item.title}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                  <div className="profile-notification__toggles">
                    <ToggleChip checked={item.inApp} label="In App" />
                    <ToggleChip checked={item.email} label="Email" />
                  </div>
                </div>
              ))}
            </div>

            <div className="profile-actions profile-actions--end">
              <button type="button" className="btn profile-secondary-btn">
                Reset Preferences
              </button>
            </div>
          </section>
        )}
      </main>

      {activeMember && (
        <MemberFormModal
          mode="edit"
          crews={crewMenuOptions}
          initial={{
            firstName: activeMember.member.split(' ')[0] ?? '',
            lastName: activeMember.member.split(' ').slice(1).join(' ') || '',
            emailLocalPart: activeMember.member.toLowerCase().replace(/\s+/g, ''),
            role: activeMember.role === 'Super Admin' ? 'Crew Lead' : 'Labor',
            crewId: crewMenuOptions[0]?.id ?? null,
            rate: activeMember.rate,
          }}
          onCancel={closeMemberModal}
          onSubmit={handleSubmitMember}
          onRemove={() => {
            setTeamMembers((list) => list.filter((member) => member.id !== activeMember.id))
            closeMemberModal()
          }}
        />
      )}
    </div>
  )
}
