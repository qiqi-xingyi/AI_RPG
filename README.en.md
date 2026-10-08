# Storybound · AI Game Master RPG

[中文](README.md) | [English](README.en.md)

An open-source solo RPG with an AI game master. Choose a world, define your character, and shape the story through suggested or free-form actions. The server handles dice, equipment, combat, progression, and saves. Play in desktop or mobile browsers, with PWA support.

Storybound is a general-purpose AI role-playing project. Fantasy, mystery, cyberpunk, cultivation, and the princess adventure are sample settings. You can also create your own world and character.

## Features

- **AI game master**: DeepSeek generates openings, story turns, and new chapters. Players do not select a model or host mode, and do not enter an API key.
- **Custom characters and worlds**: Define an identity, background, and goals, or choose an example character. These descriptions are game data and cannot change server rules.
- **Chinese / English stories**: Select `zh` or `en` when creating a campaign. Narrative, choices, memory, and objectives are generated in that language. Repository documentation is bilingual; the current interface and fixed RPG catalogs are primarily Chinese.
- **Free-form actions**: Pick from 2–4 generated choices or write your own action. Success and failure both advance the story, with consequences carried forward.
- **RPG mechanics**: D20 checks, four abilities, three equipment slots, consumables, turn-based combat, levels, talents, a shop, crafting, and claimable quest rewards. The server calculates HP, MP, gold, and XP.
- **Continuous campaigns**: No fixed story-turn cap. Continue after a natural chapter ending while retaining your character, items, memory, and history.
- **Persistent saves**: Automatic saving, story export, and save-credential import across devices. Static screens can be cached; story actions require a connection.
- **Invitation playtests**: The cloud adapter supports share links, browser quotas, and shareable dedicated access. API keys stay on the server.

## Quick start

Requires Node.js **22.13+**. CI runs on Node.js 24.

```sh
git clone https://github.com/qiqi-xingyi/AI_RPG.git
cd AI_RPG
npm ci
cp .env.example .env
```

Set your own `DEEPSEEK_API_KEY` in `.env`, then start the server:

```sh
npm start
```

Open <http://127.0.0.1:3000>, choose a world, character, and story language, and begin. A missing key or AI failure preserves existing progress and reports an error; production never falls back to a scripted story.

The local server has no third-party production dependencies. Development dependencies support testing, cloud builds, and database migrations.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | Server API key, required for story generation | Empty |
| `DEEPSEEK_MODEL` | Model selected by the deployment owner | `deepseek-flash` |
| `DEEPSEEK_BASE_URL` | DeepSeek API endpoint for the local Node server | `https://api.deepseek.com` |
| `PORT` | Local server port | `3000` |
| `HOST` | Local bind address | `127.0.0.1` |

Choose a model available to your DeepSeek account. The adapter requests structured JSON through `/chat/completions`. The cloud Worker uses the official DeepSeek endpoint, with its model configured on the server. Player names, backgrounds, actions, and campaign context are sent to DeepSeek.

Real configuration, invitation credentials, and saves are excluded from source control: `.env`, `data/`, `.hosting/`, `artifacts/`, and `dist/` are ignored.

## Sample worlds and characters

| World ID | 中文 | English | Character |
| --- | --- | --- | --- |
| `fantasy` | 星落边境 | The Starfall Frontier | Custom character |
| `noir` | 午夜来信 | Letters After Midnight | Custom character |
| `cyber` | 霓虹边界 | Beyond the Neon | Custom character |
| `wuxia` | 山海旧梦 | Echoes of Shanhai | Custom character |
| `princess` | 公主与星之冠 | The Princess & the Star Crown | Optional adult princess example |
| `custom` | 自定义世界 | Your Own World | Custom character and setting |

Wanderer, Guardian, Scholar, and Storyteller are four talent profiles, independent of character identity. The princess example retains its portrait and story. New general campaigns default to a custom character; existing princess saves retain their identity, appearance, history, and original setting.

Images are setting illustrations and an example character portrait. They are not generated for every scene.

## Rules and extension points

