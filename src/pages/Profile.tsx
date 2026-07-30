import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretDown, Plus, SignOut, Trash, User } from '@phosphor-icons/react'
import Avatar from '../components/dashboard/Avatar'
import Modal from '../components/dashboard/Modal'
import Sidebar from '../components/dashboard/Sidebar'
import Topbar from '../components/dashboard/Topbar'
import { Icon } from '../components/dashboard/icons'
import './Dashboard.css'
import './Profile.css'

type Tab = 'settings' | 'team' | 'notifications'
type MemberRole = 'Super Admin' | 'Controller' | 'Ops Manager'
type TeamMember = {
  id: string
  rosterId: string
  member: string
  joinDate: string
  role: MemberRole
  emailLocalPart: string
  emailDomain: string
}
type NotificationItem = {
  title: string
  description: string
  inApp: boolean
  email: boolean
}
type MemberDraft = {
  firstName: string
  lastName: string
  emailLocalPart: string
  emailDomain: string
  role: MemberRole
}
type MemberModalState =
  | { type: 'none' }
  | { type: 'add'; form: MemberDraft }
  | { type: 'edit'; memberId: string; form: MemberDraft }

const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'r68',
    rosterId: '#8742',
    member: 'Hank Williams',
    joinDate: '02-21-2026',
    role: 'Super Admin',
    emailLocalPart: 'hankwilliams',
    emailDomain: '@ids-work.com',
  },
  {
    id: 'r64a',
    rosterId: '#4638',
    member: 'Tammy Tomlinson',
    joinDate: '02-21-2026',
    role: 'Controller',
    emailLocalPart: 'tammytomlinson',
    emailDomain: '@ids-work.com',
  },
]

