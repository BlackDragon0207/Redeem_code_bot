// /새로고침 + scripts/register.js --wipe 에서 쓰는 헬퍼
// 방식: 기존 명령어를 전부 제거(전역 + 알려진 길드)한 뒤 현재 definitions로 재등록
// (기존 파일의 data/execute 구조는 이 봇의 디스패치 방식(handleInteraction)과 맞지 않고,
//  client.commands 컬렉션도 없어서 실행 시 TypeError가 나길래 헬퍼 형태로 고침)
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const STEP_TIMEOUT_MS = 25000; // 단계별 최대 대기 (넘기면 실패 처리, 무한 대기 방지)

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 시간 초과 (${STEP_TIMEOUT_MS / 1000}초)`)), STEP_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function collectGuildIds() {
  const ids = new Set();
  try {
    for (const gid of Object.keys(require('./store').getAllGuilds())) ids.add(gid);
  } catch { /* store 읽기 실패해도 계속 */ }
  if (process.env.GUILD_ID) ids.add(process.env.GUILD_ID);
  ids.add('690807258388365323'); // 기존에 중복 등록됐던 길드 (기록에 없어도 정리 대상)
  return [...ids];
}

async function wipeAndRegister(onProgress) {
  const progress = async (msg) => {
    try { if (onProgress) await onProgress(msg); } catch { /* 진행 표시 실패는 무시 */ }
  };
  const token = process.env.DISCORD_TOKEN;
  if (!token || token.includes('여기에')) throw new Error('.env에 DISCORD_TOKEN이 없습니다.');

  const rest = new REST({ version: '10' }).setToken(token);
  const me = await withTimeout(rest.get(Routes.oauth2CurrentApplication()).catch(() => null), '앱 정보 조회');
  const appId = me && me.id ? me.id : null;
  if (!appId) throw new Error('Application ID 조회 실패 — 봇 토큰을 확인해주세요.');

  const guildIds = collectGuildIds();
  await progress('🔍 현재 등록 상태 조회 중…');
  const before = {
    global: await withTimeout(rest.get(Routes.applicationCommands(appId)).catch(() => []), '전역 명령어 조회'),
    guilds: {},
  };
  await Promise.all(guildIds.map(async (gid) => {
    before.guilds[gid] = await withTimeout(
      rest.get(Routes.applicationGuildCommands(appId, gid)).catch(() => []),
      `길드(${gid}) 명령어 조회`
    );
  }));

  // 1. 전부 제거
  await progress('🧹 기존 명령어 비우는 중…');
  await withTimeout(rest.put(Routes.applicationCommands(appId), { body: [] }), '전역 명령어 비우기');
  console.log('🧹 전역 명령어 비움');
  await Promise.all(guildIds.map(async (gid) => {
    try {
      await withTimeout(rest.put(Routes.applicationGuildCommands(appId, gid), { body: [] }), `길드(${gid}) 비우기`);
      console.log(`🧹 길드(${gid}) 명령어 비움`);
    } catch (err) {
      console.warn(`⚠️ 길드(${gid}) 비우기 실패:`, err.message);
    }
  }));

  // 2. 재등록 (실패하면 명령어가 텅 비므로 최대 3회 재시도)
  await progress('📝 명령어 재등록 중…');
  const { registerCommands } = require('./register');
  let result = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      result = await withTimeout(registerCommands({ cleanStale: false }), `재등록 ${attempt}회차`);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️ 재등록 ${attempt}회차 실패, 재시도:`, err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (!result) throw lastErr || new Error('재등록 실패 (3회 시도)');

  await progress('🔍 재등록 결과 확인 중…');
  const after = {
    global: await withTimeout(rest.get(Routes.applicationCommands(appId)).catch(() => []), '전역 명령어 재조회'),
    guilds: {},
  };
  await Promise.all(guildIds.map(async (gid) => {
    after.guilds[gid] = await withTimeout(
      rest.get(Routes.applicationGuildCommands(appId, gid)).catch(() => []),
      `길드(${gid}) 명령어 재조회`
    );
  }));
  return { appId, before, after, result };
}

module.exports = { wipeAndRegister };
