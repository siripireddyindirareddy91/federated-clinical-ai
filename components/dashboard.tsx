"use client";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  LayoutDashboard,
  Hospital,
  Database,
  Network,
  ShieldCheck,
  BrainCircuit,
  Stethoscope,
  Boxes,
  ChartNoAxesCombined,
  FileText,
  ScrollText,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Play,
  RefreshCw,
  Download,
  Check,
  CheckCheck,
  LockKeyhole,
  Menu,
  X,
  LogOut,
  LoaderCircle,
  Users,
  Clock,
  Server,
  GitBranch,
  Eye,
  Info,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  MoreHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { api, post, pct, human } from "@/lib/api";
type Data = Record<string, any>;
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["hospitals", "Hospitals", Hospital],
  ["datasets", "Datasets", Database],
  ["federated-learning", "Federated Learning", Network],
  ["agents", "AI Agents", BrainCircuit],
  ["clinical-research", "Clinical Research", Stethoscope],
  ["models", "Model Registry", Boxes],
  ["analytics", "Analytics", ChartNoAxesCombined],
  ["privacy", "Privacy & Security", ShieldCheck],
  ["reports", "Reports", FileText],
] as const;
const features = [
  "age",
  "gender_category",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "glucose_level",
  "cholesterol_level",
  "bmi",
  "heart_rate",
  "medical_history_flag",
];
const initialCase = {
  age: 57,
  gender_category: 0,
  blood_pressure_systolic: 142,
  blood_pressure_diastolic: 86,
  glucose_level: 145,
  cholesterol_level: 220,
  bmi: 29,
  heart_rate: 78,
  medical_history_flag: 1,
};
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span />
      {children}
    </span>
  );
}
function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <GitBranch size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
function Panel({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: any;
  tone?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function PerformanceChart({ rounds }: { rounds: Data[] }) {
  const data = [...rounds]
    .reverse()
    .map((r) => ({
      round: `R${r.number}`,
      Accuracy: +(r.metrics.accuracy * 100).toFixed(1),
      "F1 score": +(r.metrics.f1 * 100).toFixed(1),
      "ROC-AUC": r.metrics.roc_auc ? +(r.metrics.roc_auc * 100).toFixed(1) : 0,
    }));
  return data.length ? (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 15, right: 12, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="accuracy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15a99b" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#15a99b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#edf0f4"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="round"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#81909f" }}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#81909f" }}
            unit="%"
          />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="Accuracy"
            stroke="#0f998d"
            fill="url(#accuracy)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
          <Area
            type="monotone"
            dataKey="F1 score"
            stroke="#8c78df"
            fill="transparent"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <Empty
      title="Your first round starts the story"
      description="Train a federated model to see measured holdout performance here."
    />
  );
}
function download(kind: string, format = "csv") {
  window.open(
    `/api/reports/${kind}?format=${format}`,
    "_blank",
    "noopener,noreferrer",
  );
}

export default function Dashboard({ route }: { route: string }) {
  const section = route.split("/")[0],
    title =
      nav.find((n) => n[0] === section)?.[1] ||
      ({ settings: "Settings", "audit-logs": "Audit Logs" } as Data)[section] ||
      "Overview";
  const [user, setUser] = useState<Data | null>(null),
    [data, setData] = useState<Data>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<Data | null>(null),
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false),
    [profile, setProfile] = useState(false),
    [query, setQuery] = useState(""),
    [searching, setSearching] = useState(false),
    [privacyForm, setPrivacyForm] = useState<Data>({}),
    [caseForm, setCaseForm] = useState<Data>(initialCase),
    [selectedHospitals, setSelectedHospitals] = useState<string[]>([]),
    [comment, setComment] = useState(""),
    [algorithm, setAlgorithm] = useState("logistic"),
    [health, setHealth] = useState<Data>({});
  const isAdmin = user?.role === "super_admin",
    canEdit = ["super_admin", "hospital_admin", "researcher"].includes(
      user?.role || "",
    );
  const load = useCallback(async () => {
    const next = await api("/workspace");
    setUser(next.user);
    setHealth(next.health);
    setData(next);
    setPrivacyForm(next.privacy);
  }, [section]);
  useEffect(() => {
    let active = true;
    api("/auth/me")
      .then(async (u) => {
        if (!active) return;
        setUser(u);
        await load();
        api("/health").then(setHealth);
      })
      .catch((e) => {
        if (e.message === "Sign in to continue") location.href = "/login";
        else setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [load]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      api("/federated/rounds")
        .then((rounds) => setData((d) => ({ ...d, rounds })))
        .catch(() => {});
      api("/agents/executions")
        .then((executions) => setData((d) => ({ ...d, executions })))
        .catch(() => {});
    }, 1800);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function act(
    action: () => Promise<any>,
    success: string,
    detail = false,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      await load();
      setToast(success);
      if (detail) setModal({ type: "result", title: success, result });
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function train() {
    act(
      () =>
        post("/federated/rounds/start", { hospital_ids: selectedHospitals }),
      "Federated round completed. Metrics are ready.",
    );
  }
  const hs: Data[] = data.hospitals || [],
    rounds: Data[] = data.rounds || [],
    models: Data[] = data.models || [],
    o = data.overview || {},
    activeModel = o.model;
  const searchResults = [
    ...nav.map(([id, label]) => ({
      id,
      label,
      url: id === "overview" ? "/dashboard" : `/dashboard/${id}`,
    })),
    ...hs.map((h) => ({
      id: h.id,
      label: h.name,
      url: "/dashboard/hospitals",
    })),
  ].filter((r) => r.label.toLowerCase().includes(query.toLowerCase()));
  const actionButton = (
    <button className="btn primary" disabled={busy || !isAdmin} onClick={train}>
      {busy ? <LoaderCircle size={16} className="spin" /> : <Play size={15} />}
      Start training round
    </button>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Activity size={23} />
          </span>
          MediFed<span className="brand-ai">AI</span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">
            <Network size={19} />
          </span>
          <div>
            <strong>Research workspace</strong>
            <small>Federated network</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <Link
              key={id}
              href={id === "overview" ? "/dashboard" : `/dashboard/${id}`}
              className={`nav-item ${section === id ? "active" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "agents" && <small>8</small>}
              {section === id && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="nav-caption">PLATFORM</span>
          <Link
            href="/dashboard/audit-logs"
            className={`nav-item ${section === "audit-logs" ? "active" : ""}`}
          >
            <ScrollText size={18} />
            Audit Logs
          </Link>
          <Link
            href="/dashboard/settings"
            className={`nav-item ${section === "settings" ? "active" : ""}`}
          >
            <Settings size={18} />
            Settings
          </Link>
          <div className="privacy-note">
            <ShieldCheck size={21} />
            <strong>Privacy starts here.</strong>
            <p>
              Only synthetic data.
              <br />
              Every result, human reviewed.
            </p>
            <Link href="/dashboard/privacy">
              Explore privacy controls <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="sidebar-status">
            <span className="live-dot" />
            Research demo <span>v1.0</span>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            Workspace <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <div className="search-box">
              <Search size={15} />
              <input
                aria-label="Search modules and hospitals"
                placeholder="Search anything..."
                value={query}
                onFocus={() => setSearching(true)}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>⌘ K</kbd>
              {searching && (
                <div className="search-results">
                  <div className="popover-title">
                    Navigate{" "}
                    <button
                      className="icon-btn"
                      onClick={() => setSearching(false)}
                      aria-label="Close search"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {searchResults.length ? (
                    searchResults.slice(0, 8).map((r) => (
                      <Link
                        key={r.id}
                        href={r.url}
                        onClick={() => setSearching(false)}
                      >
                        {r.label}
                        <ArrowUpRight size={13} />
                      </Link>
                    ))
                  ) : (
                    <p>No matches found.</p>
                  )}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <div className="popover-anchor">
              <button
                className="icon-btn notification-button"
                aria-label="Notifications"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                {o.pending_reviews > 0 && <i />}
              </button>
              {notifications && (
                <div className="popover">
                  <strong>Research notifications</strong>
                  <p>
                    {o.pending_reviews || 0} research artifacts await review.
                  </p>
                  <Link href="/dashboard/clinical-research">
                    Open review queue <ArrowRight size={14} />
                  </Link>
                  <p className="tiny">
                    {rounds.length} completed federated rounds.
                  </p>
                </div>
              )}
            </div>
            <div className="popover-anchor">
              <button
                className="profile-button"
                onClick={() => setProfile(!profile)}
              >
                <span className="avatar">
                  {user?.name
                    ?.split(" ")
                    .map((x: string) => x[0])
                    .join("") || "…"}
                </span>
                <div>
                  <strong>{user?.name || "Loading"}</strong>
                  <small>{human(user?.role || "researcher")}</small>
                </div>
                <ChevronDown size={13} />
              </button>
              {profile && (
                <div className="popover">
                  <strong>{user?.email}</strong>
                  <p>{human(user?.role || "")}</p>
                  <button
                    className="btn secondary full"
                    onClick={async () => {
                      await post("/auth/logout");
                      location.href = "/login";
                    }}
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="research-banner">
            <span>
              <ShieldCheck size={14} /> SYNTHETIC RESEARCH ENVIRONMENT
            </span>
            <p>
              {health.durable_storage === false
                ? "Temporary demo storage · May reset between server instances"
                : "Experimental outputs only · No medical diagnosis or treatment decisions"}
            </p>
            <Link href="/dashboard/privacy">
              View safeguards <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {section === "overview"
                  ? "YOUR FEDERATED RESEARCH, AT A GLANCE"
                  : "MEDIFED RESEARCH WORKSPACE"}
              </div>
              <h1>
                {section === "overview" ? "Network overview" : title}
                {section === "overview" && <span className="heading-dot" />}
              </h1>
              <p>
                {
                  (
                    {
                      overview:
                        "Better intelligence, together. Keep your data where it belongs.",
                      hospitals:
                        "Manage the institutions powering your collaborative research network.",
                      datasets:
                        "Explore, validate, and prepare synthetic data inside hospital boundaries.",
                      "federated-learning":
                        "Train together. Exchange model updates. Keep source records local.",
                      agents:
                        "Eight specialized agents. One transparent, executable workflow.",
                      "clinical-research":
                        "Explore experimental outputs with feature explanations and human review.",
                      models:
                        "A traceable history of every experimental model.",
                      analytics:
                        "Measured performance across your research network.",
                      privacy:
                        "Transparent controls for an educational privacy-preserving workflow.",
                      reports:
                        "Export calculated research results and audit evidence.",
                      "audit-logs":
                        "An accountable record of activity across the platform.",
                      settings:
                        "Manage access, roles, and your research environment.",
                    } as Data
                  )[section]
                }
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="btn secondary small"
                disabled={busy}
                onClick={() => act(load, "Workspace refreshed")}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              {["overview", "federated-learning"].includes(section) &&
                actionButton}
              {section === "agents" && (
                <button
                  className="btn primary"
                  disabled={busy || !isAdmin}
                  onClick={() =>
                    act(
                      () =>
                        post("/agents/workflow/start", { hospital_ids: [] }),
                      "Agent workflow finished",
                      true,
                    )
                  }
                >
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  Run workflow
                </button>
              )}
              {section === "hospitals" && isAdmin && (
                <button
                  className="btn primary"
                  onClick={() =>
                    setModal({
                      type: "hospital",
                      name: "",
                      location: "",
                      active: true,
                    })
                  }
                >
                  <Plus size={16} />
                  Register hospital
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="alert error" role="alert">
              <AlertTriangle size={17} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {busy && (
            <div className="progress-bar">
              <div />
            </div>
          )}
          {loading ? (
            <div className="skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : (
            <>
              {section === "overview" && (
                <>
                  <div className="metrics-grid">
                    <Metric
                      label="Connected hospitals"
                      value={o.hospitals}
                      detail={`${o.active_participants} actively participating`}
                      icon={Hospital}
                    />
                    <Metric
                      label="Global model accuracy"
                      value={pct(o.accuracy)}
                      detail={
                        activeModel
                          ? `${activeModel.version} · Measured holdout accuracy`
                          : "Run your first round to evaluate"
                      }
                      icon={ChartNoAxesCombined}
                      tone="purple"
                    />
                    <Metric
                      label="Completed rounds"
                      value={o.completed_rounds}
                      detail="Weighted FedAvg aggregation"
                      icon={Network}
                      tone="blue"
                    />
                    <Metric
                      label="Privacy budget remaining"
                      value={`${Math.max(0, (o.privacy?.budget_limit || 0) - (o.privacy?.spent || 0)).toFixed(1)} ε`}
                      detail="Educational accounting ledger"
                      icon={ShieldCheck}
                      tone="amber"
                    />
                  </div>
                  <div className="overview-grid">
                    <Panel
                      title="Federated model performance"
                      subtitle="Real held-out evaluation across completed rounds"
                      action={
                        <Link
                          className="subtle-link"
                          href="/dashboard/analytics"
                        >
                          View analytics <ArrowUpRight size={14} />
                        </Link>
                      }
                    >
                      <PerformanceChart rounds={rounds} />
                    </Panel>
                    <Panel
                      title="Network health"
                      subtitle="Your collaboration, in sync"
                      action={<Badge>Operational</Badge>}
                    >
                      <div className="health-ring">
                        <div>
                          <strong>
                            {o.active_participants || 0}
                            <span>/{o.hospitals || 0}</span>
                          </strong>
                          <small>active institutions</small>
                        </div>
                      </div>
                      <div className="health-list">
                        <span>
                          <i className="dot teal" />
                          Federated coordinator<strong>Ready</strong>
                        </span>
                        <span>
                          <i className="dot purple" />
                          Agent orchestration<strong>8 available</strong>
                        </span>
                        <span>
                          <i className="dot blue" />
                          Synthetic records
                          <strong>
                            {o.synthetic_records?.toLocaleString()}
                          </strong>
                        </span>
                      </div>
                      <Link
                        href="/dashboard/hospitals"
                        className="panel-footer-link"
                      >
                        Manage network <ArrowRight size={14} />
                      </Link>
                    </Panel>
                  </div>
                  <div className="section-heading">
                    <h2>
                      Hospital network <span>{hs.length} institutions</span>
                    </h2>
                    <Link href="/dashboard/hospitals">
                      View all hospitals <ArrowRight size={14} />
                    </Link>
                  </div>
                  <div className="hospital-mini-grid">
                    {hs.map((h, i) => (
                      <button
                        key={h.id}
                        className="hospital-mini"
                        onClick={() =>
                          setModal({ type: "hospital-detail", ...h })
                        }
                      >
                        <div className="hospital-mini-top">
                          <span className={`hospital-icon color-${i}`}>
                            <Hospital size={21} />
                          </span>
                          <Badge tone={h.active ? "green" : "gray"}>
                            {h.active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <h3>{h.name}</h3>
                        <p>{h.location}</p>
                        <div className="mini-divider" />
                        <div className="mini-stat">
                          <span>Synthetic records</span>
                          <strong>{h.dataset_size.toLocaleString()}</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Data boundary</span>
                          <strong>
                            <LockKeyhole size={11} /> Isolated
                          </strong>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="overview-bottom">
                    <Panel
                      title="Recent activity"
                      subtitle="A traceable research workflow"
                      action={
                        <Link
                          href="/dashboard/audit-logs"
                          className="subtle-link"
                        >
                          View audit log <ArrowUpRight size={13} />
                        </Link>
                      }
                    >
                      <div className="activity-list">
                        {(data.activities || []).slice(0, 4).map((a: Data) => (
                          <div className="activity-item" key={a.id}>
                            <span className="activity-icon">
                              <CheckCheck size={16} />
                            </span>
                            <div>
                              <strong>{a.action}</strong>
                              <p>
                                {a.actor} {a.detail && `· ${a.detail}`}
                              </p>
                            </div>
                            <small>
                              {new Date(a.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                          </div>
                        ))}
                      </div>
                    </Panel>
                    <Panel
                      title="Responsible by design"
                      subtitle="Research outputs need human context"
                    >
                      <div className="responsible-card">
                        <ShieldCheck size={28} />
                        <h3>People stay in control.</h3>
                        <p>
                          Every prediction is an experimental research artifact.
                          Review model limitations and fairness before approving
                          a result.
                        </p>
                        <Link href="/dashboard/clinical-research">
                          Open research workspace <ArrowRight size={14} />
                        </Link>
                      </div>
                    </Panel>
                  </div>
                </>
              )}
              {section === "hospitals" && (
                <>
                  <div className="metrics-grid three">
                    <Metric
                      label="Registered institutions"
                      value={hs.length}
                      detail="Synthetic research network"
                      icon={Hospital}
                    />
                    <Metric
                      label="Active participants"
                      value={hs.filter((h) => h.active).length}
                      detail="Eligible for training rounds"
                      icon={Network}
                    />
                    <Metric
                      label="Synthetic records"
                      value={o.synthetic_records?.toLocaleString()}
                      detail="Logically isolated by hospital"
                      icon={Database}
                    />
                  </div>
                  <div className="hospital-full-grid">
                    {hs.map((h, i) => (
                      <Panel
                        key={h.id}
                        title={h.name}
                        subtitle={h.location}
                        action={
                          <Badge tone={h.active ? "green" : "gray"}>
                            {h.active ? "Active" : "Paused"}
                          </Badge>
                        }
                      >
                        <div className="hospital-details">
                          <Hospital className={`color-${i}`} size={32} />
                          <dl>
                            <div>
                              <dt>Institution type</dt>
                              <dd>{h.institution_type}</dd>
                            </div>
                            <div>
                              <dt>Synthetic records</dt>
                              <dd>{h.dataset_size}</dd>
                            </div>
                            <div>
                              <dt>Research contact</dt>
                              <dd>{h.contact}</dd>
                            </div>
                            <div>
                              <dt>Registered</dt>
                              <dd>
                                {new Date(h.created_at).toLocaleDateString()}
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <div className="panel-actions">
                          <button
                            className="btn secondary small"
                            onClick={() =>
                              setModal({ type: "hospital-detail", ...h })
                            }
                          >
                            <Eye size={14} />
                            View profile
                          </button>
                          {(isAdmin || user?.hospital_id === h.id) && (
                            <button
                              className="btn secondary small"
                              onClick={() =>
                                setModal({ type: "hospital", ...h })
                              }
                            >
                              <Settings size={14} />
                              Configure
                            </button>
                          )}
                        </div>
                      </Panel>
                    ))}
                  </div>
                </>
              )}
              {section === "datasets" && (
                <>
                  <div className="alert info">
                    <Info size={17} />
                    Only the documented numeric schema is accepted. Upload
                    synthetic records only; identifiers are prohibited.
                    <a className="text-link" href="/api/synthetic/sample">
                      Download sample CSV
                    </a>
                  </div>
                  {canEdit && (
                    <Panel
                      title="Add a synthetic cohort"
                      subtitle="CSV · up to 2 MB · up to 10,000 records"
                    >
                      <form
                        className="upload-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const body = new FormData(form);
                          await act(
                            () =>
                              api("/datasets/upload", { method: "POST", body }),
                            "Synthetic dataset uploaded",
                          );
                          form.reset();
                        }}
                      >
                        <label>
                          Hospital boundary
                          <select name="hospital_id" required>
                            {hs
                              .filter(
                                (h) => isAdmin || h.id === user?.hospital_id,
                              )
                              .map((h) => (
                                <option value={h.id} key={h.id}>
                                  {h.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Synthetic CSV
                          <input
                            type="file"
                            name="file"
                            accept=".csv"
                            required
                          />
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            name="synthetic"
                            value="true"
                            required
                          />
                          I confirm this contains only synthetic data.
                        </label>
                        <button className="btn primary" disabled={busy}>
                          <Plus size={15} />
                          Upload dataset
                        </button>
                      </form>
                    </Panel>
                  )}
                  <Panel
                    title="Your hospital datasets"
                    subtitle="Backend authorization enforces the hospital boundary"
                  >
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Dataset</th>
                            <th>Hospital</th>
                            <th>Records</th>
                            <th>Quality</th>
                            <th>Preprocessing</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.datasets || []).map((d: Data) => (
                            <tr key={d.id}>
                              <td>
                                <strong>{d.name}</strong>
                                <small className="block muted">
                                  Synthetic cohort
                                </small>
                              </td>
                              <td>
                                {hs.find((h) => h.id === d.hospital_id)?.name}
                              </td>
                              <td>{d.row_count}</td>
                              <td>
                                <Badge
                                  tone={d.validation.passed ? "green" : "amber"}
                                >
                                  {d.validation.quality_score}%
                                </Badge>
                              </td>
                              <td>
                                {d.preprocessed ? "Configured" : "Pending"}
                              </td>
                              <td>
                                <button
                                  className="btn secondary small"
                                  onClick={async () => {
                                    const detail = await api(
                                      `/datasets/${d.id}`,
                                    );
                                    setModal({ type: "dataset", ...detail });
                                  }}
                                >
                                  Inspect <ChevronRight size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!data.datasets?.length && (
                        <Empty
                          title="No visible datasets"
                          description="Upload a synthetic cohort into your institution's isolated workspace."
                        />
                      )}
                    </div>
                  </Panel>
                </>
              )}
              {section === "federated-learning" && (
                <>
                  <div className="metrics-grid three">
                    <Metric
                      label="Training rounds"
                      value={rounds.length}
                      detail="Stored round history"
                      icon={GitBranch}
                    />
                    <Metric
                      label="Aggregation strategy"
                      value="FedAvg"
                      detail="Sample-weighted model parameters"
                      icon={Network}
                    />
                    <Metric
                      label="Current global accuracy"
                      value={pct(o.accuracy)}
                      detail="Calculated on local holdouts"
                      icon={ChartNoAxesCombined}
                    />
                  </div>
                  <Panel
                    title="Federated training network"
                    subtitle="Logical local training → masked updates → weighted aggregation → global model"
                  >
                    <div className="federation-visual">
                      <div className="federation-nodes">
                        {hs.map((h) => (
                          <label
                            className={`federation-node ${!h.active ? "inactive" : ""}`}
                            key={h.id}
                          >
                            <Hospital size={24} />
                            <strong>
                              {h.name.split(" ").slice(0, 2).join(" ")}
                            </strong>
                            <small>{h.dataset_size} synthetic records</small>
                            <input
                              aria-label={`Include ${h.name}`}
                              type="checkbox"
                              checked={selectedHospitals.includes(h.id)}
                              disabled={!h.active || busy}
                              onChange={(e) =>
                                setSelectedHospitals((s) =>
                                  e.target.checked
                                    ? [...s, h.id]
                                    : s.filter((id) => id !== h.id),
                                )
                              }
                            />
                            <span>
                              {h.active
                                ? "Local training ready"
                                : "Participation paused"}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="federation-flow">
                        <span>
                          <LockKeyhole size={19} />
                          Masked model updates
                        </span>
                        <ArrowRight size={20} />
                        <span className="aggregation">
                          <Network size={24} />
                          FedAvg coordinator
                        </span>
                        <ArrowRight size={20} />
                        <span>
                          <BrainCircuit size={24} />
                          Global model
                        </span>
                      </div>
                    </div>
                    <div className="panel-actions">
                      <small className="muted">
                        No selection includes all active hospitals. Only
                        administrators can start global training.
                      </small>
                      {actionButton}
                    </div>
                  </Panel>
                  <div className="alert info">
                    <Info size={17} />
                    In-process simulation: hospital nodes share a server.
                    Pairwise masking is educational and is not cryptographic
                    secure aggregation.
                  </div>
                  <Panel
                    title="Training history"
                    subtitle="Measured evaluations and reproducible round configuration"
                    action={
                      <button
                        className="btn secondary small"
                        onClick={() => download("federated")}
                      >
                        <Download size={14} />
                        Export
                      </button>
                    }
                  >
                    {rounds.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Round / version</th>
                              <th>Participants</th>
                              <th>Accuracy</th>
                              <th>F1 score</th>
                              <th>ROC-AUC</th>
                              <th>Duration</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rounds.map((r) => (
                              <tr
                                key={r.id}
                                onClick={() =>
                                  setModal({
                                    type: "result",
                                    title: `Round ${r.number} · ${r.version}`,
                                    result: r,
                                  })
                                }
                                className="clickable"
                              >
                                <td>
                                  <strong>Round {r.number}</strong>
                                  <small className="block muted">
                                    {r.version}
                                  </small>
                                </td>
                                <td>{r.participants.length} hospitals</td>
                                <td>{pct(r.metrics.accuracy)}</td>
                                <td>{pct(r.metrics.f1)}</td>
                                <td>{pct(r.metrics.roc_auc)}</td>
                                <td>{r.duration_seconds}s</td>
                                <td>
                                  <Badge>Completed</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        title="Ready for your first round"
                        description="Start actual local gradient training, followed by weighted parameter aggregation and holdout evaluation."
                      />
                    )}
                  </Panel>
                </>
              )}
              {section === "agents" && (
                <>
                  <div className="agent-grid">
                    {(data.agents || []).map((a: Data, i: number) => (
                      <button
                        className="agent-card"
                        key={a.id}
                        onClick={() =>
                          setModal({
                            type: "agent",
                            ...a,
                            steps: (data.executions || []).flatMap((e: Data) =>
                              e.steps.filter((s: Data) => s.agent === a.name),
                            ),
                          })
                        }
                      >
                        <div className="agent-card-top">
                          <span className={`agent-icon color-${i % 5}`}>
                            <BrainCircuit size={24} />
                          </span>
                          <Badge>Ready</Badge>
                        </div>
                        <small className="eyebrow">
                          AGENT {String(i + 1).padStart(2, "0")}
                        </small>
                        <h3>{a.name}</h3>
                        <p>
                          {
                            [
                              "Checks missing values, duplicates, numeric ranges, and class coverage.",
                              "Enforces participation and configured privacy budget gates.",
                              "Trains local nodes and aggregates sample-weighted model updates.",
                              "Calculates accuracy, precision, recall, F1, AUC, and confusion matrix.",
                              "Produces exact linear contributions and model feature weights.",
                              "Calculates demographic performance and flags accuracy gaps.",
                              "Summarizes measured research outcomes and model limitations.",
                              "Records workflow transitions and research audit evidence.",
                            ][i]
                          }
                        </p>
                        <span className="subtle-link">
                          Inspect execution history <ArrowUpRight size={14} />
                        </span>
                      </button>
                    ))}
                  </div>
                  <Panel
                    title="Workflow execution history"
                    subtitle="Conditional routing stops failed quality and privacy gates"
                  >
                    {data.executions?.length ? (
                      data.executions.map((e: Data) => (
                        <div className="execution" key={e.id}>
                          <div className="execution-head">
                            <strong>Workflow {e.id.slice(0, 8)}</strong>
                            <small>
                              {new Date(e.created_at).toLocaleString()}
                            </small>
                            <Badge
                              tone={e.status === "blocked" ? "amber" : "green"}
                            >
                              {human(e.status)}
                            </Badge>
                          </div>
                          <div className="execution-steps">
                            {e.steps.map((s: Data, i: number) => (
                              <button
                                key={i}
                                onClick={() =>
                                  setModal({
                                    type: "result",
                                    title: s.agent,
                                    result: s,
                                  })
                                }
                              >
                                <span
                                  className={
                                    s.status === "blocked"
                                      ? "step-blocked"
                                      : "step-completed"
                                  }
                                >
                                  {s.status === "blocked" ? (
                                    <X size={14} />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                </span>
                                <strong>{s.agent}</strong>
                                <small>{s.duration_ms}ms</small>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="No workflows executed yet"
                        description="Run the LangGraph workflow to exercise all eight agents with real model training."
                      />
                    )}
                  </Panel>
                </>
              )}
              {section === "clinical-research" && (
                <>
                  <div className="alert warning">
                    <AlertTriangle size={18} />
                    Experimental model output — not a medical diagnosis.
                    Approval applies to the research artifact only.
                  </div>
                  <div className="research-grid">
                    <Panel
                      title="Synthetic case explorer"
                      subtitle="Enter a synthetic feature profile for the active global model"
                    >
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          act(
                            () => post("/research/predict", caseForm),
                            "Research output generated",
                            false,
                          ).then((r) => {
                            if (r) setModal({ type: "case", ...r });
                          });
                        }}
                      >
                        <div className="form-grid">
                          {features.map((k) => (
                            <label key={k}>
                              {human(k)}
                              <input
                                type="number"
                                step={
                                  [
                                    "gender_category",
                                    "medical_history_flag",
                                    "age",
                                  ].includes(k)
                                    ? "1"
                                    : "0.1"
                                }
                                min={
                                  k === "gender_category" ||
                                  k === "medical_history_flag"
                                    ? 0
                                    : undefined
                                }
                                max={
                                  k === "gender_category" ||
                                  k === "medical_history_flag"
                                    ? 1
                                    : undefined
                                }
                                value={caseForm[k]}
                                onChange={(e) =>
                                  setCaseForm({
                                    ...caseForm,
                                    [k]: Number(e.target.value),
                                  })
                                }
                                required
                              />
                            </label>
                          ))}
                        </div>
                        <div className="panel-actions">
                          <small className="muted">
                            Active model:{" "}
                            {activeModel?.version || "Train a round first"}
                          </small>
                          <button
                            className="btn primary"
                            disabled={
                              busy || !activeModel || user?.role === "auditor"
                            }
                          >
                            <BrainCircuit size={16} />
                            Generate research output
                          </button>
                        </div>
                      </form>
                    </Panel>
                    <Panel
                      title="Interpret with care"
                      subtitle="Transparent methods, bounded claims"
                    >
                      <div className="limitations">
                        <ShieldCheck size={32} />
                        <h3>Research, with context.</h3>
                        <p>
                          The model learns a synthetic binary label generated
                          from known features. Its accuracy does not imply
                          performance on real patient data.
                        </p>
                        <ul>
                          <li>
                            Exact log-odds contributions, not SHAP estimates.
                          </li>
                          <li>
                            Probabilities are experimental and uncalibrated.
                          </li>
                          <li>
                            Two synthetic gender categories are a limited
                            fairness demonstration.
                          </li>
                          <li>
                            No diagnosis, treatment, or medicine
                            recommendations.
                          </li>
                        </ul>
                      </div>
                    </Panel>
                  </div>
                  <Panel
                    title="Research artifacts & review queue"
                    subtitle="Human review is retained with the artifact"
                  >
                    {data.cases?.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Research artifact</th>
                              <th>Experimental output</th>
                              <th>Probability</th>
                              <th>Model</th>
                              <th>Review status</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {data.cases.map((c: Data) => (
                              <tr key={c.id}>
                                <td>
                                  <strong>Case {c.id.slice(0, 8)}</strong>
                                  <small className="block muted">
                                    {new Date(c.created_at).toLocaleString()}
                                  </small>
                                </td>
                                <td>{c.risk_category}</td>
                                <td>{pct(c.probability)}</td>
                                <td>{c.model_version}</td>
                                <td>
                                  <Badge
                                    tone={
                                      c.review_status === "approved"
                                        ? "green"
                                        : "amber"
                                    }
                                  >
                                    {human(c.review_status)}
                                  </Badge>
                                </td>
                                <td>
                                  <button
                                    className="btn secondary small"
                                    onClick={() => {
                                      setComment("");
                                      setModal({ type: "case", ...c });
                                    }}
                                  >
                                    Review <ArrowUpRight size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        title="Explore your first synthetic case"
                        description="Generate an experimental output after training a global model."
                      />
                    )}
                  </Panel>
                </>
              )}
              {section === "models" && (
                <Panel
                  title="Experimental model registry"
                  subtitle="Every completed round registers a traceable version"
                  action={
                    <button
                      className="btn secondary small"
                      onClick={() => download("models")}
                    >
                      <Download size={14} />
                      Export metrics
                    </button>
                  }
                >
                  {models.length ? (
                    <div className="model-list">
                      {models.map((m) => (
                        <article className="model-card" key={m.id}>
                          <div className="model-card-head">
                            <span className="model-icon">
                              <Boxes size={25} />
                            </span>
                            <div>
                              <h3>{m.name}</h3>
                              <p>
                                {m.version} · {m.algorithm}
                              </p>
                            </div>
                            <Badge
                              tone={m.status === "active" ? "green" : "gray"}
                            >
                              {human(m.status)}
                            </Badge>
                          </div>
                          <div className="model-metrics">
                            {[
                              "accuracy",
                              "precision",
                              "recall",
                              "f1",
                              "roc_auc",
                            ].map((k) => (
                              <div key={k}>
                                <small>{human(k)}</small>
                                <strong>{pct(m.metrics[k])}</strong>
                              </div>
                            ))}
                          </div>
                          <div className="model-footer">
                            <small>
                              {new Date(m.created_at).toLocaleString()} ·{" "}
                              {m.aggregation}
                            </small>
                            <div className="button-row">
                              <button
                                className="btn secondary small"
                                onClick={() =>
                                  setModal({ type: "model", ...m })
                                }
                              >
                                View details <Eye size={14} />
                              </button>
                              {isAdmin && (
                                <button
                                  disabled={busy}
                                  className="btn secondary small"
                                  onClick={() =>
                                    act(
                                      () =>
                                        post(`/models/${m.id}/status`, {
                                          action:
                                            m.status === "active"
                                              ? "archive"
                                              : "activate",
                                        }),
                                      "Model status updated",
                                    )
                                  }
                                >
                                  {m.status === "active"
                                    ? "Archive"
                                    : "Activate version"}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="No model versions yet"
                      description="A completed federated round automatically registers its global model."
                    />
                  )}
                </Panel>
              )}
              {section === "analytics" && (
                <>
                  <div className="metrics-grid">
                    <Metric
                      label="Accuracy"
                      value={pct(activeModel?.metrics.accuracy)}
                      detail="Held-out synthetic records"
                      icon={ChartNoAxesCombined}
                    />
                    <Metric
                      label="Precision"
                      value={pct(activeModel?.metrics.precision)}
                      detail="Positive predictive value"
                      icon={CheckCircle2}
                    />
                    <Metric
                      label="Recall"
                      value={pct(activeModel?.metrics.recall)}
                      detail="Synthetic positive coverage"
                      icon={Activity}
                    />
                    <Metric
                      label="F1 score"
                      value={pct(activeModel?.metrics.f1)}
                      detail="Precision / recall harmonic mean"
                      icon={GitBranch}
                    />
                  </div>
                  <Panel
                    title="Training performance"
                    subtitle="Calculated metrics across stored global model versions"
                  >
                    <PerformanceChart rounds={rounds} />
                  </Panel>
                  <div className="two-columns">
                    <Panel
                      title="Demographic fairness"
                      subtitle="Held-out performance by synthetic gender category"
                    >
                      {data.fairness?.length ? (
                        <>
                          <div className="chart">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={data.fairness.map((g: Data) => ({
                                  ...g,
                                  Accuracy: g.accuracy * 100,
                                  Recall: g.recall * 100,
                                }))}
                              >
                                <CartesianGrid
                                  vertical={false}
                                  stroke="#edf0f4"
                                />
                                <XAxis
                                  dataKey="group"
                                  tick={{ fontSize: 11 }}
                                />
                                <YAxis
                                  domain={[0, 100]}
                                  tick={{ fontSize: 11 }}
                                />
                                <Tooltip />
                                <Bar
                                  dataKey="Accuracy"
                                  fill="#14a397"
                                  radius={[5, 5, 0, 0]}
                                />
                                <Bar
                                  dataKey="Recall"
                                  fill="#9c8ad9"
                                  radius={[5, 5, 0, 0]}
                                />
                                <Legend />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="panel-note">
                            Accuracy gap: {pct(activeModel?.fairness_gap)} · A
                            gap over 10% triggers additional review.
                          </p>
                        </>
                      ) : (
                        <Empty
                          title="No fairness evaluation yet"
                          description="Train a global model to evaluate synthetic demographic groups."
                        />
                      )}
                    </Panel>
                    <Panel
                      title="Feature importance"
                      subtitle="Absolute standardized logistic regression coefficients"
                    >
                      {activeModel ? (
                        <div className="feature-bars">
                          {activeModel.feature_importance.map((f: Data) => (
                            <div key={f.feature}>
                              <div>
                                <span>{human(f.feature)}</span>
                                <strong>{f.importance.toFixed(3)}</strong>
                              </div>
                              <div className="bar-track">
                                <div
                                  style={{
                                    width: `${(f.importance / Math.max(...activeModel.feature_importance.map((x: Data) => x.importance))) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          title="Awaiting a trained model"
                          description="Feature weights appear after your first round."
                        />
                      )}
                    </Panel>
                  </div>
                  {activeModel && (
                    <Panel
                      title="Confusion matrix"
                      subtitle="Aggregated held-out results · rows: actual / columns: predicted"
                    >
                      <div className="confusion-matrix">
                        {activeModel.metrics.confusion_matrix
                          .flat()
                          .map((v: number, i: number) => (
                            <div key={i}>
                              <small>
                                {
                                  [
                                    "True negative",
                                    "False positive",
                                    "False negative",
                                    "True positive",
                                  ][i]
                                }
                              </small>
                              <strong>{v}</strong>
                            </div>
                          ))}
                      </div>
                    </Panel>
                  )}
                </>
              )}
              {section === "privacy" && (
                <>
                  <div className="alert warning">
                    <Info size={17} />
                    The privacy mechanisms here are educational simulations. No
                    formal differential privacy, production cryptographic
                    security, or regulatory compliance is claimed.
                  </div>
                  <div className="metrics-grid three">
                    <Metric
                      label="Recorded consumption"
                      value={`${data.privacy?.spent || 0} ε`}
                      detail="Educational epsilon ledger"
                      icon={Activity}
                    />
                    <Metric
                      label="Budget limit"
                      value={`${data.privacy?.budget_limit || 0} ε`}
                      detail="Training blocked when exhausted"
                      icon={SlidersHorizontal}
                    />
                    <Metric
                      label="Hospital isolation"
                      value="Enforced"
                      detail="Backend authorization per tenant"
                      icon={LockKeyhole}
                    />
                  </div>
                  <div className="two-columns">
                    <Panel
                      title="Privacy configuration"
                      subtitle="Administrators control the educational noise experiment"
                    >
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          act(
                            () =>
                              api("/privacy/config", {
                                method: "PUT",
                                body: JSON.stringify(privacyForm),
                              }),
                            "Privacy configuration saved",
                          );
                        }}
                      >
                        <div className="form-grid">
                          {[
                            "epsilon",
                            "delta",
                            "budget_limit",
                            "clip_norm",
                            "noise_multiplier",
                          ].map((k) => (
                            <label key={k}>
                              {human(k)}
                              <input
                                type="number"
                                step="any"
                                min="0.000001"
                                required
                                value={privacyForm[k] ?? ""}
                                disabled={!isAdmin}
                                onChange={(e) =>
                                  setPrivacyForm({
                                    ...privacyForm,
                                    [k]: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={!!privacyForm.enabled}
                            disabled={!isAdmin}
                            onChange={(e) =>
                              setPrivacyForm({
                                ...privacyForm,
                                enabled: e.target.checked,
                              })
                            }
                          />
                          Enable clipped update noise and educational budget
                          gate
                        </label>
                        <div className="panel-actions">
                          <span className="muted tiny">
                            Changing epsilon does not certify privacy.
                          </span>
                          <button
                            className="btn primary"
                            disabled={busy || !isAdmin}
                          >
                            Save configuration <Check size={15} />
                          </button>
                        </div>
                      </form>
                    </Panel>
                    <Panel
                      title="Safeguards & boundaries"
                      subtitle="Know what the research environment implements"
                    >
                      <div className="safeguard-list">
                        {[
                          [
                            "Hospital data isolation",
                            "Server-side authorization checks every private dataset and case request.",
                          ],
                          [
                            "Secure authentication",
                            "Scrypt password hashes, signed JWTs in HttpOnly cookies, and role checks.",
                          ],
                          [
                            "Educational masked aggregation",
                            "Pairwise numeric masks cancel in weighted sum space. No cryptographic protocol.",
                          ],
                          [
                            "Synthetic data only",
                            "Strict numeric CSV schema excludes identifying fields.",
                          ],
                          [
                            "Storage transparency",
                            health.durable_storage === false
                              ? "Vercel /tmp SQLite is temporary. Configure DATABASE_URL for durable PostgreSQL."
                              : "SQLAlchemy database storage. At-rest encryption depends on the host.",
                          ],
                        ].map(([t, d]) => (
                          <div key={t}>
                            <ShieldCheck size={19} />
                            <div>
                              <strong>{t}</strong>
                              <p>{d}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                </>
              )}
              {section === "reports" && (
                <div className="report-grid">
                  {[
                    [
                      "federated",
                      "Federated training history",
                      "Round configuration, measured evaluations, version history, and participation.",
                    ],
                    [
                      "privacy",
                      "Privacy audit report",
                      "Educational epsilon consumption and cumulative privacy budget records.",
                    ],
                    [
                      "models",
                      "Model evaluation report",
                      "Registered model versions, calculated metrics, and model status.",
                    ],
                  ].map(([kind, t, d]) => (
                    <Panel
                      key={kind}
                      title={t}
                      subtitle="GENERATED FROM STORED RESEARCH DATA"
                    >
                      <div className="report-body">
                        <FileText size={34} />
                        <p>{d}</p>
                        <span className="tiny muted">
                          Synthetic research only · Generated on demand
                        </span>
                      </div>
                      <div className="panel-actions">
                        <button
                          className="btn secondary"
                          onClick={() => download(kind)}
                        >
                          <Download size={15} />
                          CSV
                        </button>
                        <button
                          className="btn primary"
                          onClick={() => download(kind, "pdf")}
                        >
                          <Download size={15} />
                          PDF report
                        </button>
                      </div>
                    </Panel>
                  ))}
                </div>
              )}
              {section === "audit-logs" && (
                <Panel
                  title="Platform audit trail"
                  subtitle="Security and research workflow events"
                >
                  {["super_admin", "auditor"].includes(user?.role || "") ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Timestamp</th>
                            <th>Actor</th>
                            <th>Event</th>
                            <th>Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.audit || []).map((a: Data) => (
                            <tr key={a.id}>
                              <td>{new Date(a.created_at).toLocaleString()}</td>
                              <td>{a.actor}</td>
                              <td>
                                <strong>{a.action}</strong>
                              </td>
                              <td>{a.detail || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="Auditor access required"
                      description="Platform-wide audit events are available to administrators and auditors."
                    />
                  )}
                </Panel>
              )}
              {section === "settings" && (
                <>
                  <Panel
                    title="Your research profile"
                    subtitle="Account and environment information"
                  >
                    <div className="profile-details">
                      <span className="large-avatar">{user?.name?.[0]}</span>
                      <div>
                        <h2>{user?.name}</h2>
                        <p>{user?.email}</p>
                        <Badge tone="blue">{human(user?.role || "")}</Badge>
                      </div>
                      <div>
                        <p>Research environment</p>
                        <strong>{health.storage}</strong>
                        <p className="tiny muted">
                          Synthetic-only demo · Version 1.0
                        </p>
                      </div>
                    </div>
                  </Panel>
                  {isAdmin && (
                    <Panel
                      title="User & role management"
                      subtitle="Role updates take effect at the next authorized API request"
                    >
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Researcher</th>
                              <th>Role</th>
                              <th>Access</th>
                              <th>Update</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(data.users || []).map((u: Data) => (
                              <tr key={u.id}>
                                <td>
                                  <strong>{u.name}</strong>
                                  <small className="block muted">
                                    {u.email}
                                  </small>
                                </td>
                                <td>
                                  <select
                                    value={u.role}
                                    disabled={u.id === user?.id || busy}
                                    onChange={(e) =>
                                      act(
                                        () =>
                                          api(`/admin/users/${u.id}`, {
                                            method: "PUT",
                                            body: JSON.stringify({
                                              role: e.target.value,
                                              active: u.active,
                                            }),
                                          }),
                                        "User role updated",
                                      )
                                    }
                                  >
                                    {[
                                      "super_admin",
                                      "hospital_admin",
                                      "researcher",
                                      "clinician",
                                      "auditor",
                                    ].map((r) => (
                                      <option key={r} value={r}>
                                        {human(r)}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <Badge tone={u.active ? "green" : "gray"}>
                                    {u.active ? "Active" : "Disabled"}
                                  </Badge>
                                </td>
                                <td>
                                  <button
                                    className="btn secondary small"
                                    disabled={u.id === user?.id || busy}
                                    onClick={() =>
                                      act(
                                        () =>
                                          api(`/admin/users/${u.id}`, {
                                            method: "PUT",
                                            body: JSON.stringify({
                                              role: u.role,
                                              active: !u.active,
                                            }),
                                          }),
                                        "User access updated",
                                      )
                                    }
                                  >
                                    {u.active ? "Disable" : "Enable"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  )}
                  <div className="alert info">
                    <Info size={17} />
                    Public demo accounts use synthetic information only. For a
                    durable deployment, configure PostgreSQL, a stable
                    JWT_SECRET, and DEMO_MODE=false.
                  </div>
                </>
              )}
            </>
          )}
          <div className="dashboard-footer">
            <span>
              <Activity size={13} />
              MediFed AI · Collaborative intelligence, private by design.
            </span>
            <span>
              <span className="live-dot" />
              Synthetic research environment
            </span>
          </div>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal.title || modal.name || "Research details"}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <div>
                <span className="eyebrow">RESEARCH WORKSPACE</span>
                <h2>
                  {modal.title ||
                    modal.name ||
                    (
                      {
                        dataset: "Dataset inspection",
                        case: "Synthetic research artifact",
                        model: "Model details",
                        agent: "Agent details",
                        "hospital-detail": "Hospital profile",
                      } as Data
                    )[modal.type]}
                </h2>
              </div>
              <button
                className="icon-btn"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={21} />
              </button>
            </header>
            <div className="modal-content">
              {modal.type === "hospital" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const body = {
                      name: modal.name,
                      location: modal.location,
                      contact: modal.contact || "research@example.org",
                      institution_type:
                        modal.institution_type || "Research hospital",
                      active: modal.active,
                    };
                    const result = await act(
                      () =>
                        api("/hospitals" + (modal.id ? "/" + modal.id : ""), {
                          method: modal.id ? "PUT" : "POST",
                          body: JSON.stringify(body),
                        }),
                      "Hospital saved",
                    );
                    if (result) setModal(null);
                  }}
                >
                  <div className="form-grid">
                    {["name", "location", "contact", "institution_type"].map(
                      (k) => (
                        <label key={k}>
                          {human(k)}
                          <input
                            required={k === "name" || k === "location"}
                            value={modal[k] || ""}
                            onChange={(e) =>
                              setModal({ ...modal, [k]: e.target.value })
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={modal.active}
                      onChange={(e) =>
                        setModal({ ...modal, active: e.target.checked })
                      }
                    />
                    Active federated participation
                  </label>
                  <button className="btn primary" disabled={busy}>
                    Save hospital <Check size={15} />
                  </button>
                </form>
              )}
              {modal.type === "hospital-detail" && (
                <>
                  <div className="detail-hero">
                    <Hospital size={36} />
                    <div>
                      <h3>{modal.name}</h3>
                      <p>{modal.location}</p>
                    </div>
                    <Badge tone={modal.active ? "green" : "gray"}>
                      {modal.active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <dl className="detail-list">
                    {[
                      "id",
                      "institution_type",
                      "contact",
                      "dataset_size",
                      "created_at",
                    ].map((k) => (
                      <div key={k}>
                        <dt>{human(k)}</dt>
                        <dd>{modal[k] ?? "—"}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="alert info">
                    <LockKeyhole size={17} />
                    This hospital's datasets are private to authorized tenant
                    members and the platform administrator.
                  </div>
                  <Link className="btn primary" href="/dashboard/datasets">
                    Open dataset workspace <ArrowRight size={15} />
                  </Link>
                </>
              )}
              {modal.type === "dataset" && (
                <>
                  <div className="metrics-grid three">
                    <Metric
                      label="Rows"
                      value={modal.row_count}
                      detail="Synthetic source records"
                      icon={Database}
                    />
                    <Metric
                      label="Quality score"
                      value={`${modal.validation.quality_score}%`}
                      detail={`${modal.validation.invalid_values} invalid values`}
                      icon={CheckCircle2}
                    />
                    <Metric
                      label="Duplicates"
                      value={modal.validation.duplicates}
                      detail="Detected in source records"
                      icon={Boxes}
                    />
                  </div>
                  <div className="button-row">
                    {canEdit && (
                      <>
                        <button
                          className="btn secondary"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => post(`/datasets/${modal.id}/validate`),
                              "Dataset validation complete",
                              true,
                            )
                          }
                        >
                          Validate
                        </button>
                        <button
                          className="btn secondary"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => post(`/datasets/${modal.id}/preprocess`),
                              "Preprocessing configured",
                              true,
                            )
                          }
                        >
                          Preprocess
                        </button>
                        <select
                          aria-label="Local model architecture"
                          value={algorithm}
                          onChange={(e) => setAlgorithm(e.target.value)}
                        >
                          <option value="logistic">Logistic regression</option>
                          <option value="random_forest">Random forest</option>
                          <option value="gradient_boosting">
                            Gradient boosting
                          </option>
                        </select>
                        <button
                          className="btn primary"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                post(
                                  `/datasets/${modal.id}/train?algorithm=${algorithm}`,
                                ),
                              "Local model trained",
                              true,
                            )
                          }
                        >
                          <Play size={14} />
                          Train locally
                        </button>
                      </>
                    )}
                  </div>
                  <h3 className="subheading">
                    Source preview · first 20 synthetic records
                  </h3>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {[...features, "risk_category"].map((k) => (
                            <th key={k}>{human(k)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {modal.preview.map((r: Data, i: number) => (
                          <tr key={i}>
                            {[...features, "risk_category"].map((k) => (
                              <td key={k}>{r[k] ?? "missing"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3 className="subheading">Missing value report</h3>
                  <div className="data-grid">
                    {Object.entries(modal.validation.missing_values).map(
                      ([k, v]) => (
                        <div key={k}>
                          <span>{human(k)}</span>
                          <strong>{String(v)}</strong>
                        </div>
                      ),
                    )}
                  </div>
                </>
              )}
              {modal.type === "case" && (
                <>
                  <div className="alert warning">
                    Experimental model output — not a medical diagnosis.
                  </div>
                  <div className="prediction-summary">
                    <div>
                      <span className="eyebrow">EXPERIMENTAL OUTPUT</span>
                      <h2>{modal.risk_category}</h2>
                      <p>
                        {modal.model_version} · {modal.explanation_method}
                      </p>
                    </div>
                    <strong>{pct(modal.probability)}</strong>
                  </div>
                  <Badge
                    tone={
                      modal.review_status === "approved" ? "green" : "amber"
                    }
                  >
                    {human(modal.review_status)}
                  </Badge>
                  <h3 className="subheading">
                    Feature contributions · log-odds relative to synthetic
                    reference
                  </h3>
                  <div className="contribution-list">
                    {modal.contributions.map((f: Data) => (
                      <div key={f.feature}>
                        <span>
                          {human(f.feature)} <small>({f.value})</small>
                        </span>
                        <div className="contribution-track">
                          <span
                            style={{
                              width: `${Math.min(100, Math.abs(f.contribution) * 50)}%`,
                              background:
                                f.contribution > 0 ? "#e7a55c" : "#15a99b",
                            }}
                          />
                        </div>
                        <strong>
                          {f.contribution > 0 ? "+" : ""}
                          {f.contribution.toFixed(3)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  {modal.review_comments && (
                    <div className="alert info">
                      Reviewer comments: {modal.review_comments}
                    </div>
                  )}
                  {["super_admin", "clinician"].includes(user?.role || "") && (
                    <>
                      <label>
                        Research reviewer comments
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Document the research context and limitations..."
                          minLength={3}
                        />
                      </label>
                      <div className="button-row">
                        {["approved", "rejected", "additional_review"].map(
                          (decision) => (
                            <button
                              key={decision}
                              className={`btn ${decision === "approved" ? "primary" : "secondary"}`}
                              disabled={busy || comment.trim().length < 3}
                              onClick={async () => {
                                const r = await act(
                                  () =>
                                    post("/research/reviews", {
                                      case_id: modal.id,
                                      decision,
                                      comments: comment,
                                    }),
                                  "Research review recorded",
                                );
                                if (r) setModal({ type: "case", ...r });
                              }}
                            >
                              {human(
                                decision === "approved"
                                  ? "approve_research_artifact"
                                  : decision,
                              )}
                            </button>
                          ),
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              {modal.type === "model" && (
                <>
                  <dl className="detail-list">
                    {[
                      "version",
                      "algorithm",
                      "aggregation",
                      "training_samples",
                      "status",
                      "secure_aggregation",
                      "privacy",
                    ].map((k) => (
                      <div key={k}>
                        <dt>{human(k)}</dt>
                        <dd>{modal[k]}</dd>
                      </div>
                    ))}
                  </dl>
                  <h3 className="subheading">Held-out evaluation</h3>
                  <div className="data-grid">
                    {Object.entries(modal.metrics)
                      .filter(([k]) => k !== "confusion_matrix")
                      .map(([k, v]) => (
                        <div key={k}>
                          <span>{human(k)}</span>
                          <strong>
                            {k === "samples" ? String(v) : pct(v as number)}
                          </strong>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {modal.type === "agent" && (
                <>
                  <p>
                    {modal.implementation}. Runs inside the LangGraph
                    conditional workflow.
                  </p>
                  {modal.steps.length ? (
                    modal.steps.map((s: Data, i: number) => (
                      <div className="agent-step-detail" key={i}>
                        <Badge
                          tone={s.status === "blocked" ? "amber" : "green"}
                        >
                          {s.status}
                        </Badge>
                        <p>{s.output_summary}</p>
                        <small>
                          {s.duration_ms}ms · Next: {s.next_action}
                        </small>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title="No recorded execution"
                      description="Run the agent workflow to produce an execution trace."
                    />
                  )}
                </>
              )}
              {modal.type === "result" && <ResultView value={modal.result} />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function ResultView({ value }: { value: any }) {
  if (value == null) return <span>—</span>;
  if (Array.isArray(value))
    return (
      <div className="result-array">
        {value.map((v, i) => (
          <div key={i}>
            <ResultView value={v} />
          </div>
        ))}
      </div>
    );
  if (typeof value === "object")
    return (
      <dl className="result-details">
        {Object.entries(value)
          .filter(([k]) => !["weights", "rows", "preview"].includes(k))
          .map(([k, v]) => (
            <div key={k}>
              <dt>{human(k)}</dt>
              <dd>
                <ResultView value={v} />
              </dd>
            </div>
          ))}
      </dl>
    );
  return (
    <span>
      {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
    </span>
  );
}
