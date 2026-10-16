import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from 'js-yaml'
import { mergeProviders } from '../scripts/merge.mjs'

const USER_PATCH = `# 我的注释：这一段很重要
- id: llm-pi-ai
  name: '@deepseek-ai/dsh-llm-pi-ai'
  config:
    providers:
      my-own-route:
        displayName: My Own
        apiKeyEnv: MY_KEY
        api: anthropic-messages
        baseURL: https://example.com/api
        models:
          - id: my-model
            name: My Model
            contextWindow: 128000
            maxTokens: 4096
            input:
              - text
`

const OUR = { 'ark-coding-plan-cn': { displayName: 'Ark Coding Plan', apiKeyEnv: 'ARK_CODING_PLAN_CN_API_KEY' } }

test('把 ark 路由并进去，且保留用户原有路由', () => {
  const out = mergeProviders(USER_PATCH, OUR)
  const providers = load(out)[0].config.providers
  assert.ok(providers['my-own-route'], '用户原有路由不能丢')
  assert.ok(providers['ark-coding-plan-cn'], 'ark 路由要加进去')
})

test('注释必须保留（不能用 YAML 往返）', () => {
  const out = mergeProviders(USER_PATCH, OUR)
  assert.match(out, /# 我的注释：这一段很重要/)
})

test('键冲突时保留用户原值', () => {
  const userWithArk = USER_PATCH.replace(
    '      my-own-route:',
    '      ark-coding-plan-cn:\n        displayName: 用户自己调过的\n        apiKeyEnv: USER_TUNED\n        api: anthropic-messages\n        baseURL: https://ark.cn-beijing.volces.com/api/coding\n        models:\n          - id: custom\n            name: Custom\n            contextWindow: 1000\n            maxTokens: 100\n            input:\n              - text\n      my-own-route:',
  )
  const out = mergeProviders(userWithArk, OUR)
  assert.equal(load(out)[0].config.providers['ark-coding-plan-cn'].displayName, '用户自己调过的')
})

test('没有 llm-pi-ai 行时，整体追加一个覆盖块', () => {
  const out = mergeProviders('[]\n', OUR)
  const doc = load(out)
  assert.equal(doc.length, 1)
  assert.equal(doc[0].id, 'llm-pi-ai')
  assert.ok(doc[0].config.providers['ark-coding-plan-cn'])
})

test('合并后仍是合法 YAML，且模型列表未被破坏', () => {
  const out = mergeProviders(USER_PATCH, OUR)
  const providers = load(out)[0].config.providers
  assert.equal(providers['my-own-route'].models.length, 1)
})
