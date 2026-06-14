# 🦉 OWL Journal V4 — Roadmap Complète

## Vision

Reconstruire OWL Journal from scratch avec les meilleures technologies disponibles. Zéro compromis sur la qualité. L'objectif : un dashboard trading professionnel, maintenable, performant et scalable.

---

## 🏗️ Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                        PRODUCTION                           │
├─────────────────────────────────────────────────────────────┤
│  Nginx (reverse proxy, SSL, gzip, rate limiting)            │
│  ├── /          → React SPA (Vite build, static files)      │
│  ├── /api       → FastAPI (Python)                          │
│  └── /ws        → WebSocket (temps réel)                    │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL 16 (données)                                    │
│  Redis (cache, sessions, rate limiting)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend — React 18+ avec TypeScript

### Stack Technique

| Techno | Raison |
|--------|--------|
| **React 18** | Concurrent rendering, Suspense, hooks avancés |
| **TypeScript 5** | Typage strict, zéro bug de type en prod |
| **Vite 5** | Build ultra-rapide, HMR instantané |
| **TanStack Router** | Router type-safe, meilleur que React Router |
| **TanStack Query v5** | Cache serveur automatique, refetch, optimistic updates |
| **Zustand** | State management léger, pas de boilerplate Redux |
| **React Hook Form + Zod** | Forms type-safe avec validation |
| **Tailwind CSS 4** | CSS utility-first, zéro CSS custom |
| **shadcn/ui** | Composants UI copiables, pas de dépendance |
| **Recharts** | Graphiques React natifs, pas de CDN externe |
| **Framer Motion** | Animations fluides |
| **React Virtual** | Virtualisation des listes (1000+ trades) |
| **date-fns** | Manipulation dates, légère et tree-shakeable |
| **React Hot Toast** | Notifications élégantes |
| **Lucide React** | Icônes SVG légères |

### Structure du Projet Frontend

```
owl-journal/
├── frontend/
│   ├── src/
│   │   ├── main.tsx                    # Entry point
│   │   ├── App.tsx                     # Root component
│   │   ├── routes/                     # TanStack Router
│   │   │   ├── __root.tsx
│   │   │   ├── index.tsx               # Dashboard
│   │   │   ├── trades.tsx
│   │   │   ├── trades.$tradeId.tsx     # Detail trade
│   │   │   ├── strategies.tsx
│   │   │   ├── accounts.tsx
│   │   │   ├── accounts.$accountId.tsx
│   │   │   ├── journal.tsx
│   │   │   ├── history.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── analytics.tsx
│   │   │   ├── import.tsx
│   │   │   └── settings.tsx
│   │   ├── components/
│   │   │   ├── ui/                     # shadcn/ui components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── ...
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── header.tsx
│   │   │   │   └── mobile-nav.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── kpi-card.tsx
│   │   │   │   ├── equity-chart.tsx
│   │   │   │   ├── drawdown-chart.tsx
│   │   │   │   ├── calendar-heatmap.tsx
│   │   │   │   ├── period-totals.tsx
│   │   │   │   └── streak-display.tsx
│   │   │   ├── trades/
│   │   │   │   ├── trade-table.tsx
│   │   │   │   ├── trade-detail-modal.tsx
│   │   │   │   ├── trade-form.tsx
│   │   │   │   ├── trade-filters.tsx
│   │   │   │   └── inline-edit.tsx
│   │   │   ├── charts/
│   │   │   │   ├── equity-curve.tsx
│   │   │   │   ├── pl-distribution.tsx
│   │   │   │   ├── r-histogram.tsx
│   │   │   │   ├── session-bar.tsx
│   │   │   │   ├── monthly-bar.tsx
│   │   │   │   └── donut-chart.tsx
│   │   │   └── import/
│   │   │       ├── dropzone.tsx
│   │   │       ├── preview-table.tsx
│   │   │       └── account-matcher.tsx
│   │   ├── hooks/
│   │   │   ├── use-trades.ts
│   │   │   ├── use-stats.ts
│   │   │   ├── use-equity.ts
│   │   │   ├── use-calendar.ts
│   │   │   ├── use-challenge.ts
│   │   │   └── use-toast.ts
│   │   ├── lib/
│   │   │   ├── api.ts                   # Axios client
│   │   │   ├── utils.ts                 # cn(), formatters
│   │   │   └── constants.ts
│   │   ├── stores/
│   │   │   ├── theme.ts                 # dark/light
│   │   │   ├── filters.ts               # filtres globaux
│   │   │   └── ui.ts                    # modals, sidebar
│   │   ├── types/
│   │   │   ├── trade.ts
│   │   │   ├── account.ts
│   │   │   ├── equity.ts
│   │   │   └── api.ts
│   │   └── styles/
│   │       └── globals.css             # Tailwind + variables CSS
│   ├── public/
│   │   └── favicon.svg
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
```

