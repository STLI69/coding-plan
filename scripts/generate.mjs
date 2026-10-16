#!/usr/bin/env node
/**
 * 从 models.yml 生成 cordis.patch.yml。
 *   node scripts/generate.mjs          写盘
 *   node scripts/generate.mjs --check  只比对，不一致则退出 1
 *
 * renderPatch 是纯函数并对外导出，测试直接 import 它 —— 不 spawn 子进程。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { load } from 'js-yaml'

export const PKG_NAME = '@dsh-ark-agent/coding-plan'

/** 渲染一个模型的 YAML 片段（缩进与手工维护的历史格式一致）。 */
function renderModel(m, efforts) {
  const lines = []
  lines.push(`          - id: ${m.id}`)
  lines.push(`            name: ${m.name}`)
  lines.push(`            contextWindow: ${m.contextWindow}`)
  lines.push(`            maxTokens: ${m.maxTokens}`)
  lines.push('            input:')
  for (const modality of m.input) lines.push(`              - ${modality}`)
  lines.push('            reasoningEfforts:')
  for (const [level, wire] of Object.entries(efforts)) {
    lines.push(wire === null ? `              ${level}:` : `              ${level}: ${wire}`)
  }
  return lines.join('\n')
}

/**
 * 把一份 models.yml 文档渲染成 cordis.patch.yml 的完整文本。
 * @param doc models.yml 解析结果
 * @returns 生成的 patch 文本（末尾带换行）
 */
export function renderPatch(doc) {
  const r = doc.route
  const out = []
  out.push('# 本文件由 scripts/generate.mjs 从 models.yml 生成 —— 不要手改。')
  out.push('# 改模型请改 models.yml，然后跑 `npm run generate`。')
  if (doc.measuredAt) out.push(`# 元数据实测日期：${doc.measuredAt}（scripts/probe.mjs）`)
  out.push('')
  out.push('# 1) 自己的空壳行：让本包出现在「设置 → 插件 → 插件列表」')
  out.push('- insert:')
  out.push(`    - id: '${PKG_NAME}'`)
  out.push(`      name: '${PKG_NAME}'`)
  out.push('')
  out.push('# 2) 目标行覆盖：同插件 insert 第二行必然失败，覆盖是唯一可行的注入方式')
  out.push('#    （原因见 README「为什么只有一个 patch」）')
  out.push('- id: llm-pi-ai')
  out.push("  name: '@deepseek-ai/dsh-llm-pi-ai'")
  out.push('  config:')
  out.push('    providers:')
  out.push(`      ${r.id}:`)
  out.push(`        displayName: ${r.displayName}`)
  out.push(`        apiKeyEnv: ${r.apiKeyEnv}`)
  out.push(`        api: ${r.api}`)
  out.push(`        baseURL: ${r.baseURL}`)
  out.push('        models:')
  for (const m of doc.models) {
    out.push(renderModel(m, m.reasoningEfforts ?? doc.defaultReasoningEfforts))
  }
  return out.join('\n') + '\n'
}

/** 读 models.yml 并渲染。 */
export function renderFromSource(root) {
  return renderPatch(load(readFileSync(join(root, 'models.yml'), 'utf8')))
}

/* ── CLI（Node 22 兼容的主模块判断：import.meta.main 要 Node 24+）── */
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const target = join(root, 'cordis.patch.yml')
  const next = renderFromSource(root)

  if (process.argv.includes('--check')) {
    let current = ''
    try {
      current = readFileSync(target, 'utf8')
    } catch {
      console.error('cordis.patch.yml 不存在 —— 先跑 `npm run generate`')
      process.exit(1)
    }
    if (current !== next) {
      console.error('cordis.patch.yml 与 models.yml 不同步 —— 跑 `npm run generate`')
      process.exit(1)
    }
    console.log('cordis.patch.yml is in sync with models.yml')
  } else {
    writeFileSync(target, next)
    console.log('wrote cordis.patch.yml')
  }
}
