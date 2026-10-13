import { app, BrowserWindow, ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { join } from 'path'
import { SerialPort } from 'serialport'

interface NativePortInfo {
  path: string
  label: string
}

interface SerialOpenConfig {
  baudRate: number
  dataBits: number
  stopBits: number
  parity: 'none' | 'even' | 'odd'
  flowControl: 'none' | 'hardware'
}

type IpcResult = { ok: true } | { ok: false; error: string }

let currentPort: SerialPort | null = null

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** 关闭当前端口（主动关闭不通知渲染进程） */
async function closeCurrentPort(): Promise<void> {
  const port = currentPort
  currentPort = null
  if (port?.isOpen) {
    await new Promise<void>((resolve) => {
      port.close(() => resolve())
    })
  }
}

function setupSerialHandlers(): void {
  ipcMain.handle('serial-native:list', async (): Promise<NativePortInfo[]> => {
    try {
      const ports = await SerialPort.list()
      return ports.map((p) => {
        const detail = p.manufacturer ?? p.friendlyName
        return {
          path: p.path,
          label: detail && detail !== p.path ? `${p.path} · ${detail}` : p.path
        }
      })
    } catch {
      return []
    }
  })

  ipcMain.handle('serial-native:open', async (event, path: string, config: SerialOpenConfig): Promise<IpcResult> => {
    await closeCurrentPort()
    const wc: WebContents = event.sender
    const port = new SerialPort({
      path,
      baudRate: config.baudRate,
      dataBits: config.dataBits as 5 | 6 | 7 | 8,
      stopBits: config.stopBits as 1 | 2,
      parity: config.parity,
      rtscts: config.flowControl === 'hardware',
      autoOpen: false
    })
    try {
      await new Promise<void>((resolve, reject) => {
        port.open((err) => (err ? reject(err) : resolve()))
      })
    } catch (err) {
      return { ok: false, error: errMsg(err) }
    }
    currentPort = port

    port.on('data', (data: Buffer) => {
      if (!wc.isDestroyed()) wc.send('serial-native:data', new Uint8Array(data))
    })
    const notifyClosed = (reason: string): void => {
      // 主动关闭时 currentPort 已被置空，不会走到这里
      if (currentPort !== port) return
      currentPort = null
      if (!wc.isDestroyed()) wc.send('serial-native:closed', reason)
    }
    port.on('close', () => notifyClosed('串口连接已断开（设备可能被拔出）'))
    port.on('error', (err) => notifyClosed(`串口错误：${errMsg(err)}`))
    return { ok: true }
  })

  ipcMain.handle('serial-native:write', async (_event, data: Uint8Array): Promise<IpcResult> => {
    const port = currentPort
    if (!port?.isOpen) return { ok: false, error: '串口未连接' }
    try {
      await new Promise<void>((resolve, reject) => {
        port.write(Buffer.from(data), (err) => (err ? reject(err) : resolve()))
      })
      await new Promise<void>((resolve, reject) => {
        port.drain((err) => (err ? reject(err) : resolve()))
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: errMsg(err) }
    }
  })

  ipcMain.handle('serial-native:close', async (): Promise<void> => {
    await closeCurrentPort()
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    title: '串口调试工具',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  setupSerialHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  void closeCurrentPort()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void closeCurrentPort()
})
