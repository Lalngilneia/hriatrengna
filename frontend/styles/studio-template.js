export const studioBaseCss = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --studio-bg: #f5f1ea;
    --studio-surface: rgba(255,255,255,0.82);
    --studio-surface-strong: #fffdfa;
    --studio-panel: #f0e8de;
    --studio-text: #231d17;
    --studio-text-muted: rgba(35,29,23,0.74);
    --studio-text-soft: rgba(35,29,23,0.46);
    --studio-line: rgba(74,56,38,0.12);
    --studio-line-strong: rgba(74,56,38,0.2);
    --studio-accent: #8b6944;
    --studio-accent-strong: #5f452a;
    --studio-accent-soft: rgba(139,105,68,0.12);
    --studio-success: #2f6f52;
    --studio-success-soft: rgba(47,111,82,0.12);
    --studio-danger: #af4f44;
    --studio-danger-soft: rgba(175,79,68,0.1);
    --studio-warning: #a56b20;
    --studio-warning-soft: rgba(165,107,32,0.12);
    --studio-info: #496a8f;
    --studio-info-soft: rgba(73,106,143,0.12);
    --studio-radius: 18px;
    --studio-shadow: 0 20px 60px rgba(51, 35, 22, 0.08);
    --gold: var(--studio-accent);
    --gold-light: #b0885f;
    --gold-dim: var(--studio-accent-soft);
    --d: var(--studio-bg);
    --d2: var(--studio-surface);
    --d3: var(--studio-surface-strong);
    --dark: var(--studio-bg);
    --dark2: var(--studio-surface);
    --dark3: var(--studio-surface-strong);
    --dark4: var(--studio-panel);
    --b: var(--studio-line);
    --t: var(--studio-text);
    --t2: var(--studio-text-muted);
    --t3: var(--studio-text-soft);
    --g: var(--studio-accent);
    --text: var(--studio-text);
    --text2: var(--studio-text-muted);
    --text3: var(--studio-text-soft);
    --border: var(--studio-line);
    --radius: var(--studio-radius);
    --green: var(--studio-success);
    --green-dim: var(--studio-success-soft);
    --red: var(--studio-danger);
    --red-dim: var(--studio-danger-soft);
    --yellow: var(--studio-warning);
    --yellow-dim: var(--studio-warning-soft);
    --blue: var(--studio-info);
    --blue-dim: var(--studio-info-soft);
    --purple: #7a658f;
    --purple-dim: rgba(122,101,143,0.12);
  }
  body {
    background:
      radial-gradient(circle at top left, rgba(139,105,68,0.08), transparent 28%),
      radial-gradient(circle at top right, rgba(73,106,143,0.06), transparent 26%),
      linear-gradient(180deg, #f7f3ed 0%, #f2ede5 100%);
    color: var(--text);
    font-family: var(--font-body, 'Inter', sans-serif);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3, h4, h5, h6,
  .nav-logo, .page-title, .section-title, .plan-name, .plan-price,
  .studio-name, .billing-plan-name, .nav-title, .stat-value {
    font-family: var(--font-heading, 'Manrope', sans-serif);
    letter-spacing: -0.02em;
  }
  a { color: inherit; }
  .nav {
    position: sticky;
    top: 0;
    z-index: 100;
    height: 68px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.4rem;
    background: rgba(247,243,237,0.8);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
  }
  .nav-logo {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }
  .nav-logo span { color: var(--gold); }
  .nav-sub, .billing-meta, .invite-detail, .member-email, .empty, .empty-sub {
    color: var(--text3);
  }
  .main, .page {
    max-width: 1180px;
    margin: 0 auto;
    padding: 2rem 1.25rem 3rem;
  }
  .billing-card, .plan-card, .card, .setup-card, .quota-bar-wrap, .stat, .modal, .current-banner {
    background: var(--dark2);
    border: 1px solid var(--border);
    box-shadow: var(--studio-shadow);
    backdrop-filter: blur(10px);
  }
  .btn-gold, .btn-plan-gold {
    background: var(--gold);
    color: #fffaf3;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
    box-shadow: 0 10px 24px rgba(95,69,42,0.14);
  }
  .btn-gold:hover, .btn-plan-gold:hover {
    background: var(--studio-accent-strong);
    transform: translateY(-1px);
  }
  .btn-gold:disabled, .btn-plan-gold:disabled,
  .btn-outline:disabled, .btn-plan-outline:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  .btn-outline, .btn-plan-outline, .action-btn {
    background: transparent;
    color: var(--text2);
    border: 1px solid var(--studio-line-strong);
    border-radius: 999px;
    cursor: pointer;
    transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
  }
  .btn-outline:hover, .btn-plan-outline:hover, .action-btn:hover {
    border-color: rgba(95,69,42,0.28);
    color: var(--studio-accent-strong);
    background: rgba(255,255,255,0.35);
  }
  .btn-red {
    background: var(--red-dim);
    color: var(--red);
    border: 1px solid rgba(175,79,68,0.18);
    border-radius: 999px;
  }
  .studio-switcher, .search-input, .form-input, .form-select, .form-input[type="color"] {
    background: rgba(255,255,255,0.72);
    color: var(--text);
    border: 1px solid var(--studio-line-strong);
    border-radius: 14px;
    outline: none;
  }
  .studio-switcher:focus, .search-input:focus, .form-input:focus, .form-select:focus {
    border-color: rgba(95,69,42,0.3);
    box-shadow: 0 0 0 4px rgba(139,105,68,0.08);
  }
  .section-title, .page-title, .studio-name, .billing-plan-name, .nav-title {
    color: var(--text);
  }
  .badge,
  .role-badge {
    background: var(--studio-accent-soft);
    color: var(--studio-accent-strong);
    border: 1px solid rgba(139,105,68,0.18);
  }
  .badge.active, .badge.claimed, .success-box {
    background: var(--green-dim);
    color: var(--green);
    border-color: rgba(47,111,82,0.18);
  }
  .badge.pending, .badge.unclaimed {
    background: var(--yellow-dim);
    color: var(--yellow);
    border-color: rgba(165,107,32,0.18);
  }
  .badge.expired, .expired-box, .error-msg {
    color: var(--red);
    border-color: rgba(175,79,68,0.18);
  }
  .expired-box, .success-box {
    border: 1px solid;
    border-radius: 16px;
    padding: 1.2rem 1.25rem;
  }
  .empty {
    padding: 2.5rem 1.25rem;
    text-align: center;
  }
  .empty-icon {
    font-size: 2rem;
    margin-bottom: 0.65rem;
  }
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(41, 30, 18, 0.25);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 200;
  }
  .modal {
    width: 100%;
    max-width: 560px;
    border-radius: 24px;
  }
  @media (max-width: 760px) {
    .nav { padding: 0 1rem; height: auto; min-height: 68px; flex-wrap: wrap; gap: 0.75rem; }
    .main, .page { padding: 1.25rem 1rem 2rem; }
  }
`;
