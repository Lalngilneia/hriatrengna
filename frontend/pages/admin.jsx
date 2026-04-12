import Head from "next/head";
import { useState, useEffect } from "react";
import {
  Activity,
  Boxes,
  CircleDollarSign,
  CreditCard,
  Gauge,
  HandCoins,
  KeyRound,
  LayoutGrid,
  LogOut,
  PackageCheck,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Ã¢â€â‚¬Ã¢â€â‚¬ TOAST NOTIFICATIONS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const toast = (icon, title, text = '') => {
  if (typeof window === 'undefined' || !window.Swal) return;
  window.Swal.fire({
    icon, title, text,
    toast: true, position: 'top-end',
    showConfirmButton: false,
    timer: icon === 'error' ? 5000 : 3000,
    timerProgressBar: true,
    background: '#1e1e2e', color: '#e8eaf0',
    iconColor: icon === 'error' ? '#ef4444' : icon === 'success' ? '#22c55e' : '#d4af64',
  });
};
const confirmDialog = (msg) => {
  if (typeof window === 'undefined' || !window.Swal) return Promise.resolve(window.confirm(msg));
  return window.Swal.fire({
    title: 'Are you sure?', text: msg, icon: 'warning',
    showCancelButton: true, confirmButtonText: 'Yes, delete',
    cancelButtonText: 'Cancel', confirmButtonColor: '#ef4444',
    background: '#1e1e2e', color: '#e8eaf0',
  }).then(r => r.isConfirmed);
};

// Ã¢â€â‚¬Ã¢â€â‚¬ STYLES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const API = process.env.NEXT_PUBLIC_API_URL || "https://api.hriatrengna.in";
const GOOGLE_FONTS_LINK = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600;700&display=swap";

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:          #0F1117;
  --bg2:         #161B27;
  --bg3:         #1E2535;
  --border:      rgba(255,255,255,0.07);
  --border2:     rgba(255,255,255,0.12);
  --gold:        #C9A84C;
  --gold-light:  #E8C97A;
  --gold-pale:   rgba(201,168,76,0.12);
  --gold-glow:   rgba(201,168,76,0.25);
  --text:        #E8EAF0;
  --text2:       #9099B0;
  --text3:       #5A6278;
  --green:       #10B981;
  --green-bg:    rgba(16,185,129,0.12);
  --red:         #EF4444;
  --red-bg:      rgba(239,68,68,0.12);
  --yellow:      #F59E0B;
  --yellow-bg:   rgba(245,158,11,0.12);
  --blue:        #3B82F6;
  --blue-bg:     rgba(59,130,246,0.12);
  --radius:      12px;
  --radius-sm:   8px;
  --sidebar-w:   240px;
}
body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; font-size: 14px; }
button { cursor: pointer; font-family: 'Inter', sans-serif; }
input, select, textarea { font-family: 'Inter', sans-serif; }

/* LAYOUT */
.admin-shell { display: flex; min-height: 100vh; }

/* SIDEBAR */
.sidebar {
  width: var(--sidebar-w); background: var(--bg2);
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
.sidebar-logo-mark {
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--gold-pale), rgba(201,168,76,0.02));
  color: var(--gold-light); border: 1px solid rgba(201,168,76,0.22);
  font-size: 0.95rem; font-weight: 700;
}
.sidebar-logo-text { font-family: 'Playfair Display', serif; font-size: 1.15rem; color: var(--text); }
.sidebar-logo-text span { color: var(--gold); }
.sidebar-logo-sub { font-size: 0.72rem; color: var(--text3); margin-top: 0.1rem; }
.sidebar-badge {
  background: var(--gold-pale); color: var(--gold);
  font-size: 0.6rem; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 0.15rem 0.5rem; border-radius: 100px;
  border: 1px solid rgba(201,168,76,0.2);
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
.nav-item:hover { background: var(--bg3); color: var(--text); }
.nav-item.active { background: var(--gold-pale); color: var(--gold-light); }
.nav-item.active .nav-icon { color: var(--gold); }
.nav-icon { font-size: 1rem; flex-shrink: 0; }
.sidebar-footer {
  padding: 1rem 0.75rem;
  border-top: 1px solid var(--border);
}
.admin-info { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem; margin-bottom: 0.5rem; }
.admin-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--gold-pale); border: 1px solid rgba(201,168,76,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; color: var(--gold); flex-shrink: 0;
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
  background: var(--bg2); border-bottom: 1px solid var(--border);
  padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 40;
}
.topbar-stack { display: flex; align-items: center; gap: 0.9rem; min-width: 0; }
.menu-btn {
  display: none; width: 40px; height: 40px; border-radius: 10px;
  border: 1px solid var(--border2); background: var(--bg3); color: var(--text);
  align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 600; flex-shrink: 0;
}
.menu-btn:hover { border-color: rgba(201,168,76,0.32); color: var(--gold-light); }
.topbar-title { font-size: 1.1rem; font-weight: 600; color: var(--text); }
.topbar-sub { font-size: 0.78rem; color: var(--text3); margin-top: 0.1rem; }
.topbar-right { display: flex; align-items: center; gap: 0.75rem; }
.topbar-date {
  font-size: 0.78rem; color: var(--text3);
  padding: 0.45rem 0.7rem; border-radius: 999px;
  border: 1px solid var(--border); background: rgba(255,255,255,0.02);
}
.page-content { padding: 2rem; flex: 1; }
.page-shell { display: grid; gap: 1.5rem; }
.page-hero {
  padding: 1.25rem 1.4rem;
  background:
    radial-gradient(circle at top right, rgba(201,168,76,0.15), transparent 35%),
    linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0));
}
.page-breadcrumb {
  display: inline-flex; align-items: center; gap: 0.45rem;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--gold-light);
}
.page-breadcrumb::before {
  content: ''; width: 8px; height: 8px; border-radius: 50%;
  background: var(--gold); box-shadow: 0 0 0 5px rgba(201,168,76,0.14);
}
.page-hero-row {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 1rem; margin-top: 0.9rem; flex-wrap: wrap;
}
.page-hero-copy { max-width: 700px; }
.page-hero-title { font-size: 1.05rem; font-weight: 600; color: var(--text); margin-bottom: 0.35rem; }
.page-hero-text { font-size: 0.84rem; color: var(--text2); line-height: 1.65; }
.page-hero-stat {
  min-width: 180px; padding: 0.9rem 1rem; border-radius: 14px;
  border: 1px solid rgba(201,168,76,0.16); background: rgba(255,255,255,0.02);
}
.page-hero-stat-label {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3);
}
.page-hero-stat-value { margin-top: 0.4rem; font-size: 0.95rem; font-weight: 600; color: var(--text); }
.quick-switch {
  display: flex; gap: 0.65rem; flex-wrap: wrap; margin-top: 1rem;
}
.quick-pill {
  border: 1px solid var(--border); background: rgba(255,255,255,0.02); color: var(--text2);
  border-radius: 999px; padding: 0.5rem 0.85rem; font-size: 0.8rem; font-weight: 500;
}
.quick-pill:hover { border-color: rgba(201,168,76,0.25); color: var(--text); }
.quick-pill.active {
  background: var(--gold-pale); border-color: rgba(201,168,76,0.32); color: var(--gold-light);
}
.sidebar-overlay {
  position: fixed; inset: 0; background: rgba(2,6,23,0.62); z-index: 45; border: none;
}

/* CARDS */
.card {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.5rem;
}
.card-title { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 0.3rem; }
.card-sub { font-size: 0.8rem; color: var(--text3); }

/* STAT CARDS */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem 1.5rem;
  position: relative; overflow: hidden; transition: border-color 0.2s;
}
.stat-card:hover { border-color: var(--border2); }
.stat-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
}
.stat-card.gold::before  { background: linear-gradient(90deg, var(--gold), var(--gold-light)); }
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
thead tr { background: var(--bg3); }
th { padding: 0.75rem 1rem; text-align: left; font-size: 0.72rem; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
td { padding: 0.85rem 1rem; border-top: 1px solid var(--border); font-size: 0.83rem; color: var(--text2); vertical-align: middle; }
tr:hover td { background: rgba(255,255,255,0.02); }
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
.badge-gray   { background: var(--bg3);       color: var(--text3);  }
.badge-gold   { background: var(--gold-pale); color: var(--gold);   }

/* BUTTONS */
.btn { border: none; border-radius: var(--radius-sm); font-weight: 500; transition: all 0.15s; display: inline-flex; align-items: center; gap: 0.4rem; white-space: nowrap; }
.btn-sm  { padding: 0.35rem 0.75rem; font-size: 0.78rem; }
.btn-md  { padding: 0.55rem 1.1rem; font-size: 0.85rem; }
.btn-lg  { padding: 0.7rem 1.5rem; font-size: 0.9rem; }
.btn-gold   { background: var(--gold); color: #1a1000; }
.btn-gold:hover   { background: var(--gold-light); }
.btn-outline      { background: transparent; border: 1px solid var(--border2); color: var(--text2); }
.btn-outline:hover { border-color: var(--text2); color: var(--text); }
.btn-danger       { background: var(--red-bg); color: var(--red); border: 1px solid rgba(239,68,68,0.2); }
.btn-danger:hover { background: var(--red); color: white; }
.btn-ghost        { background: transparent; color: var(--text3); }
.btn-ghost:hover  { color: var(--text); background: var(--bg3); }

/* FORMS */
.form-group { margin-bottom: 1.1rem; }
.label { display: block; font-size: 0.78rem; font-weight: 500; color: var(--text2); margin-bottom: 0.4rem; }
.input, .select, .textarea {
  width: 100%; padding: 0.6rem 0.875rem;
  background: var(--bg); border: 1px solid var(--border2);
  border-radius: var(--radius-sm); color: var(--text); font-size: 0.85rem;
  outline: none; transition: border-color 0.15s;
}
.input:focus, .select:focus, .textarea:focus { border-color: var(--gold); }
.textarea { resize: vertical; min-height: 80px; }
.input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

/* SEARCH BAR */
.search-bar {
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--bg); border: 1px solid var(--border2);
  border-radius: var(--radius-sm); padding: 0 0.875rem;
}
.search-bar input { background: none; border: none; color: var(--text); font-size: 0.85rem; padding: 0.55rem 0; outline: none; flex: 1; }
.search-icon { color: var(--text3); font-size: 0.9rem; }

/* FILTERS ROW */
.filters-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.25rem; }
.filters-row .select { width: auto; min-width: 130px; }

/* PAGINATION */
.pagination { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; padding-top: 1rem; }
.page-btn { width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--bg3); border: 1px solid var(--border); color: var(--text2); font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
.page-btn.active { background: var(--gold-pale); color: var(--gold); border-color: rgba(201,168,76,0.3); }
.page-info { font-size: 0.78rem; color: var(--text3); }

/* MODAL */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal { background: var(--bg2); border: 1px solid var(--border2); border-radius: 16px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
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
.settings-nav-item:hover { background: var(--bg3); color: var(--text); }
.settings-nav-item.active { background: var(--gold-pale); color: var(--gold-light); }
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
  position: absolute; inset: 0; background: var(--bg3); border-radius: 100px;
  cursor: pointer; transition: background 0.2s;
}
.toggle-slider::before {
  content: ''; position: absolute; width: 16px; height: 16px; border-radius: 50%;
  background: white; top: 3px; left: 3px; transition: transform 0.2s;
}
.toggle input:checked + .toggle-slider { background: var(--gold); }
.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

/* LOGIN PAGE */
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); background-image: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(201,168,76,0.06), transparent); }
.login-card { background: var(--bg2); border: 1px solid var(--border2); border-radius: 20px; padding: 3rem 2.5rem; width: 100%; max-width: 400px; }
.login-logo { font-family: 'Playfair Display', serif; font-size: 1.5rem; color: var(--text); margin-bottom: 0.3rem; }
.login-logo span { color: var(--gold); }
.login-sub { font-size: 0.85rem; color: var(--text3); margin-bottom: 2rem; }
.login-title { font-size: 1.3rem; font-weight: 600; color: var(--text); margin-bottom: 0.3rem; }

/* USER DETAIL */
.user-detail-header { display: flex; align-items: flex-start; gap: 1.5rem; padding: 1.5rem; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 1.5rem; }
.user-avatar-lg { width: 64px; height: 64px; border-radius: 50%; background: var(--gold-pale); border: 2px solid rgba(201,168,76,0.3); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: var(--gold); flex-shrink: 0; }
.user-detail-info { flex: 1; }
.user-detail-name { font-size: 1.2rem; font-weight: 600; color: var(--text); margin-bottom: 0.25rem; }
.user-detail-email { font-size: 0.85rem; color: var(--text3); margin-bottom: 0.75rem; }
.user-detail-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }

/* SECTION GRID */
.section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.grid-3 { grid-template-columns: repeat(3, 1fr); }

/* SUPPORT CRM */
.support-layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 1.25rem; align-items: start; }
.support-list { display: flex; flex-direction: column; gap: 0.75rem; }
.support-ticket {
  width: 100%; text-align: left; background: var(--bg2); color: var(--text);
  border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem;
  transition: border-color 0.15s, transform 0.15s, background 0.15s;
}
.support-ticket:hover { border-color: rgba(201,168,76,0.28); background: rgba(255,255,255,0.02); }
.support-ticket.active { border-color: rgba(201,168,76,0.38); background: rgba(201,168,76,0.08); }
.support-thread { display: flex; flex-direction: column; gap: 1rem; }
.support-bubble {
  border: 1px solid var(--border); border-radius: 14px; padding: 1rem 1.1rem;
  background: rgba(255,255,255,0.02);
}
.support-bubble.reply { border-color: rgba(201,168,76,0.2); background: rgba(201,168,76,0.08); }
.support-meta-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.65rem; }
.support-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
.support-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; }
.support-stat-card { padding: 0.9rem 1rem; border-radius: 14px; border: 1px solid var(--border); background: rgba(255,255,255,0.02); }
.support-stat-label { font-size: 0.72rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; }
.support-stat-value { margin-top: 0.35rem; font-size: 1.1rem; font-weight: 600; color: var(--text); }

/* ALERT */
.alert { padding: 0.875rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem; }
.alert-success { background: var(--green-bg); color: var(--green); border: 1px solid rgba(16,185,129,0.2); }
.alert-error   { background: var(--red-bg);   color: var(--red);   border: 1px solid rgba(239,68,68,0.2); }

@media(max-width:768px){
  .sidebar { transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); box-shadow: 0 12px 60px rgba(0,0,0,0.45); }
  .main-area { margin-left: 0; }
  .menu-btn { display: inline-flex; }
  .topbar { padding: 1rem; }
  .topbar-stack { width: 100%; }
  .topbar-right { margin-left: auto; }
  .page-content { padding: 1rem; }
  .stats-grid { grid-template-columns: 1fr; }
  .section-grid { grid-template-columns: 1fr; }
  .support-layout { grid-template-columns: 1fr; }
  .settings-grid { grid-template-columns: 1fr; }
  .page-hero-stat { width: 100%; }
}
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
.fade-in { animation: fadeIn 0.25s ease; }
`;

// Ã¢â€â‚¬Ã¢â€â‚¬ SAMPLE DATA Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

// Ã¢â€â‚¬Ã¢â€â‚¬ HELPERS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const fmt     = (n) => `Ã¢â€šÂ¹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Ã¢â‚¬â€';

const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
}) : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â';

const stripHtml = (value = '') => String(value)
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const getSupportText = (item) => {
  const payloadData = item?.payload?.data || item?.data || item || {};
  const textCandidate = [
    item?.body_text,
    item?.text_body,
    payloadData.text,
    payloadData.reply_plain,
    payloadData.plain,
    payloadData.body_text,
  ].find((value) => String(value || '').trim());

  if (textCandidate) return String(textCandidate).trim();

  const htmlCandidate = [
    item?.html_body,
    payloadData.html,
    payloadData.reply_html,
    payloadData.body_html,
  ].find((value) => String(value || '').trim());

  return stripHtml(htmlCandidate || '');
};

const getSupportPreview = (item) => (
  getSupportText(item).replace(/\s+/g, ' ').trim().slice(0, 160)
);

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('mqr_admin_token') : null;

