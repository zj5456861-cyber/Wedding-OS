import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Icon } from '../components/Icons'
import type { Couple } from '../lib/couple'
import { toChineseError } from '../lib/errors'
import {
  createTaskCategory,
  deleteTaskCategory,
  fetchTaskCategories,
  renameTaskCategory,
  reorderTaskCategories,
  type TaskCategory,
} from '../lib/taskCategories'
import {
  createTask,
  deleteTask,
  deleteTasksByCategory,
  fetchTasks,
  reorderTasks,
  setTaskStatus,
  updateTask,
  TASK_STATUS_LABELS,
  type Task,
  type TaskInput,
  type TaskStatus,
} from '../lib/tasks'

const STATUS_OPTIONS: TaskStatus[] = ['not_started', 'in_progress', 'done']

type TaskEdit =
  | { mode: 'new'; category: string }
  | { mode: 'edit'; task: Task }
  | null

// 拖拽排序：指针捕获，鼠标与触屏通用；scope 区分分类列表与事项列表
function useDragSort(
  ids: string[],
  onReorder: (ordered: string[]) => void,
  scope: string,
) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const idsRef = useRef(ids)
  idsRef.current = ids
  const attr = scope + ':'

  function handlePointerDown(id: string) {
    return (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      setDragKey(attr + id)
      setOverKey(attr + id)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  function handlePointerMove() {
    return (e: ReactPointerEvent<HTMLElement>) => {
      if (!dragKey?.startsWith(attr)) return
      e.preventDefault()
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const row = el?.closest('[data-drag-row]') as HTMLElement | null
      const target = row?.dataset.dragRow ?? ''
      if (target.startsWith(attr)) setOverKey(target)
    }
  }

  function handlePointerUp() {
    if (
      dragKey?.startsWith(attr) &&
      overKey?.startsWith(attr) &&
      dragKey !== overKey
    ) {
      const list = idsRef.current
      const from = list.indexOf(dragKey.slice(attr.length))
      const to = list.indexOf(overKey.slice(attr.length))
      if (from >= 0 && to >= 0) {
        const next = [...list]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        onReorder(next)
      }
    }
    setDragKey(null)
    setOverKey(null)
  }

  return { dragKey, overKey, attr, handlePointerDown, handlePointerMove, handlePointerUp }
}

export default function TasksPage({ couple }: { couple: Couple }) {
  const queryClient = useQueryClient()
  const { data: categories = [] } = useQuery({
    queryKey: ['task-categories', couple.id],
    queryFn: () => fetchTaskCategories(couple.id),
  })
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', couple.id],
    queryFn: () => fetchTasks(couple.id),
  })
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)
  const [taskEdit, setTaskEdit] = useState<TaskEdit>(null)
  const [formError, setFormError] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [addCatOpen, setAddCatOpen] = useState(false)
  const [renameState, setRenameState] = useState<{ id: string; value: string } | null>(null)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['task-categories', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['tasks', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['home', couple.id] })
  }

  const save = useMutation({
    mutationFn: (input: { id?: string; values: TaskInput }) =>
      input.id ? updateTask(input.id, input.values) : createTask(couple.id, input.values),
    onSuccess: () => {
      invalidate()
      setTaskEdit(null)
      setFormError('')
    },
    onError: (err) => setFormError(toChineseError(err)),
  })

  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: TaskStatus }) =>
      setTaskStatus(id, value),
    onSuccess: () => invalidate(),
    onError: (err) => setFormError(toChineseError(err)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => invalidate(),
    onError: (err) => setFormError(toChineseError(err)),
  })

  const addCat = useMutation({
    mutationFn: (name: string) => createTaskCategory(couple.id, name),
    onSuccess: () => {
      invalidate()
      setNewCatName('')
      setAddCatOpen(false)
    },
    onError: (err) => window.alert(toChineseError(err)),
  })

  const renameCat = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameTaskCategory(couple.id, id, name),
    onSuccess: () => {
      invalidate()
      setRenameState(null)
    },
    onError: (err) => window.alert(toChineseError(err)),
  })

  const deleteCat = useMutation({
    mutationFn: (id: string) => deleteTaskCategory(id),
    onSuccess: () => invalidate(),
    onError: (err) => window.alert(toChineseError(err)),
  })

  const deleteCatWithTasks = useMutation({
    mutationFn: ({ categoryId, categoryName }: { categoryId: string; categoryName: string }) =>
      deleteTasksByCategory(couple.id, categoryName).then(() => deleteTaskCategory(categoryId)),
    onSuccess: () => invalidate(),
    onError: (err) => window.alert(toChineseError(err)),
  })

  const reorderCat = useMutation({
    mutationFn: (orderedIds: string[]) => reorderTaskCategories(couple.id, orderedIds),
    onSuccess: () => invalidate(),
    onError: (err) => window.alert(toChineseError(err)),
  })

  const reorderTask = useMutation({
    mutationFn: (orderedIds: string[]) => reorderTasks(couple.id, orderedIds),
    onSuccess: () => invalidate(),
    onError: (err) => window.alert(toChineseError(err)),
  })

  const tasksByCategory = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      const key = t.category?.trim() || ''
      const arr = m.get(key) ?? []
      arr.push(t)
      m.set(key, arr)
    }
    return m
  }, [tasks])

  const knownNames = useMemo(
    () => new Set(categories.map((c) => c.name)),
    [categories],
  )
  const fallbackTasks = useMemo(
    () => tasks.filter((t) => !knownNames.has(t.category?.trim() || '')),
    [tasks, knownNames],
  )

  const expandedCat = categories.find((c) => c.id === expandedCatId) ?? null
  const expandedTasks = expandedCat ? tasksByCategory.get(expandedCat.name) ?? [] : []

  const catDrag = useDragSort(
    categories.map((c) => c.id),
    (ordered) => reorderCat.mutate(ordered),
    'cat',
  )
  const taskDrag = useDragSort(
    expandedTasks.map((t) => t.id),
    (ordered) => reorderTask.mutate(ordered),
    'task',
  )

  function toggleCategory(catId: string) {
    setExpandedCatId((cur) => (cur === catId ? null : catId))
    setRenameState(null)
  }

  function deleteCategory(cat: TaskCategory, catTasks: Task[]) {
    if (catTasks.length > 0) {
      const ok = window.confirm(
        `「${cat.name}」下有 ${catTasks.length} 个事项，是否同时删除这些事项？`,
      )
      if (!ok) return
    } else if (!window.confirm(`删除分类「${cat.name}」？`)) {
      return
    }
    if (expandedCatId === cat.id) setExpandedCatId(null)
    if (catTasks.length > 0) {
      deleteCatWithTasks.mutate({ categoryId: cat.id, categoryName: cat.name })
    } else {
      deleteCat.mutate(cat.id)
    }
  }

  function submitAddCat() {
    if (!newCatName.trim()) return
    addCat.mutate(newCatName)
  }

  return (
    <div>
      <div className="card">
        <div className="module-head">
          <p className="module-kicker">事项</p>
          <h2 className="module-title">分类清单</h2>
        </div>
        <p className="muted">
          共 {tasks.length} 个事项 · {categories.length} 个分类；长按或拖动「≡」调整顺序
        </p>

        {categories.map((cat) => {
          const catTasks = tasksByCategory.get(cat.name) ?? []
          const catExpanded = expandedCatId === cat.id
          const catRenaming = renameState?.id === cat.id
          const dragging = catDrag.dragKey === catDrag.attr + cat.id
          const over = catDrag.overKey === catDrag.attr + cat.id
          return (
            <div
              className={`category-sheet drag-row ${dragging ? 'dragging' : ''} ${
                over && !dragging ? 'drag-over' : ''
              }`}
              key={cat.id}
              data-drag-row={catDrag.attr + cat.id}
            >
              <div
                className="paper-row"
                style={{ flexDirection: 'column', gap: 6, padding: '8px 0' }}
                onClick={() => {
                  if (!catRenaming) toggleCategory(cat.id)
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <button
                    className="icon-btn drag-handle"
                    type="button"
                    aria-label="拖动排序"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={catDrag.handlePointerDown(cat.id)}
                    onPointerMove={catDrag.handlePointerMove()}
                    onPointerUp={catDrag.handlePointerUp}
                    onPointerCancel={catDrag.handlePointerUp}
                  >
                    <Icon name="list" size={15} />
                  </button>
                  <div
                    className="row-main editable"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!catRenaming) setRenameState({ id: cat.id, value: cat.name })
                    }}
                  >
                    {catRenaming ? (
                      <input
                        value={renameState?.value ?? cat.name}
                        onChange={(e) => setRenameState({ id: cat.id, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            renameCat.mutate({
                              id: cat.id,
                              name: renameState?.value ?? cat.name,
                            })
                          if (e.key === 'Escape') setRenameState(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <>
                        <p className="row-title">{cat.name}</p>
                        <p className="row-meta">{catTasks.length} 个事项</p>
                      </>
                    )}
                  </div>
                  <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                    {catRenaming ? (
                      <>
                        <button
                          className="icon-btn"
                          aria-label="保存分类名"
                          onClick={() =>
                            renameCat.mutate({
                              id: cat.id,
                              name: renameState?.value ?? cat.name,
                            })
                          }
                        >
                          <Icon name="check" size={14} />
                        </button>
                        <button
                          className="icon-btn"
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
                          aria-label="展开分类"
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
                          className="icon-btn danger-btn"
                          aria-label="删除分类"
                          onClick={() => deleteCategory(cat, catTasks)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {catExpanded && (
                <div className="cat-body">
                  {catTasks.length === 0 && <p className="muted">这个分类还没有事项</p>}
                  {catTasks.map((t, i) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      index={i}
                      dragKey={taskDrag.attr + t.id}
                      dragging={taskDrag.dragKey === taskDrag.attr + t.id}
                      over={taskDrag.overKey === taskDrag.attr + t.id}
                      onPointerDown={taskDrag.handlePointerDown(t.id)}
                      onPointerMove={taskDrag.handlePointerMove()}
                      onPointerUp={taskDrag.handlePointerUp}
                      onStatus={(value) => status.mutate({ id: t.id, value })}
                      statusPending={status.isPending}
                      onEdit={() => {
                        setFormError('')
                        setTaskEdit({ mode: 'edit', task: t })
                      }}
                      onDelete={() => {
                        if (window.confirm(`删除事项「${t.title}」？`)) remove.mutate(t.id)
                      }}
                    />
                  ))}
                  <button
                    className="link"
                    onClick={() => {
                      setFormError('')
                      setTaskEdit({ mode: 'new', category: cat.name })
                    }}
                  >
                    + 新增事项
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {fallbackTasks.length > 0 && (
          <div className="category-sheet">
            <div
              className="paper-row"
              style={{ flexDirection: 'column', gap: 6, padding: '8px 0', cursor: 'pointer' }}
              onClick={() => setExpandedCatId((cur) => (cur === '__fallback' ? null : '__fallback'))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <div className="row-main">
                  <p className="row-title">未分类</p>
                  <p className="row-meta">{fallbackTasks.length} 个事项</p>
                </div>
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    aria-label="展开分类"
                    onClick={() =>
                      setExpandedCatId((cur) => (cur === '__fallback' ? null : '__fallback'))
                    }
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        transform:
                          expandedCatId === '__fallback' ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <Icon name="chevron" size={15} />
                    </span>
                  </button>
                </div>
              </div>
            </div>
            {expandedCatId === '__fallback' && (
              <div className="cat-body">
                {fallbackTasks.map((t, i) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    index={i}
                    dragKey=""
                    dragging={false}
                    over={false}
                    onPointerDown={() => undefined}
                    onPointerMove={() => undefined}
                    onPointerUp={() => undefined}
                    onStatus={(value) => status.mutate({ id: t.id, value })}
                    statusPending={status.isPending}
                    onEdit={() => {
                      setFormError('')
                      setTaskEdit({ mode: 'edit', task: t })
                    }}
                    onDelete={() => {
                      if (window.confirm(`删除事项「${t.title}」？`)) remove.mutate(t.id)
                    }}
                  />
                ))}
                <button
                  className="link"
                  onClick={() => {
                    setFormError('')
                    setTaskEdit({ mode: 'new', category: categories[0]?.name ?? '' })
                  }}
                >
                  + 新增事项
                </button>
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && categories.length === 0 && fallbackTasks.length === 0 && (
          <div className="empty-state" style={{ padding: '14px 4px 8px' }}>
            <Icon name="calendar" size={56} className="empty-icon" />
            <p className="muted">还没有事项，先添加一个分类吧</p>
          </div>
        )}

        {/* 新增分类 */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button
            className="secondary"
            type="button"
            style={{ width: 'auto', padding: '10px 24px', margin: 0 }}
            disabled={addCat.isPending}
            onClick={() => {
              setNewCatName('')
              setAddCatOpen(true)
            }}
          >
            + 添加分类
          </button>
        </div>
      </div>

      {/* 新增分类弹窗 */}
      {addCatOpen && (
        <div className="dialog-mask" onClick={() => setAddCatOpen(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="module-head">
              <p className="module-kicker">一级分类</p>
              <h2 className="module-title">新增分类</h2>
            </div>
            <label>分类名称</label>
            <input
              autoFocus
              placeholder="例如：蜜月旅行"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAddCat()
                if (e.key === 'Escape') setAddCatOpen(false)
              }}
            />
            <button
              className="primary"
              type="button"
              disabled={addCat.isPending || !newCatName.trim()}
              onClick={submitAddCat}
            >
              {addCat.isPending ? '保存中…' : '保存'}
            </button>
            <button className="secondary" type="button" onClick={() => setAddCatOpen(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="muted">加载中…</p>}
      {error && <p className="error">{toChineseError(error)}</p>}

      {taskEdit && (
        <TaskForm
          key={taskEdit.mode === 'new' ? `new-${taskEdit.category}` : taskEdit.task.id}
          initial={taskEdit.mode === 'edit' ? taskEdit.task : undefined}
          presetCategory={taskEdit.mode === 'new' ? taskEdit.category : undefined}
          categories={categories}
          submitting={save.isPending}
          error={formError}
          onCancel={() => {
            setTaskEdit(null)
            setFormError('')
          }}
          onSubmit={(values) =>
            save.mutate({
              id: taskEdit.mode === 'edit' ? taskEdit.task.id : undefined,
              values,
            })
          }
        />
      )}
    </div>
  )
}

function TaskRow({
  task,
  index,
  dragKey,
  dragging,
  over,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onStatus,
  statusPending,
  onEdit,
  onDelete,
}: {
  task: Task
  index: number
  dragKey: string
  dragging: boolean
  over: boolean
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: () => void
  onStatus: (value: TaskStatus) => void
  statusPending: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const hint = dueHint(task)
  return (
    <div
      className={`paper-row drag-row ${dragging ? 'dragging' : ''} ${
        over && !dragging ? 'drag-over' : ''
      }`}
      style={{ flexDirection: 'column', gap: 4 }}
      data-drag-row={dragKey}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
        {dragKey ? (
          <button
            className="drag-grip"
            type="button"
            aria-label="拖动排序"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <Icon name="list" size={14} />
          </button>
        ) : null}
        <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
        <div className="row-main">
          <p className="row-title">{task.title}</p>
          <p className="row-meta">
            {task.due_date ? `建议最晚：${task.due_date}` : '未设完成日期'}
            {task.reminder_date ? ` · 提醒 ${task.reminder_date}` : ''}
            {hint && (
              <span className={`due-hint ${hint.over ? 'over' : ''}`}> · {hint.text}</span>
            )}
          </p>
          {task.note && <p className="row-note">{task.note}</p>}
        </div>
        <div className="row-actions">
          <button className="icon-btn" aria-label="编辑事项" onClick={onEdit}>
            <Icon name="edit" size={15} />
          </button>
          <button className="icon-btn danger-btn" aria-label="删除事项" onClick={onDelete}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
      <div className="stamp-row" style={{ paddingLeft: 32, margin: 0 }}>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            className={`stamp ${task.status === s ? 'active' : ''} ${s === 'done' ? 'done' : ''}`}
            disabled={statusPending}
            onClick={() => onStatus(s)}
          >
            {TASK_STATUS_LABELS[s]}
          </button>
        ))}
        {task.status === 'waiting_decision' && (
          <span className="stamp waiting" style={{ pointerEvents: 'none' }}>
            待线下决定
          </span>
        )}
      </div>
    </div>
  )
}

function dueHint(task: Task): { text: string; over: boolean } | null {
  if (!task.due_date || task.status === 'done') return null
  const [y, m, d] = task.due_date.split('-').map(Number)
  const due = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const days = Math.round((due - today) / 86400000)
  if (days === 0) return { text: '今天截止', over: false }
  if (days > 0 && days <= 7) return { text: `距离截止 ${days} 天`, over: false }
  if (days < 0) return { text: `已逾期 ${-days} 天`, over: true }
  return null
}

function TaskForm({
  initial,
  presetCategory,
  categories,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Task
  presetCategory?: string
  categories: TaskCategory[]
  submitting: boolean
  error: string
  onSubmit: (values: TaskInput) => void
  onCancel: () => void
}) {
  const categoryNames = useMemo(
    () => categories.map((c) => c.name),
    [categories],
  )
  const initialCategory = initial?.category ?? presetCategory ?? ''
  const options = useMemo(() => {
    if (initialCategory && !categoryNames.includes(initialCategory)) {
      return [initialCategory, ...categoryNames]
    }
    return categoryNames
  }, [initialCategory, categoryNames])

  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState(initialCategory)
  const [status, setStatus] = useState<TaskStatus>(
    initial?.status === 'waiting_decision' ? 'not_started' : (initial?.status ?? 'not_started'),
  )
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [reminderDate, setReminderDate] = useState(initial?.reminder_date ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      category: category.trim() || null,
      status,
      due_date: dueDate || null,
      reminder_date: reminderDate || null,
      note: note.trim() || null,
    })
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="module-head">
        <p className="module-kicker">事项</p>
        <h2 className="module-title">{initial ? '编辑事项' : '新增事项'}</h2>
      </div>
      <label>事项名称</label>
      <input required value={title} onChange={(e) => setTitle(e.target.value)} />
      <label>分类</label>
      <select required value={category} onChange={(e) => setCategory(e.target.value)}>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <label>状态</label>
      <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {TASK_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <label>建议最晚完成日期（可空）</label>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <label>提醒日期（可空，到日期在首页提醒）</label>
      <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
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
  )
}
