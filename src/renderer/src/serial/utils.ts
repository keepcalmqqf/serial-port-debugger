// 十六进制与文本转换工具

/** 将 HEX 字符串解析为字节数组。允许空格、逗号、0x 前缀，非法输入返回 null */
export function hexStringToBytes(input: string): Uint8Array | null {
  const cleaned = input.replace(/0x/gi, ' ').replace(/[,;]/g, ' ').trim()
  if (!cleaned) return new Uint8Array(0)
  const tokens = cleaned.split(/\s+/)
  const bytes = new Uint8Array(tokens.length)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!/^[0-9a-fA-F]{1,2}$/.test(token)) return null
    bytes[i] = parseInt(token, 16)
  }
  return bytes
}

/** 字节数组转为大写 HEX 字符串（每字节两位，空格分隔） */
export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0').toUpperCase()
    if (i < bytes.length - 1) out += ' '
  }
  return out
}

/** 字节数组转为可打印文本；不可打印字符显示为 \xHH 转义形式 */
export function bytesToText(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) {
    if (b === 0x0a) out += '\n'
    else if (b === 0x0d) out += '\r'
    else if (b === 0x09) out += '\t'
    else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b)
    else out += `\\x${b.toString(16).padStart(2, '0').toUpperCase()}`
  }
  return out
}

/** 下载文本文件 */
export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 当前时间的 HH:MM:SS.mmm 格式时间戳 */
export function timestamp(): string {
  const d = new Date()
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}
