#!/usr/bin/env node
/**
 * 实测 Coding Plan 端点：
 *   1) 模型是否可达
 *   2) maxTokens 上限（对候选档位逐档试探，记录最高被接受值）
 *   3) 是否接受图片输入
 *
 * contextWindow 故意不测：验证它要发超长 prompt，成本不可控。
 *
 *   node scripts/probe.mjs                  # 探测 models.yml 里的模型
 *   node scripts/probe.mjs --watchlist      # 探测 watchlist.yml 的候选 id
 *   node scripts/probe.mjs --write          # 把 maxTokens/image 结果写回 models.yml
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { deflateSync } from 'node:zlib'
import { load } from 'js-yaml'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CEILINGS = [65536, 131072, 262144, 393216]

/* ── 生成一张真实尺寸的测试图 ──
 * 不能用 1×1：很多端点会以「尺寸过小」拒绝，产生「不支持图片」的假阴性。
 */
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

/** 生成 size×size 的纯色 PNG（默认 64×64 红色）。 */
export function solidPng(size = 64) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0 // filter: none
    for (let x = 0; x < size; x += 1) {
      const o = y * stride + 1 + x * 4
      raw[o] = 220
      raw[o + 1] = 40
      raw[o + 2] = 40
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const TEST_PNG = solidPng(64).toString('base64')

/** 从错误响应里取一句话，用于区分「不支持图片」与「图太小」等测试假象。 */
function reason(text) {
  try {
    const j = JSON.parse(text)
    return String(j.error?.message ?? j.message ?? text).slice(0, 160)
  } catch {
    return String(text).slice(0, 160)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(base, key, model, maxTokens, withImage) {
  const content = withImage
    ? [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: TEST_PNG } },
        { type: 'text', text: 'hi' },
      ]
    : [{ type: 'text', text: 'hi' }]
  // 429 退避重试：drift workflow 会连续打很多请求，限流必须当作暂时状态而不是「模型下架」
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
    })
    const text = await res.text()
    if (res.status === 429 && attempt < 4) {
      await sleep(2000 * (attempt + 1))
      continue
    }
    return { status: res.status, text }
  }
}

/** 逐档试探，返回最高被接受的档位。 */
async function probeCeiling(base, key, model) {
  let best = null
  for (const c of CEILINGS) {
    const { status } = await call(base, key, model, c, false)
    if (status === 200) best = c
    else if (status === 400) break
  }
  return best
}

/**
 * 文本级手术：只改每个模型的 maxTokens / input 行与顶层 measuredAt。
 * 不能用 YAML 往返 —— 那会把 models.yml 里的说明性注释全部抹掉。
 * @param {string} text models.yml 原文
 * @param {Array<object>} results probe 结果
 * @param {string} today YYYY-MM-DD
 * @returns {string} 更新后的文本
 */
export function applyMeasured(text, results, today) {
  const lines = text.split('\n')
  for (const r of results) {
    if (!r.reachable) continue
    const start = lines.findIndex((l) => l === `  - id: ${r.id}`)
    if (start === -1) continue
    let end = lines.length
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^ {2}- id: /.test(lines[i])) {
        end = i
        break
      }
    }
    for (let i = start; i < end; i += 1) {
      if (r.ceiling && /^ {4}maxTokens: \d+$/.test(lines[i])) {
        lines[i] = `    maxTokens: ${r.ceiling}`
      }
      if (r.image !== null && /^ {4}input: \[/.test(lines[i])) {
        lines[i] = `    input: [${r.image ? 'text, image' : 'text'}]`
      }
    }
  }
  const idx = lines.findIndex((l) => /^measuredAt: /.test(l))
  if (idx !== -1) {
    lines[idx] = `measuredAt: '${today}'`
  } else {
    const anchor = lines.findIndex((l) => l === 'models:')
    if (anchor !== -1) {
      lines.splice(
        anchor,
        0,
        '# 元数据实测日期（由 scripts/probe.mjs --write 写入）。必须加引号：',
        '# 不加引号 YAML 会把它解析成 Date 对象，字符串化会带时区，生成物就会随机器变化。',
        `measuredAt: '${today}'`,
        '',
      )
    }
  }
  return lines.join('\n')
}

/**
 * 跑一次探测。
 * @param {{watchlist?: boolean, write?: boolean, root?: string}} opts
 * @returns {Promise<Array<object>>} 每个 id 的结果
 */
export async function runProbe(opts = {}) {
  const root = opts.root ?? ROOT
  const KEY = process.env.ARK_CODING_PLAN_CN_API_KEY
  if (!KEY) {
    console.error('缺少 ARK_CODING_PLAN_CN_API_KEY —— 本脚本必须用真实 key 才有意义')
    process.exit(2)
  }

  const doc = load(readFileSync(join(root, 'models.yml'), 'utf8'))
  const base = doc.route.baseURL
  const list = opts.watchlist
    ? load(readFileSync(join(root, 'watchlist.yml'), 'utf8')).candidates
    : doc.models.map((m) => m.id)

  const results = []
  for (const id of list) {
    const { status, text } = await call(base, KEY, id, 16, false)
    if (status === 401 || status === 403) {
      console.error(`认证失败（HTTP ${status}）—— key 无效或没有 Coding Plan 权限，与「模型下架」不是一回事`)
      process.exit(4)
    }
    const reachable = status === 200
    const retired = !reachable && /model|not found|not exist|invalid/i.test(text)
    let ceiling = null
    let image = null
    let imageReason = null
    if (reachable && !opts.watchlist) {
      ceiling = await probeCeiling(base, KEY, id)
      const img = await call(base, KEY, id, 16, true)
      image = img.status === 200
      if (!image) imageReason = reason(img.text)
    }
    results.push({ id, reachable, retired, ceiling, image, imageReason, status })
    console.log(
      `${reachable ? 'ok  ' : retired ? 'GONE' : 'ERR '} ${id} ceiling=${ceiling ?? '-'} image=${image ?? '-'} (http ${status})` +
        (imageReason ? `\n       image-reject: ${imageReason}` : ''),
    )
    await sleep(300)
  }

  if (opts.write && !opts.watchlist) {
    const today = new Date().toISOString().slice(0, 10)
    const src = readFileSync(join(root, 'models.yml'), 'utf8')
    writeFileSync(join(root, 'models.yml'), applyMeasured(src, results, today))
    console.log('models.yml 已更新（注释保留）—— 记得跑 `npm run generate` 并复核 diff')
  }

  return results
}

/* ── CLI（Node 22 兼容的主模块判断）── */
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const results = await runProbe({
    watchlist: process.argv.includes('--watchlist'),
    write: process.argv.includes('--write'),
  })
  const gone = results.filter((r) => r.retired).map((r) => r.id)
  if (gone.length) {
    console.error(`下架/改名：${gone.join(', ')}`)
    process.exit(1)
  }
}
