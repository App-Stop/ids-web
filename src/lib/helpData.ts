export type HelpCategory = 'Getting Started' | 'Operations' | 'Management' | 'Account'

export type HelpStep = {
  title: string
  body: string
  /** Label for the empty visual placeholder shown with this step. */
  media?: string
}

export type HelpArticle = {
  id: string
  title: string
  summary: string
  category: HelpCategory
  /** Matches a key in ARTICLE_ICONS on the Help Center page. */
  icon: string
  minutes: number
  intro: string
  steps: HelpStep[]
  tips?: string[]
}

export const HELP_CATEGORIES: HelpCategory[] = ['Getting Started', 'Operations', 'Management', 'Account']

export const helpArticles: HelpArticle[] = [
  {
    id: 'signing-in',
    title: 'Signing In & Passwords',
    summary: 'Sign in to your account, and recover access if you have forgotten your password.',
    category: 'Getting Started',
    icon: 'signIn',
    minutes: 2,
    intro:
      'Every user gets their own account. Your role decides what you can change — admins can manage the team, while other roles work day to day in the schedule, crew and timesheet screens.',
    steps: [
      {
        title: 'Sign in',
        body: 'Enter the email address your administrator invited and your password, then select Sign In. You land on the Dashboard.',
        media: 'Screenshot — Sign In screen',
      },
      {
        title: 'Request a reset link',
        body: 'If you cannot remember your password, choose Forgot Password on the sign-in screen and enter your email. A reset link is sent to that address.',
        media: 'Screenshot — Forgot Password screen',
      },
      {
        title: 'Set a new password',
        body: 'Open the link, type your new password twice and confirm. You are returned to the sign-in screen to log in with the new password.',
        media: 'Screenshot — Reset Password screen',
      },
    ],
    tips: [
      'Reset links are single use — request a fresh one if you have already opened it.',
      'Only an admin can change the email address on an account.',
    ],
  },
  {
    id: 'navigating',
    title: 'Finding Your Way Around',
    summary: 'The sidebar, page layout, zoom controls and how the app behaves on smaller screens.',
    category: 'Getting Started',
    icon: 'compass',
    minutes: 3,
    intro:
      'Every screen shares the same frame: navigation on the left, the page title and its toolbar at the top, and the working area below.',
    steps: [
      {
        title: 'Use the sidebar',
        body: 'Navigation is split into Operations (Dashboard, Schedule Board, Jobs Management, Cost Tracking) and Management (Crew, Timesheet). Your profile sits at the bottom.',
        media: 'Screenshot — Expanded sidebar',
      },
      {
        title: 'Collapse for more room',
        body: 'Select the panel icon beside the logo to shrink the sidebar to an icon rail. Wide screens like the Schedule Board benefit most. Your choice is remembered between visits.',
        media: 'Screenshot — Collapsed icon rail',
      },
      {
        title: 'Zoom a table',
        body: 'Table-heavy pages carry a zoom control in the toolbar. Use minus and plus to fit more rows and columns on screen without changing your browser zoom.',
        media: 'Screenshot — Zoom control in a page toolbar',
      },
      {
        title: 'Work on a tablet or phone',
        body: 'On small screens the sidebar becomes a bar along the bottom, and wide tables scroll sideways. Drag anywhere inside a table to pan it.',
        media: 'Screenshot — Mobile navigation bar',
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Reading the Dashboard',
    summary: 'Your daily snapshot: active jobs, unassigned crews and the day’s activity.',
    category: 'Operations',
    icon: 'dashboard',
    minutes: 3,
    intro:
      'The Dashboard answers one question first thing in the morning: what is running today, and who still needs a job?',
    steps: [
      {
        title: 'Scan the stat cards',
        body: 'The cards across the top summarise active jobs, crews on site, hours logged and budget health for the current period.',
        media: 'Screenshot — Dashboard stat cards',
      },
      {
        title: 'Review today’s jobs',
        body: 'The job list shows each active job with its assigned crew and colour marker. Select a job to open its details.',
        media: 'Screenshot — Today’s jobs list',
      },
      {
        title: 'Clear the unassigned list',
        body: 'Crews with no work for the day appear under Unassigned Crew. Select Assign Crew beside a crew to place it on a job straight away.',
        media: 'Screenshot — Unassigned crew panel',
      },
    ],
    tips: ['An empty Unassigned Crew list means every crew has work booked for the day.'],
  },
  {
    id: 'assign-crew',
    title: 'Assigning a Crew to a Job',
    summary: 'The full assign flow, changing an assignment, and removing a crew from a job.',
    category: 'Operations',
    icon: 'assign',
    minutes: 4,
    intro:
      'Assignment always follows the same three screens — pick the job, pick the crew, confirm the details — whether you start from the Dashboard, the Schedule Board or Jobs Management.',
    steps: [
      {
        title: 'Start the assignment',
        body: 'Select Assign Crew next to an unassigned crew on the Dashboard, or open a job and choose Assign Crew.',
        media: 'Screenshot — Assign Crew entry points',
      },
      {
        title: 'Choose the job',
        body: 'Pick the job from the list and add an optional note for the crew lead — access instructions, equipment, a site contact.',
        media: 'Screenshot — Assign Job modal',
      },
      {
        title: 'Confirm the details',
        body: 'The details screen shows the contract amount, labour budget, dates and the assigned crew lead with their hourly rate. Select Done to save.',
        media: 'Screenshot — Job Details modal',
      },
      {
        title: 'Change or remove a crew',
        body: 'Reopen the job and choose Change Crew to swap in a different crew, or Remove Crew to free it up. Removing asks for confirmation and cannot be undone.',
        media: 'Screenshot — Remove crew confirmation',
      },
    ],
    tips: [
      'Cancel on the Assign Crew screen closes the flow and returns you to the Dashboard.',
      'A removed crew returns to the Unassigned Crew list immediately.',
    ],
  },
  {
    id: 'schedule-board',
    title: 'Using the Schedule Board',
    summary: 'Plan the week or month, drag assignments across days, and attach notes.',
    category: 'Operations',
    icon: 'calendar',
    minutes: 5,
    intro:
      'The Schedule Board is a grid: jobs down the left, days across the top. Each coloured pill is one crew booked on one job for a run of days.',
    steps: [
      {
        title: 'Switch weekly or monthly',
        body: 'Weekly opens the full left-hand table with the contractor and supervisor columns. Monthly trades that detail for a wider date range.',
        media: 'Screenshot — Weekly and monthly views side by side',
      },
      {
        title: 'Move through dates',
        body: 'The arrows beside the date range step one week or one month at a time. Use the calendar button to jump to a specific date.',
        media: 'Screenshot — Date range controls',
      },
      {
        title: 'Show or hide job details',
        body: 'The handle on the divider between the job columns and the calendar opens the extra columns — General Contractor, GC Super, IDS Super and contract value.',
        media: 'Screenshot — Job detail columns expanded',
      },
      {
        title: 'Extend an assignment',
        body: 'Drag either end of a pill sideways to change its start or end day. Drop it on another job row to move the booking.',
        media: 'Screenshot — Dragging a pill to extend it',
      },
      {
        title: 'Add a note',
        body: 'Select the note badge on a pill to add, edit or delete a note. Pills with a note show a filled badge, and hovering previews the text.',
        media: 'Screenshot — Assignment note badge and tooltip',
      },
    ],
    tips: ['Filter to a single job with the All Jobs dropdown when the board gets busy.'],
  },
  {
    id: 'jobs-management',
    title: 'Managing Jobs',
    summary: 'Create and edit jobs, track status, and watch labour budgets.',
    category: 'Operations',
    icon: 'jobs',
    minutes: 4,
    intro:
      'Jobs Management is the full register of work — awarded, in progress and completed — with the contract and labour budget behind each one.',
    steps: [
      {
        title: 'Create a job',
        body: 'Select Create Job and fill in the name, general contractor, estimator, dates, contract amount and labour budget. New jobs start with the status Awarded.',
        media: 'Screenshot — Create Job form',
      },
      {
        title: 'Find a job',
        body: 'Search by name or job number, narrow the list with the Status filter, and reorder it with Sort by — newest, hourly rate, crew size or alphabetical.',
        media: 'Screenshot — Jobs toolbar with filters',
      },
      {
        title: 'Read the labour budget bar',
        body: 'Each row shows labour spent against budget. The bar turns green while there is room, orange on awarded work and red with a warning marker once the budget is exceeded.',
        media: 'Screenshot — Labour budget column',
      },
      {
        title: 'Open a job',
        body: 'Select a job number to open its details — contract, budget, dates, assigned crew lead and any note. Edit the job from the row menu.',
        media: 'Screenshot — Job details modal',
      },
    ],
  },
  {
    id: 'cost-tracking',
    title: 'Tracking Costs',
    summary: 'Log daily labour and dumpster costs, and check them against the budget.',
    category: 'Operations',
    icon: 'cost',
    minutes: 4,
    intro:
      'Cost Tracking is the daily record of what a job actually costs — crew hours and disposal — so the labour budget on each job stays honest.',
    steps: [
      {
        title: 'Read the summary cards',
        body: 'Total labour, dumpster cost, hours and entries for the selected period, each compared against the period before.',
        media: 'Screenshot — Cost Tracking summary cards',
      },
      {
        title: 'Filter the entries',
        body: 'Narrow the table by job, crew or date range. The summary cards update to match whatever the filters leave on screen.',
        media: 'Screenshot — Cost Tracking filters',
      },
      {
        title: 'Add an entry',
        body: 'Log a new cost against a job with the date, crew, hours and any dumpster charge. Entries feed straight into the job’s labour budget.',
        media: 'Screenshot — Add cost entry form',
      },
    ],
    tips: ['A job over budget is flagged here and on the Jobs Management list.'],
  },
  {
    id: 'crew-management',
    title: 'Managing Crews & Roster',
    summary: 'Build crews, assign leads, and keep the member roster up to date.',
    category: 'Management',
    icon: 'crew',
    minutes: 4,
    intro:
      'The Crew page has two tabs. Crew lists the working teams and what they are booked on; Roster lists every individual and the crew they belong to.',
    steps: [
      {
        title: 'Switch between Crew and Roster',
        body: 'Use the toggle in the toolbar. The search box, filters and sort follow whichever tab you are on.',
        media: 'Screenshot — Crew and Roster tabs',
      },
      {
        title: 'Create a crew',
        body: 'Choose Add New, then Crew. Name the crew, pick the lead, set the hourly rate and add members. The crew colour is used across the Schedule Board.',
        media: 'Screenshot — Create Crew form',
      },
      {
        title: 'Add a member',
        body: 'Choose Add New, then Member. Record the name, role, hourly rate and status, then place them on a crew.',
        media: 'Screenshot — Add Member form',
      },
      {
        title: 'Review assignments',
        body: 'The Crew tab lists the jobs each crew is booked on. Select one to open its details, or assign a job to a crew that is free.',
        media: 'Screenshot — Crew jobs column',
      },
    ],
    tips: [
      'Crews with no current work show the status Unassigned.',
      'Filter the Crew tab by job to see who is on a particular site.',
    ],
  },
  {
    id: 'timesheet',
    title: 'Logging Attendance',
    summary: 'Record hours, review the week or month, and correct an entry.',
    category: 'Management',
    icon: 'timesheet',
    minutes: 4,
    intro: 'The Timesheet is the hours record behind payroll and the labour figures on every job.',
    steps: [
      {
        title: 'Log attendance',
        body: 'Select Log Attendance, choose the member and job, then set the date and hours worked.',
        media: 'Screenshot — Log Attendance form',
      },
      {
        title: 'Choose a period',
        body: 'Switch between Today, Weekly and Monthly. Weekly and monthly views add a Summary or Detailed choice — totals per member, or every individual entry.',
        media: 'Screenshot — Period and view controls',
      },
      {
        title: 'Narrow the list',
        body: 'Search by member, filter to specific people, and reorder with Sort by — newest, hours or name.',
        media: 'Screenshot — Timesheet filters',
      },
      {
        title: 'Correct an entry',
        body: 'Open the menu at the end of a row to edit or delete an entry. Corrections flow through to Cost Tracking.',
        media: 'Screenshot — Timesheet row menu',
      },
    ],
  },
  {
    id: 'profile-team',
    title: 'Your Profile & Team',
    summary: 'Update your details, manage team access, and choose your notifications.',
    category: 'Account',
    icon: 'profile',
    minutes: 3,
    intro: 'The Profile screen holds three tabs: your own settings, the team who can sign in, and notification preferences.',
    steps: [
      {
        title: 'Update your details',
        body: 'Change your name, email and photo under Profile Settings. Your role is set by an administrator and is read only.',
        media: 'Screenshot — Profile Settings tab',
      },
      {
        title: 'Change your password',
        body: 'Enter your current password, then the new one twice, and save.',
        media: 'Screenshot — Change password fields',
      },
      {
        title: 'Manage the team',
        body: 'Admins can add a member with their name, email and role — Super Admin, Controller or Ops Manager — and edit or remove people later.',
        media: 'Screenshot — Manage Team tab',
      },
      {
        title: 'Set notifications',
        body: 'Choose in-app or email alerts for budget overruns, schedule changes, new assignments, daily briefings and cost logs.',
        media: 'Screenshot — Notification preferences',
      },
    ],
    tips: ['Removing a team member revokes their access immediately.'],
  },
]

export function findHelpArticle(id: string | undefined) {
  return helpArticles.find((a) => a.id === id)
}