const apiCall = async (path, options = {}) => {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : { error: await res.text() };
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

function AdminHead() {
  return (
    <Head>
      <title>Hriatrengna Admin</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={GOOGLE_FONTS_LINK} />
    </Head>
  );
}

const StatusBadge = ({ status }) => {
  const map = {
    active:    ['badge-green',  'Ã¢â€”Â Active'],
    inactive:  ['badge-gray',   'Ã¢â€”â€¹ Inactive'],
    canceled:  ['badge-red',    'Ã¢Å“â€¢ Canceled'],
    past_due:  ['badge-yellow', 'Ã¢Å¡Â  Past Due'],
    halted:    ['badge-red',    'Ã¢Å“â€¢ Halted'],
    trialing:  ['badge-blue',   'Ã¢â€”Å’ Trialing'],
    captured:  ['badge-green',  'Ã¢Å“â€œ Paid'],
    failed:    ['badge-red',    'Ã¢Å“â€¢ Failed'],
    monthly:   ['badge-blue',   'Monthly'],
    yearly:    ['badge-gold',   'Yearly'],
  };
  map.open = ['badge-blue', 'Open'];
  map.in_progress = ['badge-yellow', 'In Progress'];
  map.waiting_customer = ['badge-gold', 'Waiting Customer'];
  map.resolved = ['badge-green', 'Resolved'];
  map.archived = ['badge-gray', 'Archived'];
  map.delivered = ['badge-green', 'Delivered'];
  map.delivery_delayed = ['badge-yellow', 'Delayed'];
  map.bounced = ['badge-red', 'Bounced'];
  map.complained = ['badge-red', 'Complained'];
  const [cls, label] = map[status] || ['badge-gray', status];
  return <span className={`badge ${cls}`}>{label}</span>;
};

// Ã¢â€â‚¬Ã¢â€â‚¬ LOGIN PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('admin@hriatrengna.in');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : { error: await res.text() };
      if (!res.ok) throw new Error(data.error || 'Invalid credentials.');
      localStorage.setItem('mqr_admin_token', data.token);
      onLogin(data.admin);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page px-4">
      <Card className="w-full max-w-md border-white/10 bg-[#121723]/90 text-white shadow-velvet">
        <CardContent className="space-y-6 p-6">
          <Badge className="border-primary/20 bg-primary/10 text-primary" variant="default">
            Administration portal
          </Badge>
          <div className="space-y-3">
            <h1 className="font-display text-5xl leading-none tracking-tight text-white">
              Super admin access.
            </h1>
            <p className="text-sm leading-7 text-white/60">
              A calmer command surface for pricing, subscribers, billing, support, and protected operations.
            </p>
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-white">
              <span>Email address</span>
              <Input
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hriatrengna.in"
                type="email"
                value={email}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-white">
              <span>Password</span>
              <Input
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Enter your password"
                type="password"
                value={password}
              />
            </label>
          </div>
          <Button className="w-full" disabled={loading} onClick={submit} size="lg" type="button">
            {loading ? 'Signing in...' : 'Sign in to admin'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ SIDEBAR Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const NAV = [
  { group: 'Overview', items: [{ id: 'dashboard', icon: Gauge, label: 'Dashboard' }] },
  { group: 'Manage', items: [
    { id: 'users',        icon: Users, label: 'Subscribers' },
    { id: 'albums',       icon: LayoutGrid, label: 'Albums' },
    { id: 'studios',      icon: Store, label: 'Studios' },
    { id: 'transactions', icon: CircleDollarSign, label: 'Transactions' },
    { id: 'refunds',      icon: HandCoins, label: 'Refunds' },
    { id: 'invoices',     icon: ReceiptText, label: 'Invoices' },
    { id: 'support',      icon: ShieldCheck, label: 'Support Inbox' },
    { id: 'affiliates',   icon: CreditCard, label: 'Affiliates' },
  ]},
  { group: 'Configure', items: [
    { id: 'pricing',         icon: CreditCard,  label: 'Legacy Plans'     },
    { id: 'addon_pricing',   icon: Boxes, label: 'Addon Pricing'    },
    { id: 'base_pricing',    icon: CircleDollarSign, label: 'Base Pricing'     },
    { id: 'physical_orders', icon: PackageCheck, label: 'Physical Orders'  },
    { id: 'settings',        icon: Settings2,  label: 'App Settings'     },
    { id: 'api',             icon: KeyRound, label: 'API & Keys'       },
  ]},
  { group: 'System', items: [
    { id: 'automation',   icon: Activity, label: 'Automation' },
    { id: 'logs',         icon: Activity, label: 'Activity Logs' },
    { id: 'account',      icon: ShieldCheck, label: 'My Account' },
  ]},
];

const PAGE_GROUP_HINTS = {
  Overview: 'Track platform health and keep an eye on the metrics that matter most this week.',
  Manage: 'Jump between operational areas without losing context. Each section below is part of the same admin workflow.',
  Configure: 'Keep commercial settings, plan logic, and integration details aligned before changing live billing behavior.',
  System: 'Use these tools for housekeeping, audit visibility, and protected admin-only actions.',
};

const getNavGroup = (page) => NAV.find((group) => group.items.some((item) => item.id === page));

function Sidebar({ page, setPage, admin, onLogout, mobileOpen, onClose }) {
  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <div><div className="sidebar-logo-text">Hriatrengna</div><div className="sidebar-logo-sub">Admin Panel</div></div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(group => (
          <div key={group.group}>
            <div className="nav-group-label">{group.group}</div>
            {group.items.map(item => (
              <button
                key={item.id}
                className={`nav-item ${page===item.id?'active':''}`}
                onClick={() => {
                  setPage(item.id);
                  onClose?.();
                }}
              >
                <span className="nav-icon"><item.icon className="size-4" /></span>{item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="admin-info">
          <div className="admin-avatar">{admin.name[0]}</div>
          <div>
            <div className="admin-name">{admin.name}</div>
            <div className="admin-role">Super Admin</div>
          </div>
        </div>
        <Button className="w-full justify-center" onClick={onLogout} type="button" variant="outline">
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}

function AdminSectionHeader({ page, setPage }) {
  const group = getNavGroup(page);
  const siblings = group?.items || [];
  const meta = PAGE_META[page] || { title: page, sub: '' };

  return (
    <Card className="border-white/10 bg-[linear-gradient(135deg,rgba(201,168,76,0.12),rgba(255,255,255,0.03))] text-white shadow-glass">
      <CardContent className="space-y-6 p-6">
        <Badge className="w-fit border-primary/20 bg-primary/10 text-primary" variant="default">
          {group?.group || 'Workspace'}
        </Badge>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="font-display text-5xl leading-none tracking-tight text-white">
              {meta.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/68">
              {PAGE_GROUP_HINTS[group?.group] || meta.sub}
            </p>
          </div>
          <div className="min-w-[200px] rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Current section
            </div>
            <div className="mt-2 text-sm leading-7 text-white/72">
              {siblings.length} view{siblings.length === 1 ? '' : 's'} in {group?.group || 'this group'}
            </div>
          </div>
        </div>
        {siblings.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {siblings.map((item) => (
              <Button
                className={cn(item.id === page && 'border-primary/30 bg-primary/10 text-primary')}
                key={item.id}
                onClick={() => setPage(item.id)}
                size="sm"
                type="button"
                variant="outline"
              >
                <item.icon className="size-4" />
                {item.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ DASHBOARD PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function DashboardPage() {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiCall('/api/admin/dashboard')
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>Loading dashboardÃ¢â‚¬Â¦</div>;
  if (error)   return <div className="alert alert-error">{error}</div>;
  if (!data)   return null;

  // Data is now flat Ã¢â‚¬â€ no stats.stats wrapper
  const u  = data.users      || {};
  const a  = data.albums     || {};
  const r  = data.revenue    || {};
  const af = data.affiliates || {};
  const tx = data.recentTransactions || [];
  const topAlbums   = data.topAlbums   || [];
  const dailyRev    = data.dailyRevenue || [];

  // Mini sparkline bar chart from daily revenue
  const maxRev = Math.max(...dailyRev.map(d => parseFloat(d.revenue || 0)), 1);

  return (
    <div className="fade-in">

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ TOP STAT CARDS Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="stats-grid" style={{marginBottom:'1.5rem'}}>
        <div className="stat-card gold">
          <div className="stat-icon">Ã°Å¸â€™Â°</div>
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value">{fmt(r.total_revenue)}</div>
          <div className="stat-sub">{fmt(r.revenue_today)} today Ã‚Â· {fmt(r.revenue_7d)} this week</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">Ã¢Å“â€œ</div>
          <div className="stat-label">Active Subscribers</div>
          <div className="stat-value">{parseInt(u.active_subscribers || 0).toLocaleString('en-IN')}</div>
          <div className="stat-sub">
            {u.monthly_subscribers || 0} monthly Ã‚Â· {u.yearly_subscribers || 0} yearly Ã‚Â· {u.lifetime_subscribers || 0} lifetime Ã‚Â· {u.wedding_subscribers || 0} wedding
          </div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">Ã°Å¸â€˜Â¥</div>
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{parseInt(u.total_users || 0).toLocaleString('en-IN')}</div>
          <div className="stat-sub">+{u.new_today || 0} today Ã‚Â· +{u.new_last_7 || 0} this week Ã‚Â· +{u.new_last_30 || 0} this month</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon">Ã°Å¸â€œÅ¡</div>
          <div className="stat-label">Albums Created</div>
          <div className="stat-value">{parseInt(a.total_albums || 0).toLocaleString('en-IN')}</div>
          <div className="stat-sub">{a.published || 0} published Ã‚Â· {a.draft || 0} draft Ã‚Â· {parseInt(a.total_views || 0).toLocaleString('en-IN')} views</div>
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ SECOND ROW: Affiliate + Revenue breakdown Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:'1.5rem'}}>
        <div className="stat-card" style={{background:'var(--bg2)'}}>
          <div className="stat-icon">Ã°Å¸Â¤Â</div>
          <div className="stat-label">Active Affiliates</div>
          <div className="stat-value" style={{fontSize:'1.6rem'}}>{af.active_affiliates || 0}</div>
          <div className="stat-sub">{af.pending_review || 0} pending review</div>
        </div>
        <div className="stat-card" style={{background:'var(--bg2)'}}>
          <div className="stat-icon">Ã°Å¸â€™Â¸</div>
          <div className="stat-label">Commission Owed</div>
          <div className="stat-value" style={{fontSize:'1.6rem'}}>{fmt(af.pending_payout)}</div>
          <div className="stat-sub">{fmt(af.total_paid_out)} paid out to date</div>
        </div>
        <div className="stat-card" style={{background:'var(--bg2)'}}>
          <div className="stat-icon">Ã°Å¸â€œÅ </div>
          <div className="stat-label">Monthly MRR</div>
          <div className="stat-value" style={{fontSize:'1.6rem'}}>{fmt(r.revenue_30d)}</div>
          <div className="stat-sub">{r.total_payments || 0} payments total</div>
        </div>
        <div className="stat-card" style={{background:parseInt(u.in_grace_period||0)>0?'rgba(234,179,8,0.08)':'var(--bg2)',border:parseInt(u.in_grace_period||0)>0?'1px solid rgba(234,179,8,0.25)':'1px solid var(--border)'}}>
          <div className="stat-icon">Ã¢ÂÂ³</div>
          <div className="stat-label">In Grace Period</div>
          <div className="stat-value" style={{fontSize:'1.6rem',color:parseInt(u.in_grace_period||0)>0?'var(--yellow)':'var(--text)'}}>{u.in_grace_period || 0}</div>
          <div className="stat-sub">Subscription ended Ã¢â‚¬â€ albums still live</div>
        </div>
        <div className="stat-card" style={{background:'var(--bg2)'}}>
          <div className="stat-icon">Ã°Å¸â€˜Â</div>
          <div className="stat-label">Avg Album Views</div>
          <div className="stat-value" style={{fontSize:'1.6rem'}}>{parseFloat(a.avg_views || 0).toFixed(1)}</div>
          <div className="stat-sub">{parseInt(a.total_views || 0).toLocaleString('en-IN')} total views</div>
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ REVENUE SPARKLINE + BREAKDOWN Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="section-grid" style={{marginBottom:'1.5rem'}}>
        <div className="card">
          <div className="card-title" style={{marginBottom:'1rem'}}>Revenue Ã¢â‚¬â€ Last 14 Days</div>
          {dailyRev.length === 0
            ? <div style={{color:'var(--text3)',fontStyle:'italic',padding:'1rem 0'}}>No revenue data yet.</div>
            : <>
                <div style={{display:'flex',alignItems:'flex-end',gap:'4px',height:'80px',marginBottom:'0.5rem'}}>
                  {dailyRev.map((d,i) => {
                    const h = Math.max(4, Math.round((parseFloat(d.revenue)/maxRev)*76));
                    return (
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}} title={`${d.date}: ${fmt(d.revenue)}`}>
                        <div style={{width:'100%',height:h,background:'var(--gold)',borderRadius:'3px 3px 0 0',opacity:0.85}}></div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem',color:'var(--text3)'}}>
                  <span>{dailyRev[0]?.date ? new Date(dailyRev[0].date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : ''}</span>
                  <span>{dailyRev[dailyRev.length-1]?.date ? new Date(dailyRev[dailyRev.length-1].date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : ''}</span>
                </div>
              </>
          }
          <div style={{borderTop:'1px solid var(--border)',marginTop:'1rem',paddingTop:'1rem'}}>
            {[
              {label:'Today',        val: fmt(r.revenue_today)},
              {label:'This Week',    val: fmt(r.revenue_7d)},
              {label:'This Month',   val: fmt(r.revenue_30d)},
              {label:'All Time',     val: fmt(r.total_revenue)},
            ].map(row => (
              <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'0.5rem 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{color:'var(--text2)',fontSize:'0.85rem'}}>{row.label}</span>
                <span style={{fontWeight:600,color:'var(--text)',fontSize:'0.85rem'}}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{marginBottom:'1rem'}}>Plan Distribution</div>
          {[
            {label:'Monthly',  count: parseInt(u.monthly_subscribers||0),  rev: fmt(r.revenue_monthly_plan),  color:'var(--blue)'},
            {label:'Yearly',   count: parseInt(u.yearly_subscribers||0),   rev: fmt(r.revenue_yearly_plan),   color:'var(--gold)'},
            {label:'Lifetime', count: parseInt(u.lifetime_subscribers||0), rev: fmt(r.revenue_lifetime_plan), color:'var(--green)'},
            {label:'Wedding',  count: parseInt(u.wedding_subscribers||0),  rev: 'Ã¢â‚¬â€',                          color:'#e879a0'},
          ].map(plan => {
            const total = parseInt(u.active_subscribers||1);
            const pct   = total > 0 ? Math.round((plan.count/total)*100) : 0;
            return (
              <div key={plan.label} style={{marginBottom:'1rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.3rem'}}>
                  <span style={{fontSize:'0.84rem',color:'var(--text2)',fontWeight:500}}>{plan.label}</span>
                  <span style={{fontSize:'0.84rem',color:'var(--text3)'}}>{plan.count} subs Ã‚Â· {plan.rev}</span>
                </div>
                <div style={{height:'8px',background:'var(--bg3)',borderRadius:'100px'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:plan.color,borderRadius:'100px',transition:'width 0.3s'}}></div>
                </div>
                <div style={{fontSize:'0.72rem',color:'var(--text3)',marginTop:'0.2rem'}}>{pct}% of active subscribers</div>
              </div>
            );
          })}
          <div style={{borderTop:'1px solid var(--border)',paddingTop:'1rem',marginTop:'0.5rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem'}}>
              <span style={{color:'var(--text3)'}}>Email Verified</span>
              <span style={{color:'var(--text)',fontWeight:600}}>{u.verified_users || 0} / {u.total_users || 0}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem',marginTop:'0.5rem'}}>
              <span style={{color:'var(--text3)'}}>Inactive / Cancelled</span>
              <span style={{color:'var(--text)',fontWeight:600}}>{u.inactive_users || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ RECENT TRANSACTIONS + TOP ALBUMS Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="section-grid" style={{marginBottom:'1.5rem'}}>
        <div className="card">
          <div className="card-title" style={{marginBottom:'1.25rem'}}>Recent Transactions</div>
          {tx.length === 0
            ? <div style={{color:'var(--text3)',fontStyle:'italic',padding:'1rem 0'}}>No transactions yet.</div>
            : <div className="table-wrap">
                <table>
                  <thead><tr><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {tx.map(t => (
                      <tr key={t.id}>
                        <td>
                          <div className="td-main">{t.user_name || 'Ã¢â‚¬â€'}</div>
                          <div style={{fontSize:'0.72rem',color:'var(--text3)'}}>{t.user_email || ''}</div>
                        </td>
                        <td><StatusBadge status={t.plan} /></td>
                        <td className="td-main" style={{color:'var(--gold)'}}>{fmt(t.amount_inr)}</td>
                        <td><StatusBadge status={t.status} /></td>
                        <td style={{fontSize:'0.78rem'}}>{fmtDate(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>

        <div className="card">
          <div className="card-title" style={{marginBottom:'1.25rem'}}>Top Albums by Views</div>
          {topAlbums.length === 0
            ? <div style={{color:'var(--text3)',fontStyle:'italic',padding:'1rem 0'}}>No published albums yet.</div>
            : <div style={{display:'flex',flexDirection:'column',gap:'0.6rem'}}>
                {topAlbums.map((alb, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.6rem 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{width:24,height:24,borderRadius:'50%',background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,color:'var(--text)',fontSize:'0.85rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{alb.name}</div>
                      <div style={{fontSize:'0.72rem',color:'var(--text3)'}}>{alb.owner_name}</div>
                    </div>
                    <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--gold)',flexShrink:0}}>
                      {parseInt(alb.view_count || 0).toLocaleString('en-IN')} views
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ USERS PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function UsersPage() {
  const [users, setUsers]           = useState([]);
  const [search, setSearch]         = useState('');
  const [statusFilter, setFilter]   = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selectedUser, setSelected] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');
  const [overrideStatus, setOverride] = useState('');

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    apiCall(`/api/admin/users?${params}`)
      .then(d => setUsers(d.users || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const deleteUser = async (userId) => {
    const ok = await confirmDialog('Delete this user and all their albums? This cannot be undone.');
    if (!ok) return;
    try {
      await apiCall(`/api/admin/users/${userId}`, { method: 'DELETE' });
      setSelected(null);
      load();
    } catch (err) { toast("error", "Error", err.message); }
  };

  const saveUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const body = {};
      if (overrideStatus) body.subscription_status = overrideStatus;
      await apiCall(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setSaveMsg('Ã¢Å“â€œ User updated.');
      toast('success', 'User updated!');
      setTimeout(() => { setSaveMsg(''); setSelected(null); load(); }, 1500);
    } catch (err) { toast("error", "Error", err.message); }
    finally { setSaving(false); }
  };

  const [addModal, setAddModal]   = useState(false);
  const [addForm, setAddForm]     = useState({ name:'', email:'', password:'', subscriptionPlan:'monthly', subscriptionStatus:'active' });
  const [addSaving, setAddSaving] = useState(false);

  const createSubscriber = async () => {
    setAddSaving(true);
    try {
      await apiCall('/api/admin/users', { method:'POST', body: JSON.stringify(addForm) });
      setAddModal(false);
      setAddForm({ name:'', email:'', password:'', subscriptionPlan:'monthly', subscriptionStatus:'active' });
      load();
    } catch (err) { toast("error", "Error", err.message); }
    finally { setAddSaving(false); }
  };

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'1rem'}}>
        <button className="btn btn-gold btn-md" onClick={() => setAddModal(true)}>+ Add Subscriber</button>
      </div>
      <div className="filters-row">
        <div className="search-bar" style={{flex:1,maxWidth:'360px'}}>
          <span className="search-icon">Ã°Å¸â€Â</span>
          <input placeholder="Search by name or emailÃ¢â‚¬Â¦" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="select" value={statusFilter} onChange={e=>setFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>
        <div style={{marginLeft:'auto',fontSize:'0.8rem',color:'var(--text3)'}}>{users.length} users</div>
      </div>

      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃ¢â‚¬Â¦</div>
        : users.length === 0
          ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center',fontStyle:'italic'}}>No users found.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>User</th><th>Subscription</th><th>Plan</th><th>Albums</th><th>Total Paid</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="td-main">{u.name}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>{u.email}</div>
                        {!u.is_email_verified && <span className="badge badge-yellow" style={{marginTop:'0.25rem'}}>Unverified</span>}
                      </td>
                      <td><StatusBadge status={u.subscription_status || 'inactive'} /></td>
                      <td>{u.subscription_plan ? <StatusBadge status={u.subscription_plan} /> : <span style={{color:'var(--text3)'}}>Ã¢â‚¬â€</span>}</td>
                      <td>{u.album_count || 0}</td>
                      <td className="td-main">{u.total_paid > 0 ? fmt(u.total_paid) : 'Ã¢â‚¬â€'}</td>
                      <td>{fmtDate(u.created_at)}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{ setSelected(u); setOverride(''); setSaveMsg(''); }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }

      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add New Subscriber</div>
              <button className="modal-close" onClick={() => setAddModal(false)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" value={addForm.name} onChange={e => setAddForm(f=>({...f,name:e.target.value}))} placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label className="label">Email *</label>
                <input className="input" type="email" value={addForm.email} onChange={e => setAddForm(f=>({...f,email:e.target.value}))} placeholder="john@example.com" />
              </div>
              <div className="form-group">
                <label className="label">Password * (min 8 chars)</label>
                <input className="input" type="password" value={addForm.password} onChange={e => setAddForm(f=>({...f,password:e.target.value}))} placeholder="Temporary password" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <div className="form-group">
                  <label className="label">Plan</label>
                  <select className="select" value={addForm.subscriptionPlan} onChange={e => setAddForm(f=>({...f,subscriptionPlan:e.target.value}))}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Status</label>
                  <select className="select" value={addForm.subscriptionStatus} onChange={e => setAddForm(f=>({...f,subscriptionStatus:e.target.value}))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => setAddModal(false)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={createSubscriber} disabled={addSaving}>
                {addSaving ? 'CreatingÃ¢â‚¬Â¦' : 'Create Subscriber'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="modal-overlay" onClick={()=>setSelected(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{selectedUser.name}</div>
                <div style={{fontSize:'0.8rem',color:'var(--text3)',marginTop:'0.2rem'}}>{selectedUser.email}</div>
              </div>
              <button className="modal-close" onClick={()=>setSelected(null)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body">
              {saveMsg && <div className="alert alert-success" style={{marginBottom:'1rem'}}>{saveMsg}</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'1.25rem'}}>
                {[
                  ['Status', <StatusBadge status={selectedUser.subscription_status || 'inactive'} />],
                  ['Plan', selectedUser.subscription_plan ? <StatusBadge status={selectedUser.subscription_plan} /> : 'Ã¢â‚¬â€'],
                  ['Albums', selectedUser.album_count || 0],
                  ['Total Paid', fmt(selectedUser.total_paid || 0)],
                  ['Joined', fmtDate(selectedUser.created_at)],
                  ['Email Verified', selectedUser.is_email_verified ? 'Ã¢Å“â€œ Yes' : 'Ã¢Å“â€¢ No'],
                ].map(([k,v]) => (
                  <div key={k} style={{background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:'0.875rem'}}>
                    <div style={{fontSize:'0.72rem',color:'var(--text3)',marginBottom:'0.3rem',textTransform:'uppercase',letterSpacing:'0.06em'}}>{k}</div>
                    <div style={{fontWeight:500,color:'var(--text)'}}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="label">Override Subscription Status</label>
                <select className="select" value={overrideStatus} onChange={e=>setOverride(e.target.value)}>
                  <option value="">Ã¢â‚¬â€ No change Ã¢â‚¬â€</option>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="canceled">canceled</option>
                  <option value="past_due">past_due</option>
                </select>
              </div>
              <UserSubscriptionConfig userId={selectedUser.id} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger btn-md" onClick={()=>deleteUser(selectedUser.id)}>Delete User</button>
              <button className="btn btn-outline btn-md" onClick={()=>setSelected(null)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={saveUser} disabled={saving}>
                {saving ? 'SavingÃ¢â‚¬Â¦' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ ALBUMS PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function AlbumsPage() {
  const [albums, setAlbums]     = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [modal, setModal]       = useState(null); // null | 'create' | album-obj
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ userId:'', name:'', type:'memorial', birthDate:'', deathDate:'', biography:'', isPublished: true, isSample: false, partner1Name:'', partner2Name:'', weddingDate:'' });

  const load = () => {
    setLoading(true);
    Promise.all([
      apiCall('/api/admin/albums'),
      apiCall('/api/admin/users?limit=200'),
    ])
      .then(([a, u]) => { setAlbums(a.albums || []); setUsers(u.users || []); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ userId:'', name:'', birthDate:'', deathDate:'', biography:'', isPublished: true });
    setModal('create');
  };
  const openEdit = (album) => {
    setForm({
      userId:       album.user_id || '',
      name:         album.name || '',
      type:         album.type || 'memorial',
      birthDate:    album.birth_date    ? album.birth_date.split('T')[0]    : '',
      deathDate:    album.death_date    ? album.death_date.split('T')[0]    : '',
      biography:    album.biography || '',
      isPublished:  album.is_published !== false,
      isSample:     album.is_sample || false,
      partner1Name: album.partner1_name || '',
      partner2Name: album.partner2_name || '',
      weddingDate:  album.wedding_date  ? album.wedding_date.split('T')[0]  : '',
    });
    setModal(album);
  };

  const openAlbum = (album) => {
    const path = album.type === 'wedding' ? `/wedding/${album.slug}` : `/album/${album.slug}`;
    window.open(path, '_blank', 'noopener,noreferrer');
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') {
        await apiCall('/api/admin/albums', { method:'POST', body: JSON.stringify(form) });
      } else {
        await apiCall(`/api/admin/albums/${modal.id}`, { method:'PUT', body: JSON.stringify(form) });
      }
      setModal(null);
      load();
    } catch (err) { toast("error", "Error", err.message); }
    finally { setSaving(false); }
  };

  const deleteAlbum = async (album) => {
    const ok = await confirmDialog(`Delete "${album.name}"? This is permanent.`);
    if (!ok) return;
    try {
      await apiCall(`/api/admin/albums/${album.id}`, { method:'DELETE' });
      load();
    } catch (err) { toast("error", "Error", err.message); }
  };

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'1rem'}}>
        <button className="btn btn-gold btn-md" onClick={openCreate}>+ Create Album</button>
      </div>
      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃ¢â‚¬Â¦</div>
        : albums.length === 0
          ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center',fontStyle:'italic'}}>No albums yet.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Album</th><th>Type</th><th>Owner</th><th>Subscription</th><th>Media</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {albums.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div className="td-main">
                          {a.is_sample && <span title="Sample album" style={{color:'var(--gold)',marginRight:'0.3rem'}}>Ã¢Â­Â</span>}
                          {a.name}
                        </div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>/{a.slug}</div>
                      </td>
                      <td>
                        <span style={{fontSize:'0.78rem',padding:'0.2rem 0.5rem',borderRadius:6,
                          background: a.type==='wedding' ? 'rgba(219,39,119,0.1)' : 'rgba(201,168,76,0.1)',
                          color: a.type==='wedding' ? '#db2777' : 'var(--gold)'}}>
                          {a.type === 'wedding' ? 'Ã°Å¸â€™Â' : 'Ã°Å¸â€¢Â¯'} {a.type || 'memorial'}
                        </span>
                      </td>
                      <td>
                        <div style={{color:'var(--text)'}}>{a.user_name}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>{a.user_email}</div>
                        {a.studio_name && (
                          <div style={{fontSize:'0.72rem',color:'var(--gold)',marginTop:'0.2rem'}}>
                            Studio: {a.studio_name}
                          </div>
                        )}
                      </td>
                      <td><StatusBadge status={a.subscription_status || 'inactive'} /></td>
                      <td>{a.media_count || 0}</td>
                      <td>{a.is_published
                        ? <span className="badge badge-green">Ã¢Å“â€œ Live</span>
                        : <span className="badge badge-gray">Draft</span>}
                      </td>
                      <td>{fmtDate(a.created_at)}</td>
                      <td style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
                        {a.is_published && (
                          <button className="btn btn-outline btn-sm" onClick={() => openAlbum(a)}>View</button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteAlbum(a)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'create' ? 'Create Album' : `Edit: ${modal.name}`}</div>
              <button className="modal-close" onClick={() => setModal(null)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body">
              {modal === 'create' && (
                <div className="form-group">
                  <label className="label">Assign to Subscriber *</label>
                  <select className="select" value={form.userId} onChange={e => setForm(f => ({...f, userId: e.target.value}))}>
                    <option value="">Ã¢â‚¬â€ Select user Ã¢â‚¬â€</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
              )}
              {/* Album Type Ã¢â‚¬â€ only on create */}
              {modal === 'create' && (
                <div className="form-group">
                  <label className="label">Album Type *</label>
                  <select className="select" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                    <option value="memorial">Ã°Å¸â€¢Â¯ Memorial</option>
                    <option value="wedding">Ã°Å¸â€™Â Wedding</option>
                  </select>
                </div>
              )}

              {/* Memorial fields */}
              {form.type === 'memorial' ? (
                <>
                  <div className="form-group">
                    <label className="label">Person's Full Name *</label>
                    <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Margaret Rose Chen" />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                    <div className="form-group">
                      <label className="label">Date of Birth</label>
                      <input className="input" type="date" value={form.birthDate} onChange={e => setForm(f => ({...f, birthDate: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="label">Date of Passing</label>
                      <input className="input" type="date" value={form.deathDate} onChange={e => setForm(f => ({...f, deathDate: e.target.value}))} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="label">Album Title *</label>
                    <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Liana & James Wedding" />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                    <div className="form-group">
                      <label className="label">Partner 1 Name</label>
                      <input className="input" value={form.partner1Name} onChange={e => setForm(f => ({...f, partner1Name: e.target.value}))} placeholder="e.g. Liana" />
                    </div>
                    <div className="form-group">
                      <label className="label">Partner 2 Name</label>
                      <input className="input" value={form.partner2Name} onChange={e => setForm(f => ({...f, partner2Name: e.target.value}))} placeholder="e.g. James" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label">Wedding Date</label>
                    <input className="input" type="date" value={form.weddingDate} onChange={e => setForm(f => ({...f, weddingDate: e.target.value}))} />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="label">Biography / Description</label>
                <textarea className="input" rows={3} style={{resize:'vertical'}} value={form.biography} onChange={e => setForm(f => ({...f, biography: e.target.value}))} placeholder="A short biography or love storyÃ¢â‚¬Â¦" />
              </div>
              <div style={{display:'flex',gap:'1.5rem',flexWrap:'wrap'}}>
                <div className="form-group" style={{display:'flex',alignItems:'center',gap:'0.6rem',margin:0}}>
                  <input type="checkbox" id="pub" checked={form.isPublished} onChange={e => setForm(f => ({...f, isPublished: e.target.checked}))} />
                  <label htmlFor="pub" className="label" style={{margin:0,cursor:'pointer'}}>Published (publicly visible)</label>
                </div>
                <div className="form-group" style={{display:'flex',alignItems:'center',gap:'0.6rem',margin:0}}>
                  <input type="checkbox" id="smp" checked={form.isSample} onChange={e => setForm(f => ({...f, isSample: e.target.checked}))} />
                  <label htmlFor="smp" className="label" style={{margin:0,cursor:'pointer',color:'var(--gold)'}}>Ã¢Â­Â Mark as Sample Album (shown on homepage)</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={save} disabled={saving}>
                {saving ? 'SavingÃ¢â‚¬Â¦' : (modal === 'create' ? 'Create Album' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ TRANSACTIONS PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function TransactionsPage() {
  const [transactions, setTx] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    Promise.all([
      apiCall('/api/admin/transactions'),
      apiCall('/api/admin/dashboard'),
    ])
      .then(([t, d]) => {
        setTx(t.transactions || []);
        setSummary(d.revenue || {});
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="stats-grid" style={{marginBottom:'1.5rem'}}>
        {[
          { label: 'Total Revenue',  val: fmt(summary.total_revenue || 0), sub: 'All time' },
          { label: 'This Month',     val: fmt(summary.revenue_30d   || 0), sub: 'Last 30 days' },
          { label: 'Total Payments', val: String(summary.total_payments || 0), sub: 'Successful' },
          { label: 'This Week',      val: fmt(summary.revenue_7d    || 0), sub: 'Last 7 days' },
        ].map(s => (
          <div key={s.label} className="stat-card gold">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{fontSize:'1.5rem',marginTop:'0.5rem'}}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃ¢â‚¬Â¦</div>
        : transactions.length === 0
          ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center',fontStyle:'italic'}}>No transactions yet.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>User</th><th>Amount</th><th>Plan</th><th>Method</th><th>Razorpay ID</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div className="td-main">{t.user_name}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>{t.user_email}</div>
                      </td>
                      <td className="td-main" style={{color:'var(--gold)'}}>{fmt(t.amount_inr)}</td>
                      <td><StatusBadge status={t.plan} /></td>
                      <td style={{textTransform:'capitalize'}}>{t.payment_method || 'Ã¢â‚¬â€'}</td>
                      <td><code style={{fontFamily:'monospace',fontSize:'0.75rem',color:'var(--text3)'}}>{t.razorpay_payment_id || 'Ã¢â‚¬â€'}</code></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>{fmtDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ PRICING PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function RefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const loadRefunds = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/api/admin/refunds');
      setRefunds(data.refunds || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefunds();
  }, []);

  const approveRefund = async (refund) => {
    const amount = window.prompt(
      'Approve refund amount in INR',
      refund.requested_amount_inr || refund.transaction_amount_inr || ''
    );
    if (amount === null) return;
    setSavingId(refund.id);
    try {
      await apiCall(`/api/admin/refunds/${refund.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'approved',
          approvedAmountInr: Number(amount),
        }),
      });
      toast('success', 'Refund approved');
      await loadRefunds();
    } catch (err) {
      toast('error', 'Approval failed', err.message);
    } finally {
      setSavingId(null);
    }
  };

  const rejectRefund = async (refund) => {
    const notes = window.prompt('Reason for rejection', refund.admin_notes || '');
    if (notes === null) return;
    setSavingId(refund.id);
    try {
      await apiCall(`/api/admin/refunds/${refund.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'rejected',
          adminNotes: notes,
        }),
      });
      toast('success', 'Refund rejected');
      await loadRefunds();
    } catch (err) {
      toast('error', 'Rejection failed', err.message);
    } finally {
      setSavingId(null);
    }
  };

  const processRefund = async (refund) => {
    const ok = await confirmDialog(`Process refund for ${refund.user_name || refund.user_email || 'this user'}?`);
    if (!ok) return;
    setSavingId(refund.id);
    try {
      await apiCall(`/api/admin/refunds/${refund.id}/process`, { method: 'POST' });
      toast('success', 'Refund processing started');
      await loadRefunds();
    } catch (err) {
      toast('error', 'Processing failed', err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃ¢â‚¬Â¦</div>
        : refunds.length === 0
          ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center',fontStyle:'italic'}}>No refund requests yet.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>User</th><th>Invoice</th><th>Amount</th><th>Status</th><th>Requested</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  {refunds.map((refund) => (
                    <tr key={refund.id}>
                      <td>
                        <div className="td-main">{refund.user_name || 'User'}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>{refund.user_email || 'Ã¢â‚¬â€'}</div>
                      </td>
                      <td>
                        <div className="td-main">{refund.invoice_number || 'Ã¢â‚¬â€'}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>{refund.plan || 'Ã¢â‚¬â€'}</div>
                      </td>
                      <td>
                        <div className="td-main" style={{color:'var(--gold)'}}>{fmt(refund.approved_amount_inr || refund.requested_amount_inr || 0)}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>requested {fmt(refund.requested_amount_inr || 0)}</div>
                      </td>
                      <td><StatusBadge status={refund.status} /></td>
                      <td>{fmtDate(refund.created_at)}</td>
                      <td style={{maxWidth:240}}>
                        <div style={{whiteSpace:'normal',lineHeight:1.5}}>
                          {refund.admin_notes || refund.reason || 'Ã¢â‚¬â€'}
                        </div>
                      </td>
                      <td>
                        <div style={{display:'flex',gap:'0.45rem',flexWrap:'wrap'}}>
                          {refund.status === 'requested' && (
                            <>
                              <button className="btn btn-outline btn-sm" disabled={savingId === refund.id} onClick={() => approveRefund(refund)}>
                                Approve
                              </button>
                              <button className="btn btn-danger btn-sm" disabled={savingId === refund.id} onClick={() => rejectRefund(refund)}>
                                Reject
                              </button>
                            </>
                          )}
                          {['approved', 'failed'].includes(refund.status) && (
                            <button className="btn btn-gold btn-sm" disabled={savingId === refund.id} onClick={() => processRefund(refund)}>
                              {savingId === refund.id ? 'WorkingÃ¢â‚¬Â¦' : 'Process'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  );
}

function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    apiCall('/api/admin/invoices')
      .then(d => setInvoices(d.invoices || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const downloadInvoice = async (invoiceId, invoiceNumber) => {
    setDownloading(invoiceId);
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/admin/invoices/${invoiceId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download invoice.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber || invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦</div>
        : invoices.length === 0
          ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center',fontStyle:'italic'}}>No invoices generated yet.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Invoice</th><th>User</th><th>Plan</th><th>Amount</th><th>Razorpay ID</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="td-main">{inv.invoice_number || inv.id}</td>
                      <td>
                        <div className="td-main">{inv.user_name || 'User'}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>{inv.user_email || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</div>
                      </td>
                      <td><StatusBadge status={inv.plan} /></td>
                      <td className="td-main" style={{color:'var(--gold)'}}>{fmt(inv.amount_inr)}</td>
                      <td><code style={{fontFamily:'monospace',fontSize:'0.75rem',color:'var(--text3)'}}>{inv.razorpay_payment_id || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</code></td>
                      <td>{fmtDate(inv.created_at)}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => downloadInvoice(inv.id, inv.invoice_number)} disabled={downloading === inv.id}>
                          {downloading === inv.id ? 'DownloadingÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦' : 'Download PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  );
}

function AffiliatesPage() {
  const [affiliates, setAffiliates]   = useState([]);
  const [loading,    setLoading]      = useState(true);
  const [error,      setError]        = useState('');
  const [msg,        setMsg]          = useState('');
  const [detail,     setDetail]       = useState(null);  // { affiliate, commissions }
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing,    setEditing]      = useState(null);
  const [saving,     setSaving]       = useState(false);
  const [payModal,   setPayModal]     = useState(null);  // affiliate for payout
  const [payRef,     setPayRef]       = useState('');
  const [paying,     setPaying]       = useState(false);
  const [form, setForm] = useState({ status:'pending', commissionRate:'', notes:'' });
  const [filterStatus, setFilterStatus] = useState('');

  const load = () => {
    setLoading(true);
    const q = filterStatus ? `?status=${filterStatus}` : '';
    apiCall(`/api/admin/affiliates${q}`)
      .then(d => setAffiliates(d.affiliates || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filterStatus]);

  const openDetail = async (affiliate) => {
    setDetail({ affiliate, commissions: [] });
    setDetailLoading(true);
    try {
      const d = await apiCall(`/api/admin/affiliates/${affiliate.id}`);
      setDetail({ affiliate: d.affiliate, users: d.users || [], commissions: d.commissions || [] });
    } catch (err) { setError(err.message); }
    finally { setDetailLoading(false); }
  };

  const openEdit = (affiliate) => {
    setEditing(affiliate);
    setForm({ status: affiliate.status || 'pending', commissionRate: String(affiliate.commission_rate ?? 10), notes: affiliate.notes || '' });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true); setError(''); setMsg('');
    try {
      await apiCall(`/api/admin/affiliates/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: form.status, commissionRate: form.commissionRate === '' ? null : Number(form.commissionRate), notes: form.notes }),
      });
      setMsg('Affiliate updated.'); setEditing(null); load();
      if (detail?.affiliate?.id === editing.id) openDetail(editing);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const doDelete = async (affiliate) => {
    if (!window.confirm(`Delete ${affiliate.name}? This cannot be undone.`)) return;
    setError(''); setMsg('');
    try {
      await apiCall(`/api/affiliates/${affiliate.id}`, { method: 'DELETE' });
      setMsg(`${affiliate.name} deleted.`);
      setDetail(null); load();
    } catch (err) { setError(err.message); }
  };

  const verifyAffiliateEmail = async (affiliate) => {
    setError(''); setMsg('');
    try {
      const d = await apiCall(`/api/affiliates/${affiliate.id}/verify-email`, { method: 'POST' });
      setMsg(d.message);
      load();
      if (detail?.affiliate?.id === affiliate.id) openDetail(affiliate);
    } catch (err) { setError(err.message); }
  };

  const openPay = (affiliate) => { setPayModal(affiliate); setPayRef(''); };

  const doPay = async () => {
    if (!payModal) return;
    const pending = payModal.commissions?.filter(c => c.status === 'pending') || [];
    if (!pending.length) return;
    setPaying(true); setError(''); setMsg('');
    try {
      const ids = pending.map(c => c.id);
      const d = await apiCall(`/api/admin/affiliates/${payModal.id}/commissions/pay`, {
        method: 'POST',
        body: JSON.stringify({ commissionIds: ids, paymentRef: payRef || null }),
      });
      setMsg(`${d.message} Total: Ã¢â€šÂ¹${(d.totalPaid||0).toLocaleString('en-IN')}`);
      setPayModal(null); load();
      if (detail?.affiliate?.id === payModal.id) openDetail(detail.affiliate);
    } catch (err) { setError(err.message); }
    finally { setPaying(false); }
  };

  const STATUS_OPTS = ['','pending','active','suspended','rejected'];

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error" style={{marginBottom:'1rem'}}>{error}</div>}
      {msg   && <div className="alert alert-success" style={{marginBottom:'1rem'}}>{msg}</div>}

      {/* Filter bar */}
      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.25rem',alignItems:'center'}}>
        <select className="select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{maxWidth:180}}>
          <option value="">All Statuses</option>
          {['pending','active','suspended','rejected'].map(s => <option key={s} value={s} style={{textTransform:'capitalize'}}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
        <span style={{fontSize:'0.82rem',color:'var(--text3)'}}>{affiliates.length} affiliate{affiliates.length!==1?'s':''}</span>
      </div>

      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃ¢â‚¬Â¦</div>
        : affiliates.length === 0
          ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center',fontStyle:'italic'}}>No affiliates found.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Code</th><th>Status</th><th>Rate</th><th>Referrals</th><th>Pending</th><th>Paid Out</th><th>Actions</th></tr></thead>
                <tbody>
                  {affiliates.map(aff => (
                    <tr key={aff.id}>
                      <td>
                        <div className="td-main">{aff.name}</div>
                        <div style={{fontSize:'0.72rem',color:'var(--text3)'}}>{aff.email}</div>
                        {aff.business_name && <div style={{fontSize:'0.72rem',color:'var(--text3)'}}>{aff.business_name}</div>}
                      </td>
                      <td><code style={{fontFamily:'monospace',fontSize:'0.78rem',color:'var(--gold)'}}>{aff.referral_code}</code></td>
                      <td>
                        <StatusBadge status={aff.status} />
                        {!aff.is_email_verified && <div style={{fontSize:'0.68rem',color:'var(--yellow,#eab308)',marginTop:'0.2rem'}}>Ã¢Å¡Â  Email unverified</div>}
                      </td>
                      <td style={{fontWeight:600}}>{aff.commission_rate ?? 0}%</td>
                      <td>{aff.referral_count ?? 0}</td>
                      <td style={{color:'var(--yellow)'}}>{fmt(aff.pending_earnings)}</td>
                      <td style={{color:'var(--green)'}}>{fmt(aff.paid_earnings)}</td>
                      <td>
                        <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
                          <button className="btn btn-outline btn-sm" onClick={() => openDetail(aff)}>View</button>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(aff)}>Edit</button>
                          {!aff.is_email_verified && (
                            <button className="btn btn-sm" style={{background:'var(--yellow,#eab308)',color:'#111',border:'none'}}
                              onClick={() => verifyAffiliateEmail(aff)}>Verify Email</button>
                          )}
                          {parseFloat(aff.pending_earnings||0) > 0 && (
                            <button className="btn btn-sm" style={{background:'var(--gold)',color:'#111',border:'none'}}
                              onClick={() => { openDetail(aff); openPay({...aff, commissions: []}); }}>Pay</button>
                          )}
                          <button className="btn btn-sm" style={{background:'transparent',border:'1px solid rgba(239,68,68,0.4)',color:'var(--red)'}}
                            onClick={() => doDelete(aff)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ DETAIL MODAL Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{maxWidth:720,width:'95%'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {detail.affiliate.name}
                <span style={{marginLeft:'0.75rem'}}><StatusBadge status={detail.affiliate.status} /></span>
              </div>
              <button className="modal-close" onClick={() => setDetail(null)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body" style={{maxHeight:'65vh',overflowY:'auto'}}>
              {detailLoading
                ? <div style={{color:'var(--text3)',padding:'2rem',textAlign:'center'}}>Loading detailsÃ¢â‚¬Â¦</div>
                : <>
                  {/* Stats row */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
                    {[
                      {label:'Referrals', val: detail.affiliate.total_referrals || 0},
                      {label:'Total Earned', val: fmt(detail.affiliate.total_earnings)},
                      {label:'Pending Payout', val: fmt(detail.commissions?.filter(c=>c.status==='pending').reduce((s,c)=>s+parseFloat(c.amount_inr||0),0))},
                      {label:'Paid Out', val: fmt(detail.affiliate.total_paid_out)},
                    ].map(s => (
                      <div key={s.label} style={{background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:'0.75rem',textAlign:'center'}}>
                        <div style={{fontSize:'0.68rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'0.3rem'}}>{s.label}</div>
                        <div style={{fontWeight:700,color:'var(--text)',fontSize:'1rem'}}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Bank details */}
                  {detail.affiliate.bank_details && (
                    <div style={{background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:'0.85rem 1rem',marginBottom:'1.25rem',fontSize:'0.82rem',color:'var(--text2)'}}>
                      <div style={{fontWeight:600,color:'var(--text)',marginBottom:'0.4rem',fontSize:'0.75rem',textTransform:'uppercase',letterSpacing:'0.06em'}}>Bank Details</div>
                      {Object.entries(detail.affiliate.bank_details).map(([k,v]) => v ? (
                        <div key={k} style={{display:'flex',gap:'1rem',marginBottom:'0.2rem'}}>
                          <span style={{color:'var(--text3)',minWidth:110,textTransform:'capitalize'}}>{k.replace(/([A-Z])/g,' $1')}:</span>
                          <span style={{fontFamily:'monospace'}}>{v}</span>
                        </div>
                      ) : null)}
                    </div>
                  )}

                  {/* Referred users */}
                  {(detail.users || []).length > 0 && (
                    <div style={{marginBottom:'1.25rem'}}>
                      <div style={{fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:'0.6rem'}}>Referred Subscribers ({detail.users.length})</div>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Name</th><th>Plan</th><th>Status</th><th>Joined</th><th>Total Paid</th></tr></thead>
                          <tbody>
                            {detail.users.map(u => (
                              <tr key={u.id}>
                                <td><div className="td-main">{u.name}</div><div style={{fontSize:'0.72rem',color:'var(--text3)'}}>{u.email}</div></td>
                                <td><StatusBadge status={u.subscription_plan} /></td>
                                <td><StatusBadge status={u.subscription_status} /></td>
                                <td style={{fontSize:'0.78rem'}}>{fmtDate(u.created_at)}</td>
                                <td style={{color:'var(--gold)'}}>{fmt(u.total_paid)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Commission history */}
                  {(detail.commissions || []).length > 0 && (
                    <div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.6rem'}}>
                        <div style={{fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)'}}>Commission History ({detail.commissions.length})</div>
                        {detail.commissions.some(c => c.status === 'pending') && (
                          <button className="btn btn-sm" style={{background:'var(--gold)',color:'#111',border:'none'}}
                            onClick={() => { setPayModal({...detail.affiliate, commissions: detail.commissions.filter(c=>c.status==='pending')}); setPayRef(''); }}>
                            Pay All Pending
                          </button>
                        )}
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Referred User</th><th>Amount Earned</th><th>Rate</th><th>Status</th><th>Date</th></tr></thead>
                          <tbody>
                            {detail.commissions.map(c => (
                              <tr key={c.id}>
                                <td><div className="td-main">{c.user_name || 'Ã¢â‚¬â€'}</div><div style={{fontSize:'0.72rem',color:'var(--text3)'}}>{c.user_email}</div></td>
                                <td style={{color:'var(--gold)',fontWeight:600}}>{fmt(c.amount_inr)}</td>
                                <td>{c.commission_rate}%</td>
                                <td><StatusBadge status={c.status} /></td>
                                <td style={{fontSize:'0.78rem'}}>{fmtDate(c.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              }
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => openEdit(detail.affiliate)}>Edit Details</button>
              <button className="btn btn-sm" style={{background:'transparent',border:'1px solid rgba(239,68,68,0.4)',color:'var(--red)',padding:'0.5rem 1rem',borderRadius:'var(--radius-sm)',cursor:'pointer'}}
                onClick={() => { doDelete(detail.affiliate); }}>Delete Affiliate</button>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ EDIT MODAL Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit Ã¢â‚¬â€ {editing.name}</div>
              <button className="modal-close" onClick={() => setEditing(null)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body">
              <div className="input-row">
                <div className="form-group">
                  <label className="label">Status</label>
                  <select className="select" value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Commission Rate (%)</label>
                  <input className="input" type="number" min="0" max="100" step="0.5"
                    value={form.commissionRate} onChange={e => setForm(f=>({...f,commissionRate:e.target.value}))} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Admin Notes</label>
                <textarea className="textarea" rows={3} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Internal notes about this affiliateÃ¢â‚¬Â¦" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={save} disabled={saving}>{saving ? 'SavingÃ¢â‚¬Â¦' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ PAY COMMISSIONS MODAL Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Ã°Å¸â€™Â° Pay Commissions Ã¢â‚¬â€ {payModal.name}</div>
              <button className="modal-close" onClick={() => setPayModal(null)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body">
              <div style={{background:'var(--bg3)',borderRadius:'var(--radius-sm)',padding:'1rem',marginBottom:'1.25rem'}}>
                <div style={{fontSize:'0.75rem',color:'var(--text3)',marginBottom:'0.3rem'}}>Total Amount to Pay</div>
                <div style={{fontSize:'2rem',fontWeight:700,color:'var(--gold)'}}>
                  {fmt((payModal.commissions||[]).filter(c=>c.status==='pending').reduce((s,c)=>s+parseFloat(c.amount_inr||0),0))}
                </div>
                <div style={{fontSize:'0.8rem',color:'var(--text3)',marginTop:'0.3rem'}}>
                  {(payModal.commissions||[]).filter(c=>c.status==='pending').length} pending commission(s)
                </div>
              </div>
              <div className="form-group">
                <label className="label">Payment Reference (optional)</label>
                <input className="input" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Bank transfer ref, UPI ID, etc." />
              </div>
              {(payModal.commissions||[]).filter(c=>c.status==='pending').length === 0 && (
                <div style={{color:'var(--text3)',fontStyle:'italic',padding:'1rem 0'}}>No pending commissions to pay.</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => setPayModal(null)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={doPay} disabled={paying || (payModal.commissions||[]).filter(c=>c.status==='pending').length===0}>
                {paying ? 'ProcessingÃ¢â‚¬Â¦' : 'Mark as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/*
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦</div>
        : businesses.length === 0
          ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center',fontStyle:'italic'}}>No business accounts yet.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Business</th><th>Status</th><th>Clients</th><th>Album Quota</th><th>Used</th><th></th></tr></thead>
                <tbody>
                  {businesses.map(business => (
                    <tr key={business.id}>
                      <td>
                        <div className="td-main">{business.name}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>{business.email}</div>
                      </td>
                      <td><StatusBadge status={business.status || 'active'} /></td>
                      <td>{business.user_count ?? 0}</td>
                      <td>{business.album_quota ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}</td>
                      <td>{business.albums_used ?? 0}</td>
                      <td style={{display:'flex',gap:'0.5rem'}}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(business)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(business)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'create' ? 'Add Business' : 'Edit Business'}</div>
              <button className="modal-close" onClick={() => setModal(null)}>ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¢</button>
            </div>
            <div className="modal-body">
              <div className="input-row">
                <div className="form-group">
                  <label className="label">Business Name</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="label">Contact Name</label>
                  <input className="input" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
                </div>
              </div>
              <div className="input-row">
                <div className="form-group">
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={modal === 'edit'} />
                </div>
                <div className="form-group">
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="input-row">
                <div className="form-group">
                  <label className="label">Album Quota</label>
                  <input className="input" type="number" min="1" value={form.albumQuota} onChange={e => setForm(f => ({ ...f, albumQuota: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="label">Status</label>
                  <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="label">Address</label>
                <textarea className="textarea" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="input-row">
                <div className="form-group">
                  <label className="label">GSTIN</label>
                  <input className="input" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="label">Notes</label>
                  <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={save} disabled={saving}>{saving ? 'SavingÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦' : 'Save Business'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
*/

function StudiosPage() {
  const EMPTY_EDIT  = { isActive: true, albumQuota: '' };
  const EMPTY_GRANT = { planSlug: 'studio-starter', months: '1' };

  const [studios, setStudios]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [saved, setSaved]             = useState('');
  const [search, setSearch]           = useState('');
  const [detail, setDetail]           = useState(null);
  const [editing, setEditing]         = useState(null);
  const [editForm, setEditForm]       = useState(EMPTY_EDIT);
  const [granting, setGranting]       = useState(null);
  const [grantForm, setGrantForm]     = useState(EMPTY_GRANT);
  const [savingEdit, setSavingEdit]   = useState(false);
  const [savingGrant, setSavingGrant] = useState(false);

  const load = async (query = search) => {
    setLoading(true);
    setError('');
    try {
      const suffix = query ? `?search=${encodeURIComponent(query)}` : '';
      const data = await apiCall(`/api/admin/studios${suffix}`);
      setStudios(data.studios || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []);

  const flashSaved = (message) => {
    setSaved(message);
    setTimeout(() => setSaved(''), 2500);
  };

  const fmtDate = (value) => value
    ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Ã¢â‚¬â€';

  const openAlbum = (album) => {
    const path = album.type === 'wedding' ? `/wedding/${album.slug}` : `/album/${album.slug}`;
    window.open(path, '_blank', 'noopener,noreferrer');
  };

  const openDetail = async (studio) => {
    try {
      const data = await apiCall(`/api/admin/studios/${studio.id}`);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const openEdit = (studio) => {
    setEditing(studio);
    setEditForm({
      isActive: Boolean(studio.is_active),
      albumQuota: String(studio.album_quota ?? studio.sub_album_quota ?? 0),
    });
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    setError('');
    try {
      await apiCall(`/api/admin/studios/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isActive: editForm.isActive,
          albumQuota: Number(editForm.albumQuota || 0),
        }),
      });
      setEditing(null);
      flashSaved('Studio updated successfully.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const openGrant = (studio) => {
    setGranting(studio);
    setGrantForm(EMPTY_GRANT);
  };

  const saveGrant = async () => {
    setSavingGrant(true);
    setError('');
    try {
      const data = await apiCall(`/api/admin/studios/${granting.id}/grant-subscription`, {
        method: 'POST',
        body: JSON.stringify({
          planSlug: grantForm.planSlug,
          months: Number(grantForm.months || 1),
        }),
      });
      setGranting(null);
      flashSaved(data.message || 'Studio subscription granted.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGrant(false);
    }
  };

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">{saved}</div>}

      <div style={{display:'flex',justifyContent:'space-between',gap:'0.75rem',marginBottom:'1rem',flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by studio or owner email"
            style={{minWidth:'260px'}}
          />
          <button className="btn btn-outline btn-md" onClick={() => load(search)}>Search</button>
        </div>
        <button className="btn btn-outline btn-md" onClick={() => load(search)}>Refresh</button>
      </div>

      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃ¢â‚¬Â¦</div>
        : studios.length === 0
          ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center',fontStyle:'italic'}}>No studios found.</div>
          : <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Studio</th><th>Plan</th><th>Members</th><th>Albums</th><th>Renews</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {studios.map((studio) => (
                    <tr key={studio.id}>
                      <td>
                        <div className="td-main">{studio.name}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>
                          Owner: {studio.owner_name || 'Ã¢â‚¬â€'} Ã‚Â· {studio.owner_email || studio.email || 'Ã¢â‚¬â€'}
                        </div>
                      </td>
                      <td>
                        {studio.plan_slug
                          ? <StatusBadge status={studio.plan_slug} />
                          : <span style={{color:'var(--text3)'}}>No plan</span>}
                      </td>
                      <td>{studio.member_count ?? 0}</td>
                      <td>{studio.albums_used ?? 0} / {studio.album_quota ?? 'Ã¢â‚¬â€'}</td>
                      <td>{fmtDate(studio.current_period_end)}</td>
                      <td><StatusBadge status={studio.sub_status || (studio.is_active ? 'active' : 'inactive')} /></td>
                      <td style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                        <button className="btn btn-outline btn-sm" onClick={() => openDetail(studio)}>View</button>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(studio)}>Edit</button>
                        <button className="btn btn-gold btn-sm" onClick={() => openGrant(studio)}>Grant Plan</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'980px'}}>
            <div className="modal-header">
              <div className="modal-title">Studio Detail Ã¢â‚¬â€ {detail.studio?.name}</div>
              <button className="modal-close" onClick={() => setDetail(null)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body" style={{display:'grid',gap:'1.25rem'}}>
              <div className="stats-grid">
                {[
                  { label:'Owner', value: detail.studio?.owner_name || 'Ã¢â‚¬â€' },
                  { label:'Owner Email', value: detail.studio?.owner_email || detail.studio?.email || 'Ã¢â‚¬â€' },
                  { label:'Albums Used', value: `${detail.studio?.albums_used ?? 0} / ${detail.studio?.album_quota ?? 'Ã¢â‚¬â€'}` },
                  { label:'Active', value: detail.studio?.is_active ? 'Yes' : 'No' },
                ].map((item, idx) => (
                  <div key={idx} className="stat-card">
                    <div className="stat-label">{item.label}</div>
                    <div className="stat-value" style={{fontSize:'1rem'}}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                <div className="card" style={{padding:'1rem'}}>
                  <div className="section-title" style={{marginBottom:'0.75rem'}}>Members</div>
                  {!detail.members?.length
                    ? <div style={{color:'var(--text3)',fontStyle:'italic'}}>No members.</div>
                    : detail.members.map((member) => (
                        <div key={member.id} style={{padding:'0.55rem 0',borderBottom:'1px solid var(--border)'}}>
                          <div className="td-main">{member.name}</div>
                          <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>
                            {member.email} Ã‚Â· {member.role}
                          </div>
                        </div>
                      ))}
                </div>

                <div className="card" style={{padding:'1rem'}}>
                  <div className="section-title" style={{marginBottom:'0.75rem'}}>Recent Subscriptions</div>
                  {!detail.subscriptions?.length
                    ? <div style={{color:'var(--text3)',fontStyle:'italic'}}>No subscriptions.</div>
                    : detail.subscriptions.map((sub) => (
                        <div key={sub.id} style={{padding:'0.55rem 0',borderBottom:'1px solid var(--border)'}}>
                          <div style={{display:'flex',justifyContent:'space-between',gap:'0.75rem'}}>
                            <span className="td-main">{sub.plan_slug}</span>
                            <StatusBadge status={sub.status} />
                          </div>
                          <div style={{fontSize:'0.75rem',color:'var(--text3)',marginTop:'0.25rem'}}>
                            Ends {fmtDate(sub.current_period_end)} Ã‚Â· Seats {sub.seat_quota} Ã‚Â· Albums {sub.album_quota}
                          </div>
                        </div>
                      ))}
                </div>
              </div>

              <div className="card" style={{padding:'1rem'}}>
                <div className="section-title" style={{marginBottom:'0.75rem'}}>Recent Audit Log</div>
                {!detail.auditLog?.length
                  ? <div style={{color:'var(--text3)',fontStyle:'italic'}}>No audit entries yet.</div>
                  : detail.auditLog.map((entry) => (
                      <div key={entry.id} style={{padding:'0.55rem 0',borderBottom:'1px solid var(--border)'}}>
                        <div className="td-main">{entry.action}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>
                          {fmtDate(entry.created_at)} Ã‚Â· {entry.target_type || 'Ã¢â‚¬â€'} Ã‚Â· {entry.target_id || 'Ã¢â‚¬â€'}
                        </div>
                      </div>
                    ))}
              </div>

              <div className="card" style={{padding:'1rem'}}>
                <div className="section-title" style={{marginBottom:'0.75rem'}}>Studio Albums</div>
                {!detail.albums?.length
                  ? <div style={{color:'var(--text3)',fontStyle:'italic'}}>No albums in this studio yet.</div>
                  : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>Album</th><th>Type</th><th>Media</th><th>Status</th><th>Created</th><th></th></tr>
                        </thead>
                        <tbody>
                          {detail.albums.map((album) => (
                            <tr key={album.id}>
                              <td>
                                <div className="td-main">{album.name}</div>
                                <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>/{album.slug}</div>
                              </td>
                              <td>{album.type || 'memorial'}</td>
                              <td>{album.media_count ?? 0}</td>
                              <td>
                                {album.is_published
                                  ? <span className="badge badge-green">Live</span>
                                  : <span className="badge badge-gray">Draft</span>}
                              </td>
                              <td>{fmtDate(album.created_at)}</td>
                              <td style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                                {album.is_published
                                  ? <button className="btn btn-outline btn-sm" onClick={() => openAlbum(album)}>View Album</button>
                                  : <span style={{color:'var(--text3)',fontSize:'0.75rem'}}>Publish to view</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit Studio Ã¢â‚¬â€ {editing.name}</div>
              <button className="modal-close" onClick={() => setEditing(null)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body">
              <div className="input-row">
                <div className="form-group">
                  <label className="label">Album Quota</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={editForm.albumQuota}
                    onChange={e => setEditForm((f) => ({ ...f, albumQuota: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Studio Status</label>
                  <select
                    className="select"
                    value={editForm.isActive ? 'active' : 'inactive'}
                    onChange={e => setEditForm((f) => ({ ...f, isActive: e.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? 'SavingÃ¢â‚¬Â¦' : 'Save Studio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {granting && (
        <div className="modal-overlay" onClick={() => setGranting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Grant Subscription Ã¢â‚¬â€ {granting.name}</div>
              <button className="modal-close" onClick={() => setGranting(null)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body">
              <div className="input-row">
                <div className="form-group">
                  <label className="label">Plan</label>
                  <select
                    className="select"
                    value={grantForm.planSlug}
                    onChange={e => setGrantForm((f) => ({ ...f, planSlug: e.target.value }))}
                  >
                    <option value="studio-starter">Studio Starter</option>
                    <option value="studio-pro">Studio Pro</option>
                    <option value="studio-agency">Studio Agency</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Months</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="24"
                    value={grantForm.months}
                    onChange={e => setGrantForm((f) => ({ ...f, months: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => setGranting(null)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={saveGrant} disabled={savingGrant}>
                {savingGrant ? 'GrantingÃ¢â‚¬Â¦' : 'Grant Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PricingPage() {
  const [plans, setPlans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saved, setSaved]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const [editName, setEditName]             = useState('');
  const [editPrice, setEditPrice]           = useState('');
  const [editMaxPhotos, setEditMaxPhotos]   = useState('');
  const [editMaxVideos, setEditMaxVideos]   = useState('');
  const [editActive, setEditActive]         = useState(true);
  const [editFeatured, setEditFeatured]     = useState(false);

  const load = () => {
    apiCall('/api/admin/plans')
      .then(d => setPlans(d.plans || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (plan) => {
    setEditing(plan);
    setEditName(plan.name);
    setEditPrice(Math.floor(plan.price_inr / 100));
    setEditMaxPhotos(plan.max_photos);
    setEditMaxVideos(plan.max_videos);
    setEditActive(plan.is_active);
    setEditFeatured(plan.is_featured);
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await apiCall(`/api/admin/plans/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name:        editName,
          price_inr:   Math.round(parseFloat(editPrice) * 100),
          max_photos:  parseInt(editMaxPhotos),
          max_videos:  parseInt(editMaxVideos),
          is_active:   editActive,
          is_featured: editFeatured,
        }),
      });
      setSaved(true);
      setEditing(null);
      load();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const parseFeat = (f) => { if (Array.isArray(f)) return f; try { return JSON.parse(f); } catch { return []; } };

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">Plan updated successfully.</div>}
      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>Loading...</div>
        : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:'1.5rem'}}>
            {plans.map(plan => (
              <div key={plan.id} className="card" style={{position:'relative'}}>
                {plan.is_featured && <span className="badge badge-gold" style={{position:'absolute',top:'1rem',right:'1rem'}}>Featured</span>}
                <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'1.25rem'}}>
                  <div style={{width:'44px',height:'44px',borderRadius:'50%',background:'var(--gold-pale)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700}}>Plan</div>
                  <div>
                    <div style={{fontWeight:600,fontSize:'1rem',color:'var(--text)'}}>{plan.name}</div>
                    <div style={{fontSize:'0.78rem',color:'var(--text3)'}}>/{plan.interval}</div>
                  </div>
                </div>
                <div style={{fontSize:'2.5rem',fontWeight:700,color:'var(--text)',marginBottom:'0.25rem'}}>Rs {Math.floor(plan.price_inr/100)}</div>
                <div style={{fontSize:'0.78rem',color:'var(--text3)',marginBottom:'1.25rem'}}>per album per {plan.interval}</div>
                <div style={{marginBottom:'1.25rem'}}>
                  {parseFeat(plan.features).map((f,i) => (
                    <div key={i} style={{display:'flex',gap:'0.5rem',padding:'0.3rem 0',fontSize:'0.82rem',color:'var(--text2)'}}>
                      <span style={{color:'var(--green)'}}>+</span>{f}
                    </div>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'1rem',padding:'0.875rem',background:'var(--bg3)',borderRadius:'var(--radius-sm)'}}>
                  <div><div style={{fontSize:'0.7rem',color:'var(--text3)'}}>Billing Type</div><div style={{fontSize:'0.8rem',color:'var(--gold)',fontFamily:'monospace'}}>Order-based</div></div>
                  <div><div style={{fontSize:'0.7rem',color:'var(--text3)'}}>Max Photos</div><div style={{fontSize:'0.8rem',color:'var(--text)'}}>{plan.max_photos >= 9999 ? 'Unlimited' : plan.max_photos}</div></div>
                </div>
                <button className="btn btn-outline btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={()=>openEdit(plan)}>Edit Plan</button>
              </div>
            ))}
          </div>
      }

      {editing && (
        <div className="modal-overlay" onClick={()=>setEditing(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit Plan - {editing.name}</div>
              <button className="modal-close" onClick={()=>setEditing(null)}>x</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error" style={{marginBottom:'1rem'}}>{error}</div>}
              <div className="input-row">
                <div className="form-group">
                  <label className="label">Plan Name</label>
                  <input className="input" value={editName} onChange={e=>setEditName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Price (Rs per {editing.interval})</label>
                  <input className="input" type="number" value={editPrice} onChange={e=>setEditPrice(e.target.value)} />
                </div>
              </div>
              <div className="input-row">
                <div className="form-group">
                  <label className="label">Max Photos</label>
                  <input className="input" type="number" value={editMaxPhotos} onChange={e=>setEditMaxPhotos(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Max Videos</label>
                  <input className="input" type="number" value={editMaxVideos} onChange={e=>setEditMaxVideos(e.target.value)} />
                </div>
              </div>
              <div style={{display:'flex',gap:'1.5rem'}}>
                <label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.85rem',color:'var(--text2)',cursor:'pointer'}}>
                  <input type="checkbox" checked={editActive} onChange={e=>setEditActive(e.target.checked)} /> Active
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.85rem',color:'var(--text2)',cursor:'pointer'}}>
                  <input type="checkbox" checked={editFeatured} onChange={e=>setEditFeatured(e.target.checked)} /> Featured (highlighted)
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={()=>setEditing(null)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Plan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Ã¢â€â‚¬Ã¢â€â‚¬ SETTINGS PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function SettingsPage() {
  const GROUPS = ['general','billing','payment','email','storage'];
  const [activeGroup, setActiveGroup] = useState('general');
  const [settings, setSettings]       = useState({});
  const [loading, setLoading]         = useState(true);
  const [saved, setSaved]             = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    apiCall('/api/admin/settings')
      .then(d => {
        if (d.settings && typeof d.settings === 'object' && !Array.isArray(d.settings)) {
          setSettings(d.settings);
          return;
        }

        const grouped = {};
        (d.flat || d.settings || []).forEach(s => {
          const g = s.group_name || s.group || 'general';
          if (!grouped[g]) grouped[g] = [];
          grouped[g].push(s);
        });
        setSettings(grouped);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const updateSetting = (group, key, value) => {
    setSettings(prev => ({
      ...prev,
      [group]: (prev[group] || []).map(s => s.key === key ? {...s, value} : s),
    }));
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const allSettings = Object.values(settings).flat();
      await apiCall('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: allSettings }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const groupSettings = settings[activeGroup] || [];

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">Ã¢Å“â€œ Settings saved successfully.</div>}
      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃ¢â‚¬Â¦</div>
        : <div className="settings-grid">
            <div>
              <div className="card" style={{padding:'0.75rem'}}>
                <div className="settings-nav">
                  {GROUPS.map(g => (
                    <button key={g} className={`settings-nav-item ${activeGroup===g?'active':''}`} onClick={()=>setActiveGroup(g)}>
                      {g.charAt(0).toUpperCase()+g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="card">
              {groupSettings.length === 0
                ? <div style={{color:'var(--text3)',fontStyle:'italic'}}>No settings in this group.</div>
                : groupSettings.map(s => (
                    <div key={s.key} className="form-group">
                      <label className="label">{s.label || s.key}</label>
                      {s.description && <div style={{fontSize:'0.72rem',color:'var(--text3)',marginBottom:'0.4rem'}}>{s.description}</div>}
                      {s.type === 'boolean'
                        ? <select className="select" value={s.value} onChange={e=>updateSetting(activeGroup,s.key,e.target.value)}>
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                          </select>
                        : <input className="input" type={s.type === 'number' ? 'number' : 'text'}
                            value={s.value || ''} onChange={e=>updateSetting(activeGroup,s.key,e.target.value)} />
                      }
                    </div>
                  ))
              }
              {groupSettings.length > 0 && (
                <button className="btn btn-gold btn-md" style={{marginTop:'0.5rem'}} onClick={save} disabled={saving}>
                  {saving ? 'SavingÃ¢â‚¬Â¦' : 'Save Settings'}
                </button>
              )}
            </div>
          </div>
      }
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ API PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Ã¢â€â‚¬Ã¢â€â‚¬ AUTOMATION PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function AutomationPage() {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState({});

  const JOBS = [
    {
      id: 'daily-digest',
      icon: 'Ã°Å¸â€œÅ ',
      label: 'Daily Signup Digest',
      desc: 'Sends you a summary of new registrations, subscribers, 24h revenue, and pending affiliate applications.',
      schedule: 'Daily at 9:00 AM IST',
      category: 'Admin Alerts',
    },
    {
      id: 'affiliate-alerts',
      icon: 'Ã°Å¸Â¤Â',
      label: 'Affiliate Application Alerts',
      desc: 'Emails you when a new verified affiliate application is pending review.',
      schedule: 'Every 30 minutes',
      category: 'Admin Alerts',
    },
    {
      id: 'commission-reminder',
      icon: 'Ã°Å¸â€™Â°',
      label: 'Commission Payout Reminder',
      desc: 'Reminds you every Monday to pay out pending affiliate commissions.',
      schedule: 'Every Monday at 9:00 AM IST',
      category: 'Admin Alerts',
    },
    {
      id: 'anniversary-reminders',
      icon: 'Ã°Å¸â€¢Â¯Ã¯Â¸Â',
      label: 'Anniversary Reminders',
      desc: 'Emails album owners on the birth anniversary or death anniversary of their loved one.',
      schedule: 'Daily at 8:00 AM IST',
      category: 'Subscriber Emails',
    },
    {
      id: 'renewal-reminders',
      icon: 'Ã°Å¸â€â€ž',
      label: 'Renewal Reminders',
      desc: 'Emails active subscribers 7 days before their subscription auto-renews.',
      schedule: 'Daily at 8:00 AM IST',
      category: 'Subscriber Emails',
    },
    {
      id: 'expiry-warnings',
      icon: 'Ã¢Å¡Â Ã¯Â¸Â',
      label: 'Expiry Warnings',
      desc: 'Emails subscribers who have cancelled, 7 days before their access ends.',
      schedule: 'Daily at 8:00 AM IST',
      category: 'Subscriber Emails',
    },
    {
      id: 'media-quota-warnings',
      icon: 'Ã°Å¸â€œÂ¦',
      label: 'Media Quota Warnings',
      desc: 'Emails subscribers when they have used 85% or more of their photo or video storage limit.',
      schedule: 'Daily at 8:00 AM IST',
      category: 'Subscriber Emails',
    },
    {
      id: 'grace-period',
      icon: 'Ã¢ÂÂ³',
      label: 'Grace Period Enforcement',
      desc: 'Moves accounts from past-due to inactive once their grace period has expired.',
      schedule: 'Daily at 8:00 AM IST',
      category: 'System',
    },
    {
      id: 'lifetime-expiry',
      icon: 'Ã¢â„¢Â¾Ã¯Â¸Â',
      label: 'Lifetime Plan Expiry',
      desc: 'Marks lifetime plan accounts as expired after 10 years.',
      schedule: 'Monthly on 1st',
      category: 'System',
    },
    {
      id: 'expired-data-cleanup',
      icon: 'Ã°Å¸â€”â€˜Ã¯Â¸Â',
      label: 'Expired Data Cleanup',
      desc: 'Warns users 7 days before deletion, then permanently deletes albums and accounts 90 days after subscription end.',
      schedule: 'Monthly on 1st',
      category: 'System',
      danger: true,
    },
  ];

  const runJob = async (jobId) => {
    setRunning(r => ({ ...r, [jobId]: true }));
    setResults(r => ({ ...r, [jobId]: null }));
    try {
      const data = await apiCall(`/api/admin/cron/run/${jobId}`, { method: 'POST' });
      setResults(r => ({ ...r, [jobId]: { ok: true, msg: data.message } }));
      toast('success', 'Job triggered', data.message);
    } catch (err) {
      setResults(r => ({ ...r, [jobId]: { ok: false, msg: err.message } }));
      toast('error', 'Job failed', err.message);
    } finally {
      setRunning(r => ({ ...r, [jobId]: false }));
    }
  };

  const categories = [...new Set(JOBS.map(j => j.category))];

  return (
    <div className="fade-in">
      {/* Info banner */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', flexShrink: 0 }}>Ã¢Å¡Â¡</div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem', fontSize: '1rem' }}>Automation Centre</div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text2)', lineHeight: 1.6 }}>
              All jobs run automatically on their schedule. Use the <strong style={{ color: 'var(--gold)' }}>Run Now</strong> button to trigger any job manually Ã¢â‚¬â€ useful for testing or catching up after downtime. Results appear in server logs. Make sure <code style={{ background: 'var(--bg3)', padding: '0.1rem 0.4rem', borderRadius: 4, color: 'var(--gold)', fontSize: '0.8rem' }}>ADMIN_NOTIFY_EMAIL</code> is set in your <code style={{ background: 'var(--bg3)', padding: '0.1rem 0.4rem', borderRadius: 4, color: 'var(--gold)', fontSize: '0.8rem' }}>.env</code> to receive admin alerts.
            </div>
          </div>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
            {cat}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {JOBS.filter(j => j.category === cat).map(job => {
              const res = results[job.id];
              const busy = running[job.id];
              return (
                <div key={job.id} className="card" style={{
                  padding: '1rem 1.25rem',
                  display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                  border: res?.ok === false ? '1px solid rgba(239,68,68,0.3)' : res?.ok === true ? '1px solid rgba(34,197,94,0.2)' : '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>{job.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>{job.label}</span>
                      {job.danger && <span style={{ fontSize: '0.65rem', background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', padding: '0.1rem 0.5rem', borderRadius: 100, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destructive</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.5, marginBottom: '0.3rem' }}>{job.desc}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Ã°Å¸â€¢Â {job.schedule}</div>
                    {res && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: res.ok ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {res.ok ? 'Ã¢Å“â€œ' : 'Ã¢Å“â€¢'} {res.msg}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => runJob(job.id)}
                    disabled={busy}
                    style={{
                      flexShrink: 0, padding: '0.5rem 1rem',
                      background: job.danger ? 'transparent' : 'var(--gold)',
                      color: job.danger ? 'var(--red)' : '#111',
                      border: job.danger ? '1px solid rgba(239,68,68,0.4)' : 'none',
                      borderRadius: 'var(--radius-sm)', fontWeight: 600,
                      fontSize: '0.82rem', cursor: busy ? 'not-allowed' : 'pointer',
                      opacity: busy ? 0.6 : 1, minWidth: 90, textAlign: 'center',
                    }}
                  >
                    {busy ? 'Ã¢ÂÂ³ RunningÃ¢â‚¬Â¦' : 'Ã¢â€“Â¶ Run Now'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function APIPage() {
  const [copied, setCopied] = useState(null);
  const copy = (text, id) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(()=>setCopied(null),2000); };
  const token = getToken();
  const ENDPOINTS = [
    { method: 'GET',  path: '/api/payments/plans',          desc: 'List active pricing plans (public)',          auth: false },
    { method: 'POST', path: '/api/auth/register',           desc: 'Register a new user',                        auth: false },
    { method: 'POST', path: '/api/auth/login',              desc: 'Login and get JWT token',                    auth: false },
    { method: 'GET',  path: '/api/auth/me',                 desc: 'Get current user',                           auth: true  },
    { method: 'POST', path: '/api/payments/subscribe',      desc: 'Create Razorpay subscription',               auth: true  },
    { method: 'POST', path: '/api/payments/verify',         desc: 'Verify payment after checkout',              auth: true  },
    { method: 'GET',  path: '/api/albums',                  desc: "List user's albums",                         auth: true  },
    { method: 'POST', path: '/api/albums',                  desc: 'Create a new album',                         auth: true  },
    { method: 'GET',  path: '/api/albums/:id/qr',           desc: 'Download QR code (PNG/SVG)',                  auth: true  },
    { method: 'POST', path: '/api/media/:albumId/upload',   desc: 'Upload photo/video/audio to R2',             auth: true  },
    { method: 'GET',  path: '/api/public/album/:slug',      desc: 'Get public album by QR slug',                auth: false },
    { method: 'POST', path: '/api/payments/webhook',        desc: 'Razorpay webhook (server-to-server)',        auth: false },
    { method: 'GET',  path: '/api/admin/dashboard',         desc: 'Admin dashboard stats',                      auth: true, admin: true },
    { method: 'GET',  path: '/api/admin/users',             desc: 'List all users',                             auth: true, admin: true },
    { method: 'GET',  path: '/api/admin/invoices',          desc: 'List invoices across all users',             auth: true, admin: true },
    { method: 'GET',  path: '/api/admin/support/inbox',     desc: 'List inbound support tickets',               auth: true, admin: true },
    { method: 'GET',  path: '/api/admin/support/inbox/:id', desc: 'Fetch ticket details and reply history',     auth: true, admin: true },
    { method: 'PUT',  path: '/api/admin/support/inbox/:id', desc: 'Update support ticket owner or status',      auth: true, admin: true },
    { method: 'POST', path: '/api/admin/support/inbox/:id/reply', desc: 'Reply from support@hriatrengna.in', auth: true, admin: true },
    { method: 'GET',  path: '/api/admin/affiliates',        desc: 'Review affiliate applications',              auth: true, admin: true },
    { method: 'PUT',  path: '/api/admin/plans/:id',         desc: 'Update a pricing plan',                      auth: true, admin: true },
    { method: 'GET',  path: '/api/admin/settings',          desc: 'Get app settings',                           auth: true, admin: true },
    { method: 'PUT',  path: '/api/admin/settings',          desc: 'Update app settings',                        auth: true, admin: true },
    { method: 'POST', path: '/api/admin/cron/run/:job',     desc: 'Manually trigger an automation job',         auth: true, admin: true },
  ];
  const methodColor = { GET:'var(--green)', POST:'var(--blue)', PUT:'var(--yellow)', DELETE:'var(--red)' };
  return (
    <div className="fade-in">
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="card-title" style={{marginBottom:'0.5rem'}}>Base URL</div>
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem',background:'var(--bg3)',padding:'0.875rem 1rem',borderRadius:'var(--radius-sm)'}}>
          <code style={{flex:1,fontFamily:'monospace',fontSize:'0.85rem',color:'var(--gold)'}}>{API}</code>
          <button className="btn btn-ghost btn-sm" onClick={()=>copy(API,'base')}>{copied==='base'?'Ã¢Å“â€œ Copied':'Copy'}</button>
        </div>
        <p style={{marginTop:'0.875rem',fontSize:'0.82rem',color:'var(--text3)',lineHeight:1.6}}>
          Admin endpoints require a <strong>separate admin token</strong> obtained from <code style={{background:'var(--bg3)',padding:'0.1rem 0.4rem',borderRadius:'4px',color:'var(--gold)'}}>POST /api/admin/auth/login</code>.
        </p>
        {false && token && (
          <div style={{marginTop:'0.875rem',padding:'0.75rem 1rem',background:'var(--bg3)',borderRadius:'var(--radius-sm)'}}>
            <div style={{fontSize:'0.72rem',color:'var(--text3)',marginBottom:'0.3rem'}}>YOUR CURRENT ADMIN TOKEN</div>
            <code style={{fontSize:'0.72rem',color:'var(--text2)',wordBreak:'break-all'}}>{token.substring(0,60)}Ã¢â‚¬Â¦</code>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th><th>Auth</th></tr></thead>
          <tbody>
            {ENDPOINTS.map((e,i) => (
              <tr key={i}>
                <td><code style={{color:methodColor[e.method]||'var(--text)',fontWeight:700,fontSize:'0.78rem'}}>{e.method}</code></td>
                <td><code style={{fontFamily:'monospace',fontSize:'0.78rem',color:'var(--text2)'}}>{e.path}</code></td>
                <td style={{color:'var(--text2)',fontSize:'0.82rem'}}>{e.desc}</td>
                <td>{e.admin ? <span className="badge badge-gold">Admin</span> : e.auth ? <span className="badge badge-blue">JWT</span> : <span className="badge badge-gray">Public</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ LOGS PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function SupportInboxPage({ admin }) {
  const [tickets, setTickets] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const loadInbox = async (preferredId = selectedId) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (assignedFilter !== 'all') params.set('assigned', assignedFilter);

      const data = await apiCall(`/api/admin/support/inbox?${params.toString()}`);
      const nextTickets = data.tickets || [];
      setTickets(nextTickets);
      setAdmins(data.admins || []);
      setStats(data.stats || null);

      if (!nextTickets.length) {
        setSelectedId(null);
        setDetail(null);
        return;
      }

      const resolvedId = preferredId && nextTickets.some((ticket) => ticket.id === preferredId)
        ? preferredId
        : nextTickets[0].id;

      setSelectedId(resolvedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (ticketId) => {
    if (!ticketId) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    try {
      const data = await apiCall(`/api/admin/support/inbox/${ticketId}`);
      setDetail(data);
      const suggestedSubject = /^re:/i.test(String(data.ticket?.subject || ''))
        ? data.ticket.subject
        : `Re: ${data.ticket?.subject || 'Support request'}`;
      setReplySubject(suggestedSubject);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [search, statusFilter, assignedFilter]);

  useEffect(() => {
    setDetail(null);
    loadDetail(selectedId);
  }, [selectedId]);

  const refreshCurrent = async () => {
    await loadInbox(selectedId);
    if (selectedId) await loadDetail(selectedId);
  };

  const updateTicket = async (patch, successTitle) => {
    if (!selectedId) return;
    setSavingMeta(true);
    try {
      await apiCall(`/api/admin/support/inbox/${selectedId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      toast('success', successTitle, 'Support ticket updated.');
      await refreshCurrent();
    } catch (err) {
      toast('error', 'Update failed', err.message);
    } finally {
      setSavingMeta(false);
    }
  };

  const sendReply = async () => {
    if (!selectedId) return;
    if (!replyBody.trim()) {
      toast('error', 'Reply required', 'Write a message before sending.');
      return;
    }

    setSendingReply(true);
    try {
      await apiCall(`/api/admin/support/inbox/${selectedId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          subject: replySubject,
          bodyText: replyBody,
        }),
      });
      setReplyBody('');
      toast('success', 'Reply sent', 'The message was sent from support@hriatrengna.in.');
      await refreshCurrent();
    } catch (err) {
      toast('error', 'Reply failed', err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const selectedTicket = detail?.ticket || tickets.find((ticket) => ticket.id === selectedId) || null;
  const conversationMessages = detail?.messages || [];
  const statusCards = stats ? [
    { label: 'Open', value: stats.open_count || 0 },
    { label: 'In Progress', value: stats.in_progress_count || 0 },
    { label: 'Waiting', value: stats.waiting_customer_count || 0 },
    { label: 'Resolved', value: stats.resolved_count || 0 },
  ] : [];

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="support-stats" style={{ marginBottom: '1rem' }}>
        {statusCards.map((card) => (
          <div key={card.label} className="support-stat-card">
            <div className="support-stat-label">{card.label}</div>
            <div className="support-stat-value">{card.value}</div>
          </div>
        ))}
        <div className="support-stat-card">
          <div className="support-stat-label">Inbox Model</div>
          <div className="support-stat-value" style={{ fontSize: '0.98rem' }}>Built-in Support CRM</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="filters-row" style={{ marginBottom: 0 }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 240 }}>
            <span className="search-icon">Ã¢Å’â€¢</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput.trim())}
              placeholder="Search sender, email, or subject"
            />
          </div>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting_customer">Waiting Customer</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
          </select>
          <select className="select" value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
            <option value="all">All owners</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {admins.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <button className="btn btn-outline btn-md" onClick={() => setSearch(searchInput.trim())}>Apply</button>
          <button className="btn btn-ghost btn-md" onClick={() => { setSearchInput(''); setSearch(''); setStatusFilter('all'); setAssignedFilter('all'); }}>
            Reset
          </button>
        </div>
      </div>

      <div className="support-layout">
        <div className="card">
          <div className="support-meta-row">
            <div>
              <div className="card-title" style={{ marginBottom: '0.2rem' }}>Support Tickets</div>
              <div className="card-sub">{tickets.length} ticket{tickets.length === 1 ? '' : 's'} in the current view</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => refreshCurrent()}>Refresh</button>
          </div>

          {loading ? (
            <div style={{ color: 'var(--text3)', padding: '2.5rem 0', textAlign: 'center' }}>Loading inboxÃ¢â‚¬Â¦</div>
          ) : tickets.length === 0 ? (
            <div style={{ color: 'var(--text3)', padding: '2.5rem 0', textAlign: 'center', fontStyle: 'italic' }}>
              No support emails match these filters.
            </div>
          ) : (
            <div className="support-list">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={`support-ticket ${ticket.id === selectedId ? 'active' : ''}`}
                  onClick={() => setSelectedId(ticket.id)}
                >
                  <div className="support-meta-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ticket.from_name || ticket.from_email}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '0.15rem' }}>{ticket.from_email}</div>
                    </div>
                    <StatusBadge status={ticket.ticket_status} />
                  </div>
                  <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: '0.35rem' }}>
                    {ticket.subject || 'No subject'}
                  </div>
                  <div style={{ color: 'var(--text2)', fontSize: '0.8rem', lineHeight: 1.5, minHeight: '2.4em' }}>
                    {ticket.preview_text || getSupportPreview(ticket) || 'No message preview available.'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text3)' }}>
                    <span>{fmtDateTime(ticket.last_message_at || ticket.last_reply_at || ticket.received_at)}</span>
                    {ticket.assigned_admin_name && <span>Owner: {ticket.assigned_admin_name}</span>}
                    {ticket.message_count > 1 && <span>{ticket.message_count} messages</span>}
                    {ticket.attachment_count > 0 && <span>{ticket.attachment_count} attachment{ticket.attachment_count === 1 ? '' : 's'}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          {!selectedTicket ? (
            <div style={{ color: 'var(--text3)', padding: '3rem 0', textAlign: 'center', fontStyle: 'italic' }}>
              Select a ticket to review the conversation and reply.
            </div>
          ) : detailLoading && !detail ? (
            <div style={{ color: 'var(--text3)', padding: '3rem 0', textAlign: 'center' }}>Loading conversationÃ¢â‚¬Â¦</div>
          ) : (
            <>
              <div className="support-meta-row" style={{ marginBottom: '1rem' }}>
                <div>
                  <div className="card-title" style={{ marginBottom: '0.25rem' }}>{selectedTicket.subject || 'No subject'}</div>
                  <div className="card-sub">
                    From {selectedTicket.from_name || selectedTicket.from_email} on {fmtDateTime(selectedTicket.received_at)}
                  </div>
                </div>
                <div className="support-actions">
                  <StatusBadge status={selectedTicket.ticket_status} />
                  {selectedTicket.thread_address && <span className="badge badge-gray">{selectedTicket.thread_address}</span>}
                  {selectedTicket.replied_at && <span className="badge badge-gray">Last reply {fmtDateTime(selectedTicket.replied_at)}</span>}
                </div>
              </div>

              <div className="support-actions" style={{ marginBottom: '1rem' }}>
                <select
                  className="select"
                  disabled={savingMeta}
                  value={selectedTicket.ticket_status || 'open'}
                  onChange={(e) => updateTicket({ ticketStatus: e.target.value }, 'Status updated')}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_customer">Waiting Customer</option>
                  <option value="resolved">Resolved</option>
                  <option value="archived">Archived</option>
                </select>
                <select
                  className="select"
                  disabled={savingMeta}
                  value={selectedTicket.assigned_admin_id || ''}
                  onChange={(e) => updateTicket({ assignedAdminId: e.target.value || 'unassigned' }, 'Owner updated')}
                >
                  <option value="">Unassigned</option>
                  {admins.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <button className="btn btn-outline btn-md" disabled={savingMeta} onClick={() => updateTicket({ assignedAdminId: admin.id }, 'Assigned to you')}>
                  Assign to me
                </button>
                <button className="btn btn-outline btn-md" disabled={savingMeta} onClick={() => updateTicket({ ticketStatus: 'resolved' }, 'Ticket resolved')}>
                  Mark resolved
                </button>
              </div>

              <div className="support-thread" style={{ marginBottom: '1rem' }}>
                {conversationMessages.map((message) => (
                  <div key={`${message.source || message.direction}-${message.id}`} className={`support-bubble ${message.direction === 'outbound' ? 'reply' : ''}`}>
                    <div className="support-meta-row">
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {message.direction === 'outbound'
                          ? `${message.from_name || 'Admin'} to ${message.to_email}`
                          : `${message.from_name || message.from_email || 'Customer'} to ${message.to_email || 'support@hriatrengna.in'}`}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {message.direction === 'outbound'
                          ? <StatusBadge status={message.delivery_status || 'sent'} />
                          : <span className="badge badge-blue">Customer</span>}
                        {message.attachment_count > 0 && <span className="badge badge-gray">{message.attachment_count} attachment{message.attachment_count === 1 ? '' : 's'}</span>}
                        <span style={{ fontSize: '0.76rem', color: 'var(--text3)' }}>{fmtDateTime(message.created_at)}</span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: '0.5rem' }}>{message.subject || 'No subject'}</div>
                    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text2)', lineHeight: 1.7 }}>
                      {message.body_text || 'No message body was included in the inbound payload.'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', marginBottom: '1rem' }}>
                <div className="card-title" style={{ marginBottom: '0.75rem' }}>Reply from support@hriatrengna.in</div>
                <div className="form-group">
                  <label className="label">Subject</label>
                  <input className="input" value={replySubject} onChange={(e) => setReplySubject(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="label">Message</label>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 180 }}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write your support reply here..."
                  />
                </div>
                <div className="support-actions">
                  <button className="btn btn-gold btn-md" onClick={sendReply} disabled={sendingReply}>
                    {sendingReply ? 'SendingÃ¢â‚¬Â¦' : 'Send Reply'}
                  </button>
                  <button className="btn btn-ghost btn-md" onClick={() => setReplyBody('')} disabled={sendingReply}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <div className="card-title" style={{ marginBottom: '0.75rem' }}>Resend Event Trail</div>
                {!detail?.events?.length ? (
                  <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>No related webhook events yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {detail.events.map((event) => (
                      <div key={`${event.webhook_id}-${event.event_type}`} style={{ padding: '0.85rem 0.9rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg2)' }}>
                        <div className="support-meta-row" style={{ marginBottom: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <code style={{ color: 'var(--gold)', fontSize: '0.78rem' }}>{event.event_type}</code>
                            <StatusBadge status={event.status} />
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text3)' }}>{fmtDateTime(event.received_at)}</div>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: 1.6 }}>
                          {event.subject || 'No subject'}
                        </div>
                        {event.error_message && (
                          <div style={{ marginTop: '0.35rem', color: 'var(--red)', fontSize: '0.76rem' }}>{event.error_message}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LogsPage() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    apiCall('/api/admin/logs')
      .then(d => setLogs(d.logs || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      {loading
        ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center'}}>LoadingÃ¢â‚¬Â¦</div>
        : logs.length === 0
          ? <div style={{color:'var(--text3)',padding:'3rem',textAlign:'center',fontStyle:'italic'}}>No activity logs yet.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Admin</th><th>Action</th><th>Target</th><th>IP Address</th><th>Time</th></tr></thead>
                <tbody>
                  {logs.map((l,i) => (
                    <tr key={i}>
                      <td className="td-main">{l.admin_name || 'Admin'}</td>
                      <td><code style={{fontFamily:'monospace',fontSize:'0.78rem',color:'var(--gold)'}}>{l.action}</code></td>
                      <td style={{color:'var(--text2)'}}>{l.target || 'Ã¢â‚¬â€'}</td>
                      <td><code style={{fontFamily:'monospace',fontSize:'0.75rem',color:'var(--text3)'}}>{l.ip_address || 'Ã¢â‚¬â€'}</code></td>
                      <td style={{color:'var(--text3)'}}>{fmtDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ ACCOUNT PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function AccountPage({ admin }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [msg, setMsg]             = useState('');
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  const changePassword = async () => {
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    if (newPw.length < 8)   { setError('Password must be at least 8 characters.'); return; }
    setError(''); setSaving(true);
    try {
      await apiCall('/api/admin/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      setMsg('Ã¢Å“â€œ Password updated successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{maxWidth:'560px'}}>
      {msg   && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="card-title" style={{marginBottom:'1.25rem'}}>Admin Profile</div>
        <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem'}}>
          <div style={{width:'56px',height:'56px',borderRadius:'50%',background:'var(--gold-pale)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',fontWeight:700,color:'var(--gold)'}}>
            {admin.name[0]}
          </div>
          <div>
            <div style={{fontWeight:600,color:'var(--text)'}}>{admin.name}</div>
            <div style={{color:'var(--text3)',fontSize:'0.82rem'}}>{admin.email}</div>
            <span className="badge badge-gold" style={{marginTop:'0.3rem'}}>Super Admin</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title" style={{marginBottom:'1.25rem'}}>Change Password</div>
        <div className="form-group">
          <label className="label">Current Password</label>
          <input className="input" type="password" placeholder="Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢" value={currentPw} onChange={e=>setCurrentPw(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">New Password</label>
          <input className="input" type="password" placeholder="Min. 8 characters" value={newPw} onChange={e=>setNewPw(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">Confirm New Password</label>
          <input className="input" type="password" placeholder="Repeat new password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} />
        </div>
        <button className="btn btn-gold btn-md" onClick={changePassword} disabled={saving}>
          {saving ? 'UpdatingÃ¢â‚¬Â¦' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}


// Ã¢â€â‚¬Ã¢â€â‚¬ ADDON PRICING PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function AddonPricingPage() {
  const [addons,  setAddons]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // key string
  const [editPrice, setEditPrice] = useState(''); // INR string
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState('');

  const load = () => {
    setLoading(true);
    apiCall('/api/admin/addon-pricing')
      .then(d => setAddons(d.addons || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (addon) => {
    setEditing(addon.key);
    setEditPrice(String(addon.price_inr));
    setError('');
  };

  const save = async () => {
    const priceInr = parseFloat(editPrice);
    if (!Number.isFinite(priceInr) || priceInr < 0)
      return setError('Price must be a non-negative number.');
    setSaving(true); setError('');
    try {
      await apiCall(`/api/admin/addon-pricing/${editing}`, {
        method: 'PATCH',
        body: JSON.stringify({ priceInr }),
      });
      setSaved(`Ã¢Å“â€œ ${editing} updated to Ã¢â€šÂ¹${priceInr}`);
      setEditing(null);
      load();
      setTimeout(() => setSaved(''), 3500);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const ICONS = { photo_pack: 'Ã°Å¸â€œÂ¸', video_pack: 'Ã°Å¸Å½Â¥', audio_toggle: 'Ã°Å¸Å½Âµ', themes_toggle: 'Ã°Å¸Å½Â¨', qr_print: 'Ã°Å¸â€“Â¨Ã¯Â¸Â', nfc_tag: 'Ã°Å¸â€â€“' };

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">{saved}</div>}

      {loading
        ? <div style={{ color: 'var(--text3)', padding: '3rem', textAlign: 'center' }}>LoadingÃ¢â‚¬Â¦</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1rem' }}>
            {addons.map(addon => (
              <div key={addon.key} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{ICONS[addon.key] || 'Ã°Å¸â€™Â¡'}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>{addon.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{addon.unit} Ã‚Â· {addon.is_recurring ? 'Recurring' : 'One-time'}</div>
                  </div>
                  {!addon.is_active && <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>Inactive</span>}
                </div>

                {editing === addon.key ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text3)', fontSize: '0.9rem' }}>Ã¢â€šÂ¹</span>
                    <input
                      className="input"
                      type="number"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      style={{ flex: 1 }}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(null); }}
                    />
                    <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? 'Ã¢â‚¬Â¦' : 'Save'}</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Ã¢Å“â€¢</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--gold)' }}>Ã¢â€šÂ¹{addon.price_inr}</span>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(addon)}>Edit Price</button>
                  </div>
                )}

                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '0.4rem' }}>
                  Last updated: {fmtDate(addon.updated_at)}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ BASE PRICING PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function BasePricingPage() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);  // { planType, lengthMonths }
  const [editRate, setEditRate]   = useState(''); // INR string
  const [editDisc, setEditDisc]   = useState(''); // pct string
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState('');
  const [tab,     setTab]     = useState('memorial');

  const load = () => {
    setLoading(true);
    apiCall('/api/admin/base-pricing')
      .then(d => setRows(d.basePricing || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (row) => {
    setEditing({ planType: row.plan_type, lengthMonths: row.length_months });
    setEditRate(String(row.monthly_rate_inr));
    setEditDisc(String(Number(row.discount_pct)));
    setError('');
  };

  const save = async () => {
    const monthlyRateInr = parseFloat(editRate);
    const discountPct    = parseFloat(editDisc);
    if (!Number.isFinite(monthlyRateInr) || monthlyRateInr <= 0)
      return setError('Monthly rate must be a positive number.');
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100)
      return setError('Discount must be between 0 and 100.');
    setSaving(true); setError('');
    try {
      await apiCall(`/api/admin/base-pricing/${editing.planType}/${editing.lengthMonths}`, {
        method: 'PATCH',
        body: JSON.stringify({ monthlyRateInr, discountPct }),
      });
      setSaved(`Ã¢Å“â€œ ${editing.planType} / ${editing.lengthMonths}mo updated.`);
      setEditing(null);
      load();
      setTimeout(() => setSaved(''), 3500);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const LENGTH_LABELS = { 1: '1 Month', 3: '3 Months', 6: '6 Months', 12: '1 Year', 24: '2 Years', 36: '3 Years', 60: '5 Years' };
  const filteredRows = rows.filter(r => r.plan_type === tab);

  return (
    <div className="fade-in">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">{saved}</div>}

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
        {['memorial','wedding'].map(t => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setTab(t)}
          >
            {t === 'memorial' ? 'Ã°Å¸â€¢Â¯Ã¯Â¸Â Memorial' : 'Ã°Å¸â€™Â Wedding'}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{ color: 'var(--text3)', padding: '3rem', textAlign: 'center' }}>LoadingÃ¢â‚¬Â¦</div>
        : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Length', 'Discount %', 'Monthly Rate', 'Status', 'Last Updated', ''].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => {
                  const isEditing = editing?.planType === row.plan_type && editing?.lengthMonths === row.length_months;
                  return (
                    <tr key={`${row.plan_type}-${row.length_months}`} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text)' }}>
                        {LENGTH_LABELS[row.length_months] || `${row.length_months}mo`}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isEditing
                          ? <input className="input" type="number" value={editDisc} onChange={e => setEditDisc(e.target.value)} style={{ width: 70 }} />
                          : <span style={{ color: row.discount_pct > 0 ? 'var(--green)' : 'var(--text3)' }}>{row.discount_pct}%</span>
                        }
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isEditing
                          ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ color: 'var(--text3)' }}>Ã¢â€šÂ¹</span>
                              <input className="input" type="number" value={editRate} onChange={e => setEditRate(e.target.value)} style={{ width: 80 }} />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>/mo</span>
                            </div>
                          )
                          : <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '1rem' }}>Ã¢â€šÂ¹{row.monthly_rate_inr}<span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text3)' }}>/mo</span></span>
                        }
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span className="badge" style={{ background: row.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: row.is_active ? 'var(--green)' : '#fca5a5' }}>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text3)' }}>{fmtDate(row.updated_at)}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isEditing
                          ? (
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button className="btn btn-gold btn-sm" onClick={save} disabled={saving}>{saving ? 'Ã¢â‚¬Â¦' : 'Save'}</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Ã¢Å“â€¢</button>
                            </div>
                          )
                          : <button className="btn btn-outline btn-sm" onClick={() => openEdit(row)}>Edit</button>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
              Ã¢Å¡Â  Changing base prices affects new subscribers only. Existing subscriptions are locked at their purchase-time price snapshot.
            </div>
          </div>
        )
      }
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ PHYSICAL ORDERS PAGE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function PhysicalOrdersPage() {
  const [orders,   setOrders]   = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [editing,  setEditing]  = useState(null);  // order object
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState('');
  const [filterFulfill, setFilterFulfill] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [page, setPage] = useState(1);

  // Edit state
  const [editStatus,    setEditStatus]    = useState('');
  const [editTracking,  setEditTracking]  = useState('');
  const [editCarrier,   setEditCarrier]   = useState('');
  const [editNotes,     setEditNotes]     = useState('');

  const FULFILL_STATUSES = ['pending','processing','shipped','delivered','cancelled'];
  const PAYMENT_STATUSES = ['pending','paid','failed','refunded'];
  const STATUS_COLORS = { pending: '#fbbf24', processing: '#60a5fa', shipped: '#a78bfa', delivered: '#34d399', cancelled: '#f87171', paid: '#34d399', failed: '#f87171', refunded: '#94a3b8' };

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (filterFulfill) params.set('fulfillmentStatus', filterFulfill);
    if (filterPayment) params.set('paymentStatus',     filterPayment);
    apiCall(`/api/admin/physical-orders?${params}`)
      .then(d => { setOrders(d.orders || []); setTotal(d.total || 0); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterFulfill, filterPayment, page]);

  const openEdit = (order) => {
    setEditing(order);
    setEditStatus(order.fulfillment_status);
    setEditTracking(order.tracking_number || '');
    setEditCarrier(order.tracking_carrier || '');
    setEditNotes(order.admin_notes || '');
    setError('');
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await apiCall(`/api/admin/physical-orders/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fulfillmentStatus: editStatus,
          trackingNumber:    editTracking.trim() || null,
          trackingCarrier:   editCarrier.trim()  || null,
          adminNotes:        editNotes.trim()    || null,
        }),
      });
      setSaved('Ã¢Å“â€œ Order updated.');
      setEditing(null);
      load();
      setTimeout(() => setSaved(''), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="fade-in">
      {error  && <div className="alert alert-error">{error}</div>}
      {saved  && <div className="alert alert-success">{saved}</div>}

      {/* Filters */}
      <div className="filters-row" style={{ marginBottom: '1rem' }}>
        <select className="input" value={filterFulfill} onChange={e => { setFilterFulfill(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
          <option value="">All Fulfillment</option>
          {FULFILL_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select className="input" value={filterPayment} onChange={e => { setFilterPayment(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
          <option value="">All Payments</option>
          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text3)' }}>{total} order{total !== 1 ? 's' : ''}</span>
      </div>

      {loading
        ? <div style={{ color: 'var(--text3)', padding: '3rem', textAlign: 'center' }}>LoadingÃ¢â‚¬Â¦</div>
        : orders.length === 0
          ? <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', padding: '3rem' }}>No orders found.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {orders.map(order => (
                <div key={order.id} className="card" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>

                    {/* Order type + badge */}
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                        {order.order_type === 'nfc_tag' ? 'Ã°Å¸â€â€“ NFC Tag' : 'Ã°Å¸â€“Â¨Ã¯Â¸Â QR Print'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 600 }}>Ã¢â€šÂ¹{order.amount_paise / 100}</div>
                    </div>

                    {/* Status badges */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {[['Payment', order.payment_status], ['Fulfillment', order.fulfillment_status]].map(([label, status]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text3)', width: 65 }}>{label}</span>
                          <span className="badge" style={{ background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status] || 'var(--text3)' }}>
                            {status}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* User + shipping */}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.88rem' }}>{order.user_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{order.user_email}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '0.25rem' }}>
                        Ã°Å¸â€œÂ {order.shipping_name} Ã‚Â· {order.shipping_city}, {order.shipping_state} {order.shipping_pincode}
                      </div>
                      {order.tracking_number && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--text2)', marginTop: '0.2rem' }}>
                          Ã°Å¸â€œÂ¦ {order.tracking_carrier || 'Carrier'}: {order.tracking_number}
                        </div>
                      )}
                    </div>

                    {/* Date + action */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{fmtDate(order.created_at)}</span>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(order)}>Update</button>
                    </div>
                  </div>

                  {order.admin_notes && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text2)' }}>
                      Ã°Å¸â€œÂ {order.admin_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
      }

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.25rem' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Ã¢â€ Â Prev</button>
          <span style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', color: 'var(--text3)' }}>{page} / {totalPages}</span>
          <button className="btn btn-outline btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next Ã¢â€ â€™</button>
        </div>
      )}

      {/* Update modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Update Order Ã¢â‚¬â€ {editing.order_type === 'nfc_tag' ? 'NFC Tag' : 'QR Print'}</div>
              <button className="modal-close" onClick={() => setEditing(null)}>Ã¢Å“â€¢</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

              <div style={{ padding: '0.75rem', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text2)' }}>
                <div><strong>Ship to:</strong> {editing.shipping_name}</div>
                <div>{editing.shipping_address_1}{editing.shipping_address_2 ? ', ' + editing.shipping_address_2 : ''}</div>
                <div>{editing.shipping_city}, {editing.shipping_state} Ã¢â‚¬â€ {editing.shipping_pincode}</div>
                <div style={{ marginTop: '0.25rem' }}>Ã°Å¸â€œÅ¾ {editing.shipping_phone}</div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="label">Fulfillment Status</label>
                <select className="input" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  {FULFILL_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>

              <div className="input-row">
                <div className="form-group">
                  <label className="label">Tracking Number</label>
                  <input className="input" value={editTracking} onChange={e => setEditTracking(e.target.value)} placeholder="e.g. EE123456789IN" />
                </div>
                <div className="form-group">
                  <label className="label">Carrier</label>
                  <input className="input" value={editCarrier} onChange={e => setEditCarrier(e.target.value)} placeholder="e.g. India Post, Delhivery" />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Admin Notes (internal)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Internal notes for this orderÃ¢â‚¬Â¦"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-md" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-gold btn-md" onClick={save} disabled={saving}>{saving ? 'SavingÃ¢â‚¬Â¦' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ USER SUBSCRIPTION CONFIG PANEL (embedded in UsersPage) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// This is a standalone component used inside the existing user
// detail modal in UsersPage. Wire it in by calling:
//   <UserSubscriptionConfig userId={selectedUser.id} />
// inside the existing selectedUser detail panel.
function UserSubscriptionConfig({ userId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState('');
  const [saving,  setSaving]  = useState(false);

  // Override form state
  const [overridePhotos,  setOvPhotos]  = useState('');
  const [overrideVideos,  setOvVideos]  = useState('');
  const [overrideAudio,   setOvAudio]   = useState('');   // '' | 'true' | 'false'
  const [overrideThemes,  setOvThemes]  = useState('');
  const [overrideExpiry,  setOvExpiry]  = useState('');
  const [overrideNote,    setOvNote]    = useState('');
  const [showOverride,    setShowOverride] = useState(false);

  const load = () => {
    setLoading(true); setError('');
    apiCall(`/api/admin/users/${userId}/subscription-config`)
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (userId) load(); }, [userId]);

  const activeSub = data?.subscriptions?.find(s => ['active','trialing'].includes(s.status));

  const saveOverride = async () => {
    setSaving(true); setError('');
    try {
      const body = {};
      if (overridePhotos !== '')  body.overridePhotos  = overridePhotos === '' ? null : parseInt(overridePhotos);
      if (overrideVideos !== '')  body.overrideVideos  = overrideVideos === '' ? null : parseInt(overrideVideos);
      if (overrideAudio  !== '')  body.overrideAudio   = overrideAudio  === 'true' ? true : overrideAudio === 'false' ? false : null;
      if (overrideThemes !== '')  body.overrideThemes  = overrideThemes === 'true' ? true : overrideThemes === 'false' ? false : null;
      if (overrideExpiry !== '')  body.overrideExpiry  = overrideExpiry || null;
      if (overrideNote   !== '')  body.overrideNote    = overrideNote;

      if (Object.keys(body).length === 0) return setError('No override fields provided.');

      await apiCall(`/api/admin/users/${userId}/subscription-config`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setSaved('Ã¢Å“â€œ Limits updated.');
      setShowOverride(false);
      load();
      setTimeout(() => setSaved(''), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text3)', fontSize: '0.85rem' }}>Loading subscription configÃ¢â‚¬Â¦</div>;
  if (error)   return <div className="alert alert-error">{error}</div>;
  if (!data)   return null;

  const STATUS_COLORS = { active: 'var(--green)', trialing: '#60a5fa', pending: '#fbbf24', canceled: '#f87171', past_due: '#f87171', halted: '#f87171', inactive: 'var(--text3)' };

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
        Subscription Config
      </div>

      {saved && <div className="alert alert-success" style={{ marginBottom: '0.75rem' }}>{saved}</div>}
      {error && <div className="alert alert-error"  style={{ marginBottom: '0.75rem' }}>{error}</div>}

      {/* Active subscription */}
      {activeSub ? (
        <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '0.875rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
              {activeSub.plan_slug?.replace('-',' ')} Ã‚Â· {activeSub.payment_mode || 'monthly'}
            </span>
            <span className="badge" style={{ background: `${STATUS_COLORS[activeSub.status] || 'var(--text3)'}22`, color: STATUS_COLORS[activeSub.status] || 'var(--text3)' }}>
              {activeSub.status}
            </span>
          </div>

          {activeSub.config_id && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', color: 'var(--text2)' }}>
              <span>Ã°Å¸â€œÂ¸ Photos</span>
              <span style={{ color: activeSub.override_photos ? 'var(--gold)' : 'var(--text)' }}>
                {activeSub.override_photos ?? activeSub.total_photos ?? 'Ã¢â‚¬â€'}
                {activeSub.override_photos ? ' (override)' : ''}
              </span>
              <span>Ã°Å¸Å½Â¥ Videos</span>
              <span style={{ color: activeSub.override_videos ? 'var(--gold)' : 'var(--text)' }}>
                {activeSub.override_videos ?? activeSub.total_videos ?? 'Ã¢â‚¬â€'}
                {activeSub.override_videos ? ' (override)' : ''}
              </span>
              <span>Ã°Å¸Å½Âµ Audio</span>
              <span>{(activeSub.override_audio ?? activeSub.audio_enabled) ? 'Ã¢Å“â€œ On' : 'Ã¢Å“â€” Off'}</span>
              <span>Ã°Å¸Å½Â¨ Themes</span>
              <span>{(activeSub.override_themes ?? activeSub.themes_enabled) ? 'Ã¢Å“â€œ On' : 'Ã¢Å“â€” Off'}</span>
              <span>Ã°Å¸â€œâ€¦ Expires</span>
              <span style={{ color: activeSub.override_expiry ? 'var(--gold)' : 'var(--text)' }}>
                {fmtDate(activeSub.override_expiry ?? activeSub.current_period_end)}
                {activeSub.override_expiry ? ' (override)' : ''}
              </span>
              <span>Ã°Å¸â€œÂ Length</span>
              <span>{activeSub.length_months ? `${activeSub.length_months} month${activeSub.length_months > 1 ? 's' : ''}` : 'Ã¢â‚¬â€'}</span>
            </div>
          )}

          {!activeSub.config_id && (
            <div style={{ color: 'var(--text3)', fontSize: '0.78rem', fontStyle: 'italic' }}>Legacy plan Ã¢â‚¬â€ no custom config.</div>
          )}
        </div>
      ) : (
        <div style={{ color: 'var(--text3)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>No active subscription.</div>
      )}

      {/* Physical orders */}
      {data.physicalOrders?.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Physical Orders</div>
          {data.physicalOrders.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text2)' }}>
              <span>{o.order_type === 'nfc_tag' ? 'Ã°Å¸â€â€“ NFC' : 'Ã°Å¸â€“Â¨Ã¯Â¸Â QR'} Ã¢â‚¬â€ {fmtDate(o.created_at)}</span>
              <span className="badge" style={{ fontSize: '0.68rem' }}>{o.fulfillment_status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Override button */}
      {activeSub?.config_id && (
        <button className="btn btn-outline btn-sm" onClick={() => setShowOverride(v => !v)} style={{ width: '100%', justifyContent: 'center' }}>
          {showOverride ? 'Cancel Override' : 'Ã¢Å¡â„¢ Override Limits'}
        </button>
      )}

      {/* Override form */}
      {showOverride && activeSub?.config_id && (
        <div style={{ marginTop: '0.75rem', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '0.875rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '0.75rem' }}>
            Leave a field blank to keep the current value. Set a number to override. Changes are logged.
          </div>

          <div className="input-row" style={{ marginBottom: '0.5rem' }}>
            <div className="form-group">
              <label className="label">Photos (override)</label>
              <input className="input" type="number" value={overridePhotos} onChange={e => setOvPhotos(e.target.value)} placeholder={String(activeSub.total_photos || '')} />
            </div>
            <div className="form-group">
              <label className="label">Videos (override)</label>
              <input className="input" type="number" value={overrideVideos} onChange={e => setOvVideos(e.target.value)} placeholder={String(activeSub.total_videos || '')} />
            </div>
          </div>

          <div className="input-row" style={{ marginBottom: '0.5rem' }}>
            <div className="form-group">
              <label className="label">Audio</label>
              <select className="input" value={overrideAudio} onChange={e => setOvAudio(e.target.value)}>
                <option value="">Ã¢â‚¬â€ no change Ã¢â‚¬â€</option>
                <option value="true">Enable</option>
                <option value="false">Disable</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Themes</label>
              <select className="input" value={overrideThemes} onChange={e => setOvThemes(e.target.value)}>
                <option value="">Ã¢â‚¬â€ no change Ã¢â‚¬â€</option>
                <option value="true">Enable</option>
                <option value="false">Disable</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="label">Expiry Override (future date)</label>
            <input className="input" type="date" value={overrideExpiry} onChange={e => setOvExpiry(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="label">Note (reason for override)</label>
            <input className="input" value={overrideNote} onChange={e => setOvNote(e.target.value)} placeholder="e.g. Goodwill extension for grieving family" />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-gold btn-sm" onClick={saveOverride} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
              {saving ? 'SavingÃ¢â‚¬Â¦' : 'Apply Override'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// Ã¢â€â‚¬Ã¢â€â‚¬ PAGE TITLES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const PAGE_META = {
  dashboard:    { title: 'Dashboard',      sub: 'Overview of your Hriatrengna platform' },
  users:        { title: 'Subscribers',    sub: 'Manage users and subscriptions' },
  albums:       { title: 'Albums',         sub: 'View and moderate all memorial albums' },
  studios:      { title: 'Studios',        sub: 'Manage photographer studios, quotas, and subscriptions' },
  transactions: { title: 'Transactions',   sub: 'Payment history in INR via Razorpay' },
  refunds:      { title: 'Refunds',        sub: 'Review refund requests and process approved payments' },
  invoices:     { title: 'Invoices',       sub: 'Download invoices and audit payment records' },
  support:      { title: 'Support Inbox',  sub: 'Review inbound support emails, assign ownership, and reply from the dashboard' },
  affiliates:   { title: 'Affiliates',     sub: 'Review applications and manage commission settings' },
  pricing:      { title: 'Pricing Plans',  sub: 'Manage plans and Razorpay integration' },
  settings:     { title: 'App Settings',   sub: 'Configure your application' },
  api:          { title: 'API & Keys',     sub: 'Endpoints, authentication, and integrations' },
  logs:         { title: 'Activity Logs',  sub: 'Admin actions and audit trail' },
  account:      { title: 'My Account',     sub: 'Profile and password settings' },
  addon_pricing:   { title: 'Addon Pricing',    sub: 'Set prices for photo/video packs, audio, themes, and physical products' },
  base_pricing:    { title: 'Base Pricing',      sub: 'Set monthly base rates and length discounts for Memorial and Wedding plans' },
  physical_orders: { title: 'Physical Orders',   sub: 'Manage QR print and NFC tag orders Ã¢â‚¬â€ update fulfillment status and tracking' },
};

// Ã¢â€â‚¬Ã¢â€â‚¬ MAIN APP Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [page, setPage]   = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Restore session from localStorage
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiCall('/api/admin/auth/me')
      .then(d => setAdmin(d.admin))
      .catch(() => localStorage.removeItem('mqr_admin_token'));
  }, []);

  const logout = () => {
    localStorage.removeItem('mqr_admin_token');
    setAdmin(null);
  };

  if (!admin) return (
    <>
      <AdminHead />
      <style>{CSS}</style>
      <LoginPage onLogin={setAdmin} />
    </>
  );

  const { title, sub } = PAGE_META[page] || { title: page, sub: '' };

  return (
    <>
      <AdminHead />
      <style>{CSS}</style>
      <div className="admin-shell">
        {mobileNavOpen && <button type="button" className="sidebar-overlay" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
        <Sidebar page={page} setPage={setPage} admin={admin} onLogout={logout} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="main-area">
          <div className="topbar">
            <div className="topbar-stack">
              <Button type="button" className="menu-btn" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation" variant="outline" size="sm">
                Menu
              </Button>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Admin workspace</div>
                <div className="topbar-title">{title}</div>
                <div className="topbar-sub">{sub}</div>
              </div>
            </div>
            <div className="topbar-right">
              <span className="topbar-date">
                {new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
              </span>
            </div>
          </div>
          <div className="page-content">
            <div className="page-shell">
              <AdminSectionHeader page={page} setPage={setPage} />
              {page === 'dashboard'    && <DashboardPage />}
              {page === 'users'        && <UsersPage />}
              {page === 'albums'       && <AlbumsPage />}
              {page === 'studios'      && <StudiosPage />}
              {page === 'transactions' && <TransactionsPage />}
              {page === 'refunds'      && <RefundsPage />}
              {page === 'invoices'     && <InvoicesPage />}
              {page === 'support'      && <SupportInboxPage admin={admin} />}
              {page === 'affiliates'   && <AffiliatesPage />}
              {page === 'pricing'      && <PricingPage />}
              {page === 'addon_pricing'   && <AddonPricingPage />}
              {page === 'base_pricing'    && <BasePricingPage />}
              {page === 'physical_orders' && <PhysicalOrdersPage />}
              {page === 'settings'     && <SettingsPage />}
              {page === 'api'          && <APIPage />}
              {page === 'automation'   && <AutomationPage />}
              {page === 'logs'         && <LogsPage />}
              {page === 'account'      && <AccountPage admin={admin} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
