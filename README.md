# @dsh-ark-agent/coding-plan

火山方舟 **Ark Coding Plan** 的 provider 路由，用于 **DeepSeek Harness（DSH）**。

**收录全部 15 个 Coding Plan 模型，每个模型可调思考强度，元数据对着线上端点实测。**

> Volcengine Ark Coding Plan provider route for DeepSeek Harness.

---

## 与已有方案的区别

| | 官方 `ark-plan-api` | 本包 |
|---|---|---|
| Coding Plan 模型 | 8 个 | **15 个** |
| 思考强度开关 | 无 | **每模型可调** |
| 清单维护 | 手写 | **单一数据源 + 每周漂移检测** |
| 元数据 | 未标注 | **实测 + 日期** |

官方缺的 7 个：`deepseek-v4.1-flash`、`kimi-k3`、`ark-code-latest`、`glm-5.3-flash`、
`doubao-seed-2.1-lite`、`doubao-seed-2.0-mini`、`kimi-k2.8-preview`。

---

## 前置条件

1. 已安装 DSH（0.2.0-rc 或更新）
2. 已开通**火山方舟 Coding Plan 订阅**并拿到 API Key

> ⚠️ 本包不含任何密钥。

---

## ⚠️ 装之前先看这一条

本包**整体替换** `llm-pi-ai` 这一行的 `config`（DSH 的 patch 语义是「整体替换、不深合并」）。

- **在设置页 / `settings.yaml` 里配过别的 provider** → 不受影响（那里是深合并）。
- **在 profile 的 `cordis.patch.yml` 里手写过 pi-ai provider** → 会被替换，请先合并：

  ```sh
  node scripts/merge.mjs ~/.dsh/profiles/<你的 profile>/cordis.patch.yml
  ```

  默认**只打印**结果；确认无误后加 `--write` 落盘（会先备份 `.bak-merge-<时间戳>`）。
  合并助手只做文本级插入，**你的注释会保留**；键冲突时保留你原来的值，不会静默覆盖。

---

## 安装

### 方式 1：命令行（从 GitHub）

```sh
dsh plugin --profile <你的 profile> add github:STLI69/coding-plan
```

### 方式 2：插件市场

在市场里搜索 `coding-plan`，点安装。

### 方式 3：本地目录

在 **设置 → 插件 → 安装 bundle** 里指向本包目录。

装完**重启 DSH**。

---

## 填入 API Key

打开 **设置 → 模型（Models）**，找到 `Ark Coding Plan`，点编辑填入 Key。
本包声明的凭据引用名是 `ARK_CODING_PLAN_CN_API_KEY`。

---

## 模型与实测数据

**实测日期：2026-10-16**（方法：`node scripts/probe.mjs`，对着线上端点逐个模型打真实请求）

| 模型 | maxTokens | 图片输入 | 思考档位 |
|---|---|---|---|
| `doubao-seed-2.1-pro` | 393216 | ✅ | off/low/high/max |
| `doubao-seed-2.1-lite` | 262144 | ✅ | off/low/high/max |
| `doubao-seed-2.1-turbo` | 262144 | ✅ | off/low/high/max |
| `doubao-seed-evolving` | 262144 | ✅ | off/low/high/max |
| `doubao-seed-2.0-lite` | 131072 | ✅ | off/low/high/max |
| `doubao-seed-2.0-mini` | 131072 | ✅ | off/low/high/max |
| `glm-5.3` | 131072 | ❌ | low/high/max |
| `glm-5.3-flash` | 131072 | ✅ | low/high/max |
| `deepseek-v4-pro` | 393216 | ✅ | off/low/high/max |
| `deepseek-v4-flash` | 393216 | ✅ | off/low/high/max |
| `deepseek-v4.1-flash` | 393216 | ✅ | off/low/high/max |
| `minimax-m3` | 131072 | ✅ | off/low/high/max |
| `kimi-k2.8-preview` | 131072 | ✅ | off/low/high/max |
| `kimi-k3` | 131072 | ✅ | off/low/high/max |
| `ark-code-latest` | 131072 | ✅ | off/low/high/max |

- `maxTokens` 的档位粒度是 65536 / 131072 / 262144 / 393216：表中是**被端点接受的最高档**。
- `glm-5.3` 与 `glm-5.3-flash` **没有 `off`**：这两个模型关掉思考会 HTTP 400，所以不提供该档位。
- 思考 token 计入输出用量，调高思考档位会显著推高 output 消耗。

### 诚实性说明

> 本包只发布能实测的东西。
>
> **实测的**：每个模型可达、被接受的 `maxTokens` 上限、是否接受图片输入 —— 方法见
> `scripts/probe.mjs`，日期见上表。
>
> **未实测的**：`contextWindow`。验证它需要发送超长 prompt，成本不可控，所以表中没有列出，
> 它在 `models.yml` 里只作为**声明值**存在。
>
> **故意不做的**：Agent Plan / 后付费 / BytePlus 路由。我们没有这些端点的 key，无法验证，
> 因此不写进描述 —— 把没验证过的路由写进去，是收录规则里最容易被退回的一件事。
>
> **怎么保持不过期**：`models.yml` 是唯一数据源，每周 GitHub Action 自动探测模型下架与新品上线
> （候选清单在 `watchlist.yml`，人工维护，不保证覆盖所有新模型）。

---

## 为什么只有一个 patch

DSH 的 patch 语义是「整体替换、不深合并」，所以本包只能**覆盖** `llm-pi-ai` 那一行。

早期版本试过「`insert` 一个同插件的第二行」，**已实测证伪**：`@deepseek-ai/dsh-llm-pi-ai` 会
无条件把整套 catalog 注册进 `dsh-llm` 的**单例** configurable-provider 目录，第二个实例必然报：

```
llm-pi-ai-ark-coding (@deepseek-ai/dsh-llm-pi-ai): LlmError:
  configurable provider "amazon-bedrock" is already declared
```

而 `dsh-base` 总是先挂一行 `llm-pi-ai`，所以第二行在任何机器（含全新 profile）都无法激活，
与 provider 名字是否重名无关。

---

## 维护者

```sh
npm ci                 # 装 devDependency（js-yaml）
npm test               # 跑测试
npm run check          # 断言 cordis.patch.yml 与 models.yml 同步
npm run generate       # 改完 models.yml 后重新生成

# 实测并把结果写回 models.yml（需 ARK_CODING_PLAN_CN_API_KEY）
node scripts/probe.mjs --write

# 探测 watchlist 里的候选模型是否已上线
node scripts/probe.mjs --watchlist
```

改模型请**只改 `models.yml`**，然后 `npm run generate`。`cordis.patch.yml` 是生成物。

---

## 许可

MIT
