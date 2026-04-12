export const FONTS = `@import url(https://fonts.googleapis.com/css2?family=Manrope:wght@600;700&family=Inter:wght@300;400;500;600;700&display=swap);`;

export const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:          #F8F7F5;
  --surface:     #FFFFFF;
  --surface-alt: #FDFDFD;
  --border:      #E7E5E4;
  --border2:     #D4D1CF;
  --accent:      #8D7B6F;
  --accent-light:#B8A99F;
  --accent-pale: rgba(141, 123, 111, 0.1);
  --accent-glow: rgba(141, 123, 111, 0.2);
  --text:        #2C2A28;
  --text2:       #78716C;
  --text3:       #A89A8E;
  --green:       #16A34A;
  --green-bg:    #F0FDF4;
  --red:         #DC2626;
  --red-bg:      #FEF2F2;
  --yellow:      #D97706;
  --yellow-bg:   #FFFBEB;
  --blue:        #2563EB;
  --blue-bg:     #EFF6FF;
  --radius:      12px;
  --radius-sm:   8px;
  --sidebar-w:   240px;
}
body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; font-size: 14px; -webkit-font-smoothing: antialiased; }
button { cursor: pointer; font-family: 'Inter', sans-serif; }
input, select, textarea { font-family: 'Inter', sans-serif; }

/* LAYOUT */
.admin-shell { display: flex; min-height: 100vh; }

/* SIDEBAR */
.sidebar {
  width: var(--sidebar-w); background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 50;
  transition: transform 0.25s;
}
.sidebar-logo {
  padding: 1.5rem 1.25rem 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 0.6rem;
}
.sidebar-logo-text { font-family: 'Manrope', serif; font-size: 1.15rem; color: var(--text); font-weight: 700; }
.sidebar-logo-text span { color: var(--accent); }
.sidebar-badge {
  background: var(--accent-pale); color: var(--accent);
  font-size: 0.6rem; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 0.15rem 0.5rem; border-radius: 100px;
}
.sidebar-nav { flex: 1; padding: 1rem 0.75rem; overflow-y: auto; }
.nav-group-label {
  font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--text3);
  padding: 0.75rem 0.5rem 0.4rem;
}
.nav-item {
  display: flex; align-items: center; gap: 0.65rem;
  padding: 0.6rem 0.75rem; border-radius: var(--radius-sm);
  color: var(--text2); font-size: 0.875rem; font-weight: 450;
  border: none; background: none; width: 100%; text-align: left;
  transition: all 0.15s; margin-bottom: 0.15rem;
}
.nav-item:hover { background: var(--bg); color: var(--text); }
.nav-item.active { background: var(--accent-pale); color: var(--accent); font-weight: 600; }
.nav-item.active .nav-icon { color: var(--accent); }
.nav-icon { font-size: 1rem; flex-shrink: 0; }
.sidebar-footer {
  padding: 1rem 0.75rem;
  border-top: 1px solid var(--border);
}
.admin-info { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem; margin-bottom: 0.5rem; }
.admin-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--accent-pale);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; color: var(--accent); flex-shrink: 0;
}
.admin-name { font-size: 0.8rem; font-weight: 500; color: var(--text); }
.admin-role { font-size: 0.7rem; color: var(--text3); }
.btn-logout {
  width: 100%; padding: 0.55rem; border-radius: var(--radius-sm);
  background: transparent; border: 1px solid var(--border2);
  color: var(--text2); font-size: 0.8rem; transition: all 0.15s;
}
.btn-logout:hover { border-color: var(--red); color: var(--red); }

/* MAIN */
.main-area { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.topbar {
  background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 40;
}
.topbar-title { font-size: 1.1rem; font-weight: 600; color: var(--text); }
.topbar-sub { font-size: 0.78rem; color: var(--text3); margin-top: 0.1rem; }
.topbar-right { display: flex; align-items: center; gap: 0.75rem; }
.page-content { padding: 2rem; flex: 1; }

/* CARDS */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.5rem;
}
.card-title { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 0.3rem; }
.card-sub { font-size: 0.8rem; color: var(--text3); }

