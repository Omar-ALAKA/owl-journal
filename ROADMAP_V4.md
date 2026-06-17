# 🦉 OWL Journal V4 — Roadmap Complète

## Vision

Dashboard trading professionnel pour comptes prop firm (FundedNext, FTMO, MyFundedFX, Equity Edge) et comptes personnels. Zéro compromis sur la qualité.

**Stack** : React 18 + TypeScript + Vite + FastAPI + PostgreSQL 16
**Déploiement** : Proxmox LXC (.71) — pas de Docker
**Repo** : github.com/Omar-ALAKA/owl-journal

---

## ✅ Fonctionnalités Complétées

### Core
- [x] Backend FastAPI avec routes CRUD (trades, accounts, analytics, journal, history, calendar, strategies)
- [x] Frontend React 18 + TypeScript + Vite
- [x] PostgreSQL 16 (migrations manuelles via psql — pas d'Alembic)
- [x] Sidebar navigation avec routes lazy-loaded
- [x] Dark/Light theme (localStorage + system preference)
- [x] Design system V3 (tokens CSS, Outfit + JetBrains Mono)
- [x] Responsive layout (sidebar collapse, mobile)

### Import de Trades
- [x] Import Excel (.xlsx) — Equity Edge, MT5, FTMO, MyFundedFX, FundedNext
- [x] Import CSV (.csv)
- [x] Preview avant import avec détection automatique du format
- [x] Détection automatique direction (buy/sell → long/short)
- [x] Détection automatique session (Asia/London/New York via UTC boundaries)
- [x] **R-multiple** : calculé automatiquement depuis SL initial (section Orders) × volume
- [x] **SL initial** : lu depuis la section Orders du rapport Equity Edge (pas le SL final de Positions)
- [x] Support colonnes françaises ("Ordre", "Symbole", "S / L", "T / P", "Echange")
- [x] Timezone support avec DST auto (EST↔EDT, CET↔CEST, etc.)
- [x] Session hours configurables par compte (JSONB)

### Analytics
- [x] KPI cards (Net P&L, Win Rate, Profit Factor, Streak)
- [x] Equity curve (AreaChart)
- [x] Drawdown tracking (max + current)
- [x] Calendar heatmap
- [x] Session analysis (bar chart)
- [x] R-multiple histogram
- [x] P&L distribution
- [x] Monthly/Weekly/Yearly period totals
- [x] Journal quotidien (daily stats)
- [x] History (comparaison périodes)

### Funded Accounts
- [x] Type de compte : challenge / funded / personal
- [x] Personal target (% configurable, défaut 5%)
- [x] Payout tracking (CRUD)
- [x] Drawdown monitoring avec status visuel (SAFE / WARNING / DANGER / BREACHED)
- [x] Current drawdown en temps réel
- [x] Indicateur "Au peak" quand drawdown = 0
- [x] Prop firm rules reminder

### Challenge Tracking
- [x] Challenge phases (Phase 1, Phase 2, Funded)
- [x] Objectifs de profit (%)
- [x] Limites de drawdown (%)
- [x] Daily loss limit
- [x] Checkpoints (milestones)
- [x] Violation detection

### Settings
- [x] Configuration des sessions de trading (heures par session)
- [x] Preview UTC des sessions
- [x] Timezone par compte
- [x] Personal target % par compte

---

## 🚧 En Cours / À Faire

### Priorité Haute
- [ ] **Rebuild equity curve** — calculer et stocker l'equity curve dans `equity_curve` table
- [ ] **Daily stats auto** — recalculer les daily stats après chaque import
- [ ] **WebSocket temps réel** — notifications live (nouveau trade, drawdown alert)
- [ ] **Export PDF** — rapport de performance hebdomadaire/mensuel

### Priorité Moyenne
- [ ] **Tags** — système de tags pour les trades (émotion, erreur, pattern)
- [ ] **Setup quality** — notation 1-5 étoiles par trade
- [ ] **Confluences** — champs multi-sélection pour les confluences
- [ ] **Multi-account equity chart** — comparer plusieurs comptes sur un même graphique
- [ ] **Trade images** — upload de screenshots attachés aux trades
- [ ] **Notes markdown** — éditeur markdown pour les notes de trade

### Priorité Basse
- [ ] **PWA** — installable sur mobile
- [ ] **i18n** — support multilingue (FR/EN)
- [ ] **Backup auto** — export DB quotidien
- [ ] **API publique** — endpoints pour intégrations tierces
- [ ] **Tests** — pytest backend + vitest frontend

---

## 🐛 Bugs Connus / Corrections Récentes

### 17 Juin 2026
- **R-multiple corrigé** : utilisait le SL final (Positions) au lieu du SL initial (Orders). Maintenant lit la section Orders du rapport Equity Edge pour récupérer le SL initial par ticket. Ajouté le volume dans le calcul (profit / risk × volume).
- **Session detection corrigée** : utilisait les heures locales de l'utilisateur au lieu des boundaries UTC. Les trades NY étaient détectés comme London. Corrigé en utilisant `get_session_for_time` de `timezone.py` (Asia 0-8 UTC, London 8-13 UTC, NY 13-21 UTC).
- **Drawdown tracking ajouté** : `current_drawdown`, `current_drawdown_pct`, `drawdown_status` (safe/warning/danger/breached) dans le funded summary. Indicateur visuel "Au peak" quand drawdown = 0.

### 16 Juin 2026
- **Session hours configurables** : chaque compte peut avoir ses propres heures de session (JSONB `session_hours`).
- **Timezone DST auto** : EST↔EDT détecté automatiquement par date de trade.
- **Funded dashboard** : page dédiée avec personal target, payout tracker, drawdown monitor.
- **Import Equity Edge FR** : support complet des rapports en français.

---

## 🏗️ Architecture Actuelle

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION (LXC .71)                     │
├─────────────────────────────────────────────────────────────┤
│  FastAPI (port 8100)                                        │
│  ├── /api/v1/*  → API REST                                 │
│  ├── /api/import/* → Import CSV/XLSX                       │
│  └── /          → React SPA (Vite build → static files)    │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL 16 (192.168.10.72)                              │
│  ├── accounts, trades, payouts, equity_curve, daily_stats  │
│  ├── checkpoints, strategies, tags, trade_tags             │
│  └── Pas d'Alembic — migrations manuelles via psql         │
└─────────────────────────────────────────────────────────────┘
```

### Structure des Fichiers

```
owl-journal/
├── frontend/
│   ├── src/
│   │   ├── main.tsx, App.tsx
│   │   ├── routes/           # Pages (React.lazy)
│   │   │   ├── dashboard.tsx
│   │   │   ├── trades.tsx
│   │   │   ├── journal.tsx
│   │   │   ├── history.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── analytics.tsx
│   │   │   ├── funded.tsx
│   │   │   ├── challenge.tsx
│   │   │   ├── accounts.tsx
│   │   │   ├── settings.tsx
│   │   │   └── import.tsx
│   │   ├── components/
│   │   │   ├── layout/       # sidebar, header
│   │   │   └── ui/           # button, dialog, table, etc.
│   │   ├── lib/              # api.ts, utils.ts
│   │   ├── stores/           # theme, filters, ui
│   │   ├── types/            # index.ts (tous les types TS)
│   │   └── styles/           # globals.css
│   └── dist/                 # Build → copié dans backend/static/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── database.py       # Engine, session
│   │   ├── models/           # SQLAlchemy (trade, account, payout, etc.)
│   │   ├── schemas/          # Pydantic (trade, account, payout, etc.)
│   │   ├── api/v1/           # Routes (trades, accounts, funded, etc.)
│   │   ├── services/         # Analytics, session_config, timezone
│   │   └── static/           # React build output
│   └── .venv/
└── ROADMAP_V4.md
```

---

## 🗄️ Schema DB (État Actuel)

```sql
-- Accounts
accounts (id, name, broker, broker_acct, account_type, phase, status,
          starting_balance, current_balance, target_profit_pct,
          max_drawdown_pct, daily_loss_pct,
          personal_target_pct, session_hours JSONB,
          notes, created_at, updated_at)

-- Trades
trades (id, account_id, ticket, open_time, close_time,
        symbol, direction, volume, entry_price, exit_price,
        sl_price, tp_price, profit, commission, swap,
        session, setup, confluences, notes,
        setup_quality, rr_target, rr_actual, r_multiple,
        sl_distance, tp_distance, is_winner,
        created_at, updated_at)

-- Payouts (nouveau)
payouts (id, account_id FK, amount, payout_date, status, notes, created_at)

-- Equity curve
equity_curve (id, account_id FK, timestamp, equity, drawdown, drawdown_pct)

-- Daily stats
daily_stats (id, account_id FK, trade_date, net_pnl, gross_profit, gross_loss,
             total_trades, wins, losses, win_rate, profit_factor)

-- Checkpoints
checkpoints (id, account_id FK, checkpoint_type, balance, equity, drawdown, notes, created_at)

-- Strategies
strategies (id, name, description, rules JSONB, created_at, updated_at)

-- Tags
tags (id, name, color)
trade_tags (trade_id FK, tag_id FK)
```

---

## 📊 KPIs Calculés

| KPI | Formule | Statut |
|-----|---------|--------|
| Net P&L | Σ profit | ✅ |
| Win Rate | wins / total × 100 | ✅ |
| Profit Factor | gross_profit / abs(gross_loss) | ✅ |
| Max Drawdown | max(peak - equity) | ✅ |
| Current Drawdown | peak - current_equity | ✅ |
| R-multiple | profit / (sl_distance × volume) | ✅ |
| Avg R | Σ r_multiple / total | ✅ |
| Streak | consecutive wins/losses | ✅ |
| Personal Progress | net_pnl / target_amount × 100 | ✅ |
| Drawdown Status | safe/warning/danger/breached | ✅ |

---

## 🚀 Commandes

```bash
# Backend
cd /root/owl-journal/backend
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8100

# Frontend build
cd /root/owl-journal/frontend
npx vite build
cp -r dist/* ../backend/static/

# DB
psql -h 192.168.10.72 -U owl -d owl_journal

# Git
cd /root/owl-journal
git add -A && git commit -m "..." && git push
```

---

*Dernière mise à jour : 17 Juin 2026*
*OWL Journal V4 — Zéro compromis. Qualité production.*
