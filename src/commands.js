const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const { GAMES, GAME_CHOICES } = require('./config');
const store = require('./store');
const { fetchAutoCodes, detectNewCodes } = require('./codes');
const { buildCodeEmbed, broadcast, sendToGuildGame } = require('./notify');

// ---- 슬래시 커맨드 정의 ----
const definitions = [
  new SlashCommandBuilder()
    .setName('알림채널')
    .setDescription('게임별 리딤코드 알림 채널을 설정합니다 (서버 관리자)')
    .addStringOption((o) =>
      o.setName('게임').setDescription('설정할 게임').setRequired(true)
        .addChoices(...GAME_CHOICES)
    )
    .addChannelOption((o) =>
      o.setName('채널').setDescription('알림을 보낼 텍스트 채널').setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addRoleOption((o) =>
      o.setName('멘션역할').setDescription('새 코드 알림 시 함께 멘션할 역할 (비우면 멘션 해제)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('구독')
    .setDescription('게임별 코드 알림을 켜거나 끕니다 (서버 관리자)')
    .addStringOption((o) =>
      o.setName('게임').setDescription('설정할 게임').setRequired(true)
        .addChoices(...GAME_CHOICES)
    )
    .addBooleanOption((o) =>
      o.setName('받기').setDescription('true=알림 받기, false=알림 끄기').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('구독목록')
    .setDescription('이 서버의 알림 채널과 게임별 구독 상태를 확인합니다'),

  new SlashCommandBuilder()
    .setName('최신코드')
    .setDescription('현재 사용 가능한 리딤코드를 조회합니다')
    .addStringOption((o) =>
      o.setName('게임').setDescription('조회할 게임 (비우면 전체)').setRequired(false)
        .addChoices(...GAME_CHOICES)
    ),

  new SlashCommandBuilder()
    .setName('코드등록')
    .setDescription('새 코드를 직접 등록해 구독 서버에 알립니다 (서버 관리자)')
    .addStringOption((o) =>
      o.setName('게임').setDescription('코드가 속한 게임').setRequired(true)
        .addChoices(...GAME_CHOICES)
    )
    .addStringOption((o) =>
      o.setName('코드').setDescription('리딤코드 (예: GENSHINGIFT)').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('보상').setDescription('보상 설명 (예: 원석 x60)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('도움말')
    .setDescription('봇 사용법을 안내합니다'),

  new SlashCommandBuilder()
    .setName('새로고침')
    .setDescription('슬래시 명령어를 다시 등록하고 중복을 정리합니다 (서버 관리자)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('코드제보')
    .setDescription('새 리딤코드를 제보합니다 (관리자 승인 후 전체 알림)')
    .addStringOption((o) =>
      o.setName('게임').setDescription('코드가 속한 게임').setRequired(true)
        .addChoices(...GAME_CHOICES)
    )
    .addStringOption((o) =>
      o.setName('코드').setDescription('리딤코드 (예: GENSHINGIFT)').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('보상').setDescription('보상 설명 (예: 원석 x60)').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('제보목록')
    .setDescription('승인 대기 중인 코드 제보를 확인합니다 (서버 관리자)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('제보승인')
    .setDescription('제보된 코드를 승인해 제보 서버에 알립니다 (서버 관리자)')
    .addStringOption((o) =>
      o.setName('번호').setDescription('제보 번호 (예: R1)').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('제보거부')
    .setDescription('제보된 코드를 거부합니다 (서버 관리자)')
    .addStringOption((o) =>
      o.setName('번호').setDescription('제보 번호 (예: R1)').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('제보알림')
    .setDescription('코드 제보가 들어오면 알릴 관리자 채널을 설정합니다 (서버 관리자)')
    .addChannelOption((o) =>
      o.setName('채널').setDescription('제보 알림을 받을 텍스트 채널').setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('알림해제')
    .setDescription('게임의 알림 채널 설정을 삭제합니다 (서버 관리자)')
    .addStringOption((o) =>
      o.setName('게임').setDescription('해제할 게임 (전체=모든 게임)').setRequired(true)
        .addChoices(...GAME_CHOICES, { name: '🌐 전체 게임', value: 'all' })
    )
    .addChannelOption((o) =>
      o.setName('채널').setDescription('확인용: 이 채널이 설정된 경우에만 해제').setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('제보알림해제')
    .setDescription('코드 제보 알림 채널 설정을 삭제합니다 (서버 관리자)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('알림테스트')
    .setDescription('최신 코드 자동알림을 지금 이 서버에서 테스트 발송합니다 (서버 관리자)')
    .addStringOption((o) =>
      o.setName('게임').setDescription('테스트할 게임 (비우면 전체)').setRequired(false)
        .addChoices(...GAME_CHOICES)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

// ---- 인터랙션 처리 ----
async function handleInteraction(client, interaction) {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  try {
    if (commandName === '알림채널') return await cmdChannel(interaction);
    if (commandName === '구독') return await cmdSub(interaction);
    if (commandName === '구독목록') return await cmdSubList(interaction);
    if (commandName === '최신코드') return await cmdLatest(interaction);
    if (commandName === '코드등록') return await cmdRegister(client, interaction);
    if (commandName === '도움말') return await cmdHelp(interaction);
    if (commandName === '새로고침') return await cmdReload(interaction);
    if (commandName === '코드제보') return await cmdReport(client, interaction);
    if (commandName === '제보목록') return await cmdReportList(interaction);
    if (commandName === '제보승인') return await cmdReportApprove(client, interaction);
    if (commandName === '제보거부') return await cmdReportReject(interaction);
    if (commandName === '제보알림') return await cmdReportChannel(interaction);
    if (commandName === '제보알림해제') return await cmdReportUnchannel(interaction);
    if (commandName === '알림해제') return await cmdUnchannel(interaction);
    if (commandName === '알림테스트') return await cmdTestAlarm(client, interaction);
    // 등록된 명령어인데 처리기가 없으면 무응답 방지
    await interaction.reply({ content: '⚠️ 알 수 없는 명령어입니다. /새로고침 으로 명령어를 다시 등록해보세요.', ephemeral: true });
  } catch (err) {
    console.error('[commands] 처리 오류:', err);
    const msg = '⚠️ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: msg, ephemeral: true });
    else await interaction.reply({ content: msg, ephemeral: true });
  }
}

async function cmdChannel(interaction) {
  const game = interaction.options.getString('게임');
  const channel = interaction.options.getChannel('채널');
  const role = interaction.options.getRole('멘션역할');
  const setting = store.getGuild(interaction.guildId);
  if (!setting.channels) setting.channels = {};
  if (!setting.mentions) setting.mentions = {};
  setting.channels[game] = channel.id;
  setting.mentions[game] = role ? role.id : null;
  setting.subs[game] = true; // 채널 지정 시 자동 구독 ON
  store.saveGuild(interaction.guildId, setting);
  await interaction.reply(
    `✅ **${GAMES[game].emoji} ${GAMES[game].name}** 알림 채널을 <#${channel.id}> 로 설정했습니다.` +
    (role ? `\n🔔 새 코드 알림 시 ${role} 역할을 멘션합니다.` : '\n🔕 멘션 역할 없음 (필요하면 멘션역할 옵션으로 다시 설정)') +
    `\n해당 게임 알림이 자동으로 켜졌습니다. 끄려면 /구독 게임:${GAMES[game].name} 받기:False`
  );
}

async function cmdUnchannel(interaction) {
  const game = interaction.options.getString('게임');
  const channel = interaction.options.getChannel('채널');
  const setting = store.getGuild(interaction.guildId);
  const targets = game === 'all' ? Object.keys(GAMES) : [game];

  // 채널 확인용 옵션이 있으면 현재 설정과 다를 때 중단 (오조작 방지)
  if (channel) {
    const mismatch = targets.filter((g) => store.getGameChannel(setting, g) !== channel.id);
    if (mismatch.length > 0) {
      const names = mismatch.map((g) => GAMES[g].name).join(', ');
      await interaction.reply({
        content: `⚠️ <#${channel.id}> 채널이 설정된 게임이 아닙니다: ${names}\n현재 설정을 /구독목록 으로 확인 후 다시 시도해주세요.`,
        ephemeral: true,
      });
      return;
    }
  }

  const removed = [];
  for (const g of targets) {
    if (!setting.channels) setting.channels = {};
    if (!setting.mentions) setting.mentions = {};
    if (setting.channels[g] || setting.mentions[g]) removed.push(`${GAMES[g].emoji} ${GAMES[g].name}`);
    setting.channels[g] = null;
    setting.mentions[g] = null;
    setting.subs[g] = false; // 채널 삭제 시 구독도 함께 OFF (경고 스팸 방지)
  }
  store.saveGuild(interaction.guildId, setting);
  if (removed.length === 0) {
    await interaction.reply('이미 해제된 상태입니다. (설정된 채널 없음)');
    return;
  }
  await interaction.reply(
    `🗑️ 알림 채널 해제: ${removed.join(', ')}\n` +
    `해당 게임 구독도 함께 꺼졌습니다. 다시 받으려면 /알림채널 로 지정해주세요. (알림 기록은 유지되어 재알림은 가지 않습니다)`
  );
}

async function cmdTestAlarm(client, interaction) {
  await interaction.deferReply({ ephemeral: true });
  const onlyGame = interaction.options.getString('게임');
  try {
    // 기록된 코드는 제외 (정기 체크와 동일한 기준)
    let news;
    if (onlyGame) {
      const list = await fetchAutoCodes(onlyGame);
      const known = new Set(store.getKnownCodes()[onlyGame] || []);
      const fresh = list.filter((c) => !known.has(c.code));
      news = fresh.length > 0 ? { [onlyGame]: fresh } : {};
      if (fresh.length > 0) store.addKnownCodes(onlyGame, fresh.map((c) => c.code));
    } else {
      news = await detectNewCodes(); // 새 코드 판별 + 기록 갱신 (정기 체크와 동일)
    }
    const games = Object.keys(news);
    if (games.length === 0) {
      await interaction.editReply('📭 새로 알릴 코드가 없습니다. (기록된 코드는 제외됨)');
      return;
    }
    // 이 서버에만 발송 (다른 서버 스팸 방지)
    const lines = [];
    for (const [game, list] of Object.entries(news)) {
      const r = await sendToGuildGame(client, interaction.guildId, game, list, { sourceNote: '🧪 /알림테스트 발송' });
      lines.push(`${GAMES[game].emoji} ${GAMES[game].name}: ${r.sent === 1 ? `✅ 발송 (${list.length}개)` : `⏭️ 스킵 (사유: ${r.reason})`}`);
    }
    await interaction.editReply(
      `🧪 알림 테스트 완료 (이 서버에만 발송, 기록된 코드 제외)\n` +
      lines.join('\n') +
      `\n※ 발송된 코드는 기록되어 다음 정기 체크에서 제외됩니다.`
    );
  } catch (err) {
    console.error('[test-alarm] 실패:', err);
    await interaction.editReply(`⚠️ 테스트 실패: ${err.message}`);
  }
}

async function cmdSub(interaction) {
  const game = interaction.options.getString('게임');
  const on = interaction.options.getBoolean('받기');
  const setting = store.getGuild(interaction.guildId);
  setting.subs[game] = on;
  store.saveGuild(interaction.guildId, setting);
  const channelId = store.getGameChannel(setting, game);
  let extra = '';
  if (on && !channelId) extra = `\n⚠️ 아직 채널이 없습니다. /알림채널 게임:${GAMES[game].name} 채널:#원하는채널 로 먼저 지정해주세요.`;
  await interaction.reply(
    `${on ? '🔔' : '🔕'} **${GAMES[game].emoji} ${GAMES[game].name}** 알림을 ${on ? '**켰습니다**' : '**껐습니다**'}.${extra}`
  );
}

async function cmdSubList(interaction) {
  const setting = store.getGuild(interaction.guildId);
  const lines = Object.entries(GAMES).map(([key, g]) => {
    const on = setting.subs[key];
    const ch = store.getGameChannel(setting, key);
    const mention = store.getGameMention(setting, key);
    return `${on ? '🔔' : '🔕'} ${g.emoji} ${g.name} — ${ch ? `<#${ch}>` : '❌ 채널미설정'}${mention ? ` (<@&${mention}>)` : ''}`;
  });
  const setCount = Object.entries(GAMES).filter(([k]) => store.getGameChannel(setting, k)).length;
  const embed = new EmbedBuilder()
    .setTitle('📋 이 서버의 알림 설정 (게임별)')
    .setColor(0x5865f2)
    .setDescription(
      `설정된 게임 채널 ${setCount}/${Object.keys(GAMES).length}개 — 미설정 게임은 /알림채널 로 지정해주세요.` +
      `\n📮 제보 알림 채널: ${setting.reportChannelId ? `<#${setting.reportChannelId}>` : '❌ 미설정 — /제보알림 로 지정'}`
    )
    .addFields(
      { name: '🎮 게임별 구독 + 채널', value: lines.join('\n') },
    );
  await interaction.reply({ embeds: [embed] });
}

async function cmdLatest(interaction) {
  const onlyGame = interaction.options.getString('게임');
  await interaction.deferReply();
  const targets = onlyGame ? [onlyGame] : Object.keys(GAMES);
  const embeds = [];

  for (const key of targets) {
    const auto = await fetchAutoCodes(key); // 자동 수집 미지원 게임은 [] 반환
    const manual = store.getManualCodes(key);
    const autoSet = new Set(auto.map((c) => c.code));
    const manualOnly = manual.filter((c) => !autoSet.has(c.code));
    const all = [...auto, ...manualOnly];
    if (all.length === 0) continue;

    const g = GAMES[key];
    const desc = all.map((c) => `\`${c.code}\` — ${c.rewards}`).join('\n').slice(0, 4000);
    const embed = new EmbedBuilder()
      .setTitle(`${g.emoji} ${g.name} — 사용 가능 코드 ${all.length}개`)
      .setColor(g.color)
      .setDescription(desc);
    const hints = [];
    if (g.redeemUrl) hints.push(`[공식 교환 페이지](${g.redeemUrl})`);
    hints.push(g.redeemHint);
    embed.addFields({ name: '🎁 교환 방법', value: hints.join('\n').slice(0, 1000) });
    embeds.push(embed);
  }

  if (embeds.length === 0) {
    await interaction.editReply('현재 조회된 코드가 없습니다. 새 코드가 나오면 알림 채널로 자동 전송됩니다.');
  } else {
    await interaction.editReply({ embeds: embeds.slice(0, 10) });
  }
}

async function cmdRegister(client, interaction) {
  const game = interaction.options.getString('게임');
  const code = interaction.options.getString('코드').trim().toUpperCase();
  const rewards = interaction.options.getString('보상') || '보상 정보 없음';

  if (store.isKnown(game, code)) {
    await interaction.reply({ content: `⚠️ \`${code}\` 코드는 이미 등록된 코드입니다.`, ephemeral: true });
    return;
  }

  store.addManualCode(game, code, rewards);
  await interaction.reply(`✅ **${GAMES[game].name}** 코드 \`${code}\` 를 등록했습니다. 구독 중인 서버에 알림을 보냅니다…`);

  const news = { [game]: [{ code, rewards }] };
  const sent = await broadcast(client, news, { isManual: true });
  await interaction.followUp(`📢 ${sent}개 채널에 알림을 전송했습니다.`);
}

async function cmdReport(client, interaction) {
  const game = interaction.options.getString('게임');
  const code = interaction.options.getString('코드').trim().toUpperCase();
  const rewards = interaction.options.getString('보상') || '보상 정보 없음';

  // 제보알림 채널 미설정 서버는 제보 자체를 막음
  const guildSetting = store.getGuild(interaction.guildId);
  if (!guildSetting.reportChannelId) {
    await interaction.reply({
      content: '⚠️ 이 서버는 제보 기능이 꺼져 있습니다. (제보알림 채널 미설정)\n서버 관리자에게 /제보알림 설정을 요청해주세요.',
      ephemeral: true,
    });
    return;
  }

  if (store.isKnown(game, code)) {
    await interaction.reply({ content: `⚠️ \`${code}\` 코드는 이미 등록된 코드입니다.`, ephemeral: true });
    return;
  }
  const { report, created } = store.addReport({
    game,
    code,
    rewards,
    reporterId: interaction.user.id,
    reporterTag: interaction.user.tag,
    guildId: interaction.guildId,
  });
  if (!created) {
    await interaction.reply({ content: `⚠️ \`${code}\` 코드는 이미 제보 대기 중입니다. (번호: ${report.id})`, ephemeral: true });
    return;
  }
  await interaction.reply(
    `📮 **${GAMES[game].emoji} ${GAMES[game].name}** 코드 \`${code}\` 제보 접수! (번호: ${report.id})\n` +
    `서버 관리자가 /제보승인 번호:${report.id} 로 승인하면 이 서버의 해당 게임 채널에 알림이 갑니다.`
  );

  // 제보알림 채널이 설정된 서버면 관리자에게 임베드로 알림
  try {
    const setting = store.getGuild(interaction.guildId);
    if (setting.reportChannelId) {
      const channel = await client.channels.fetch(setting.reportChannelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle(`📮 새 코드 제보 (${report.id})`)
          .setColor(0xf5a623)
          .addFields(
            { name: '🎮 게임', value: `${GAMES[game].emoji} ${GAMES[game].name}`, inline: true },
            { name: '🎁 코드', value: `\`${code}\``, inline: true },
            { name: '🎀 보상', value: rewards.slice(0, 200) },
            { name: '👤 제보자', value: `${interaction.user.tag}`, inline: true },
          )
          .setTimestamp();
        await channel.send({
          content: `/제보승인 번호:${report.id} 로 승인, /제보거부 번호:${report.id} 로 거부`,
          embeds: [embed],
        });
      }
    }
  } catch (err) {
    console.error('[report] 제보알림 전송 실패:', err.message);
  }
}

async function cmdReportChannel(interaction) {
  const channel = interaction.options.getChannel('채널');
  const setting = store.getGuild(interaction.guildId);
  setting.reportChannelId = channel.id;
  store.saveGuild(interaction.guildId, setting);
  await interaction.reply(
    `✅ 코드 제보 알림 채널을 <#${channel.id}> 로 설정했습니다.\n` +
    `앞으로 /코드제보가 들어오면 이 채널에 관리자용 알림이 갑니다. /제보목록·/제보승인·/제보거부 로 처리해주세요.`
  );
}

async function cmdReportUnchannel(interaction) {
  const setting = store.getGuild(interaction.guildId);
  if (!setting.reportChannelId) {
    await interaction.reply('이미 해제된 상태입니다. (제보알림 채널 미설정)');
    return;
  }
  setting.reportChannelId = null;
  store.saveGuild(interaction.guildId, setting);
  await interaction.reply(
    '🗑️ 코드 제보 알림 채널을 해제했습니다.\n' +
    '이제 이 서버에서 /코드제보는 차단됩니다. 다시 받으려면 /제보알림 로 지정해주세요. (대기 중인 제보는 /제보목록 에 그대로 남아 있습니다)'
  );
}

async function cmdReportList(interaction) {
  const reports = store.getReports();
  if (reports.length === 0) {
    await interaction.reply('📭 승인 대기 중인 제보가 없습니다.');
    return;
  }
  const lines = reports.slice(0, 20).map(
    (r) => `\`${r.id}\` ${GAMES[r.game] ? GAMES[r.game].emoji + ' ' + GAMES[r.game].name : r.game} — \`${r.code}\` (${r.rewards.slice(0, 40)}) — 제보: ${r.reporterTag || r.reporterId || '?'}`
  );
  const embed = new EmbedBuilder()
    .setTitle(`📮 제보 대기 목록 (${reports.length}개)`)
    .setColor(0x5865f2)
    .setDescription(lines.join('\n').slice(0, 4000));
  await interaction.reply({ embeds: [embed] });
}

async function cmdReportApprove(client, interaction) {
  const id = interaction.options.getString('번호').trim().toUpperCase();
  const report = store.findReport(id);
  if (!report) {
    await interaction.reply({ content: `⚠️ ${id} 제보를 찾을 수 없습니다. /제보목록 으로 확인해주세요.`, ephemeral: true });
    return;
  }
  if (store.isKnown(report.game, report.code)) {
    store.removeReport(report.id);
    await interaction.reply({ content: `⚠️ \`${report.code}\` 코드는 이미 등록된 코드입니다. 제보를 정리했습니다.`, ephemeral: true });
    return;
  }
  store.addManualCode(report.game, report.code, report.rewards);
  store.removeReport(report.id);
  await interaction.reply(`✅ ${report.id} 승인! **${GAMES[report.game].name}** 코드 \`${report.code}\` 를 등록했습니다. 제보 서버의 해당 게임 채널에 알림을 보냅니다… (제보: ${report.reporterTag || '?'})`);

  // 제보가 올라온 서버의 해당 게임 채널에만 발송 (전체 발송 아님)
  const result = await sendToGuildGame(client, report.guildId, report.game, [{ code: report.code, rewards: report.rewards }], { isManual: true });
  if (result.sent === 1) {
    await interaction.followUp(`📢 <#${result.channelId}> 채널에 알림을 전송했습니다.`);
  } else if (result.reason === 'unsubscribed') {
    await interaction.followUp(`⚠️ 제보 서버에서 **${GAMES[report.game].name}** 구독이 꺼져 있어 발송하지 않았습니다. 코드는 등록됐으니 /구독 으로 켜면 다음부터 갑니다.`);
  } else if (result.reason === 'no-guild') {
    await interaction.followUp(`⚠️ 제보된 서버 정보를 찾을 수 없어 발송하지 않았습니다. 코드는 등록됐으니 /최신코드 에서 확인 가능합니다.`);
  } else {
    await interaction.followUp(`⚠️ 제보 서버에 **${GAMES[report.game].name}** 채널이 없어 발송하지 않았습니다. 코드는 등록됐으니 /알림채널 로 지정하면 다음부터 갑니다.`);
  }
}

async function cmdReportReject(interaction) {
  const id = interaction.options.getString('번호').trim().toUpperCase();
  const removed = store.removeReport(id);
  if (!removed) {
    await interaction.reply({ content: `⚠️ ${id} 제보를 찾을 수 없습니다. /제보목록 으로 확인해주세요.`, ephemeral: true });
    return;
  }
  await interaction.reply(`🗑️ ${removed.id} (**${GAMES[removed.game] ? GAMES[removed.game].name : removed.game}** \`${removed.code}\`) 제보를 거부했습니다.`);
}

async function cmdHelp(interaction) {
  const gameNames = Object.values(GAMES).map((g) => g.name).join(' · ');
  const embed = new EmbedBuilder()
    .setTitle('🤖 리딤코드 알림 봇 사용법')
    .setColor(0x5865f2)
    .setDescription(
      `${gameNames}의 리딤코드를 알려드립니다.\n` +
      `원신/스타레일/젠레스/엔드필드/니케/명조/소녀전선2/블루아카이브/이환/트릭컬은 **30분마다 자동으로** 새 코드를 감지해 각 게임 채널에 보냅니다. 프로밀리아는 코드표 감시 중(출시 후 자동 반영).\n` +
      `실버팰리스는 코드가 나오면 /코드등록으로 직접 등록해주세요.`
    )
    .addFields(
      { name: '🛠️ 최초 설정 (관리자)', value: '`/알림채널 게임:원신 채널:#원신알림 멘션역할:@게이머`\n게임마다 채널을 따로 지정합니다. 지정한 게임은 자동 구독ON. 관심 게임 전부 설정 권장.\n`/알림해제 게임:원신` — 채널·멘션 삭제 + 구독OFF (전체는 게임:전체 게임)' },
      { name: '🎮 구독 관리 (관리자)', value: '`/구독 게임:니케 받기:False`\n`/구독목록` — 게임별 채널/멘션/ON-OFF 확인' },
      { name: '🔍 코드 조회 (누구나)', value: '`/최신코드`\n`/최신코드 게임:원신`' },
      { name: '✋ 직접 등록 (관리자)', value: '`/코드등록 게임:명조 코드:WUTHERINGGIFT 보상:아스트라이트x50`\n자동 수집보다 먼저 알리고 싶을 때 직접 등록하면 구독 서버 전체에 즉시 알림이 갑니다.' },
      { name: '📮 코드 제보 (누구나 + 관리자 승인)', value: '`/코드제보 게임:트릭컬 코드:GOOGLETOP3` — /제보알림 설정된 서버에서만 가능\n`/제보알림 채널:#관리자채널` — 제보 도착 알림 설정 (관리자, 이 서버에만 적용)\n`/제보목록` — 대기 목록 확인 (관리자)\n`/제보승인 번호:R1` — 승인 후 제보 서버에만 알림 (관리자)\n`/제보거부 번호:R1` — 거부 (관리자)\n`/제보알림해제` — 제보 알림 채널 삭제, 이후 제보는 차단 (관리자)' },
      { name: '🔄 중복 정리 (관리자)', value: '`/새로고침` — 명령어가 2개씩 보이면 실행. 기존 명령어 전부 제거 후 재등록\n`/알림테스트` — 최신 코드 알림을 이 서버에서 테스트 발송 (기록된 코드 제외)' },
    );
  await interaction.reply({ embeds: [embed] });
}

async function cmdReload(interaction) {
  // 동시에 2번 실행되면 서로 덮어써서 꼬이므로 1회만 허용
  if (global.__reloading) {
    await interaction.reply({ content: '⏳ 이미 새로고침이 진행 중입니다. 잠시 후 다시 시도해주세요.', ephemeral: true });
    return;
  }
  global.__reloading = true;
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (err) {
    global.__reloading = false;
    console.error('[reload] defer 실패:', err.message);
    try {
      await interaction.reply({ content: '⚠️ 응답 준비 실패. 잠시 후 다시 시도해주세요.', ephemeral: true });
    } catch {}
    return;
  }
  try {
    await interaction.editReply('🔄 기존 명령어 비우는 중… (10~20초 소요)');
    const { wipeAndRegister } = require('./reload');
    const { before, after } = await wipeAndRegister(async (msg) => {
      try { await interaction.editReply(msg); } catch {}
    });
    const fmt = (s) => {
      const g = Object.entries(s.guilds).map(([gid, list]) => `${gid}:${list.length}개`).join(', ') || '없음';
      return `전역 ${s.global.length}개 / 길드(${g})`;
    };
    await interaction.editReply(
      `🔄 기존 명령어 전부 제거 후 재등록 완료\n` +
      `· 이전: ${fmt(before)}\n` +
      `· 현재: ${fmt(after)}\n` +
      (after.global.length === 0
        ? `⚠️ 재등록 결과가 비어있습니다! 봇을 재시작하면 시작 시 자동 재등록됩니다.\n`
        : '') +
      `전역 반영은 최대 1시간 걸릴 수 있어요. 테스트용이면 .env에 GUILD_ID를 넣고 재시작하세요.`
    );
  } catch (err) {
    console.error('[reload] 실패:', err);
    try {
      await interaction.editReply(`⚠️ 재등록 실패: ${err.message}\n명령어가 비어있다면 봇을 재시작하면 시작 시 자동 재등록됩니다.`);
    } catch {}
  } finally {
    global.__reloading = false;
  }
}

module.exports = { definitions, handleInteraction };
