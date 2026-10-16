#!/usr/bin/env node
/**
 * 把本包的 provider 合并进用户已有的 profile patch，永不丢路由。
 *
 * 为什么是「文本级手术」而不是 YAML 往返：profile 的 cordis.patch.yml 里有大量
 * 说明性注释，YAML 往返会把它们全部抹掉。
 *
 *   node scripts/merge.mjs <path-to-cordis.patch.yml>          # 只打印到 stdout
 *   node scripts/merge.mjs <path-to-cordis.patch.yml> --write  # 落盘（先备份 .bak-merge-<ts>）
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { load } from 'js-yaml'

const ANCHOR = /^- id:\s*llm-pi-ai\s*$/
const PROVIDERS = /^(\s+)providers:\s*$/
const ENTRY = /^\s*- /

/** 生成一段 6 空格缩进的 provider 片段（与 profile patch 常见缩进一致）。 */
export function renderProvider(name, body) {
  const lines = [`      ${name}:`]
  for (const [k, v] of Object.entries(body)) {
    lines.push(v !== null && typeof v === 'object' ? `        ${k}: ${JSON.stringify(v)}` : `        ${k}: ${v}`)
  }
  return lines.join('\n') + '\n'
}

/**
 * 把 providers 并进 patch 文本。已存在的键保留用户原值（不静默覆盖）。
 * @param {string} text 现有 patch 文本
 * @param {Record<string, object>} providers 要加入的 provider（键 -> 片段对象）
 * @returns {string} 合并后的文本
 */
export function mergeProviders(text, providers) {
  const lines = text.split('\n')
  const anchorIdx = lines.findIndex((l) => ANCHOR.test(l))

  if (anchorIdx === -1) {
    const extra = ['- id: llm-pi-ai', "  name: '@deepseek-ai/dsh-llm-pi-ai'", '  config:', '    providers:']
    for (const [name, body] of Object.entries(providers)) {
      extra.push(renderProvider(name, body).trimEnd())
    }
    const trimmed = text.replace(/\s*$/, '')
    const base = trimmed === '' || trimmed === '[]' ? '' : trimmed + '\n'
    return base + extra.join('\n') + '\n'
  }

  let providersIdx = -1
  for (let i = anchorIdx + 1; i < lines.length; i += 1) {
    if (ENTRY.test(lines[i])) break
    if (PROVIDERS.test(lines[i])) { providersIdx = i; break }
  }
  if (providersIdx === -1) throw new Error('llm-pi-ai 行里没有 providers: 段，请手工合并')

  const existing = new Set()
  for (let i = providersIdx + 1; i < lines.length; i += 1) {
    if (ENTRY.test(lines[i])) break
    const m = /^ {6}([A-Za-z0-9_.-]+):\s*$/.exec(lines[i])
    if (m) existing.add(m[1])
  }

  const additions = []
  for (const [name, body] of Object.entries(providers)) {
    if (existing.has(name)) {
      console.error(`! 已存在 provider "${name}" —— 保留你的原值，未覆盖`)
      continue
    }
    additions.push(renderProvider(name, body).trimEnd())
  }
  if (additions.length === 0) return text

  return [...lines.slice(0, providersIdx + 1), ...additions.join('\n').split('\n'), ...lines.slice(providersIdx + 1)].join('\n')
}

/* ── CLI（Node 22 兼容的主模块判断）── */
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const args = process.argv.slice(2)
  const WRITE = args.includes('--write')
  let target = args.find((a) => !a.startsWith('--'))

  if (!target) {
    const home = process.env.DSH_HOME || join(homedir(), '.dsh')
    const profilesDir = join(home, 'profiles')
    if (!existsSync(profilesDir)) {
      console.error('找不到 profiles 目录，请显式给出 cordis.patch.yml 路径')
      process.exit(2)
    }
    const candidates = readdirSync(profilesDir)
      .map((p) => join(profilesDir, p, 'cordis.patch.yml'))
      .filter(existsSync)
    if (candidates.length !== 1) {
      console.error(`匹配到 ${candidates.length} 个 profile，拒绝猜，请显式指定：`)
      for (const c of candidates) console.error('  ' + c)
      process.exit(2)
    }
    target = candidates[0]
  }

  const patchText = readFileSync(target, 'utf8')
  const generated = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'cordis.patch.yml'), 'utf8')
  const ourProviders = load(generated)[1].config.providers

  const merged = mergeProviders(patchText, ourProviders)

  // 安全校验：合并后必须能 parse，且原有 provider 键一个都不能丢
  load(merged)
  const beforeEntry = load(patchText).find?.((e) => e && e.id === 'llm-pi-ai')
  const afterEntry = load(merged).find((e) => e && e.id === 'llm-pi-ai')
  const beforeKeys = Object.keys(beforeEntry?.config?.providers ?? {})
  for (const k of beforeKeys) {
    if (!(k in (afterEntry?.config?.providers ?? {}))) {
      console.error(`拒绝写盘：原有 provider "${k}" 会丢失`)
      process.exit(3)
    }
  }

  if (WRITE) {
    const backup = `${target}.bak-merge-${Date.now()}`
    copyFileSync(target, backup)
    writeFileSync(target, merged)
    console.error(`已写入 ${target}（备份 ${backup}）`)
  } else {
    process.stdout.write(merged)
  }
}
