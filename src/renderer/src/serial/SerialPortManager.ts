import type { ConnectionState, PortConfig } from './types'

export interface SerialEvents {
  /** 收到数据（原始字节） */
  onData(data: Uint8Array): void
  /** 连接状态变化 */
  onStateChange(state: ConnectionState): void
  /** 断开（含主动关闭与设备拔出），reason 为可选原因 */
  onDisconnect(reason?: string): void
}

/**
 * SerialPortManager：对 navigator.serial 的封装。
 * 管理端口选择、打开/关闭、读取循环（reader cancel + releaseLock）、
 * 写入（writer releaseLock）以及设备拔出监听。
 */
export class SerialPortManager {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private closing = false
  private disconnectListener: (() => void) | null = null

  constructor(private events: SerialEvents) {}

  get currentPort(): SerialPort | null {
    return this.port
  }

  /** 弹出系统选择器，让用户选择一个串口 */
  async requestPort(): Promise<void> {
    const port = await navigator.serial.requestPort()
    this.port = port
  }

  /** 获取已授权端口列表 */
  async getAuthorizedPorts(): Promise<SerialPort[]> {
    return navigator.serial.getPorts()
  }

  setPort(port: SerialPort | null): void {
    this.port = port
  }

  async open(config: PortConfig): Promise<void> {
    if (!this.port) throw new Error('尚未选择串口')
    this.closing = false
    this.events.onStateChange('connecting')
    try {
      await this.port.open({
        baudRate: config.baudRate,
        dataBits: config.dataBits,
        stopBits: config.stopBits,
        parity: config.parity,
        flowControl: config.flowControl,
        bufferSize: 16 * 1024,
      })
    } catch (err) {
      this.events.onStateChange('disconnected')
      throw this.describeOpenError(err)
    }

    // 设备拔出监听
    this.disconnectListener = () => {
      if (!this.closing) {
        void this.teardown()
        this.events.onDisconnect('设备已断开（可能被拔出）')
      }
    }
    this.port.addEventListener('disconnect', this.disconnectListener)
    this.events.onStateChange('connected')
    void this.readLoop()
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return
    this.reader = this.port.readable.getReader()
    try {
      for (;;) {
        const { value, done } = await this.reader.read()
        if (done) break
        if (value && value.length > 0) this.events.onData(value)
      }
    } catch {
      // 读取错误：端口被拔出或已关闭，走断开流程
      if (!this.closing) {
        void this.teardown()
        this.events.onDisconnect('串口读取失败，连接已断开')
        return
      }
    } finally {
      this.reader?.releaseLock()
      this.reader = null
    }
    // 正常结束（done）：若并非主动关闭，也视为断开
    if (!this.closing) {
      void this.teardown()
      this.events.onDisconnect('串口连接已结束')
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port?.writable) throw new Error('串口未连接')
    const writer = this.port.writable.getWriter()
    try {
      await writer.write(data)
    } finally {
      writer.releaseLock()
    }
  }

  async close(): Promise<void> {
    await this.teardown()
  }

  /** 关闭资源：cancel reader → releaseLock → close port，幂等 */
  private async teardown(): Promise<void> {
    if (this.closing) return
    this.closing = true
    const port = this.port
    if (this.disconnectListener && port) {
      port.removeEventListener('disconnect', this.disconnectListener)
      this.disconnectListener = null
    }
    try {
      this.reader?.cancel()
    } catch {
      /* ignore */
    }
    // 等待读取循环释放锁
    if (this.reader) {
      await new Promise((r) => setTimeout(r, 50))
    }
    if (port) {
      try {
        await port.close()
      } catch {
        /* ignore */
      }
    }
    this.events.onStateChange('disconnected')
  }

  /** 打开失败时给出友好中文提示 */
  private describeOpenError(err: unknown): Error {
    const msg = err instanceof Error ? err.message : String(err)
    if (/Access denied|denied/i.test(msg)) {
      return new Error(`打开失败：端口被占用或无权限（${msg}）`)
    }
    if (/NetworkError|Failed to open|open/i.test(msg)) {
      return new Error(`打开失败：${msg}。常见原因：端口被其他程序占用、设备已拔出或不支持该波特率`)
    }
    return new Error(`打开失败：${msg}`)
  }
}
