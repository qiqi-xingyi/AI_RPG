# 星叙 Storybound · AI 跑团 RPG

[English](README.md) | [简体中文](README.zh-CN.md)

一个由 AI 担任主持人的开源单人跑团 RPG。选择世界、定义角色背景，用选项或自由行动改变故事；后端负责掷骰、装备、战斗、成长与存档。支持桌面、手机浏览器与 PWA。

项目面向通用 AI 跑团。奇幻、悬疑、赛博、仙侠和公主都是示例世界，也可以直接创建自己的世界与角色。

## 功能

- **AI 主持**：DeepSeek 生成开场、剧情与续章；玩家无需选择模型或主持模式，也无需输入 API Key。
- **自由角色与世界**：定义身份、背景与目标，或选择示例角色。世界设定和角色背景作为游戏数据传给 AI，不能改变后端规则。
- **中文 / English 故事**：创建冒险时选择 `zh` 或 `en`，故事、行动选项、记忆与目标按该语言生成。仓库说明默认展示英文，提供完整中文译文；当前游戏界面与固定 RPG 目录仍以中文为主。
- **自由行动**：2–4 个 AI 行动选项，也可以自行输入行动。成功与失败都推进故事，过去的决定影响后续情节。
- **RPG 系统**：D20 检定、四项能力、三个装备栏、道具、回合制战斗、等级与天赋、商店、合成和任务奖励。生命、魔力、金币与经验由后端计算。
- **连续冒险**：没有固定剧情回合上限；自然收尾后可以续章，继承角色、物品、记忆与历史。
- **持久存档**：自动保存、故事导出与跨设备存档凭据导入；静态界面可缓存，推进故事需要联网。
- **邀请试玩**：云端支持分享链接、浏览器试玩配额和可分享的专属入口；API Key 始终保存在服务器。

## 快速开始

需要 Node.js **22.13+**；CI 使用 Node.js 24。

```sh
git clone https://github.com/qiqi-xingyi/AI_RPG.git
cd AI_RPG
npm ci
cp .env.example .env
```

在 `.env` 中填写自己的 `DEEPSEEK_API_KEY`，然后：

```sh
npm start
```

打开 <http://127.0.0.1:3000>，选择世界、角色与故事语言后启程。Key 缺失或 AI 出错时会保留进度并显示错误，不会切换成预写剧情。

单机服务没有第三方生产依赖；开发依赖用于测试、云端构建与数据库迁移。

## 配置

| 变量 | 用途 | 默认值 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 服务端 API Key，创建和推进剧情必需 | 空 |
| `DEEPSEEK_MODEL` | 部署者指定的模型 | `deepseek-flash` |
| `DEEPSEEK_BASE_URL` | 本地 Node 服务的 DeepSeek API 地址 | `https://api.deepseek.com` |
| `PORT` | 本地端口 | `3000` |
| `HOST` | 本地监听地址 | `127.0.0.1` |

确认模型可用于自己的 DeepSeek 账户后配置。适配器通过 `/chat/completions` 请求结构化 JSON；云端 Worker 使用官方 DeepSeek 地址，模型通过服务器环境变量配置。玩家姓名、背景、行动与故事上下文会发送给 DeepSeek。

真实配置、邀请凭据和存档不会进入源码：`.env`、`data/`、`.hosting/`、`artifacts/` 与 `dist/` 均被忽略。

## 示例世界与角色

| 世界 ID | English | 中文 | 主角 |
| --- | --- | --- | --- |
| `fantasy` | The Starfall Frontier | 星落边境 | 自定义角色 |
| `noir` | Letters After Midnight | 午夜来信 | 自定义角色 |
| `cyber` | Beyond the Neon | 霓虹边界 | 自定义角色 |
| `wuxia` | Echoes of Shanhai | 山海旧梦 | 自定义角色 |
| `princess` | The Princess & the Star Crown | 公主与星之冠 | 可选的成年公主示例 |
| `custom` | Your Own World | 自定义世界 | 自定义角色与世界 |

旅人、守护者、学者、吟游者是四种天赋方向，与角色的身份独立。公主示例保留原有立绘与剧情；新冒险默认自由角色。已有公主存档继续保留身份、外貌、历史与原来的世界设定。

图片目前是世界插画与示例角色立绘，不是每一幕实时生成的图片。

## 游戏规则与扩展

