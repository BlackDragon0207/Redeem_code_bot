// 사용법:
//   node scripts/register.js --status        # 전역/길드 등록 현황 조회
//   node scripts/register.js                 # 등록 + 중복 정리
//   node scripts/register.js --no-clean      # 정리 없이 등록만
//   node scripts/register.js --wipe          # 기존 명령어 전부 제거 후 재등록
require('dotenv').config();
const { registerCommands, listCommands } = require('../src/register');

(async () => {
  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ .env에 DISCORD_TOKEN이 없습니다.');
    process.exit(1);
  }
  if (process.argv.includes('--status')) {
    const s = await listCommands();
    console.log(`APP: ${s.appId}`);
    console.log(`GLOBAL (${s.global.length}):`, s.global.map((c) => c.name).join(', ') || '(없음)');
    for (const [gid, list] of Object.entries(s.guilds)) {
      console.log(`GUILD ${gid} (${list.length}):`, list.map((c) => c.name).join(', ') || '(없음)');
    }
    return;
  }
  const cleanStale = !process.argv.includes('--no-clean');
  if (process.argv.includes('--wipe')) {
    const { wipeAndRegister } = require('../src/reload');
    const { before, after } = await wipeAndRegister();
    console.log(`이전: 전역 ${before.global.length}개`);
    console.log(`현재: 전역 ${after.global.length}개`);
    return;
  }
  await registerCommands({ cleanStale });
})();
