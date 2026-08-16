// 统一手绘插画系统：黑白线稿 + 低饱和色填充

export type IllustrationType =
  | 'timeline'
  | 'tasks'
  | 'budget'
  | 'travel'
  | 'ai'
  | 'heart'
  | 'bouquet'
  | 'arch'
  | 'couple'
  | 'coins'
  | 'calendar'
  | 'envelope'
  | 'photo'
  | 'hearts'

// 线稿插画色板：与婚礼手账色彩系统对齐
const STROKE = '#3b3028'
const CREAM = '#fbf7f0'
const SAND = '#d8c2a8'
const BLUSH = '#ecdcd2'
const SAGE = '#dfe3d9'

const L = {
  fill: 'none',
  stroke: STROKE,
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function LineIllustration({ type }: { type: IllustrationType }) {
  if (type === 'arch') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <path d="M14 68V30c0-12 12-20 26-20s26 8 26 20v38" {...L} fill="none" />
        <path d="M14 68h52" {...L} />
        <path d="M40 10v6" {...L} />
        <circle cx="22" cy="24" r="3" {...L} fill={BLUSH} />
        <circle cx="58" cy="24" r="3" {...L} fill={BLUSH} />
        <circle cx="40" cy="18" r="3" {...L} fill={SAGE} />
        <path d="M22 20c-4 1-6 3-6 4s2 3 6 4M58 20c4 1 6 3 6 4s-2 3-6 4" {...L} />
        <path d="M20 44c4 4 8 4 12 0M48 44c4 4 8 4 12 0" {...L} />
      </svg>
    )
  }
  if (type === 'bouquet') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <path d="M30 66l10-34 10 34" {...L} fill={CREAM} />
        <path d="M30 66c-4 2-8 0-8-3 0-5 8-9 8-9M50 66c4 2 8 0 8-3 0-5-8-9-8-9" {...L} />
        <circle cx="32" cy="26" r="6" {...L} fill={BLUSH} />
        <circle cx="48" cy="24" r="6" {...L} fill={SAGE} />
        <circle cx="40" cy="16" r="6" {...L} fill={SAND} />
        <path d="M26 30c-4 0-6 2-6 5M54 28c4 0 6 2 6 5" {...L} />
        <path d="M28 58c-2 3-5 4-8 4M52 58c2 3 5 4 8 4" {...L} />
      </svg>
    )
  }
  if (type === 'couple') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <circle cx="30" cy="24" r="7" {...L} fill={CREAM} />
        <path d="M20 46c0-8 4-12 10-12s10 4 10 12" {...L} fill={BLUSH} />
        <circle cx="50" cy="24" r="7" {...L} fill={CREAM} />
        <path d="M40 46c0-8 4-12 10-12s10 4 10 12" {...L} fill={SAGE} />
        <path d="M30 22c2-1 5 1 5 3M50 22c2-1 5 1 5 3" {...L} />
        <path d="M28 44l2-6M32 44l-2-6M48 44l2-6M52 44l-2-6" {...L} />
        <path d="M40 46v18M30 64h20" {...L} />
      </svg>
    )
  }
  if (type === 'coins') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <circle cx="40" cy="30" r="12" {...L} fill={SAND} />
        <ellipse cx="40" cy="42" rx="12" ry="5" {...L} fill={CREAM} />
        <circle cx="40" cy="30" r="7" {...L} />
        <path d="M40 27v6M37 30h6" {...L} />
        <ellipse cx="24" cy="52" rx="8" ry="3.4" {...L} fill={CREAM} />
        <ellipse cx="52" cy="54" rx="8" ry="3.4" {...L} fill={CREAM} />
        <path d="M24 48c4 0 6 2 6 4M52 50c4 0 6 2 6 4" {...L} />
      </svg>
    )
  }
  if (type === 'timeline') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <circle cx="40" cy="40" r="24" {...L} fill={CREAM} />
        <path d="M40 26v15l10 6" {...L} />
        <path d="M40 8v6M40 66v6M8 40h6M66 40h6" {...L} />
        <path d="M20 20l-4-4M60 20l4-4M20 60l-4 4M60 60l4 4" {...L} />
        <circle cx="26" cy="52" r="1.6" {...L} fill={SAND} />
        <circle cx="54" cy="50" r="1.6" {...L} fill={SAND} />
      </svg>
    )
  }
  if (type === 'tasks') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <rect x="18" y="18" width="44" height="44" rx="4" {...L} fill={CREAM} />
        <path d="M18 28h44" {...L} />
        <path d="M26 24v4M34 24v4" {...L} />
        <path d="M28 38l5 5 9-10" {...L} />
        <path d="M28 50l5 5 9-10" {...L} />
        <path d="M52 40h8" {...L} />
      </svg>
    )
  }
  if (type === 'budget') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <path d="M18 22h34v36H22c-4 0-6-2-6-6V22z" {...L} fill={CREAM} />
        <path d="M18 22c2-6 8-10 16-10 8 0 14 4 16 10" {...L} />
        <path d="M40 22h22v30c0 3-2 5-5 5" {...L} />
        <circle cx="40" cy="42" r="7" {...L} fill={SAND} />
        <path d="M40 36v12M36 46h8" {...L} />
        <path d="M56 30l2-4 2 4" {...L} fill={BLUSH} />
      </svg>
    )
  }
  if (type === 'travel') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <path d="M18 26h44l-6 30H24z" {...L} fill={SAGE} />
        <path d="M26 26l3-8h22l3 8" {...L} fill={CREAM} />
        <path d="M34 56l-3 8h18l-3-8" {...L} />
        <path d="M40 26v30" {...L} />
        <path d="M40 38c8-4 14 2 18 6M40 38c-8-4-14 2-18 6" {...L} />
        <circle cx="58" cy="18" r="4" {...L} fill={BLUSH} />
        <path d="M58 14v8M54 18h8" {...L} />
      </svg>
    )
  }
  if (type === 'ai') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <circle cx="40" cy="34" r="16" {...L} fill={CREAM} />
        <path d="M28 62c2-6 6-9 12-9s10 3 12 9" {...L} fill={SAND} />
        <circle cx="34" cy="32" r="1.8" {...L} fill={STROKE} />
        <circle cx="46" cy="32" r="1.8" {...L} fill={STROKE} />
        <path d="M36 40c2 2 6 2 8 0" {...L} />
        <path d="M60 14l1.4 3 3 1.4-3 1.4L60 23l-1.4-3.2-3-1.4 3-1.4z" {...L} fill={BLUSH} />
        <path d="M18 16l1 2.2 2.2 1-2.2 1L18 22l-1-2.2-2.2-1 2.2-1z" {...L} fill={BLUSH} />
      </svg>
    )
  }
  if (type === 'calendar') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <rect x="16" y="18" width="48" height="46" rx="4" {...L} fill={CREAM} />
        <path d="M16 30h48" {...L} />
        <path d="M28 12v10M52 12v10" {...L} />
        <path d="M24 40l6 6 10-12" {...L} />
        <circle cx="52" cy="42" r="3" {...L} fill={BLUSH} />
        <path d="M46 54h12" {...L} />
      </svg>
    )
  }
  if (type === 'envelope') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <rect x="14" y="24" width="52" height="36" rx="3" {...L} fill={CREAM} />
        <path d="M16 27l24 18 24-18" {...L} />
        <path d="M28 52h24" {...L} />
        <path d="M20 60l4-8" {...L} />
        <path d="M60 60l-4-8" {...L} />
        <path d="M40 16v6" {...L} />
        <circle cx="40" cy="13" r="2" {...L} fill={BLUSH} />
      </svg>
    )
  }
  if (type === 'photo') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <rect x="18" y="16" width="44" height="48" rx="3" {...L} fill={CREAM} />
        <path d="M18 52l12-12 10 8 8-8 14 12" {...L} />
        <circle cx="32" cy="30" r="5" {...L} fill={BLUSH} />
        <path d="M62 12v6M59 15h6" {...L} />
        <path d="M18 12v6M15 15h6" {...L} />
      </svg>
    )
  }
  if (type === 'hearts') {
    return (
      <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
        <path
          d="M27 54C16 45 12 40 12 33c0-5 4-9 9-9 3.4 0 6.2 1.8 6.2 4.6 0-2.8 2.8-4.6 6.2-4.6 5 0 9 4 9 9 0 7-4 12-15.4 21z"
          {...L}
          fill={CREAM}
        />
        <path
          d="M55 54C44 45 40 40 40 33c0-5 4-9 9-9 3.4 0 6.2 1.8 6.2 4.6 0-2.8 2.8-4.6 6.2-4.6 5 0 9 4 9 9 0 7-4 12-15.4 21z"
          {...L}
          fill={BLUSH}
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 80 80" className="empty-illu" aria-hidden>
      <path
        d="M40 62C24 50 16 43 16 33c0-6 5-11 11-11 4 0 7 2 9 5l4 6 4-6c2-3 5-5 9-5 6 0 11 5 11 11 0 10-8 17-24 29z"
        {...L}
        fill={BLUSH}
      />
      <path d="M58 18l1.4 3.2 3.2 1.4-3.2 1.4L58 27l-1.4-3-3.2-1.4 3.2-1.4z" {...L} fill={SAND} />
      <path d="M22 22l1.2 2.8L26 26l-2.8 1.2L22 30l-1.2-2.8L18 26l2.8-1.2z" {...L} fill={SAND} />
    </svg>
  )
}
