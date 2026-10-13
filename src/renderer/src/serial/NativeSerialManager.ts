import type { PortConfig, SerialManager } from './types'
import type { SerialEvents } from './SerialPortManager'

/**
 * NativeSerialManager：桌面端实现，通过 preload 暴露的 window.serialNative
 * 调用主进程的 serialport。接口与 Web Serial 的 SerialPortManager 一致。
 */
export class NativeSerialManager implements SerialManager {
  private path: string | null = null

  constructor(private events: SerialEvents) {
    const bridge = window.serialNative
    bridge?.onData((data) => this.events.onData(data))
    // onClosed 只在意外断开（拔出 / 错误）时由主进程推送，主动 close 不触发
    bridge?.onClosed((reason) => {
      this.events.onStateChange('disconnected')
      this.events.onDisconnect(reason)
    })
  }

  setPortPath(path: string | null): void {
    this.path = path
  }

  async open(config: PortConfig): Promise<void> {
    const bridge = window.serialNative
    if (!bridge) throw new Error('桌面串口桥不可用')
    if (!this.path) throw new Error('尚未选择串口')
    this.events.onStateChange('connecting')
    const result = await bridge.open(this.path, config)
    if (!result.ok) {
      this.events.onStateChange('disconnected')
      throw new Error(describeOpenError(result.error ?? '未知错误'))
    }
    this.events.onStateChange('connected')
  }

  async write(data: Uint8Array): Promise<void> {
    const bridge = window.serialNative
    if (!bridge) throw new Error('桌面串口桥不可用')
    const result = await bridge.write(data)
    if (!result.ok) throw new Error(result.error ?? '写入失败')
  }

  async close(): Promise<void> {
    await window.serialNative?.close()
    this.events.onStateChange('disconnected')
  }
}

/** 打开失败时给出友好中文提示 */
function describeOpenError(msg: string): string {
  if (/Access denied|denied|EBUSY|busy/i.test(msg)) {
    return `打开失败：端口被占用或无权限（${msg}）`
  }
  if (/cannot open|ENOENT|no such file/i.test(msg)) {
    return `打开失败：设备不存在或已被拔出（${msg}）`
  }
  return `打开失败：${msg}`
}
