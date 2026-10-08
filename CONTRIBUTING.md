# 贡献 / Contributing

[中文 README](README.md) · [English README](README.en.md) · [API](docs/API.md)

## 中文

项目欢迎新的世界、角色示例、玩法和语言支持。公主是一个可选示例，通用引擎不应强制玩家拥有某种性别或身份。

1. 安装 Node.js 22.13+，运行 `npm ci`；如需真人游玩，将自己的 Key 写入被忽略的 `.env`。
2. 修改 `lib/catalog.mjs` 可扩展主题与角色。世界的公开介绍进入配置接口，秘密与完整设定留在服务器。
3. 角色背景和世界设定是文字数据；数值、掷骰与奖励必须由 `lib/game.mjs` 和 `lib/rpg.mjs` 处理。
4. 调整 `lib/deepseek.mjs` 时保持 JSON 协议与中英文故事语言要求，保留玩家自由行动和既有记忆。
5. 改动存档结构时保护旧存档。变更数据库需增加迁移，不要修改已经应用的迁移。
6. 同步更新两份 README，运行 `npm run check` 和 `npm run build`；测试应使用模拟 AI，不调用收费 API。
7. 发布前检查 `node scripts/check-secrets.mjs --staged`。不要提交 Key、邀请链接凭据、个人存档、真实配置或部署状态。

新语言应增加明确的语言 ID 与主持输出要求。当前 `language` 是故事语言，界面完整翻译可独立实现；不要声称已有尚未完成的翻译。

## English

Contributions to settings, example characters, mechanics, and language support are welcome. The princess is an optional example; the shared engine must not impose a fixed identity or gender.

1. Install Node.js 22.13+ and run `npm ci`. For manual play, put your own key in the ignored `.env` file.
2. Extend worlds and characters in `lib/catalog.mjs`. Public descriptions go to the configuration API; secrets and full premises remain server-side.
3. Character backgrounds and world premises are text data. Stats, dice, and rewards belong in `lib/game.mjs` and `lib/rpg.mjs`.
4. Keep the JSON protocol and Chinese/English output requirements when modifying `lib/deepseek.mjs`. Preserve free-form actions and accumulated memory.
5. Maintain save compatibility. Add migrations for database changes; do not edit migrations that have already been applied.
6. Update both READMEs and run `npm run check` and `npm run build`. Use mocked AI in tests, without paid API calls.
7. Before publishing, run `node scripts/check-secrets.mjs --staged`. Never commit API keys, access-link credentials, personal saves, real configuration, or deployment state.

New languages need an explicit language ID and host-output instructions. The current `language` field controls story output; full interface translation can be implemented separately. Document only translations that actually exist.
