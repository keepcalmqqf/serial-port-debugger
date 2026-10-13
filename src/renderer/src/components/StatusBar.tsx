import type { ConnectionState } from '../serial/types'

interface Props {
  state: ConnectionState
  rxCount: number
  txCount: number
  portLabel: string
}

const STATE_TEXT: Record<ConnectionState, string> = {
  disconnected: '未连接',
  connecting: '连接中…',
  connected: '已连接',
}

export default function StatusBar({ state, rxCount, txCount, portLabel }: Props) {
  return (
    <footer className="status-bar">
      <span className={`status-badge status-${state}`}>
        <i className="status-dot" />
        {STATE_TEXT[state]}
      </span>
      {portLabel && <span className="status-bar-item">{portLabel}</span>}
      <span className="status-bar-item">RX: {rxCount} B</span>
      <span className="status-bar-item">TX: {txCount} B</span>
      <span className="status-bar-spacer" />
      <span className="status-bar-item status-bar-dim">
        {typeof window !== 'undefined' && window.serialNative
          ? '原生串口 · 数据不经过任何服务器'
          : 'Web Serial API · 数据不经过任何服务器'}
      </span>
    </footer>
  )
}
