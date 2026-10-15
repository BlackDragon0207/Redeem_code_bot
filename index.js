require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const cron = require('node-cron');
const { handleInteraction } = require('./src/commands');
const { registerCommands } = require('./src/register');
const { detectNewCodes, seedKnownCodes } = require('./src/codes');
const { broadcast, sendToGuildGame } = require('./src/notify');

const TOKEN = process.env.DISCORD_TOKEN;
const CHECK_CRON = process.env.CHECK_CRON || '*/30 * * * *';

if (!TOKEN || TOKEN.includes('여기에')) {
  console.error('❌ .env 파일에 DISCORD_TOKEN을 먼저 입력해주세요. (.env.example 참고)');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// 슬래시 커맨드 등록 + 미사용 스코프 정리(중복 방지)는 src/register.js
// - GUILD_ID가 있으면 테스트 서버에 즉시 등록 + 전역 비움
// - 없으면 전역 등록 + 알려진 길드 명령어 비움

// 주기적 코드 체크 → 신규 코드만 구독 서버에 알림
async function checkAndNotify() {
  console.log('[auto-check] 코드 확인 중…');
  try {
    const news = await detectNewCodes();
    const count = Object.values(news).reduce((n, list) => n + list.length, 0);
    if (count === 0) {
      console.log('[auto-check] 새 코드 없음');
      return;
    }
    console.log('[auto-check] 새 코드 발견:', JSON.stringify(news));
    const sent = await broadcast(client, news);
    console.log(`[auto-check] ${sent}개 채널에 알림 전송`);
  } catch (err) {
    console.error('[auto-check] 오류:', err.message);
  }
}

client.once('ready', async () => {
  console.log(`🤖 로그인 완료: ${client.user.tag}`);

  // 상태 메시지 교대 (기본 15초마다): "By. blackdragon0207" ↔ "리딤코드 확인하기"
  // Discord 게이트웨이 제한(60초당 5회) 때문에 12초 미만 간격은 금지 → 기본 15초
  const statuses = [
    { name: 'By. blackdragon0207', type: ActivityType.Playing },
    { name: '리딤코드 확인하기', type: ActivityType.Watching },
  ];
  const STATUS_INTERVAL_MS = Math.max(Number(process.env.STATUS_INTERVAL_SEC) || 15, 15) * 1000;
  let statusIdx = 0;
  const applyStatus = () => {
    const s = statuses[statusIdx % statuses.length];
    client.user.setActivity(s.name, { type: s.type });
    statusIdx++;
  };
  applyStatus();
  setInterval(applyStatus, STATUS_INTERVAL_MS);
  console.log(`🟢 상태 메시지 교대 시작 (${STATUS_INTERVAL_MS / 1000}초마다)`);

  // 테스트 서버가 지정되면 켜자마자 "기록에 없는 새 코드만" 그 서버에 1회 발송
  // (GUILD_ID 없음 → 동작 안 함 / 기록된 코드는 제외 → 재시작해도 중복 발송 없음)
  // detectNewCodes()가 발송분을 바로 기록하므로 다음 정기 체크와 중복되지 않음
  // 첫 실행이면 기록이 비어서 전체 목록이 테스트 서버로 1회 발송됨 (다른 서버에는 안 감)
  if (process.env.GUILD_ID) {
    try {
      console.log('[startup-push] 테스트 서버로 새 코드 확인 중…');
      const news = await detectNewCodes();
      const games = Object.keys(news);
      if (games.length === 0) {
        console.log('[startup-push] 새 코드 없음 (기록된 코드 제외)');
      }
      let sentGames = 0;
      for (const [game, list] of Object.entries(news)) {
        const r = await sendToGuildGame(client, process.env.GUILD_ID, game, list, { sourceNote: '🚀 봇 시작 시 테스트 발송' });
        if (r.sent === 1) sentGames++;
        else console.log(`[startup-push] ${game} 스킵 (사유: ${r.reason})`);
      }
      console.log(`[startup-push] 완료: ${sentGames}/${games.length}개 게임 발송`);
    } catch (err) {
      console.error('[startup-push] 실패:', err.message);
    }
  }

  // 첫 실행이면 남은 코드들을 조용히 기록만 하고 알림 스팸 방지
  // (위 푸시에서 이미 기록됐으면 스킵됨)
  const seeded = await seedKnownCodes().catch((e) => {
    console.error('[seed] 실패:', e.message);
    return false;
  });
  if (seeded) console.log('📦 기존 코드 목록을 초기 저장했습니다 (알림 없음)');

  cron.schedule(CHECK_CRON, checkAndNotify);
  console.log(`⏰ 자동 체크 예약됨 (${CHECK_CRON})`);
});

client.on('interactionCreate', (interaction) => handleInteraction(client, interaction));

(async () => {
  // 켤 때마다 슬래시 명령어 리로드 (PUT = 전체 교체 + 미사용 스코프 정리)
  try {
    const result = await registerCommands();
    if (result && result.count) console.log(`🔄 시작 시 명령어 리로드 완료 (${result.count}개, 모드: ${result.mode})`);
  } catch (err) {
    console.error('⚠️ 시작 시 명령어 등록 실패 — 봇은 계속 시작합니다:', err.message);
  }
  await client.login(TOKEN);
})();