---

## ⚙️ Backend — FastAPI avec PostgreSQL

### Stack Technique

| Techno | Raison |
|--------|--------|
| **Python 3.13** | Dernière version, performances améliorées |
| **FastAPI 0.115+** | Async natif, OpenAPI auto, validation Pydantic |
| **SQLAlchemy 2.0** | ORM moderne, async support |
| **asyncpg** | Driver PostgreSQL async le plus rapide |
| **Alembic** | Migrations de base de données |
| **Pydantic v2** | Validation ultra-rapide |
| **python-jose** | JWT tokens |
| **passlib** | Hashage mots de passe |
| **Celery + Redis** | Tâches async (imports, rebuilds) |
| **pytest + httpx** | Tests async |
| **structlog** | Logging structuré JSON |
| **uv** | Package manager Python (100x plus rapide que pip) |

### Structure du Projet Backend

```
owl-journal/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # FastAPI app factory
│   │   ├── config.py                   # Settings (pydantic-settings)
│   │   ├── database.py                 # Engine, session, base
│   │   ├── dependencies.py             # DB session, auth
│   │   ├── models/                     # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── trade.py
│   │   │   ├── account.py
│   │   │   ├── equity.py
│   │   │   ├── daily_stats.py
│   │   │   ├── checkpoint.py
│   │   │   ├── strategy.py
│   │   │   └── confluence.py
│   │   ├── schemas/                    # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── trade.py
│   │   │   ├── account.py
│   │   │   ├── equity.py
│   │   │   └── analytics.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── router.py
│   │   │   │   ├── trades.py
│   │   │   │   ├── accounts.py
│   │   │   │   ├── analytics.py
│   │   │   │   ├── equity.py
│   │   │   │   ├── calendar.py
│   │   │   │   ├── strategies.py
│   │   │   │   ├── import_.py
│   │   │   │   ├── journal.py
│   │   │   │   └── health.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── equity.py               # Calcul equity curve
│   │   │   ├── analytics.py            # Stats, streaks, KPIs
│   │   │   ├── import_parser.py        # CSV/XLSX parsing
│   │   │   ├── challenge.py            # Challenge tracking
│   │   │   └── rebuild.py              # Rebuild equity/daily
│   │   ├── tasks/                      # Celery tasks
│   │   │   ├── __init__.py
│   │   │   ├── import_tasks.py
│   │   │   └── rebuild_tasks.py
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   ├── cors.py
│   │   │   ├── logging.py
│   │   │   └── rate_limit.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── formatters.py
│   │       └── validators.py
│   ├── migrations/                     # Alembic
│   │   ├── versions/
│   │   └── env.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_trades.py
│   │   ├── test_accounts.py
│   │   └── test_analytics.py
│   ├── pyproject.toml
│   └── Dockerfile
```

---

## 🗄️ Base de Données — PostgreSQL 16

### Schema

