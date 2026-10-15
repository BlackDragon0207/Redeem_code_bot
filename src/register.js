// 슬래시 커맨드 등록 + 중복(전역/길드 동시 등록) 정리 모듈
// commands.js와 순환참조를 피하기 위해 definitions는 함수 안에서 lazy-require
const { REST, Routes } = require('discord.js');

async function getAppId(rest) {
  const me = await rest.get(Routes.oauth2CurrentApplication()).catch(() => null);
  return me && me.id ? me.id : null;
}

async function listCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = await getAppId(rest);
  if (!appId) throw new Error('Application ID 조회 실패 — 봇 토큰을 확인해주세요.');
  const global = await rest.get(Routes.applicationCommands(appId)).catch(() => []);
  const guildIds = new Set(Object.keys(require('./store').getAllGuilds()));
  if (process.env.GUILD_ID) guildIds.add(process.env.GUILD_ID);
  const guilds = {};
  for (const gid of guildIds) {
    try {
      guilds[gid] = await rest.get(Routes.applicationGuildCommands(appId, gid));
    } catch {
      guilds[gid] = [];
    }
  }
  return { appId, global, guilds };
}

// 등록 + 미사용 스코프 정리 (중복 방지)
// - GUILD_ID 있으면: 길드에 등록 + 전역은 비움(테스트 모드, 즉시 반영)
// - GUILD_ID 없으면: 전역에 등록 + 알려진 길드 명령어는 비움(중복 제거)
async function registerCommands({ cleanStale = true } = {}) {
  const { definitions } = require('./commands');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = await getAppId(rest);
  if (!appId) {
    console.warn('⚠️ Application ID 조회 실패 — 봇 토큰을 확인해주세요.');
    return { mode: 'failed', appId: null };
  }
  const GUILD_ID = process.env.GUILD_ID;
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(appId, GUILD_ID), { body: definitions });
    console.log(`✅ 테스트 서버(${GUILD_ID})에 명령어 ${definitions.length}개 등록 완료 (즉시 반영)`);
    if (cleanStale) {
      await rest.put(Routes.applicationCommands(appId), { body: [] });
      console.log('🧹 전역 명령어 비움 (길드/전역 중복 방지)');
    }
    return { mode: 'guild', appId, count: definitions.length };
  }
  await rest.put(Routes.applicationCommands(appId), { body: definitions });
  console.log(`✅ 전역 명령어 ${definitions.length}개 등록 완료 (반영까지 최대 1시간)`);
  if (cleanStale) {
    const guildIds = new Set(Object.keys(require('./store').getAllGuilds()));
    // .env에 주석으로 남아있는 길드도 정리 대상에 포함 (현재 알려진 값)
    guildIds.add('690807258388365323');
    for (const gid of guildIds) {
      try {
        await rest.put(Routes.applicationGuildCommands(appId, gid), { body: [] });
        console.log(`🧹 길드(${gid}) 명령어 비움 (중복 제거)`);
      } catch (err) {
        console.warn(`⚠️ 길드(${gid}) 정리 실패:`, err.message);
      }
    }
  }
  return { mode: 'global', appId, count: definitions.length };
}

module.exports = { registerCommands, listCommands };