/* STAT CARDS */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem 1.5rem;
  position: relative; overflow: hidden; transition: border-color 0.2s;
}
.stat-card:hover { border-color: var(--border2); }
.stat-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
}
.stat-card.gold::before  { background: linear-gradient(90deg, var(--accent), var(--accent-light)); }
.stat-card.green::before { background: linear-gradient(90deg, var(--green), #34D399); }
.stat-card.blue::before  { background: linear-gradient(90deg, var(--blue), #60A5FA); }
.stat-card.red::before   { background: linear-gradient(90deg, var(--red), #F87171); }
.stat-icon { font-size: 1.5rem; margin-bottom: 0.75rem; }
.stat-label { font-size: 0.75rem; color: var(--text3); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; }
.stat-value { font-size: 1.9rem; font-weight: 700; color: var(--text); line-height: 1; }
.stat-sub { font-size: 0.75rem; color: var(--text3); margin-top: 0.4rem; }

/* TABLES */
.table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
table { width: 100%; border-collapse: collapse; }
thead tr { background: var(--bg); }
th { padding: 0.75rem 1rem; text-align: left; font-size: 0.72rem; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
td { padding: 0.85rem 1rem; border-top: 1px solid var(--border); font-size: 0.83rem; color: var(--text2); vertical-align: middle; }
tr:hover td { background: var(--bg); }
.td-main { color: var(--text); font-weight: 500; }

/* BADGES */
.badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.2rem 0.6rem; border-radius: 100px; font-size: 0.7rem; font-weight: 600;
}
.badge-green  { background: var(--green-bg);  color: var(--green);  }
.badge-red    { background: var(--red-bg);    color: var(--red);    }
.badge-yellow { background: var(--yellow-bg); color: var(--yellow); }
.badge-blue   { background: var(--blue-bg);   color: var(--blue);   }
.badge-gray   { background: var(--bg);        color: var(--text3);  }
.badge-gold   { background: var(--accent-pale); color: var(--accent);   }

/* BUTTONS */
.btn { border: none; border-radius: var(--radius-sm); font-weight: 500; transition: all 0.15s; display: inline-flex; align-items: center; gap: 0.4rem; white-space: nowrap; }
.btn-sm  { padding: 0.35rem 0.75rem; font-size: 0.78rem; }
.btn-md  { padding: 0.55rem 1.1rem; font-size: 0.85rem; }
.btn-lg  { padding: 0.7rem 1.5rem; font-size: 0.9rem; }
.btn-gold   { background: var(--accent); color: var(--surface); }
.btn-gold:hover   { background: var(--text); }
.btn-outline      { background: transparent; border: 1px solid var(--border2); color: var(--text2); }
.btn-outline:hover { border-color: var(--text2); color: var(--text); }
.btn-danger       { background: transparent; color: var(--red); border: 1px solid var(--red-bg); }
.btn-danger:hover { background: var(--red); color: var(--surface); }
.btn-ghost        { background: transparent; color: var(--text3); }
.btn-ghost:hover  { color: var(--text); background: var(--bg); }

/* FORMS */
.form-group { margin-bottom: 1.1rem; }
.label { display: block; font-size: 0.78rem; font-weight: 500; color: var(--text2); margin-bottom: 0.4rem; }
.input, .select, .textarea {
  width: 100%; padding: 0.6rem 0.875rem;
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: var(--radius-sm); color: var(--text); font-size: 0.85rem;
  outline: none; transition: border-color 0.15s;
}
.input:focus, .select:focus, .textarea:focus { border-color: var(--gold); }
.textarea { resize: vertical; min-height: 80px; }
.input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

/* SEARCH BAR */
.search-bar {
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: var(--radius-sm); padding: 0 0.875rem;
}
.search-bar input { background: none; border: none; color: var(--text); font-size: 0.85rem; padding: 0.55rem 0; outline: none; flex: 1; }
.search-icon { color: var(--text3); font-size: 0.9rem; }

/* FILTERS ROW */
.filters-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.25rem; }
.filters-row .select { width: auto; min-width: 130px; }

/* PAGINATION */
.pagination { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; padding-top: 1rem; }
.page-btn { width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border); color: var(--text2); font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
.page-btn.active { background: var(--accent-pale); color: var(--accent); border-color: var(--accent); }
.page-info { font-size: 0.78rem; color: var(--text3); }

/* MODAL */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal { background: var(--surface); border: 1px solid var(--border2); border-radius: 16px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
.modal-header { padding: 1.5rem 1.5rem 0; display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem; }
.modal-title { font-size: 1.05rem; font-weight: 600; color: var(--text); }
.modal-close { background: none; border: none; color: var(--text3); font-size: 1.2rem; padding: 0.25rem; }
.modal-close:hover { color: var(--text); }
.modal-body { padding: 0 1.5rem 1.5rem; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid var(--border); display: flex; gap: 0.75rem; justify-content: flex-end; }

/* SETTINGS */
.settings-grid { display: grid; grid-template-columns: 200px 1fr; gap: 1.5rem; }
.settings-nav { display: flex; flex-direction: column; gap: 0.25rem; }
.settings-nav-item { padding: 0.55rem 0.875rem; border-radius: var(--radius-sm); background: none; border: none; color: var(--text2); font-size: 0.85rem; text-align: left; transition: all 0.15s; }
.settings-nav-item:hover { background: var(--bg); color: var(--text); }
.settings-nav-item.active { background: var(--accent-pale); color: var(--accent); font-weight: 600; }
.settings-section-title { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text3); margin-bottom: 1rem; }
.setting-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; padding: 1rem 0; border-bottom: 1px solid var(--border); }
.setting-row:last-child { border-bottom: none; }
.setting-info { flex: 1; }
.setting-label { font-size: 0.85rem; font-weight: 500; color: var(--text); margin-bottom: 0.2rem; }
.setting-desc { font-size: 0.75rem; color: var(--text3); }
.setting-control { flex-shrink: 0; min-width: 200px; }
.toggle { position: relative; width: 40px; height: 22px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0; background: var(--border); border-radius: 100px;
  cursor: pointer; transition: background 0.2s;
}
.toggle-slider::before {
  content: ''; position: absolute; width: 16px; height: 16px; border-radius: 50%;
  background: var(--surface); top: 3px; left: 3px; transition: transform 0.2s;
}
.toggle input:checked + .toggle-slider { background: var(--accent); }
.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

/* LOGIN PAGE */
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); background-image: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(141, 123, 111, 0.06), transparent); }
.login-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 3rem 2.5rem; width: 100%; max-width: 400px; }
.login-logo { font-family: 'Manrope', serif; font-size: 1.5rem; color: var(--text); margin-bottom: 0.3rem; font-weight: 700; }
.login-logo span { color: var(--accent); }
.login-sub { font-size: 0.85rem; color: var(--text3); margin-bottom: 2rem; }
.login-title { font-size: 1.3rem; font-weight: 600; color: var(--text); margin-bottom: 0.3rem; }

