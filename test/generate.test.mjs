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