```sql
-- Comptes de trading
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    broker VARCHAR(50),
    broker_acct VARCHAR(50),
    account_type VARCHAR(20) CHECK (account_type IN ('challenge', 'funded', 'personal')),
    phase VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    starting_balance DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    target_profit_pct DECIMAL(5,2) DEFAULT 10,
    max_drawdown_pct DECIMAL(5,2) DEFAULT 7,
    daily_loss_pct DECIMAL(5,2) DEFAULT 5,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades
CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    ticket VARCHAR(50),
    open_time TIMESTAMPTZ NOT NULL,
    close_time TIMESTAMPTZ,
    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(5) CHECK (direction IN ('long', 'short')),
    volume DECIMAL(10,4) NOT NULL,
    entry_price DECIMAL(12,5) NOT NULL,
    exit_price DECIMAL(12,5),
    sl_price DECIMAL(12,5),
    tp_price DECIMAL(12,5),
    profit DECIMAL(12,2) DEFAULT 0,
    commission DECIMAL(12,2) DEFAULT 0,
    swap DECIMAL(12,2) DEFAULT 0,
    session VARCHAR(20),
    setup VARCHAR(100),
    confluences TEXT,
    notes TEXT,
    setup_quality SMALLINT CHECK (setup_quality BETWEEN 1 AND 5),
    rr_target DECIMAL(6,2),
    rr_actual DECIMAL(6,2),
    r_multiple DECIMAL(6,2),
    sl_distance DECIMAL(10,2),
    tp_distance DECIMAL(10,2),
    is_winner SMALLINT DEFAULT 0,  -- 0=loss, 1=win, 2=be
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equity curve (daily snapshots)
CREATE TABLE equity_curve (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    equity DECIMAL(12,2) NOT NULL,
    drawdown DECIMAL(12,2) DEFAULT 0,
    drawdown_pct DECIMAL(6,2) DEFAULT 0,
    UNIQUE(account_id, timestamp)
);

-- Daily stats
CREATE TABLE daily_stats (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    trade_date DATE NOT NULL,
    net_pnl DECIMAL(12,2) DEFAULT 0,
    gross_profit DECIMAL(12,2) DEFAULT 0,
    gross_loss DECIMAL(12,2) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    profit_factor DECIMAL(6,3) DEFAULT 0,
    UNIQUE(account_id, trade_date)
);

-- Checkpoints (challenge milestones)
CREATE TABLE checkpoints (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    checkpoint_type VARCHAR(30) NOT NULL,
    balance DECIMAL(12,2) NOT NULL,
    equity DECIMAL(12,2) NOT NULL,
    drawdown DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom strategies
CREATE TABLE strategies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#E8A838'
);

CREATE TABLE trade_tags (
    trade_id INTEGER REFERENCES trades(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
);

-- Indexes
CREATE INDEX idx_trades_account ON trades(account_id);
CREATE INDEX idx_trades_open_time ON trades(open_time);
CREATE INDEX idx_trades_setup ON trades(setup);
CREATE INDEX idx_trades_session ON trades(session);
CREATE INDEX idx_equity_account_time ON equity_curve(account_id, timestamp);
CREATE INDEX idx_daily_account_date ON daily_stats(account_id, trade_date);
```

---

## 🐳 Infrastructure — Docker Compose

```yaml
# docker-compose.yml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: owl_journal
      POSTGRES_USER: owl
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U owl"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://owl:${DB_PASSWORD}@db:5432/owl_journal
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    ports:
      - "8100:8100"

  frontend:
    build: ./frontend
    depends_on:
      - backend
    ports:
      "80:80"

  celery:
    build: ./backend
    command: celery -A app.tasks worker --loglevel=info
    environment:
      DATABASE_URL: postgresql+asyncpg://owl:${DB_PASSWORD}@db:5432/owl_journal
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - db
      - redis

volumes:
  pgdata:
```

---

## 📋 Phases de Développement

