import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('..', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))

test('files 里每个文件都真实存在', () => {
  for (const f of pkg.files) {
    assert.ok(
      existsSync(fileURLToPath(new URL(f, root))),
      `package.json.files 声明了 ${f}，但文件不存在`,
    )
  }
})

test('main 指向的文件在 files 里（官方就是漏了这一点）', () => {
  const main = pkg.main.replace(/^\.\//, '')
  assert.ok(pkg.files.includes(main), `main (${main}) 必须随包发布`)
})

test('空壳插件导出 default { name, apply }', async () => {
  const mod = await import(new URL('index.js', root))
  const plugin = mod.default
  assert.ok(plugin, 'index.js 必须有 default 导出')
  assert.equal(plugin.name, pkg.name)
  assert.equal(typeof plugin.apply, 'function')
})
