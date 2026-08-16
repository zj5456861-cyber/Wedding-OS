import { supabase } from './supabase'

export const CURRENCIES = ['CNY', 'EUR', 'USD', 'JPY', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]

export interface Budget {
  id: string
  couple_id: string
  category_id: string
  amount_cny: number
  note: string | null
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  couple_id: string
  category_id: string
  name: string
  amount: number
  currency: string
  exchange_rate: number | null
  rmb_amount: number
  expense_date: string
  note: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseInput {
  name: string
  category_id: string
  amount: number
  currency: string
  exchange_rate: number | null
  rmb_amount: number
  expense_date: string
  note: string | null
}

export function computeRmbAmount(
  amount: number,
  currency: string,
  exchangeRate: number | null,
): number {
  if (currency === 'CNY') return Math.round(amount * 100) / 100
  const rate = Number(exchangeRate ?? 0)
  return Math.round(amount * rate * 100) / 100
}

export async function fetchBudgets(coupleId: string): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('couple_id', coupleId)
  if (error) throw error
  return (data ?? []) as Budget[]
}

export async function setBudgetAmount(
  coupleId: string,
  categoryId: string,
  amountCny: number,
  note?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('budgets')
    .select('id')
    .eq('couple_id', coupleId)
    .eq('category_id', categoryId)
    .maybeSingle()
  if (error) throw error
  if (data) {
    const { error: updateError } = await supabase
      .from('budgets')
      .update({ amount_cny: amountCny, note: note?.trim() || null })
      .eq('id', (data as { id: string }).id)
    if (updateError) throw updateError
  } else {
    const { error: insertError } = await supabase.from('budgets').insert({
      couple_id: coupleId,
      category_id: categoryId,
      amount_cny: amountCny,
      note: note?.trim() || null,
    })
    if (insertError) throw insertError
  }
}

export async function fetchExpenses(coupleId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Expense[]
}

export async function createExpense(coupleId: string, input: ExpenseInput): Promise<void> {
  const { error } = await supabase.from('expenses').insert({
    couple_id: coupleId,
    category_id: input.category_id,
    name: input.name.trim(),
    amount: input.amount,
    currency: input.currency,
    exchange_rate: input.currency === 'CNY' ? null : input.exchange_rate,
    rmb_amount: input.rmb_amount,
    expense_date: input.expense_date,
    note: input.note?.trim() || null,
  })
  if (error) throw error
}

// 更新支出：历史金额冻结——仅金额或币种变化时重算 rmb_amount，
// 单独修改汇率不影响已保存的人民币金额
export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const { data, error } = await supabase
    .from('expenses')
    .select('amount,currency,rmb_amount')
    .eq('id', id)
    .single()
  if (error) throw error
  const prev = data as { amount: number; currency: string; rmb_amount: number }
  const moneyChanged =
    Number(prev.amount) !== input.amount || prev.currency !== input.currency
  const rmbAmount = moneyChanged
    ? input.rmb_amount
    : Number(prev.rmb_amount ?? input.rmb_amount)
  const { error: updateError } = await supabase
    .from('expenses')
    .update({
      category_id: input.category_id,
      name: input.name.trim(),
      amount: input.amount,
      currency: input.currency,
      exchange_rate: input.currency === 'CNY' ? null : input.exchange_rate,
      rmb_amount: rmbAmount,
      expense_date: input.expense_date,
      note: input.note?.trim() || null,
    })
    .eq('id', id)
  if (updateError) throw updateError
}

// 快捷修改支出金额：币种与冻结汇率不变，仅重算人民币金额
export async function updateExpenseAmount(id: string, amount: number): Promise<void> {
  const { data, error } = await supabase
    .from('expenses')
    .select('currency,exchange_rate')
    .eq('id', id)
    .single()
  if (error) throw error
  const row = data as { currency: string; exchange_rate: number | null }
  const rmbAmount = computeRmbAmount(
    amount,
    row.currency,
    row.currency === 'CNY' ? null : row.exchange_rate,
  )
  const { error: updateError } = await supabase
    .from('expenses')
    .update({ amount, rmb_amount: rmbAmount })
    .eq('id', id)
  if (updateError) throw updateError
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
