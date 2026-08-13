import { useNavigate } from "react-router-dom";
import {
  SquaresFour,
  CalendarBlank,
  Hammer,
  CurrencyCircleDollar,
  Users,
  ListChecks,
  SidebarSimple,
  GearSix,
  User,
  Question,
} from "@phosphor-icons/react";
import logo from "../../assets/sidebar logo.png";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";

const OPERATIONS = [
  // { label: "Dashboard", icon: SquaresFour, path: "/dashboard" },
  { label: "Schedule Board", icon: CalendarBlank, path: "/schedule-board" },
  { label: "Jobs Management", icon: Hammer, path: "/jobs-management" },
  {
    label: "Cost Tracking",
    icon: CurrencyCircleDollar,
    path: "/cost-tracking",
  },
];

const MANAGEMENT = [
  { label: "Crew Management", icon: Users, path: "/crew-management" },
  { label: "Timesheet", icon: ListChecks, path: "/timesheet" },
];

const SUPPORT = [
  { label: "Help Center", icon: Question, path: "/help-center" },
];

const MOBILE_NAV = [
  ...OPERATIONS,
  ...MANAGEMENT,
  ...SUPPORT,
  { label: "Profile", icon: User, path: "/profile" },
];

export default function Sidebar({
  active,
  collapsed: collapsedProp,
  onCollapsedChange,
}: {
  active: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const [internalCollapsed, setInternalCollapsed] = useSidebarCollapsed();
  const collapsed = collapsedProp ?? internalCollapsed;
  const setCollapsed = (next: boolean) => {
    if (collapsedProp === undefined) setInternalCollapsed(next);
    onCollapsedChange?.(next);
  };
  const navigate = useNavigate();

  return (
    <>
      <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
        {collapsed ? (
          <>
            <div className="sidebar__rail">
              <button
                type="button"
                className="sidebar__icon-btn"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <SidebarSimple size={20} weight="regular" />
              </button>

              <div className="sidebar__rail-sep" />

              {OPERATIONS.map(({ label, icon: IconCmp, path }) => (
                <button
                  key={label}
                  type="button"
                  className={`sidebar__icon-btn ${active === label ? "is-active" : ""}`}
                  title={label}
                  onClick={() => path && navigate(path)}
                >
                  <IconCmp
                    size={20}
                    weight={active === label ? "fill" : "regular"}
                  />
                </button>
              ))}

              <div className="sidebar__rail-sep" />

              {MANAGEMENT.map(({ label, icon: IconCmp, path }) => (
                <button
                  key={label}
                  type="button"
                  className={`sidebar__icon-btn ${active === label ? "is-active" : ""}`}
                  title={label}
                  onClick={() => path && navigate(path)}
                >
                  <IconCmp
                    size={20}
                    weight={active === label ? "fill" : "regular"}
                  />
                </button>
              ))}

              <div className="sidebar__rail-sep" />

              {SUPPORT.map(({ label, icon: IconCmp, path }) => (
                <button
                  key={label}
                  type="button"
                  className={`sidebar__icon-btn ${active === label ? "is-active" : ""}`}
                  title={label}
                  onClick={() => path && navigate(path)}
                >
                  <IconCmp
                    size={20}
                    weight={active === label ? "fill" : "regular"}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              className="sidebar__profile-pill"
              onClick={() => navigate("/profile")}
              aria-label="Open profile"
            >
              <span className="sidebar__profile-avatar">
                <User size={20} weight="regular" />
              </span>
            </button>
          </>
        ) : (
          <>
            <div className="sidebar__panel">
              <div className="sidebar__brand">
                <div className="sidebar_logo">
                  <img src={logo} alt="IDS Demolition" />
                  <h2 className="sidebar_text">IDS Demolition</h2>
                </div>
                <button
                  type="button"
                  className="sidebar__icon-btn sidebar__collapse-btn"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse sidebar"
                >
                  <SidebarSimple size={20} weight="regular" />
                </button>
              </div>

              <nav className="sidebar__nav">
                <p className="sidebar__group">Operations</p>
                {OPERATIONS.map(({ label, icon: IconCmp, path }) => (
                  <button
                    key={label}
                    className={`sidebar__item ${active === label ? "is-active" : ""}`}
                    type="button"
                    onClick={() => path && navigate(path)}
                  >
                    <IconCmp
                      size={20}
                      weight={active === label ? "fill" : "regular"}
                    />
                    {label}
                  </button>
                ))}

                <p className="sidebar__group">Management</p>
                {MANAGEMENT.map(({ label, icon: IconCmp, path }) => (
                  <button
                    key={label}
                    className={`sidebar__item ${active === label ? "is-active" : ""}`}
                    type="button"
                    onClick={() => path && navigate(path)}
                  >
                    <IconCmp
                      size={20}
                      weight={active === label ? "fill" : "regular"}
                    />
                    {label}
                  </button>
                ))}

                <p className="sidebar__group">Support</p>
                {SUPPORT.map(({ label, icon: IconCmp, path }) => (
                  <button
                    key={label}
                    className={`sidebar__item ${active === label ? "is-active" : ""}`}
                    type="button"
                    onClick={() => path && navigate(path)}
                  >
                    <IconCmp
                      size={20}
                      weight={active === label ? "fill" : "regular"}
                    />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            <button
              type="button"
              className="sidebar__user sidebar__user--button"
              onClick={() => navigate("/profile")}
            >
              <span className="sidebar__profile-avatar sidebar__profile-avatar--lg">
                <User size={18} weight="regular" />
              </span>
              <div className="sidebar__user-info">
                <strong>Hank Yocum</strong>
                <span>Admin</span>
              </div>
              <GearSix size={18} weight="regular" />
            </button>
          </>
        )}
      </aside>

      <nav className="sidebar-mobile-nav" aria-label="Mobile navigation">
        {MOBILE_NAV.map(({ label, icon: IconCmp, path }) => (
          <button
            key={label}
            type="button"
            className={`sidebar-mobile-nav__item ${active === label ? "is-active" : ""}`}
            onClick={() => path && navigate(path)}
            aria-current={active === label ? "page" : undefined}
          >
            <IconCmp size={18} weight={active === label ? "fill" : "regular"} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
