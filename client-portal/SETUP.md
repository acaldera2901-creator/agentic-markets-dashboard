# Agentic Markets — Client Portal Setup

## 1. Crea il progetto Supabase

1. Vai su https://supabase.com e crea un nuovo progetto
2. Scegli un nome (es. `agentic-markets-portal`) e una password robusta per il DB
3. Regione: West Europe (Frankfurt) o EU Central

## 2. Configura le variabili d'ambiente

Nel dashboard Supabase: Settings > API

Copia:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Aggiorna `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Crea lo schema del database

Vai su Supabase > SQL Editor e esegui questo script:

```sql
-- Profiles (estende auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Deposits
create table if not exists deposits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  amount decimal(10,2) not null,
  method text not null check (method in ('bank_transfer', 'usdt', 'cash')),
  status text default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  notes text,
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

alter table deposits enable row level security;

create policy "Users can view own deposits"
  on deposits for select using (auth.uid() = user_id);

create policy "Users can insert own deposits"
  on deposits for insert with check (auth.uid() = user_id);

-- Equity snapshots
create table if not exists equity_snapshots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  balance decimal(10,2) not null,
  pnl_daily decimal(10,2) default 0,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table equity_snapshots enable row level security;

create policy "Users can view own equity"
  on equity_snapshots for select using (auth.uid() = user_id);

create policy "Users can insert own equity"
  on equity_snapshots for insert with check (auth.uid() = user_id);

-- Bet records
create table if not exists bet_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  sport text not null check (sport in ('football', 'tennis')),
  match_name text not null,
  selection text not null,
  odds decimal(6,2),
  stake decimal(10,2),
  status text default 'pending' check (status in ('pending', 'won', 'lost')),
  profit_loss decimal(10,2),
  placed_at timestamptz default now(),
  settled_at timestamptz
);

alter table bet_records enable row level security;

create policy "Users can view own bets"
  on bet_records for select using (auth.uid() = user_id);

create policy "Users can insert own bets"
  on bet_records for insert with check (auth.uid() = user_id);
```

## 4. Crea l'utente demo

In Supabase > Authentication > Users > "Invite user":
- Email: `demo@agenticmarkets.com`
- Oppure usa SQL Editor:

```sql
-- Crea utente demo (esegui nel SQL Editor con service_role)
-- Nota: l'utente va creato via Dashboard > Auth > Users > Add user
-- Email: demo@agenticmarkets.com
-- Password: Demo1234!
```

Dopo aver creato l'utente, copia il suo UUID dal dashboard Auth.

## 5. Popola i dati demo

Sostituisci `YOUR_USER_UUID` con l'UUID dell'utente demo, poi esegui:

```sql
-- Demo data seed
-- SOSTITUISCI 'YOUR_USER_UUID' con l'UUID dell'utente demo

do $$
declare
  demo_uid uuid := 'YOUR_USER_UUID';
  start_date date := current_date - 90;
  curr_date date;
  curr_balance decimal := 1000.00;
  daily_change decimal;
  i integer := 0;
begin

-- Equity snapshots (90 giorni, trend +18%)
curr_date := start_date;
while curr_date <= current_date loop
  -- Random daily oscillation with slight upward drift
  daily_change := (random() * 40 - 16) + 2.2; -- avg +2.2/day = ~18% over 90d
  curr_balance := greatest(900, curr_balance + daily_change);
  
  insert into equity_snapshots (user_id, date, balance, pnl_daily)
  values (demo_uid, curr_date, round(curr_balance, 2), round(daily_change, 2))
  on conflict (user_id, date) do nothing;
  
  curr_date := curr_date + 1;
  i := i + 1;
end loop;

