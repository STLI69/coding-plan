import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'

const patch = load(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8'))
const models = patch[1].config.providers['ark-coding-plan-cn'].models

test('结构：恰好一条 insert + 一条 llm-pi-ai 覆盖', () => {
  assert.equal(patch.length, 2)
  assert.ok(Array.isArray(patch[0].insert))
  assert.equal(patch[0].insert.length, 1)
  assert.equal(patch[1].id, 'llm-pi-ai')
})

test('空壳行的 name 必须等于包名', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(patch[0].insert[0].name, pkg.name)
})

test('llm-pi-ai 覆盖带 name 断言且指向官方插件', () => {
  assert.equal(patch[1].name, '@deepseek-ai/dsh-llm-pi-ai')
})

test('每个模型都有 reasoningEfforts，且 glm-5.3* 没有 off', () => {
  for (const m of models) assert.ok(m.reasoningEfforts, `${m.id} 缺 reasoningEfforts`)
  for (const id of ['glm-5.3', 'glm-5.3-flash']) {
    const m = models.find((x) => x.id === id)
    assert.ok(m, `${id} 必须存在`)
    assert.ok(!('off' in m.reasoningEfforts), `${id} 不能有 off（关思考会 HTTP 400）`)
  }
})

test('其余模型都有 off/low/high/max 四档', () => {
  for (const m of models) {
    if (m.id === 'glm-5.3' || m.id === 'glm-5.3-flash') continue
    assert.deepEqual(Object.keys(m.reasoningEfforts), ['off', 'low', 'high', 'max'], m.id)
  }
})

test('off 是空值，low/high/max 有 wire 值', () => {
  for (const m of models) {
    const e = m.reasoningEfforts
    if ('off' in e) assert.equal(e.off, null)
    assert.equal(e.low, 'low')
    assert.equal(e.high, 'high')
    assert.equal(e.max, 'max')
  }
})

test('baseURL 不带 /v1', () => {
  const r = patch[1].config.providers['ark-coding-plan-cn']
  assert.ok(!r.baseURL.endsWith('/v1'))
})