### Phase 1 — Foundation (Semaine 1)
- [ ] Setup projet : Vite + React + TS + Tailwind
- [ ] Setup backend : FastAPI + SQLAlchemy + Alembic
- [ ] Schema PostgreSQL complet
- [ ] Docker Compose (db + redis + backend + frontend)
- [ ] API CRUD trades + accounts
- [ ] Pages : Dashboard vide, Trades liste, Accounts liste
- [ ] Sidebar navigation + routing
- [ ] Dark/Light theme

### Phase 2 — Dashboard & Analytics (Semaine 2)
- [ ] KPI cards (Net P&L, PF, Win Rate, Streak)
- [ ] Equity curve chart (Recharts)
- [ ] Drawdown monitor
- [ ] Calendar heatmap
- [ ] Period totals (week/month/year)
- [ ] Session analysis
- [ ] Setup analysis
- [ ] OWL Score radar

### Phase 3 — Trades Management (Semaine 3)
- [ ] Trade table avec filtres
- [ ] Trade detail modal
- [ ] Add/Edit trade form
- [ ] Inline editing
- [ ] Import CSV/XLSX wizard
- [ ] Tags management
- [ ] Confluences
- [ ] Quality stars

### Phase 4 — Features Avancées (Semaine 4)
- [ ] Challenge tracking (Funding Pips, FTMO, etc.)
- [ ] Multi-account support
- [ ] Journal/Notes
- [ ] History
- [ ] Strategies management
- [ ] Checkpoints
- [ ] Reports export (PDF)
- [ ] WebSocket temps réel

### Phase 5 — Polish & Deploy (Semaine 5)
- [ ] Tests unitaires (pytest + vitest)
- [ ] Tests E2E (Playwright)
- [ ] CI/CD (GitHub Actions)
- [ ] SSL + Nginx
- [ ] Backup automatique DB
- [ ] Monitoring (Sentry)
- [ ] Documentation API (Swagger)
- [ ] PWA support

---

## 🔐 Sécurité

- JWT tokens avec refresh
- CORS restrictif
- Rate limiting (Redis)
- Validation stricte (Pydantic + Zod)
- Pas de inline handlers (tout en React)
- CSP stricte sans unsafe-inline
- SQL injection impossible (SQLAlchemy paramétré)
- XSS impossible (React échappe tout)

---

## 📊 Comparaison Ancien vs Nouveau

| Aspect | V3 (Vanilla JS) | V4 (React + TS) |
|--------|-----------------|-----------------|
| CSP | ❌ Inline handlers bloqués | ✅ Zéro inline |
| XSS | ⚠️ Manuel | ✅ Auto par React |
| Typage | ❌ JS loose | ✅ TypeScript strict |
| Composants | ❌ HTML strings | ✅ Composants réutilisables |
| State | ❌ Global variables | ✅ Zustand + TanStack Query |
| Charts | ⚠️ Chart.js CDN | ✅ Recharts (bundled) |
| Build | ❌ Aucun | ✅ Vite (HMR instant) |
| Tests | ❌ Aucun | ✅ pytest + vitest + Playwright |
| DB | ⚠️ SQLite | ✅ PostgreSQL |
| Cache | ❌ Aucun | ✅ Redis |
| Tasks async | ❌ Aucun | ✅ Celery |
| Migrations | ❌ Manuel | ✅ Alembic |
| API docs | ❌ Aucune | ✅ Swagger auto |

---

## 🚀 Commandes de Démarrage

```bash
# Cloner
git clone <repo> && cd owl-journal

# Lancer tout
docker compose up -d

# Backend only
cd backend && uv run uvicorn app.main:app --reload

# Frontend only
cd frontend && npm run dev

# Migrations
cd backend && alembic upgrade head

# Tests
cd backend && pytest
cd frontend && npm test
```

---

*OWL Journal V4 — Zéro compromis. Qualité production.*
