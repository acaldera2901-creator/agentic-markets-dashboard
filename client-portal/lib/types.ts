export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Deposit {
  id: string
  user_id: string
  amount: number
  method: 'bank_transfer' | 'usdt' | 'cash'
  status: 'pending' | 'confirmed' | 'rejected'
  notes: string | null
  created_at: string
  confirmed_at: string | null
}

export interface EquitySnapshot {
  id: string
  user_id: string
  date: string
  balance: number
  pnl_daily: number
  created_at: string
}

export interface BetRecord {
  id: string
  user_id: string
  sport: 'football' | 'tennis'
  match_name: string
  selection: string
  odds: number | null
  stake: number | null
  status: 'pending' | 'won' | 'lost'
  profit_loss: number | null
  placed_at: string
  settled_at: string | null
}

export interface DashboardStats {
  currentBalance: number
  totalPnL: number
  totalPnLPct: number
  winRate: number
  activeBets: number
  startingBalance: number
}