const INITIAL_NOTIFICATION_ITEMS: NotificationItem[] = [
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

function ToggleChip({
  checked,
  label,
  onClick,
}: {
  checked: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" className={`profile-toggle ${checked ? 'is-active' : ''}`} onClick={onClick}>
      <span className="profile-toggle__box">{checked ? <Icon.Check width={12} height={12} /> : null}</span>
      {label}
    </button>
  )
}

export default function Profile() {
  const [tab, setTab] = useState<Tab>('settings')
  const [teamMembers, setTeamMembers] = useState(TEAM_MEMBERS)
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATION_ITEMS)
  const [memberModal, setMemberModal] = useState<MemberModalState>({ type: 'none' })
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  function updateNotification(title: string, key: 'inApp' | 'email') {
    setNotifications((list) => list.map((item) => (item.title === title ? { ...item, [key]: !item[key] } : item)))
  }

  function openAddMember() {
    setMemberModal({
      type: 'add',
      form: {
        firstName: 'Gene',
        lastName: 'Byars',
        emailLocalPart: 'johndoe',
        emailDomain: '@idsdemo.com',
        role: 'Ops Manager',
      },
    })
  }

  function openEditMember(member: TeamMember) {
    const [firstName, ...rest] = member.member.split(' ')
    setMemberModal({
      type: 'edit',
      memberId: member.id,
      form: {
        firstName,
        lastName: rest.join(' '),
        emailLocalPart: member.emailLocalPart,
        emailDomain: member.emailDomain,
        role: member.role,
      },
    })
  }

  function closeMemberModal() {
    setMemberModal({ type: 'none' })
  }

  function updateMemberForm<K extends keyof MemberDraft>(key: K, value: MemberDraft[K]) {
    setMemberModal((current) => (current.type === 'none' ? current : { ...current, form: { ...current.form, [key]: value } }))
  }

  function saveMember() {
    if (memberModal.type === 'none') return
    const fullName = `${memberModal.form.firstName} ${memberModal.form.lastName}`.trim()

    if (memberModal.type === 'add') {
      setTeamMembers((list) => [
        ...list,
        {
          id: `member-${Date.now()}`,
          rosterId: `#${Math.floor(100 + Math.random() * 900)}`,
          member: fullName,
          joinDate: '02-21-2026',
          role: memberModal.form.role,
          emailLocalPart: memberModal.form.emailLocalPart,
          emailDomain: memberModal.form.emailDomain,
        },
      ])
    } else {
      setTeamMembers((list) =>
        list.map((member) =>
          member.id === memberModal.memberId
            ? {
                ...member,
                member: fullName,
                role: memberModal.form.role,
                emailLocalPart: memberModal.form.emailLocalPart,
                emailDomain: memberModal.form.emailDomain,
              }
            : member,
        ),
      )
    }

    closeMemberModal()
  }

  function removeMember() {
    if (memberModal.type !== 'edit') return
    setTeamMembers((list) => list.filter((member) => member.id !== memberModal.memberId))
    closeMemberModal()
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const nextUrl = URL.createObjectURL(file)
    setProfilePhotoUrl((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
      return nextUrl
    })
    e.target.value = ''
  }

  return (
    <div className="dash profile-page">
      <Sidebar active="Profile" />

      <main className="dash__main profile-page__main">
        <Topbar />

        <div className="profile-page__header">
          <div>
            <h1 className="dash__title profile-page__title">Profile</h1>
            <p className="dash__subtitle">Manage your account settings and preferences</p>
          </div>
        </div>

        <div className="profile-tabs-row">
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
          <button type="button" className="profile-logout" onClick={() => navigate('/')}>
            <SignOut size={16} weight="regular" />
            Log Out
          </button>
        </div>

        {tab === 'settings' && (
          <section className="profile-card profile-card--settings">
            <div className="profile-photo-row">
              <div className="profile-photo">
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="Profile" className="profile-photo__img" />
                ) : (
                  <User size={44} weight="thin" />
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="profile-photo-input"
                onChange={handlePhotoChange}
              />
              <button type="button" className="btn profile-upload-btn" onClick={() => photoInputRef.current?.click()}>
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
                <input defaultValue="Admin" readOnly className="profile-field__readonly" />
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
                      <Avatar name={member.member} size={28} />
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
                        onClick={() => openEditMember(member)}
                    >
                      <Icon.Edit width={16} height={16} />
                    </button>
                  </span>
                </div>
              ))}
              </div>
            </div>

            <div className="profile-team__footer">
              <button type="button" className="btn btn--primary profile-add-team-btn" onClick={openAddMember}>
                <Plus size={16} weight="bold" />
                Add Team
              </button>
            </div>
          </section>
        )}

        {tab === 'notifications' && (
          <section className="profile-card profile-card--notifications">
            <h2>Notification Preferences</h2>
            <div className="profile-notifications">
              {notifications.map((item) => (
                <div className="profile-notification" key={item.title}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                  <div className="profile-notification__toggles">
                    <ToggleChip checked={item.inApp} label="In App" onClick={() => updateNotification(item.title, 'inApp')} />
                    <ToggleChip checked={item.email} label="Email" onClick={() => updateNotification(item.title, 'email')} />
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

      {memberModal.type === 'add' && (
        <Modal onClose={closeMemberModal} width={720}>
          <div className="profile-modal">
            <h2 className="profile-modal__title">Add New Member</h2>

            <div className="profile-modal__two-up">
              <label className="profile-modal__field">
                <span>First Name*</span>
                <input value={memberModal.form.firstName} onChange={(e) => updateMemberForm('firstName', e.target.value)} />
              </label>
              <label className="profile-modal__field">
                <span>Last Name*</span>
                <input value={memberModal.form.lastName} onChange={(e) => updateMemberForm('lastName', e.target.value)} />
              </label>
            </div>

            <label className="profile-modal__field">
              <span>Email address</span>
              <div className="profile-email-row">
                <input
                  value={memberModal.form.emailLocalPart}
                  onChange={(e) => updateMemberForm('emailLocalPart', e.target.value)}
                />
                <input value={memberModal.form.emailDomain} onChange={(e) => updateMemberForm('emailDomain', e.target.value)} />
              </div>
            </label>

            <label className="profile-modal__field">
              <span>Role</span>
              <div className="profile-modal__select-wrap">
                <select value={memberModal.form.role} onChange={(e) => updateMemberForm('role', e.target.value as MemberRole)}>
                  <option>Ops Manager</option>
                  <option>Controller</option>
                  <option>Super Admin</option>
                </select>
                <CaretDown size={22} weight="regular" />
              </div>
            </label>

            <div className="profile-modal__actions">
              <button type="button" className="btn profile-secondary-btn" onClick={closeMemberModal}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={saveMember}>
                Add to Team
              </button>
            </div>
          </div>
        </Modal>
      )}

      {memberModal.type === 'edit' && (
        <Modal onClose={closeMemberModal} width={740}>
          <div className="profile-modal">
            <div className="profile-modal__head">
              <h2 className="profile-modal__title">Edit Member</h2>
              <span className="profile-modal__meta">ID #001</span>
            </div>

            <label className="profile-modal__field">
              <span>Name*</span>
              <input
                value={`${memberModal.form.firstName} ${memberModal.form.lastName}`.trim()}
                onChange={(e) => {
                  const parts = e.target.value.split(' ')
                  updateMemberForm('firstName', parts[0] ?? '')
                  updateMemberForm('lastName', parts.slice(1).join(' '))
                }}
              />
            </label>

            <label className="profile-modal__field">
              <span>Email</span>
              <div className="profile-email-row">
                <input
                  value={memberModal.form.emailLocalPart}
                  onChange={(e) => updateMemberForm('emailLocalPart', e.target.value)}
                />
                <input value={memberModal.form.emailDomain} onChange={(e) => updateMemberForm('emailDomain', e.target.value)} />
              </div>
            </label>

            <div className="profile-modal__footer">
              <button type="button" className="profile-remove-btn" onClick={removeMember}>
                <Trash size={20} weight="regular" />
                Remove Member
              </button>

              <div className="profile-modal__actions">
                <button type="button" className="btn profile-secondary-btn" onClick={closeMemberModal}>
                  Cancel
                </button>
                <button type="button" className="btn btn--primary" onClick={saveMember}>
                  Update
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