Roll D20 plus the relevant ability modifier against the action's difficulty. A natural 20 succeeds and a natural 1 fails. Successful story checks grant 10 XP and 3 gold; failures grant 5 XP and cost 3/5/8 HP according to difficulty. Every 50 XP grants a level, increased HP/MP limits, and a talent point.

Equipment, consumables, materials, enemy templates, and reward catalogs live in `lib/rpg.mjs`. This is a shared, simplified RPG ruleset: all settings use the same mechanics. AI may adapt enemy names and narrative, but cannot invent arbitrary stats or unlimited loot.

World and character presets live in `lib/catalog.mjs`. Host instructions, context windows, and the provider adapter live in `lib/deepseek.mjs`. See [Contributing](CONTRIBUTING.md) for extension guidance and [API documentation](docs/API.md) for requests.

## Mobile and saves

- On trusted Wi-Fi, set `HOST=0.0.0.0` and use your computer's LAN address and port.
- Add the PWA to your home screen where supported. HTTPS is normally required. Native iOS/Android apps are not included.
- Local saves are stored in `data/sessions.json`. Back up the entire `data/` directory. Exported credentials grant access to a save on the same server; they are not complete save backups.
- Browser save shortcuts do not automatically sync between devices. Export and import credentials to continue elsewhere, and share them only with the save's owner.

## Cloud deployment and sharing

`cloud/worker.mjs` uses D1 for game state and quotas, and database leases to protect concurrent turns. It shares the same rules as the local Node server.

| Cloud variable | Purpose |
| --- | --- |
| `DEEPSEEK_API_KEY` | Server-side DeepSeek secret |
| `DEEPSEEK_MODEL` | Model selected on the server |
| `PLAYTEST_CODE` | Standard playtest invitation credential |
| `PLAYTEST_USER_DAILY_LIMIT` | AI attempts per browser per day; default 30, maximum 100 |
| `PLAYTEST_GLOBAL_DAILY_LIMIT` | Daily site quota for standard playtests; default 100, maximum 1000 |
| `OWNER_ACCESS_TOKEN_HASH` | SHA-256 digest of the dedicated share credential |
| `TRIAL_SIGNING_KEY` | Optional separate cookie signing key; otherwise derived from the API key |

Standard links use `/#invite=invitation-credential`; dedicated links use `/#owner=random-access-credential`. The browser removes credentials from the fragment before exchanging them for an HttpOnly cookie. The DeepSeek key is never included. Generate dedicated credentials from 32 cryptographically random bytes encoded as base64url; store only their digest on the server. Rotating the digest revokes old dedicated links and cookies.

Standard quotas reset by UTC date and count openings, story turns, and continuations. Failed attempts retain their reservation. Equipment, trading, and combat do not consume AI attempts. Dedicated links are shareable: holders bypass both daily playtest quotas and do not spend the standard playtest budget. Request throttles, concurrency protection, DeepSeek service limits, and account balance still apply. AI usage is billed to the deployment owner's account.

This is an invitation playtest system. It does not include verified user accounts, multiplayer parties, cross-server saves, or a monetary spending cap. The local Node server is intended for localhost or trusted networks; public hosting should use the access-controlled cloud adapter.

## Development and validation

```sh
npm run check
npm run build
```

Tests use mocked AI and temporary databases; they do not call paid APIs. Builds produce `dist/server/` and `dist/client/`, without real configuration or personal saves.

Database definitions live in `db/schema.ts`, with migrations in `drizzle/`. After schema changes, run `npm run db:generate`, review the SQL, and let the hosting platform apply migrations.

Before publishing, run `node scripts/check-secrets.mjs --staged` to inspect staged files.

```text
lib/catalog.mjs      World, character, and language configuration
lib/game.mjs         Checks, scene validation, and story progression
lib/rpg.mjs          Equipment, combat, progression, and rewards
lib/deepseek.mjs     AI host instructions and provider adapter
server.mjs           Local Node server
cloud/               Cloud Worker and D1 storage
db/ + drizzle/       Database definitions and migrations
public/              Responsive interface, artwork, and PWA
test/                Rules and HTTP integration tests
```

## License

[MIT](LICENSE). Adapt the worlds, replace example characters, extend the rules, and deploy with your own server-side key.
