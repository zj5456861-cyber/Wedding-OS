// 统一线稿图标系统：细线 + 低饱和点缀，与 Illustrations.tsx 同一视觉语言
// 禁止使用 emoji 承担图标职责

export type IconName =
  | 'home'
  | 'timeline'
  | 'tasks'
  | 'budget'
  | 'us'
  | 'ai'
  | 'summary'
  | 'next'
  | 'check'
  | 'list'
  | 'calendar'
  | 'send'
  | 'edit'
  | 'trash'
  | 'add'
  | 'close'
  | 'chevron'
  | 'heart'
  | 'spark'

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName
  size?: number
  className?: string
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  switch (name) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M4 11.2 12 4.6l8 6.6" />
          <path d="M6.2 9.8V19h11.6V9.8" />
          <path d="M10 19v-4.6h4V19" />
        </svg>
      )
    case 'timeline':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.6V12l3.2 2.2" />
        </svg>
      )
    case 'tasks':
      return (
        <svg {...props}>
          <rect x="3.6" y="6" width="16.8" height="12" rx="1" />
          <path d="M4.8 7.4 12 12.8l7.2-5.4" />
        </svg>
      )
    case 'budget':
      return (
        <svg {...props}>
          <circle cx="12" cy="9.5" r="4.6" />
          <ellipse cx="12" cy="14" rx="4.6" ry="1.9" />
          <path d="M12 4.9v9.1M9.7 8.4h4.6" />
        </svg>
      )
    case 'us':
      return (
        <svg {...props}>
          {/* 两颗交叠戒指 + 线稿爱心：关系与陪伴 */}
          <circle cx="9.6" cy="13" r="5.4" />
          <circle cx="14.4" cy="13" r="5.4" />
          <path d="M12 7.6l-.9-.8c-.9-.8-2.3-.4-2.3.9 0 1 .9 1.8 2.3 3l.9-.7.9.7c1.4-1.2 2.3-2 2.3-3 0-1.3-1.4-1.7-2.3-.9z" />
        </svg>
      )
    case 'ai':
      return (
        <svg {...props}>
          <path d="M12 3.4l1.7 4.3 4.3 1.7-4.3 1.7L12 15.4l-1.7-4.3-4.3-1.7 4.3-1.7z" />
          <path d="M18.6 16.8l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" opacity="0.7" />
          <path d="M5.6 4.6l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" opacity="0.7" />
        </svg>
      )
    case 'summary':
      return (
        <svg {...props}>
          <path d="M4.5 20h15" />
          <path d="M6.5 20v-6M12 20V5.5M17.5 20v-9" />
        </svg>
      )
    case 'next':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M15 9l-2.2 5.4L7.6 15l2.2-5.4z" />
        </svg>
      )
    case 'check':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.2" />
          <path d="M15.6 15.6 20 20" />
          <path d="M8.6 11l1.7 1.7 3.1-3.4" />
        </svg>
      )
    case 'list':
      return (
        <svg {...props}>
          <path d="M9 7h11M9 12h11M9 17h11" />
          <path d="M4.4 6.4l.8.8 1.6-1.8M4.4 11.4l.8.8 1.6-1.8M4.4 16.4l.8.8 1.6-1.8" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="4" y="5.6" width="16" height="14.8" rx="1" />
          <path d="M4 10h16M8.2 3.6v4M15.8 3.6v4" />
        </svg>
      )
    case 'send':
      return (
        <svg {...props}>
          <path d="M4 12h14M12.6 6.4 18.2 12l-5.6 5.6" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...props}>
          <path d="M5 19h4.4L18.9 9.5a2 2 0 0 0-2.8-2.8L6.6 17.1z" />
          <path d="M14.2 8.6l2.8 2.8" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...props}>
          <path d="M5.5 7h13M9.5 7V4.8h5V7" />
          <path d="M7 7l1 13h8l1-13" />
        </svg>
      )
    case 'add':
      return (
        <svg {...props}>
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      )
    case 'close':
      return (
        <svg {...props}>
          <path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      )
    case 'heart':
      return (
        <svg {...props}>
          <path d="M12 19.4C6.8 15.2 4.4 12.2 4.4 9.4c0-2.4 1.8-4.2 4.2-4.2 1.6 0 2.8.8 3.4 2.1.6-1.3 1.8-2.1 3.4-2.1 2.4 0 4.2 1.8 4.2 4.2 0 2.8-2.4 5.8-7.6 10z" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...props}>
          <path d="M12 3.6l1.6 4.2 4.2 1.6-4.2 1.6L12 15.2l-1.6-4.2-4.2-1.6 4.2-1.6z" />
        </svg>
      )
    default:
      return <svg {...props} />
  }
}
