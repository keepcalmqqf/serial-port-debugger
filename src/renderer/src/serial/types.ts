export const BAUD_RATES = [
  300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400,
  57600, 115200, 230400, 460800, 921600, 1000000, 2000000,
]

export type Parity = 'none' | 'even' | 'odd'
export type FlowControl = 'none' | 'hardware'
export type NewlineSuffix = 'none' | 'LF' | 'CR' | 'CRLF'

export const NEWLINE_SUFFIX: Record<NewlineSuffix, string> = {
  none: '',
  LF: '\n',
  CR: '\r',
  CRLF: '\r\n',
}

export interface PortConfig {
  baudRate: number
  dataBits: number
  stopBits: number
  parity: Parity
  flowControl: FlowControl
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

/** 串口管理器统一接口：桌面端（serialport）与 Web 端（Web Serial API）各有一份实现 */
export interface SerialManager {
  open(config: PortConfig): Promise<void>
  write(data: Uint8Array): Promise<void>
  close(): Promise<void>
  /** 仅桌面端实现：设置目标端口路径 */
  setPortPath?(path: string | null): void
}

export const defaultPortConfig: PortConfig = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
}