/* USER DETAIL */
.user-detail-header { display: flex; align-items: flex-start; gap: 1.5rem; padding: 1.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 1.5rem; }
.user-avatar-lg { width: 64px; height: 64px; border-radius: 50%; background: var(--accent-pale); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: var(--accent); flex-shrink: 0; }
.user-detail-info { flex: 1; }
.user-detail-name { font-size: 1.2rem; font-weight: 600; color: var(--text); margin-bottom: 0.25rem; }
.user-detail-email { font-size: 0.85rem; color: var(--text3); margin-bottom: 0.75rem; }
.user-detail-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }

/* SECTION GRID */
.section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.grid-3 { grid-template-columns: repeat(3, 1fr); }

/* ALERT */
.alert { padding: 0.875rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem; }
.alert-success { background: var(--green-bg); color: var(--green); border: 1px solid rgba(16,185,129,0.2); }
.alert-error   { background: var(--red-bg);   color: var(--red);   border: 1px solid rgba(239,68,68,0.2); }

@media(max-width:768px){
  .sidebar { transform: translateX(-100%); }
  .main-area { margin-left: 0; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .section-grid { grid-template-columns: 1fr; }
  .settings-grid { grid-template-columns: 1fr; }
}
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
.fade-in { animation: fadeIn 0.25s ease; }
`;
