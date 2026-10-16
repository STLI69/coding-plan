import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderFromSource } from '../scripts/generate.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const committed = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

test('提交的 cordis.patch.yml 与 models.yml 完全一致', () => {
  assert.equal(committed, renderFromSource(root), '生成物与源不同步 —— 跑 `npm run generate`')
})

test('渲染是幂等的', () => {
  assert.equal(renderFromSource(root), renderFromSource(root))
})

test('渲染结果含 15 个模型', () => {
  const hits = committed.match(/^ {10}- id: /gm) ?? []
  assert.equal(hits.length, 15)
})

test('实测日期必须是 ISO 日期，不能带时区（回归：YAML 会把裸日期解析成 Date）', () => {
  const line = committed.split('\n').find((l) => l.includes('元数据实测日期'))
  assert.ok(line, '生成物必须带实测日期注释')
  assert.match(line, /：\d{4}-\d{2}-\d{2}（/, `日期必须是 YYYY-MM-DD，实际：${line}`)
  assert.ok(!/GMT|Standard Time|标准时间/.test(line), `日期不能带时区信息，实际：${line}`)
})

test('渲染结果与运行机器时区无关', () => {
  const original = process.env.TZ
  try {
    process.env.TZ = 'UTC'
    const utc = renderFromSource(root)
    process.env.TZ = 'Asia/Shanghai'
    const cst = renderFromSource(root)
    assert.equal(utc, cst, '不同时区渲染结果必须一致')
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})
