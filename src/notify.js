const { EmbedBuilder } = require('discord.js');
const { GAMES } = require('./config');
const store = require('./store');

// 새 코드 알림 임베드 생성
function buildCodeEmbed(gameKey, codes, { isManual = false, sourceNote = '' } = {}) {
  const game = GAMES[gameKey];
  const embed = new EmbedBuilder()
    .setTitle(`${game.emoji} ${game.name} — 새 리딤코드 ${codes.length}개!`)
    .setColor(game.color)
    .setTimestamp();

  const lines = codes.map((c) => {
    const reward = c.rewards ? ` — ${c.rewards}` : '';
    return `\`${c.code}\`${reward}`;
  });
  embed.setDescription(lines.join('\n').slice(0, 4000));

  const hints = [];
  if (game.redeemUrl) hints.push(`[공식 교환 페이지](${game.redeemUrl})`);
  hints.push(game.redeemHint);
  if (sourceNote) hints.push(sourceNote);
  if (isManual) hints.push('✋ 서버 관리자가 직접 등록한 코드입니다.');
  embed.addFields({ name: '🎁 교환 방법', value: hints.join('\n').slice(0, 1000) });

  embed.setFooter({ text: '코드는 유효기간이 짧습니다. 최대한 빨리 입력하세요!' });
  return embed;
}

// news: { game: [{code, rewards}] } 를 게임별 설정 채널에 전송
async function broadcast(client, news, opts = {}) {
  const guilds = store.getAllGuilds();
  let sent = 0;
  const channelCache = new Map();

  async function fetchChannel(channelId) {
    if (channelCache.has(channelId)) return channelCache.get(channelId);
    try {
      const ch = await client.channels.fetch(channelId);
      channelCache.set(channelId, ch);
      return ch;
    } catch {
      channelCache.set(channelId, null);
      return null;
    }
  }

  for (const [guildId, rawSetting] of Object.entries(guilds)) {
    const setting = store.normalizeGuild ? store.normalizeGuild(rawSetting) : rawSetting;

    for (const [game, codes] of Object.entries(news)) {
      if (!setting.subs || setting.subs[game] === false) continue; // 구독 해제된 게임 스킵
      if (!codes || codes.length === 0) continue;
      const channelId = store.getGameChannel ? store.getGameChannel(setting, game) : setting.channelId;
      if (!channelId) {
        console.warn(`[notify] 채널 미설정 (서버 ${guildId}, ${game}) — /알림채널 로 지정 필요`);
        continue;
      }
      const channel = await fetchChannel(channelId);
      if (!channel || !channel.isTextBased()) {
        console.warn(`[notify] 채널을 찾을 수 없음 (서버 ${guildId}, ${game}:${channelId})`);
        continue;
      }
      try {
        const mentionId = store.getGameMention ? store.getGameMention(setting, game) : setting.mentionRoleId;
        const mention = mentionId ? `<@&${mentionId}> ` : '';
        await channel.send({
          content: mention || undefined,
          embeds: [buildCodeEmbed(game, codes, opts)],
        });
        sent++;
      } catch (err) {
        console.error(`[notify] 전송 실패 (서버 ${guildId}, ${game}):`, err.message);
      }
    }
  }
  return sent;
}

// 특정 1개 서버의 게임 채널에만 전송 (제보승인용)
// 반환: { sent: 0|1, reason?: 'no-guild'|'unsubscribed'|'no-channel'|'send-failed', channelId? }
async function sendToGuildGame(client, guildId, game, codes, opts = {}) {
  if (!guildId) return { sent: 0, reason: 'no-guild' };
  const raw = store.getAllGuilds()[guildId];
  if (!raw) return { sent: 0, reason: 'no-guild' };
  const setting = store.normalizeGuild ? store.normalizeGuild(raw) : raw;
  if (!setting.subs || setting.subs[game] === false) return { sent: 0, reason: 'unsubscribed' };
  if (!codes || codes.length === 0) return { sent: 0, reason: 'send-failed' };
  const channelId = store.getGameChannel ? store.getGameChannel(setting, game) : setting.channelId;
  if (!channelId) return { sent: 0, reason: 'no-channel' };
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn(`[notify] 채널을 찾을 수 없음 (서버 ${guildId}, ${game}:${channelId})`);
    return { sent: 0, reason: 'no-channel' };
  }
  try {
    const mentionId = store.getGameMention ? store.getGameMention(setting, game) : null;
    await channel.send({
      content: mentionId ? `<@&${mentionId}> ` : undefined,
      embeds: [buildCodeEmbed(game, codes, opts)],
    });
    return { sent: 1, channelId };
  } catch (err) {
    console.error(`[notify] 전송 실패 (서버 ${guildId}, ${game}):`, err.message);
    return { sent: 0, reason: 'send-failed' };
  }
}

module.exports = { buildCodeEmbed, broadcast, sendToGuildGame };
