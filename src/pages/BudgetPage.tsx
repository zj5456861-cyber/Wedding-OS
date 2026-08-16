import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Icon } from '../components/Icons'
import type { Couple } from '../lib/couple'
import { toChineseError } from '../lib/errors'
import {
  createBudgetCategory,
  deleteBudgetCategory,
  fetchBudgetCategories,
  renameBudgetCategory,
  type BudgetCategory,
} from '../lib/budgetCategories'
import {
  computeRmbAmount,
  createExpense,
  CURRENCIES,
  deleteExpense,
  fetchBudgets,
  fetchExpenses,
  setBudgetAmount,
  updateExpense,
  type Expense,
  type ExpenseInput,
} from '../lib/budgets'

type ExpenseEdit =
  | { mode: 'new'; categoryId: string }
  | { mode: 'edit'; expense: Expense }
  | null

export default function BudgetPage({ couple }: { couple: Couple }) {
  const queryClient = useQueryClient()
  const { data: categories = [] } = useQuery({
    queryKey: ['budget-categories', couple.id],
    queryFn: () => fetchBudgetCategories(couple.id),
  })
  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', couple.id],
    queryFn: () => fetchBudgets(couple.id),
  })
  const { data: expenses = [], isLoading: loadingExpenses, error: expensesError } = useQuery({
    queryKey: ['expenses', couple.id],
    queryFn: () => fetchExpenses(couple.id),
  })

  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)
  const [addCatOpen, setAddCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [renameState, setRenameState] = useState<{ id: string; value: string } | null>(null)
  const [budgetState, setBudgetState] = useState<{ id: string; value: string } | null>(null)
  const [expenseEdit, setExpenseEdit] = useState<ExpenseEdit>(null)
  const [formError, setFormError] = useState('')

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['budget-categories', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['budgets', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['expenses', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['home', couple.id] })
  }

  const addCat = useMutation({
    mutationFn: (name: string) => createBudgetCategory(couple.id, name),
    onSuccess: () => {
      invalidate()
      setNewCatName('')
      setAddCatOpen(false)
    },
    onError: (err) => window.alert(toChineseError(err)),
  })

  const renameCat = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameBudgetCategory(id, name),
    onSuccess: () => {
      invalidate()
      setRenameState(null)
    },
    onError: (err) => window.alert(toChineseError(err)),
  })

  const removeCat = useMutation({
    mutationFn: (id: string) => deleteBudgetCategory(id),
    onSuccess: () => invalidate(),
    onError: (err) => window.alert(toChineseError(err)),
  })

  const saveBudget = useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: string; amount: number }) =>
      setBudgetAmount(couple.id, categoryId, amount),
    onSuccess: () => {
      invalidate()
      setBudgetState(null)
    },
    onError: (err) => window.alert(toChineseError(err)),
  })

  const saveExpense = useMutation({
    mutationFn: (input: { id?: string; values: ExpenseInput }) =>
      input.id ? updateExpense(input.id, input.values) : createExpense(couple.id, input.values),
    onSuccess: () => {
      invalidate()
      setExpenseEdit(null)
      setFormError('')
    },
    onError: (err) => setFormError(toChineseError(err)),
  })

  const removeExpense = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => invalidate(),
    onError: (err) => window.alert(toChineseError(err)),
  })

  const topCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories])
  const childrenByParent = useMemo(() => {
    const m = new Map<string, BudgetCategory[]>()
    for (const c of categories) {
      if (c.parent_id) {
        const arr = m.get(c.parent_id) ?? []
        arr.push(c)
        m.set(c.parent_id, arr)
      }
    }
    return m
  }, [categories])
  const budgetByCategory = useMemo(
    () => new Map(budgets.map((b) => [b.category_id, Number(b.amount_cny ?? 0)])),
    [budgets],
  )
  const expensesByCategory = useMemo(() => {
    const m = new Map<string, Expense[]>()
    for (const e of expenses) {
      const arr = m.get(e.category_id) ?? []
      arr.push(e)
      m.set(e.category_id, arr)
    }
    return m
  }, [expenses])

  function spentOf(catId: string): number {
    return (expensesByCategory.get(catId) ?? []).reduce(
      (s, e) => s + Number(e.rmb_amount ?? 0),
      0,
    )
  }
  function spentIncludingChildren(topId: string): number {
    let s = spentOf(topId)
    for (const child of childrenByParent.get(topId) ?? []) s += spentOf(child.id)
    return s
  }

  // 顶部总预算 = 所有可见一级分类预算之和（排除已删除分类的残留预算行）
  const budgetTotal = topCategories.reduce(
    (s, c) => s + (budgetByCategory.get(c.id) ?? 0),
    0,
  )
  const spentTotal = expenses.reduce((s, e) => s + Number(e.rmb_amount ?? 0), 0)

  function toggleCategory(catId: string) {
    setExpandedCatId((cur) => (cur === catId ? null : catId))
    setRenameState(null)
  }

  function deleteCategory(cat: BudgetCategory, count: number) {
    const warn = count > 0 ? `（该分类下有 ${count} 笔支出，历史支出保留）` : ''
    if (!window.confirm(`删除分类「${cat.name}」？${warn}`)) return
    if (expandedCatId === cat.id) setExpandedCatId(null)
    removeCat.mutate(cat.id)
  }

  return (
    <div>
      {/* 花销账本 · 概览 */}
      <div className="card">
        <div className="module-head">
          <p className="module-kicker">账本</p>
          <h2 className="module-title">花销账本</h2>
        </div>
        {loadingExpenses && <p className="muted">加载中…</p>}
        {expensesError && <p className="error">{toChineseError(expensesError)}</p>}
        <div className="ledger-line">
          <span className="ledger-label">总预算</span>
          <span className="ledger-num">¥ {formatMoney(budgetTotal)}</span>
        </div>
        <div className="ledger-line">
          <span className="ledger-label">总支出</span>
          <span className="ledger-num">¥ {formatMoney(spentTotal)}</span>
        </div>
        <div className="ledger-line">
          <span className="ledger-label">剩余金额</span>
          <span className={`ledger-num ${budgetTotal - spentTotal < 0 ? 'over' : ''}`}>
            ¥ {formatMoney(budgetTotal - spentTotal)}
          </span>
        </div>
      </div>

      {/* 支出分类 */}
      <div className="card">
        <div className="module-head">
          <p className="module-kicker">支出分类</p>
          <h2 className="module-title">预算与消费</h2>
        </div>
        <p className="muted">每个分类独立设置预算；点击分类展开支出记录</p>

        {topCategories.map((cat) => {
          const catBudget = budgetByCategory.get(cat.id) ?? 0
          const catSpent = spentIncludingChildren(cat.id)
          const catRemaining = catBudget - catSpent
          const catExpanded = expandedCatId === cat.id
          const renaming = renameState?.id === cat.id
          const budgeting = budgetState?.id === cat.id
          const catExpenses = expensesByCategory.get(cat.id) ?? []
          return (
            <div className="category-sheet" key={cat.id}>
              <div className="paper-row" style={{ flexDirection: 'column', gap: 6, padding: '8px 0' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer' }}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <div className="row-main">
                    {renaming ? (
                      <input
                        value={renameState?.value ?? cat.name}
                        onChange={(e) => setRenameState({ id: cat.id, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            renameCat.mutate({ id: cat.id, name: renameState?.value ?? cat.name })
                          if (e.key === 'Escape') setRenameState(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="row-title">{cat.name}</p>
                    )}
                  </div>
                  <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                    {renaming ? (
                      <>
                        <button
                          className="icon-btn"
                          type="button"
                          aria-label="保存分类名"
                          onClick={() =>
                            renameCat.mutate({ id: cat.id, name: renameState?.value ?? cat.name })
                          }
                        >
                          <Icon name="check" size={14} />
                        </button>
                        <button
                          className="icon-btn"
                          type="button"
                          aria-label="取消"
                          onClick={() => setRenameState(null)}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="icon-btn"
                          type="button"
                          aria-label="展开支出记录"
                          onClick={() => toggleCategory(cat.id)}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              transform: catExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                            }}
                          >
                            <Icon name="chevron" size={15} />
                          </span>
                        </button>
                        <button
                          className="icon-btn"
                          type="button"
                          aria-label="编辑分类名"
                          onClick={() => setRenameState({ id: cat.id, value: cat.name })}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          className="icon-btn danger-btn"
                          type="button"
                          aria-label="删除分类"
                          onClick={() => deleteCategory(cat, catExpenses.length)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {budgeting ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                    <span className="sub-meta">预算</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={budgetState?.value ?? ''}
                      onChange={(e) => setBudgetState((s) => (s ? { ...s, value: e.target.value } : s))}
                      style={{ width: 130, margin: 0 }}
                    />
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label="保存预算"
                      onClick={() =>
                        saveBudget.mutate({
                          categoryId: cat.id,
                          amount: Number(budgetState?.value) || 0,
                        })
                      }
                    >
                      <Icon name="check" size={14} />
                    </button>
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label="取消"
                      onClick={() => setBudgetState(null)}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="cat-amounts">
                    <span>
                      <button
                        className="amount-btn"
                        type="button"
                        aria-label="修改预算"
                        onClick={() => setBudgetState({ id: cat.id, value: String(catBudget) })}
                      >
                        <b>{formatMoney(catBudget)}</b>
                      </button>
                      预算
                    </span>
                    <span>
                      <b>{formatMoney(catSpent)}</b>
                      已支出
                    </span>
                    <span className={catRemaining < 0 ? 'over' : ''}>
                      <b>{formatMoney(catRemaining)}</b>
                      剩余
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                  <button
                    className="link"
                    type="button"
                    style={{ margin: 0, fontSize: 12 }}
                    onClick={() => {
                      setFormError('')
                      setExpenseEdit({ mode: 'new', categoryId: cat.id })
                    }}
                  >
                    + 添加支出
                  </button>
                </div>
              </div>

              {catExpanded && (
                <div className="cat-body">
                  {catExpenses.length === 0 && <p className="muted">还没有支出记录</p>}
                  {catExpenses.map((e) => (
                    <div className="paper-row expense-row" key={e.id} style={{ padding: '9px 0' }}>
                      <span className="row-date">{e.expense_date.slice(5)}</span>
                      <div className="row-main">
                        <p className="row-title" style={{ fontSize: 14 }}>
                          {e.name}
                        </p>
                        <p className="row-meta">{e.note ?? ''}</p>
                      </div>
                      <span className="expense-dots" />
                      <div className="row-right">
                        <p className="row-amount">
                          {e.currency === 'CNY' ? '¥' : ''}
                          {formatMoney2(Number(e.amount))}
                          {e.currency !== 'CNY' ? ` ${e.currency}` : ''}
                        </p>
                        {e.currency !== 'CNY' && e.exchange_rate ? (
                          <p className="row-meta">≈ ¥{formatMoney2(Number(e.rmb_amount))}</p>
                        ) : null}
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            type="button"
                            aria-label="编辑支出"
                            onClick={() => setExpenseEdit({ mode: 'edit', expense: e })}
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            className="icon-btn danger-btn"
                            type="button"
                            aria-label="删除支出"
                            onClick={() => {
                              if (window.confirm(`删除这笔支出「${e.name}」？`)) removeExpense.mutate(e.id)
                            }}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {topCategories.length === 0 && (
          <div className="empty-state" style={{ padding: '14px 4px 8px' }}>
            <Icon name="budget" size={56} className="empty-icon" />
            <p className="muted">还没有支出分类，先添加第一个吧</p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button
            className="secondary"
            type="button"
            style={{ width: 'auto', padding: '10px 22px', margin: 0 }}
            disabled={addCat.isPending}
            onClick={() => {
              setNewCatName('')
              setAddCatOpen(true)
            }}
          >
            + 添加支出分类
          </button>
        </div>
      </div>

      {/* 新增支出分类弹窗 */}
      {addCatOpen && (
        <div className="dialog-mask" onClick={() => setAddCatOpen(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="module-head">
              <p className="module-kicker">支出分类</p>
              <h2 className="module-title">新增支出分类</h2>
            </div>
            <label>分类名称</label>
            <input
              autoFocus
              placeholder="例如：买车 / 宝宝准备"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCatName.trim()) addCat.mutate(newCatName)
                if (e.key === 'Escape') setAddCatOpen(false)
              }}
            />
            <button
              className="primary"
              type="button"
              disabled={addCat.isPending || !newCatName.trim()}
              onClick={() => addCat.mutate(newCatName)}
            >
              {addCat.isPending ? '保存中…' : '保存'}
            </button>
            <button className="secondary" type="button" onClick={() => setAddCatOpen(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* 支出弹窗 */}
      {expenseEdit && (
        <ExpenseModal
          key={
            expenseEdit.mode === 'new'
              ? `new-${expenseEdit.categoryId}`
              : expenseEdit.expense.id
          }
          initial={expenseEdit.mode === 'edit' ? expenseEdit.expense : undefined}
          categoryId={expenseEdit.mode === 'new' ? expenseEdit.categoryId : undefined}
          submitting={saveExpense.isPending}
          error={formError}
          onCancel={() => {
            setExpenseEdit(null)
            setFormError('')
          }}
          onSubmit={(values) =>
            saveExpense.mutate({
              id: expenseEdit.mode === 'edit' ? expenseEdit.expense.id : undefined,
              values,
            })
          }
        />
      )}
    </div>
  )
}

function ExpenseModal({
  initial,
  categoryId,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Expense
  categoryId?: string
  submitting: boolean
  error: string
  onSubmit: (values: ExpenseInput) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'CNY')
  const [rate, setRate] = useState(initial?.exchange_rate ? String(initial.exchange_rate) : '')
  const [date, setDate] = useState(initial?.expense_date ?? new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState(initial?.note ?? '')

  const amountNum = Number(amount) || 0
  const rateNum = Number(rate) || 0
  const rmbPreview = computeRmbAmount(amountNum, currency, currency === 'CNY' ? null : rateNum)

  function submit(e: FormEvent) {
    e.preventDefault()
    const catId = initial?.category_id ?? categoryId
    if (!name.trim() || !catId) return
    onSubmit({
      name: name.trim(),
      category_id: catId,
      amount: amountNum,
      currency,
      exchange_rate: currency === 'CNY' ? null : rateNum,
      rmb_amount: rmbPreview,
      expense_date: date,
      note: note.trim() || null,
    })
  }

  return (
    <div className="dialog-mask" onClick={onCancel}>
      <form className="dialog-card" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="module-head">
          <p className="module-kicker">支出</p>
          <h2 className="module-title">{initial ? '编辑支出' : '添加支出'}</h2>
        </div>
        <label>支出名称</label>
        <input
          autoFocus
          required
          placeholder="例如：水电材料"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label>金额</label>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          placeholder="例如：5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <label>日期</label>
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="flex-1">
            <label>币种</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {currency !== 'CNY' && (
            <div className="flex-1">
              <label>汇率</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                required
                placeholder="例如 7.85"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          )}
        </div>
        <label>备注</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? '保存中…' : '保存'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          取消
        </button>
      </form>
    </div>
  )
}

function formatMoney(n: number): string {
  return n.toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  })
}

function formatMoney2(n: number): string {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
