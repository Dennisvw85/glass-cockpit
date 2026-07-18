import { control, type PendingPermission } from '../ws.ts'
import { ago, homeRelative } from '../format.ts'

interface Props {
  permissions: PendingPermission[]
  now: number
}

/**
 * A blocked tool call is the one thing worth interrupting the user for, so this
 * sits above everything else rather than in the feed.
 */
export function Permissions({ permissions, now }: Props) {
  if (permissions.length === 0) return null

  return (
    <div className="border-b border-accent bg-ink-raised">
      {permissions.map((p) => (
        <div key={p.id} className="px-3 py-2 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-accent text-sm">{p.toolName}</span>
              <span className="text-xs text-ink-faint truncate">
                {p.cwd ? homeRelative(p.cwd) : ''}
              </span>
              <span className="text-xs text-ink-faint tabular-nums ml-auto shrink-0">
                {ago(p.ts, now)}
              </span>
            </div>
            {p.preview && (
              <p className="text-xs text-ink-muted truncate mt-0.5">{p.preview}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => control(`/api/permissions/${p.id}/deny`, {})}
              className="px-3 min-h-[44px] rounded border border-ink-line text-ink-muted text-xs"
            >
              deny
            </button>
            <button
              onClick={() => control(`/api/permissions/${p.id}/allow`, {})}
              className="px-4 min-h-[44px] rounded border border-accent text-accent text-xs"
            >
              allow
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
