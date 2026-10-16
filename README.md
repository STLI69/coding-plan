# @dsh-ark-agent/coding-plan

火山方舟 **Ark Coding Plan** 的 provider 路由，用于 **DeepSeek Harness（DSH）**。

装完即可在模型选择器里看到 `Ark Coding Plan` 分组（15 个模型），填入你自己的 API Key 就能用。

> Volcengine Ark Coding Plan provider route for DeepSeek Harness — a configuration-only DSH bundle.

---

## 前置条件

1. 已安装 DSH（0.2.0-rc 或更新）
2. 已开通**火山方舟 Coding Plan 订阅**，并拿到 API Key
   （火山方舟控制台 → Coding Plan → 生成 API Key）

> ⚠️ **本包不含任何密钥。** 每个使用者填自己的 Key。

---

## ⚠️ 装之前先看这一条

本包**整体替换** `llm-pi-ai` 这一行的 `config`（DSH 的 patch 语义就是「整体替换、不深合并」）。

- **你从没配过 pi-ai provider** → 直接装，无影响。
- **你已经配过别的 pi-ai provider**（自定义 OpenAI 兼容路由等）→ 装之前请把它们抄下来，
  装完合并进同一份 `providers:` 字典，否则会被覆盖掉。

合并示例（`~/.dsh/profiles/<profile>/cordis.patch.yml`）：

```yaml
- id: llm-pi-ai
  name: '@deepseek-ai/dsh-llm-pi-ai'
  config:
    providers:
      ark-coding-plan-cn:   # ← 本包带来的
        # ...
      my-other-route:       # ← 你原有的，保留在这里
        # ...
```

---

## 安装

### 方式 1：插件市场（推荐）

1. 装 `dshmarket`（若还没有）：

   ```sh
   dsh plugin --profile <你的 profile> add dshmarket
   ```

2. 打开 **设置 → 插件市场**，搜索 `ark-coding-plan`，点安装。

### 方式 2：命令行（从 GitHub 装）

```sh
dsh plugin --profile <你的 profile> add github:STLI69/coding-plan
```

> 尚未发布到 npm。发布后也可以直接 `dsh plugin --profile <你的 profile> add @dsh-ark-agent/coding-plan`。

### 方式 3：本地目录（开发/离线）

在 **设置 → 插件 → 安装 bundle** 里，指向本包的绝对目录。

---

## 填入你自己的 API Key

装完后打开 **设置 → 模型（Models）**，找到 `Ark Coding Plan`，点「编辑」，把 API Key 填进去。

本包声明的凭据引用名是 `ARK_CODING_PLAN_CN_API_KEY`；GUI 会把它写进你本机的
`~/.dsh/.credentials.yaml`。

---

## 为什么只有一个 patch（实测记录）

早期版本提供过两个变体，其中「insert 独立行」变体已被实测证伪并移除。

**结论：insert 一个同插件的第二行，在任何机器上都无法激活。**

原因：`@deepseek-ai/dsh-llm-pi-ai` 会**无条件**把整套 catalog 注册进 `dsh-llm` 的
**单例** configurable-provider 目录；第二个实例必然撞上已被声明的 catalog provider。
而 `dsh-base` 总是先挂一行 `llm-pi-ai`，所以「第二行」永远存在，也就永远失败。

实测（隔离 profile，DSH 0.2.0-rc.2）：

| 变体 | 结果 | `llm/listProviders` |
|---|---|---|
| insert（全新 profile，无任何用户配置） | ❌ `1 entry did not activate` | 只有 deepseek-official / deepseek-account，**没有 Ark 分组** |
| override（本包现在的形状） | ✅ 干净启动，无告警 | 多出 `ark-coding-plan-cn` / `Ark Coding Plan` |

insert 变体启动时的实际报错：

```
dsh: warning: 1 entry did not activate
llm-pi-ai-ark-coding (@deepseek-ai/dsh-llm-pi-ai): LlmError:
  configurable provider "amazon-bedrock" is already declared
```

注意报错里是 `amazon-bedrock` 而不是你的 provider —— 说明失败与 provider id 是否重名无关，
纯粹是「同插件不能挂两行」。

---

## 包含的模型（15）

`doubao-seed-2.1-pro` · `doubao-seed-2.1-lite` · `doubao-seed-2.1-turbo` ·
`doubao-seed-evolving` · `doubao-seed-2.0-lite` · `doubao-seed-2.0-mini` ·
`glm-5.3` · `glm-5.3-flash` ·
`deepseek-v4-pro` · `deepseek-v4-flash` · `deepseek-v4.1-flash` ·
`minimax-m3` · `kimi-k2.8-preview` · `kimi-k3` · `ark-code-latest`

### 关键参数（实测）

| 项目 | 值 |
|---|---|
| 协议 | `anthropic-messages` |
| baseURL | `https://ark.cn-beijing.volces.com/api/coding` |
| 凭据引用 | `ARK_CODING_PLAN_CN_API_KEY` |

**baseURL 故意不写 `/v1`** —— pi-ai 适配器会自动追加 `/v1/messages`。

### 思考等级（reasoningEfforts）

- 支持 `off` / `low` / `high` / `max`
- ⚠️ **`glm-5.3` 与 `glm-5.3-flash` 不支持关闭思考**（会 HTTP 400），所以这两个模型**没有** `off` 键
- 思考 token **计入输出用量**，调高思考等级会显著推高 output 消耗

### 图片输入

- **支持**：全部 doubao 系列、glm-5.3-flash、minimax-m3、kimi-k3、kimi-k2.8-preview、deepseek-v4.1-flash、ark-code-latest
- **仅文本**：glm-5.3、deepseek-v4-pro、deepseek-v4-flash

---

## 验证

装完并重启 DSH 后：

1. **设置 → 模型**里出现 `Ark Coding Plan` 分组
2. 模型选择器里能选到 15 个模型
3. 发一句「你好」，能正常收到回复

---

## 常见问题

**Q：看不到 `Ark Coding Plan` 分组？**
A：先确认装完**重启过 DSH**（bundle 的 patch 在启动时读取）。
再确认你的 profile 里没有另一行把 `llm-pi-ai` 覆盖回去（后应用的层会赢）。

**Q：显示红点 / 401？**
A：Key 没填或填错。设置 → 模型 → Ark Coding Plan → 编辑 → 重填。
注意 DSH 凭据优先级是 **进程环境变量 > 凭据库 > `.env`**；若你设过
`ARK_CODING_PLAN_CN_API_KEY` 环境变量，它会顶替凭据库，需要彻底重启 DSH。

**Q：我原有的 pi-ai provider 不见了？**
A：本包整体替换了 `llm-pi-ai` 的 config。把它们合并回同一份 `providers:` 字典即可（见上文）。

**Q：改了配置没生效？**
A：bundle 的 patch 只在启动时读取，**重启 DSH**。浏览器设置页缓存用刷新（F5）即可。

---

## 发布到插件市场（作者用）

1. 确认 `package.json` 的 `name` / `version`（npm 上可用）
2. 发布：

   ```sh
   npm publish --access public
   ```

3. 去 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) **提 PR**，
   在列表里加一条（本仓库不是插件目录，别往这里提条目）
4. 站点与市场会自动收录，**通常 1 天内生效**

> 市场只允许安装精选列表内的来源，所以第 3 步是必须的。

---

## 许可

MIT
