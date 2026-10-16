import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'

const doc = load(readFileSync(new URL('../models.yml', import.meta.url), 'utf8'))

test('route 必备字段', () => {
  assert.equal(doc.route.id, 'ark-coding-plan-cn')
  assert.equal(doc.route.apiKeyEnv, 'ARK_CODING_PLAN_CN_API_KEY')
  assert.equal(doc.route.api, 'anthropic-messages')
  assert.ok(doc.route.baseURL.startsWith('https://'))
})

test('baseURL 不以 /v1 结尾（pi-ai 自己会拼）', () => {
  assert.ok(!doc.route.baseURL.endsWith('/v1'), 'baseURL 不能带 /v1')
})

test('恰好 15 个模型，id 唯一且非空', () => {
  const ids = doc.models.map((m) => m.id)
  assert.equal(ids.length, 15)
  assert.equal(new Set(ids).size, 15)
  for (const id of ids) assert.ok(typeof id === 'string' && id.length > 0)
})

test('每个模型元数据合法', () => {
  for (const m of doc.models) {
    assert.ok(typeof m.name === 'string' && m.name.length > 0, `${m.id} name`)
    assert.ok(Number.isInteger(m.contextWindow) && m.contextWindow > 0, `${m.id} contextWindow`)
    assert.ok(Number.isInteger(m.maxTokens) && m.maxTokens > 0, `${m.id} maxTokens`)
    assert.ok(Array.isArray(m.input) && m.input.length > 0, `${m.id} input`)
    for (const modality of m.input) {
      assert.ok(['text', 'image'].includes(modality), `${m.id} input ${modality}`)
    }
  }
})
