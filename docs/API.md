# API Reference / 接口说明

[English README](../README.md) · [中文 README](../README.zh-CN.md)

APIs use JSON and return game state or `{"error":"…"}`. Clients describe characters and actions; the server determines stats, dice, and rewards.

接口使用 JSON，成功返回游戏状态，错误返回 `{"error":"…"}`。客户端只能描述角色和行动，生命、金币、检定结果与奖励由后端决定。

## Create a campaign / 创建冒险

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

| Field / 字段 | English | 中文 |
| --- | --- | --- |
| `worldId` | `fantasy`, `noir`, `cyber`, `wuxia`, `princess`, or `custom` | 选择示例或自定义世界 |
| `worldPremise` | Required for custom worlds, up to 1000 characters; ignored for presets | 自定义世界必填，最多 1000 字符；示例世界忽略 |
| `protagonistId` | `custom` or `princess-elya`; defaults to a custom character except in the princess example, which requires its princess profile | 默认自由角色；公主示例世界默认公主且只接受该身份 |
| `characterConcept` | Optional custom background, up to 500 characters; the princess profile is controlled by its server preset | 自由角色背景，选填，最多 500 字符；公主身份由后端示例配置确定 |
| `name` | Required, up to 24 characters | 必填，最多 24 字符 |
| `language` | Story language: `zh` (default) or `en`; retained across turns and chapters | 故事语言为 `zh`（默认）或 `en`；保存后沿用到后续回合与续章 |
| `roleId` | `wanderer`, `guardian`, `scholar`, or `storyteller` | 旅人、守护者、学者或吟游者天赋 |
| `difficulty` | `story`, `balanced`, or `hard` | 叙事、经典或挑战难度 |
| `wish` | Optional story preference, up to 300 characters | 故事偏好，选填，最多 300 字符 |

Creation generates an AI opening and returns `201` with `{session, token}`. Keep the random token private; public session data excludes it.

创建会调用 AI 生成开场，成功返回 `201` 与 `{session, token}`。保管随机 `token`；公开 session 不包含该凭据。

## Configuration and saves / 配置与存档

| Endpoint / 接口 | English | 中文 |
| --- | --- | --- |
| `GET /api/config` | Worlds, profiles, languages, talents, difficulties, and RPG catalogs | 世界、身份、故事语言、天赋、难度与 RPG 目录 |
| `GET /api/sessions/:id` | Read your save | 读取自己的存档 |
| `POST /api/sessions/:id/turn` | Story action | 行动与剧情推进 |
| `POST /api/sessions/:id/continue` | Continue after a chapter ending | 自然结尾后的续章 |
| `POST /api/sessions/:id/rpg` | Equipment, items, combat, and other RPG actions | 装备、道具、战斗与其他 RPG 操作 |

Save requests require `Authorization: Bearer <token>`.

读取或修改存档需 `Authorization: Bearer <token>`。

Mutations require the current `version` and a UUID `requestId`. Reuse the original requestId for retries; committed actions do not advance twice or award duplicate rewards. Stale versions return `409`.

所有修改需当前 `version` 与一个 UUID `requestId`。重试复用原 requestId，已提交的请求不会重复推进或发奖励。过期版本返回 `409`。

### Free-form turn / 自由行动

```json
{"version":0,"requestId":"2fc252b5-cd63-4d7b-a7fb-bb539dca2871","action":"Ask the archivist about the missing dream.","skill":"insight"}
```

Suggested actions use `choiceId` instead of `action`. Skills are `might`, `insight`, `agility`, or `charm`.

选项行动用 `choiceId`，不用 `action`。`skill` 为 `might`、`insight`、`agility` 或 `charm`。

### Continue / 续章

```json
{"version":5,"requestId":"d0a21377-0b80-4fe0-bd29-eac45e5fe762","direction":"Travel with my companion to the next city."}
```

### Equip an item / 装备道具

```json
{"version":0,"requestId":"dc674f26-f80e-49b4-85b4-4866a5c98114","type":"equip","itemId":"moonblade"}
```

## Cloud invitation access / 云端邀请

Local Node play does not use a playtest cookie. Cloud play requires invitation access in addition to save credentials.

本地 Node 版不需要试玩 cookie。云端除存档 token 外，还需经过邀请验证。

| Endpoint / 接口 | Example body / 示例请求 | Purpose / 用途 |
| --- | --- | --- |
| `POST /api/playtest/login` | `{"code":"invitation-credential"}` | Standard playtest access / 普通试玩邀请 |
| `POST /api/playtest/owner` | `{"token":"dedicated-access-credential"}` | Dedicated access / 专属入口 |

Successful login sets a signed HttpOnly, Secure, SameSite cookie. Share links automate this exchange. `playtest.access` in `/api/config` is `trial`, `owner`, or `null`; dedicated access has `dailyLimit: null`. The server verifies this privilege; a client `role=owner` flag cannot grant it.

成功设置服务器签名的 HttpOnly、Secure、SameSite cookie，分享链接可自动完成交换。`/api/config` 的 `playtest.access` 是 `trial`、`owner` 或 `null`，专属身份的 `dailyLimit` 为 `null`。该身份由服务器验证，不能通过提交 `role=owner` 获得。

The provider API key never appears in configuration, game state, cookies, or access links.

API Key 不出现在配置、状态、cookie 或访问链接中。
