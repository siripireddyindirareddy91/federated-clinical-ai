import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Network,
  BrainCircuit,
  Database,
  Hospital,
  LockKeyhole,
  Check,
  ChevronRight,
} from "lucide-react";
export default function Landing() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Activity size={24} />
          </span>
          MediFed<span className="brand-ai">AI</span>
        </Link>
        <div className="landing-links">
          <a href="#how-it-works">How it works</a>
          <a href="#architecture">Architecture</a>
          <a href="#intelligence">Intelligence</a>
        </div>
        <Link href="/login" className="btn dark">
          Launch platform <ArrowUpRight size={16} />
        </Link>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" /> THE FUTURE OF COLLABORATIVE RESEARCH
            </span>
            <h1>
              Shared intelligence.
              <br />
              <span>Private by design.</span>
            </h1>
            <p>
              Bring institutions together, not their data. Explore
              privacy-preserving federated learning and multi-agent intelligence
              for collaborative clinical research.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="btn primary">
                Explore the platform <ArrowRight size={17} />
              </Link>
              <a href="#how-it-works" className="btn secondary">
                See how it works <ChevronRight size={17} />
              </a>
            </div>
            <div className="hero-facts">
              <span>
                <Check size={15} /> Synthetic data only
              </span>
              <span>
                <Check size={15} /> No paid AI APIs
              </span>
              <span>
                <Check size={15} /> Human oversight
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="orb orb-one" />
            <div className="orb orb-two" />
            <div className="network-grid" />
            <div className="visual-label">
              <span className="live-dot" /> FEDERATED RESEARCH NETWORK
            </div>
            <svg
              className="network-lines"
              viewBox="0 0 500 400"
              aria-hidden="true"
            >
              <path d="M250 200L100 95M250 200L400 95M250 200L80 285M250 200L420 285M250 200L250 355" />
            </svg>
            <div className="central-node">
              <BrainCircuit size={40} />
              <strong>Global intelligence</strong>
              <span>Model updates, together.</span>
            </div>
            {["Meridian", "Northstar", "Evergreen", "Harbor", "Summit"].map(
              (x, i) => (
                <div key={x} className={`floating-node node-${i}`}>
                  <Hospital size={20} />
                  <span>{x}</span>
                  <small>
                    <span className="live-dot" /> Local data
                  </small>
                </div>
              ),
            )}
            <div className="privacy-float">
              <ShieldCheck size={18} />
              <div>
                <strong>Data stays local</strong>
                <small>Logical hospital isolation</small>
              </div>
              <LockKeyhole size={15} />
            </div>
          </div>
        </section>
        <div className="trust-strip">
          <span>BUILT FOR RESEARCH. DESIGNED FOR TRUST.</span>
          <strong>
            <Hospital size={19} /> 5 synthetic institutions
          </strong>
          <strong>
            <Network size={19} /> Federated learning
          </strong>
          <strong>
            <BrainCircuit size={19} /> 8 specialized agents
          </strong>
        </div>
        <section className="landing-section" id="how-it-works">
          <span className="eyebrow">COLLABORATE WITHOUT COMPROMISE</span>
          <h2>
            One shared model.
            <br />
            Every institution in control.
          </h2>
          <div className="feature-grid">
            {[
              [
                Database,
                "01",
                "Prepare locally",
                "Validate synthetic cohorts in logically isolated hospital workspaces.",
              ],
              [
                Network,
                "02",
                "Learn together",
                "Train local models, exchange compatible updates, and aggregate with weighted FedAvg.",
              ],
              [
                ShieldCheck,
                "03",
                "Evaluate responsibly",
                "Inspect real metrics, feature contributions, and fairness gaps before human review.",
              ],
            ].map(([Icon, n, title, desc]: any) => (
              <article className="feature-card" key={n}>
                <span className="step-number">{n}</span>
                <Icon size={28} />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="architecture-section" id="architecture">
          <div>
            <span className="eyebrow">PRIVACY ARCHITECTURE</span>
            <h2>
              A clear boundary
              <br />
              around every dataset.
            </h2>
            <p>
              Hospital-level authorization keeps private datasets separated. The
              coordinator combines model parameters and aggregate research
              metrics.
            </p>
            <p className="disclosure">
              This demonstration runs logical hospital nodes in one process.
              Update noise, privacy accounting, and pairwise masking are
              educational simulations, without a formal privacy or cryptographic
              guarantee.
            </p>
          </div>
          <div className="architecture-box">
            <div className="arch-row">
              <Hospital /> Hospital environments <span>LOCAL</span>
            </div>
            <div className="arch-connector">↓ approved model updates</div>
            <div className="arch-row teal">
              <Network /> Federated coordinator <span>FedAvg</span>
            </div>
            <div className="arch-connector">↓ global model parameters</div>
            <div className="arch-row">
              <BrainCircuit /> Explainable research <span>REVIEW</span>
            </div>
          </div>
        </section>
        <section className="landing-section" id="intelligence">
          <span className="eyebrow">PURPOSE-BUILT INTELLIGENCE</span>
          <h2>Eight agents. One accountable workflow.</h2>
          <p className="section-description">
            Executable LangGraph agents check quality, enforce configured
            policies, coordinate training, evaluate models, explain features,
            measure fairness, summarize research, and record an audit trail.
          </p>
          <div className="agent-pills">
            {[
              "Data Quality",
              "Privacy Guardian",
              "Federated Coordinator",
              "Model Evaluation",
              "Explainability",
              "Bias & Fairness",
              "Research Assistant",
              "Audit",
            ].map((x) => (
              <span key={x}>
                <BrainCircuit size={16} />
                {x}
              </span>
            ))}
          </div>
          <div className="cta">
            <h2>Make collaboration your next breakthrough.</h2>
            <p>
              A working research environment. Synthetic data. No clinical
              decisions.
            </p>
            <Link href="/login" className="btn primary">
              Launch dashboard <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
      </main>
      <footer>
        <Link href="/" className="brand">
          <Activity /> MediFed AI
        </Link>
        <span>Experimental research only · Not for diagnosis or treatment</span>
        <a href="https://github.com/siripireddyindirareddy91/federated-clinical-ai">
          Source code <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
