# API · 接口说明

[中文 README](../README.md) · [English README](../README.en.md)

接口使用 JSON，成功返回游戏状态，错误返回 `{"error":"…"}`。客户端只能描述角色和行动，不能指定生命、金币、检定结果或奖励。/ APIs use JSON and return game state or `{"error":"…"}`. Clients describe characters and actions; the server determines stats, dice, and rewards.

## 创建冒险 / Create a campaign

`POST /api/sessions`

```json
{
  "name": "Alex",
  "worldId": "custom",
  "worldPremise": "A city floating above a sea of clouds, where dreams can be traded.",
  "protagonistId": "custom",
  "characterConcept": "A wandering investigator looking for a missing sibling.",
  "roleId": "scholar",
  "difficulty": "balanced",
  "language": "en",
  "wish": "Focus on investigation and relationships."
}
```

- `worldId`: `fantasy` / `noir` / `cyber` / `wuxia` / `princess` / `custom`。
- `worldPremise`: 自定义世界必填，最多 1000 字符；其他世界忽略。/ Required for custom worlds, up to 1000 characters; ignored for presets.
- `protagonistId`: `custom` 或 `princess-elya`。默认自由角色；公主示例世界默认公主且只接受该身份。/ Defaults to a custom character. The princess example world requires its princess identity.
- `characterConcept`: 自由角色背景，选填，最多 500 字符；公主身份由后端的示例配置确定。/ Optional custom background, up to 500 characters. The princess profile is controlled by the server preset.
- `name`: 必填，最多 24 字符。/ Required, up to 24 characters.
- `language`: `zh`（默认）或 `en`，保存后沿用到后续回合与续章。/ Stored with the campaign and retained across turns and chapters.
- `roleId`: `wanderer` / `guardian` / `scholar` / `storyteller`。
- `difficulty`: `story` / `balanced` / `hard`。
- `wish`: 选填，最多 300 字符。/ Optional story preference, up to 300 characters.

创建会调用 AI 生成开场，成功返回 `201` 与 `{session, token}`。保管随机 `token`；公开 session 不包含该凭据。/ Creation generates an AI opening and returns `201` with `{session, token}`. Keep the random token private; public session data excludes it.

## 配置与存档 / Configuration and saves

| 接口 / Endpoint | 用途 / Purpose |
| --- | --- |
| `GET /api/config` | 世界、身份、故事语言、天赋、难度与 RPG 目录 / Worlds, profiles, languages, talents, difficulties, and RPG catalogs |
| `GET /api/sessions/:id` | 读取自己的存档 / Read your save |
| `POST /api/sessions/:id/turn` | 行动与剧情推进 / Story action |
| `POST /api/sessions/:id/continue` | 自然结尾后的续章 / Continue after a chapter ending |
| `POST /api/sessions/:id/rpg` | 装备、道具、战斗与其他 RPG 操作 / Equipment, items, combat, and other RPG actions |

读取或修改存档需 `Authorization: Bearer <token>`。/ Save requests require the bearer credential.

所有修改需当前 `version` 与一个 UUID `requestId`；重试应复用原 requestId，已成功提交的请求不会重复推进或发奖励。过期版本返回 `409`。/ Mutations require the current version and a UUID requestId. Reuse it for retries; committed actions are idempotent. Stale versions return `409`.

自由行动 / Free-form turn:

```json
{"version":0,"requestId":"2fc252b5-cd63-4d7b-a7fb-bb539dca2871","action":"Ask the archivist about the missing dream.","skill":"insight"}
```

选项行动用 `choiceId`，不用 `action`。`skill` 为 `might` / `insight` / `agility` / `charm`。/ Suggested actions use choiceId instead of action. Skills use the fixed enum IDs.

续章 / Continue:

```json
{"version":5,"requestId":"d0a21377-0b80-4fe0-bd29-eac45e5fe762","direction":"Travel with my companion to the next city."}
```

装备示例 / Equip example:

```json
{"version":0,"requestId":"dc674f26-f80e-49b4-85b4-4866a5c98114","type":"equip","itemId":"moonblade"}
```

## 云端邀请 / Cloud invitation access

本地 Node 版不需要试玩 cookie。云端除存档 token 外，还需经过邀请验证。/ Local Node play does not use a playtest cookie. Cloud play requires invitation access in addition to save credentials.

- `POST /api/playtest/login`，`{"code":"邀请凭据"}` / invitation credential。
- `POST /api/playtest/owner`，`{"token":"专属随机访问凭据"}` / dedicated access credential。

成功设置服务器签名的 HttpOnly、Secure、SameSite cookie。浏览器分享链接可自动完成交换。`/api/config` 的 `playtest.access` 是 `trial`、`owner` 或 `null`；专属身份的 `dailyLimit` 为 `null`。该身份只能由服务器验证，不能通过提交 `role=owner` 获得。/ Successful login sets a signed secure cookie. Share links automate this exchange. Dedicated access bypasses daily trial quotas and must be verified by the server; a client role flag cannot grant it.

API Key 不出现在配置、状态、cookie 或访问链接中。/ The provider key never appears in configuration, game state, cookies, or access links.