D20 加能力值，与行动难度比较；自然 20 成功，1 失败。故事成功获得 10 经验与 3 金币，失败获得 5 经验并按难度失去 3/5/8 生命。每 50 经验升级，增加生命、魔力上限与天赋点。

装备、药剂、材料、敌人模板与奖励目录在 `lib/rpg.mjs`。这是一套共享的简化 RPG 规则，不同世界沿用同一套数值；AI 可以调整敌人名字与叙述，不能创造任意属性或无限掉落。

主题与角色配置在 `lib/catalog.mjs`；主持提示、记忆窗口与供应商适配器在 `lib/deepseek.mjs`。扩展指引见 [贡献说明](CONTRIBUTING.md)，接口示例见 [API 文档](docs/API.md)。

## 手机与存档

- 同一可信 Wi-Fi 网络内，可将 `HOST` 改为 `0.0.0.0`，通过电脑的局域网 IP 和端口访问。
- PWA 可以添加到主屏幕，通常需要 HTTPS。当前没有 iOS/Android 原生安装包。
- 本地存档保存在 `data/sessions.json`。备份需保存整个 `data/`；导出的存档凭据用于访问同一服务器上的存档，不是完整存档备份。
- 浏览器的存档入口不会自动跨设备同步，可导出凭据再到另一台设备导入。凭据具有访问权限，应交给存档本人。

## 云端与分享

云端适配器在 `cloud/worker.mjs`，使用 D1 保存游戏状态与配额，使用数据库租约保护并发提交。与本地 Node 版本复用同一套规则。

| 云端变量 | 用途 |
| --- | --- |
| `DEEPSEEK_API_KEY` | 服务器中的 DeepSeek 密钥 |
| `DEEPSEEK_MODEL` | 服务器指定的模型 |
| `PLAYTEST_CODE` | 普通试玩邀请凭据 |
| `PLAYTEST_USER_DAILY_LIMIT` | 每个浏览器的每日 AI 试玩次数，默认 30，上限 100 |
| `PLAYTEST_GLOBAL_DAILY_LIMIT` | 普通试玩的全站每日次数，默认 100，上限 1000 |
| `OWNER_ACCESS_TOKEN_HASH` | 专属分享凭据的 SHA-256 摘要 |
| `TRIAL_SIGNING_KEY` | 可选的独立 cookie 签名密钥；未配置时从 API Key 派生 |

普通链接格式为 `/#invite=邀请凭据`，专属链接为 `/#owner=随机访问凭据`。链接凭据从 fragment 读取后清除，再交换 HttpOnly cookie，不公开 DeepSeek Key。专属凭据使用 32 字节安全随机数的 base64url 编码；服务器仅保存摘要。更换摘要会撤销旧专属链接和 cookie。

普通试玩按 UTC 日期重置，开局、剧情推进与续章计入次数；失败尝试保留预约额度。装备、买卖与战斗不占 AI 次数。专属链接可转发，持有者不受试玩每日配额限制，也不占普通试玩配额；请求限速、并发保护、DeepSeek 服务限制与余额仍适用。所有 AI 调用由部署者的账户付费。

这是一套小范围邀请试玩系统，尚无实名账号、多人组队、跨服务器存档或账户金额封顶。本地 Node 版本默认用于本机或可信局域网；公网部署应使用带访问控制的云端适配器。

## 开发与验证

```sh
npm run check
npm run build
```

测试使用模拟 AI 与临时数据库，不调用收费 API。构建生成 `dist/server/` 与 `dist/client/`，不包含真实配置和个人存档。

数据库定义在 `db/schema.ts`，迁移在 `drizzle/`；改变数据库结构后运行 `npm run db:generate` 并检查 SQL，由部署平台应用迁移。

发布前运行 `node scripts/check-secrets.mjs --staged` 检查即将提交的文件。

```text
lib/catalog.mjs      世界、角色与语言配置
lib/game.mjs         检定、场景校验与故事推进
lib/rpg.mjs          装备、战斗、成长与奖励
lib/deepseek.mjs     AI 主持提示与供应商适配器
server.mjs           本地 Node 服务
cloud/               云端 Worker 与 D1 存储
db/ + drizzle/       数据库结构与迁移
public/              响应式游戏界面、插画与 PWA
test/                规则与 HTTP 集成测试
```

## 许可证

[MIT](LICENSE)。可以修改世界、替换示例角色、扩展规则，并使用自己的后端密钥部署。
