const fs = require('node:fs');
const path = require('node:path');
const { GAME_KEYS } = require('./config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GUILDS_FILE = path.join(DATA_DIR, 'guilds.json');
const CODES_FILE = path.join(DATA_DIR, 'codes.json');
const MANUAL_FILE = path.join(DATA_DIR, 'manual.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[store] ${file} 읽기 실패, 기본값 사용:`, err.message);
    return fallback;
  }
}

function saveJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ---- 서버(길드) 설정 ----
// 구조: { [guildId]: { subs: { [game]: boolean }, channels: { [game]: channelId|null }, mentions: { [game]: roleId|null }, reportChannelId: string|null, channelId?, mentionRoleId? (구버전 호환용) } }
function defaultSubs() {
  return Object.fromEntries(GAME_KEYS.map((k) => [k, true]));
}

function defaultChannels() {
  return Object.fromEntries(GAME_KEYS.map((k) => [k, null]));
}

function defaultMentions() {
  return Object.fromEntries(GAME_KEYS.map((k) => [k, null]));
}

// 구버전(공통 channelId/mentionRoleId) → 게임별 구조로 정규화 (메모리상, 저장도 갱신)
function normalizeGuild(setting) {
  if (!setting.subs || typeof setting.subs !== 'object') setting.subs = defaultSubs();
  if (!setting.channels || typeof setting.channels !== 'object') setting.channels = defaultChannels();
  if (!setting.mentions || typeof setting.mentions !== 'object') setting.mentions = defaultMentions();
  // 새 게임이 추가돼도 기본값 보정
  for (const k of GAME_KEYS) {
    if (typeof setting.subs[k] !== 'boolean') setting.subs[k] = true;
    if (typeof setting.channels[k] !== 'string') setting.channels[k] = null;
    if (setting.mentions[k] !== null && typeof setting.mentions[k] !== 'string') setting.mentions[k] = null;
  }
  // 구버전 마이그레이션: 공통 채널이 있었는데 게임별이 전부 비어있으면 전 게임에 복사
  if (setting.channelId && Object.values(setting.channels).every((v) => !v)) {
    for (const k of GAME_KEYS) setting.channels[k] = setting.channelId;
  }
  if (setting.mentionRoleId && Object.values(setting.mentions).every((v) => !v)) {
    for (const k of GAME_KEYS) setting.mentions[k] = setting.mentionRoleId;
  }
  if (typeof setting.reportChannelId !== 'string') setting.reportChannelId = null;
  return setting;
}

function getGameChannel(setting, game) {
  if (setting.channels && setting.channels[game]) return setting.channels[game];
  return setting.channelId || null; // 구버전 폴백
}

function getGameMention(setting, game) {
  if (setting.mentions && setting.mentions[game]) return setting.mentions[game];
  return null;
}

function getGuild(guildId) {
  const all = loadJson(GUILDS_FILE, {});
  if (!all[guildId]) {
    all[guildId] = { channelId: null, mentionRoleId: null, subs: defaultSubs(), channels: defaultChannels(), mentions: defaultMentions(), reportChannelId: null };
    saveJson(GUILDS_FILE, all);
  }
  normalizeGuild(all[guildId]);
  saveJson(GUILDS_FILE, all);
  return all[guildId];
}

function saveGuild(guildId, setting) {
  const all = loadJson(GUILDS_FILE, {});
  all[guildId] = setting;
  saveJson(GUILDS_FILE, all);
}

function getAllGuilds() {
  return loadJson(GUILDS_FILE, {});
}

// ---- 이미 알린 코드 기록 ----
// 구조: { [game]: string[] } — 자동 수집 + 수동 등록 모두 기록 (중복 알림 방지)
function getKnownCodes() {
  return loadJson(CODES_FILE, {});
}

function addKnownCodes(game, codes) {
  const all = loadJson(CODES_FILE, {});
  const set = new Set(all[game] || []);
  for (const c of codes) set.add(c);
  all[game] = [...set];
  saveJson(CODES_FILE, all);
}

function isKnown(game, code) {
  const all = loadJson(CODES_FILE, {});
  return (all[game] || []).includes(code);
}

// ---- 수동 등록 코드 (자동 수집 API가 없는 게임용) ----
// 구조: { [game]: [{ code, rewards, at }] }
function getManualCodes(game) {
  const all = loadJson(MANUAL_FILE, {});
  return all[game] || [];
}

function addManualCode(game, code, rewards) {
  const all = loadJson(MANUAL_FILE, {});
  const list = all[game] || [];
  if (!list.some((c) => c.code === code)) {
    list.unshift({ code, rewards: rewards || '보상 정보 없음', at: new Date().toISOString() });
    all[game] = list.slice(0, 50); // 게임당 최대 50개 보관
    saveJson(MANUAL_FILE, all);
  }
  addKnownCodes(game, [code]);
}

// ---- 유저 제보 (승인 전 대기 목록) ----
// 구조: { seq: number, items: [{ id, game, code, rewards, reporterId, reporterTag, guildId, at }] }
function loadReports() {
  const data = loadJson(REPORTS_FILE, { seq: 0, items: [] });
  if (!Array.isArray(data.items)) data.items = [];
  if (typeof data.seq !== 'number') data.seq = data.items.length;
  return data;
}

function getReports() {
  return loadReports().items;
}

function findReport(id) {
  return loadReports().items.find((r) => r.id === String(id).toUpperCase());
}

function findReportByCode(game, code) {
  const up = String(code).toUpperCase();
  return loadReports().items.find((r) => r.game === game && r.code === up);
}

function addReport({ game, code, rewards, reporterId, reporterTag, guildId }) {
  const data = loadReports();
  const up = String(code).toUpperCase();
  const dup = data.items.find((r) => r.game === game && r.code === up);
  if (dup) return { report: dup, created: false };
  data.seq += 1;
  const report = {
    id: `R${data.seq}`,
    game,
    code: up,
    rewards: rewards || '보상 정보 없음',
    reporterId: reporterId || null,
    reporterTag: reporterTag || null,
    guildId: guildId || null,
    at: new Date().toISOString(),
  };
  data.items.unshift(report);
  saveJson(REPORTS_FILE, data);
  return { report, created: true };
}

function removeReport(id) {
  const data = loadReports();
  const idx = data.items.findIndex((r) => r.id === String(id).toUpperCase());
  if (idx < 0) return null;
  const [removed] = data.items.splice(idx, 1);
  saveJson(REPORTS_FILE, data);
  return removed;
}

module.exports = { getGuild, saveGuild, getAllGuilds, getKnownCodes, addKnownCodes, isKnown, getManualCodes, addManualCode, normalizeGuild, getGameChannel, getGameMention, getReports, findReport, findReportByCode, addReport, removeReport };
