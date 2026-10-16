# @dsh-ark-agent/coding-plan

Volcengine **Ark Coding Plan** provider route for **DeepSeek Harness (DSH)**.

**All 15 Coding Plan models, per-model reasoning-effort control, and metadata measured against the live endpoint.**

---

## How it differs from what is already listed

| | Official `ark-plan-api` | This package |
|---|---|---|
| Coding Plan models | 8 | **15** |
| Reasoning-effort control | none | **per model** |
| List maintenance | hand-written | **single source + weekly drift check** |
| Metadata | unstated | **measured, with a date** |

Missing from the official entry: `deepseek-v4.1-flash`, `kimi-k3`, `ark-code-latest`, `glm-5.3-flash`,
`doubao-seed-2.1-lite`, `doubao-seed-2.0-mini`, `kimi-k2.8-preview`.

---

## Requirements

1. DSH 0.2.0-rc or newer
2. A Volcengine Ark Coding Plan subscription and API key

> ⚠️ This package ships no credentials.

---

## ⚠️ Read this before installing

This package **replaces the whole `config`** of the `llm-pi-ai` row (DSH patches replace config
wholesale and do not deep-merge).

- Providers you added through the settings UI / `settings.yaml` are **not** affected (those deep-merge).
- Providers you hand-wrote into your profile's `cordis.patch.yml` **would** be replaced — merge first:

  ```sh
  node scripts/merge.mjs ~/.dsh/profiles/<your profile>/cordis.patch.yml
  ```

  It only prints by default; add `--write` to save (a `.bak-merge-<ts>` backup is made first).
  The merge is a textual insertion, so **your comments survive**; on a key conflict your existing
  value wins and you are told, never silently overwritten.

---

## Install

```sh
dsh plugin --profile <your profile> add github:STLI69/coding-plan
```

Or install it from the plugin market, or point the plugin installer at a local directory.

Restart DSH afterwards.

---

## Add your API key

Open **Settings → Models**, pick `Ark Coding Plan` and paste your key. The credential name this
package declares is `ARK_CODING_PLAN_CN_API_KEY`.

---

## Models and measured data

**Measured 2026-10-16** (method: `node scripts/probe.mjs`, one real request per model against the live endpoint).

| Model | maxTokens | Image input | Reasoning levels |
|---|---|---|---|
| `doubao-seed-2.1-pro` | 393216 | yes | off/low/high/max |
| `doubao-seed-2.1-lite` | 262144 | yes | off/low/high/max |
| `doubao-seed-2.1-turbo` | 262144 | yes | off/low/high/max |
| `doubao-seed-evolving` | 262144 | yes | off/low/high/max |
| `doubao-seed-2.0-lite` | 131072 | yes | off/low/high/max |
| `doubao-seed-2.0-mini` | 131072 | yes | off/low/high/max |
| `glm-5.3` | 131072 | no | low/high/max |
| `glm-5.3-flash` | 131072 | yes | low/high/max |
| `deepseek-v4-pro` | 393216 | yes | off/low/high/max |
| `deepseek-v4-flash` | 393216 | yes | off/low/high/max |
| `deepseek-v4.1-flash` | 393216 | yes | off/low/high/max |
| `minimax-m3` | 131072 | yes | off/low/high/max |
| `kimi-k2.8-preview` | 131072 | yes | off/low/high/max |
| `kimi-k3` | 131072 | yes | off/low/high/max |
| `ark-code-latest` | 131072 | yes | off/low/high/max |

- The `maxTokens` probes step through 65536 / 131072 / 262144 / 393216; the table shows the
  **highest value the endpoint accepted**.
- `glm-5.3` and `glm-5.3-flash` have **no `off`**: turning thinking off for these returns HTTP 400,
  so the level is not offered.
- Thinking tokens are billed as output, so a higher reasoning level costs noticeably more.

### Honesty statement

> This package only ships what can be measured.
>
> **Measured**: that each model is reachable, the `maxTokens` value the endpoint accepts, and whether
> it accepts image input — the method is `scripts/probe.mjs`, the date is above.
>
> **Not measured**: `contextWindow`. Verifying it needs an oversized prompt, whose cost is not
> bounded, so it is absent from the table and exists in `models.yml` only as a **claimed** value.
>
> **Deliberately not done**: Agent Plan, postpaid and BytePlus routes. We hold no key for those
> endpoints and cannot verify them, so they are not described. Shipping unverified routes is the
> single fastest way to get an otherwise-good plugin sent back.
>
> **How it stays current**: `models.yml` is the single source, and a weekly GitHub Action probes for
> retired models and newly available ones (candidates live in `watchlist.yml`, maintained by hand and
> not guaranteed to catch every new model).

---

## Why there is only one patch

DSH patches replace config wholesale and do not deep-merge, so this package can only **override**
the `llm-pi-ai` row.

An earlier version tried `insert`-ing a second row for the same plugin. That was **measured and
disproved**: `@deepseek-ai/dsh-llm-pi-ai` unconditionally registers its entire catalog into
`dsh-llm`'s **singleton** configurable-provider registry, so a second instance always fails with:

```
llm-pi-ai-ark-coding (@deepseek-ai/dsh-llm-pi-ai): LlmError:
  configurable provider "amazon-bedrock" is already declared
```

`dsh-base` always mounts one `llm-pi-ai` row first, so the second row cannot activate on any machine
— a fresh profile included — regardless of whether the provider name collides.

---

## Maintainers

```sh
npm ci                 # install the dev dependency (js-yaml)
npm test               # run the tests
npm run check          # assert cordis.patch.yml matches models.yml
npm run generate       # regenerate after editing models.yml

# measure and write the results back into models.yml (needs ARK_CODING_PLAN_CN_API_KEY)
node scripts/probe.mjs --write

# probe the watchlist for models that have just become available
node scripts/probe.mjs --watchlist
```

Edit **`models.yml` only**, then run `npm run generate`. `cordis.patch.yml` is generated.

---

## License

MIT