-- Bet records
insert into bet_records (user_id, sport, match_name, selection, odds, stake, status, profit_loss, placed_at, settled_at) values
(demo_uid, 'football', 'Inter vs AC Milan', '1X2 - Inter', 1.85, 50, 'won', 42.50, current_date - 85, current_date - 85),
(demo_uid, 'football', 'Juventus vs Napoli', '1X2 - Napoli', 3.20, 25, 'lost', -25.00, current_date - 82, current_date - 82),
(demo_uid, 'tennis', 'Djokovic vs Alcaraz', 'Djokovic +1.5', 1.72, 40, 'won', 28.80, current_date - 80, current_date - 80),
(demo_uid, 'football', 'Barcelona vs Real Madrid', 'Under 2.5', 2.10, 60, 'won', 66.00, current_date - 78, current_date - 78),
(demo_uid, 'tennis', 'Sinner vs Medvedev', 'Sinner', 1.60, 45, 'won', 27.00, current_date - 75, current_date - 75),
(demo_uid, 'football', 'PSG vs Lyon', '1X2 - PSG', 1.45, 80, 'won', 36.00, current_date - 72, current_date - 72),
(demo_uid, 'football', 'Bayern vs Dortmund', 'Both Teams Score', 1.75, 35, 'lost', -35.00, current_date - 70, current_date - 70),
(demo_uid, 'tennis', 'Nadal vs Tsitsipas', 'Tsitsipas', 2.40, 30, 'won', 42.00, current_date - 68, current_date - 68),
(demo_uid, 'football', 'Liverpool vs Man City', 'Over 2.5', 1.95, 50, 'won', 47.50, current_date - 65, current_date - 65),
(demo_uid, 'football', 'Arsenal vs Chelsea', '1X2 - Draw', 3.40, 20, 'lost', -20.00, current_date - 62, current_date - 62),
(demo_uid, 'tennis', 'Federer vs Murray', 'Federer', 1.55, 55, 'won', 30.25, current_date - 60, current_date - 60),
(demo_uid, 'football', 'Atletico vs Sevilla', 'Under 2.5', 1.90, 40, 'won', 36.00, current_date - 58, current_date - 58),
(demo_uid, 'football', 'Lazio vs Roma', 'Over 1.5', 1.65, 60, 'won', 39.00, current_date - 55, current_date - 55),
(demo_uid, 'tennis', 'Zverev vs Ruud', 'Zverev -1', 1.80, 35, 'lost', -35.00, current_date - 52, current_date - 52),
(demo_uid, 'football', 'Benfica vs Porto', '1X2 - Benfica', 2.20, 45, 'won', 54.00, current_date - 50, current_date - 50),
(demo_uid, 'football', 'Ajax vs PSV', 'Both Score NO', 2.05, 30, 'won', 31.50, current_date - 48, current_date - 48),
(demo_uid, 'tennis', 'Hurkacz vs Rublev', 'Hurkacz', 1.70, 40, 'lost', -40.00, current_date - 45, current_date - 45),
(demo_uid, 'football', 'Feyenoord vs AZ', 'Over 2.5', 1.85, 50, 'won', 42.50, current_date - 42, current_date - 42),
(demo_uid, 'football', 'Celtic vs Rangers', 'Celtic +0.5', 1.60, 70, 'won', 42.00, current_date - 40, current_date - 40),
(demo_uid, 'tennis', 'Dimitrov vs Fritz', 'Fritz', 2.15, 25, 'won', 28.75, current_date - 38, current_date - 38),
(demo_uid, 'football', 'Man United vs Tottenham', 'Over 2.5', 1.75, 45, 'lost', -45.00, current_date - 35, current_date - 35),
(demo_uid, 'football', 'Marseille vs Monaco', '1X2 - Monaco', 2.50, 30, 'won', 45.00, current_date - 32, current_date - 32),
(demo_uid, 'tennis', 'Berrettini vs Khachanov', 'Berrettini', 1.65, 40, 'won', 26.00, current_date - 28, current_date - 28),
(demo_uid, 'football', 'Napoli vs Fiorentina', 'Napoli -1', 1.90, 55, 'won', 49.50, current_date - 7, null),
(demo_uid, 'tennis', 'Sinner vs Alcaraz', 'Sinner ML', 2.10, 50, 'pending', null, current_date - 1, null);

-- Deposits
insert into deposits (user_id, amount, method, status, notes, created_at, confirmed_at) values
(demo_uid, 500.00, 'bank_transfer', 'confirmed', 'Primo versamento', current_date - 90, current_date - 89),
(demo_uid, 500.00, 'usdt', 'confirmed', 'Top-up mensile', current_date - 45, current_date - 44),
(demo_uid, 250.00, 'bank_transfer', 'pending', 'Ricarica Q2', current_date - 2, null);

end $$;
```

## 6. Avvia il server di sviluppo

```bash
cd ~/Desktop/sistema-andrea/agentic-markets/client-portal
npm run dev
```

Il portale sarà disponibile su http://localhost:3000

Credenziali demo: `demo@agenticmarkets.com` / `Demo1234!`

## 7. Deploy su Vercel

```bash
# Login con account agenticmarkets
npx vercel --token YOUR_TOKEN

# Oppure collega la repo GitHub e configura le env vars nel dashboard Vercel:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Scope Vercel: `agenticmarkets-cb-1025s-projects`
