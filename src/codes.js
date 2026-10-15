const axios = require('axios');
const cheerio = require('cheerio');
const { GAMES } = require('./config');
const store = require('./store');

const HOYO_CODES_API = 'https://hoyo-codes.seria.moe/codes?game=';
// 엔드필드 코드표 (Game8 위키) — 저쪽 봇과 같은 소스
const ENDFIELD_GAME8_URL = 'https://game8.co/games/Arknights-Endfield/archives/571509';

// Game8 코드표에서 엔드필드 코드 목록 가져오기 — 코드 입력칸(input.a-clipboard__textInput) + 같은 행 보상 텍스트
async function fetchEndfieldCodes() {
  try {
    const { data: html } = await axios.get(ENDFIELD_GAME8_URL, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const codes = [];
    $('input.a-clipboard__textInput').each((_, el) => {
      const code = ($(el).attr('value') || '').trim();
      if (!code || code.length < 4 || !/^[A-Za-z0-9_-]{4,40}$/.test(code)) return;
      if (seen.has(code)) return;
      seen.add(code);
      let rewards = '보상 정보 없음';
      try {
        const cells = $(el).closest('tr').find('td');
        if (cells.length >= 2) {
          const rewardText = $(cells[1]).text().trim().replace(/\s+/g, ' ');
          if (rewardText && rewardText !== code) rewards = rewardText.slice(0, 200);
        }
      } catch { /* 보상 파싱 실패해도 코드는 유지 */ }
      codes.push({ code, rewards });
    });
    return codes;
  } catch (err) {
    console.error('[codes] endfield 자동 수집 실패:', err.message);
    return [];
  }
}

// 니케 코드표 (nikke.gg) — "Status" 헤더 테이블(활성)만 파싱, "Expired" 테이블은 제외
const NIKKE_GG_URL = 'https://nikke.gg/cd-keys-guide/';

async function fetchNikkeCodes() {
  try {
    const { data: html } = await axios.get(NIKKE_GG_URL, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const codes = [];
    $('table').each((_, tbl) => {
      const headerText = $(tbl).find('tr').first().text();
      if (!/Status/i.test(headerText) || /Expired/i.test(headerText)) return; // 활성 테이블만
      $(tbl).find('tr').slice(1).each((__, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        const status = cells.length >= 4 ? $(cells[3]).text().trim().toLowerCase() : 'working';
        if (/expired|invalid|dead/.test(status)) return;
        const code = $(cells[0]).text().trim().replace(/\s+/g, '');
        if (!code || !/^[A-Za-z0-9]{3,40}$/.test(code)) return;
        if (seen.has(code.toUpperCase())) return;
        seen.add(code.toUpperCase());
        const rewardText = $(cells[1]).text().trim().replace(/\s+/g, ' ');
        codes.push({ code, rewards: rewardText ? rewardText.slice(0, 200) : '보상 정보 없음' });
      });
    });
    return codes;
  } catch (err) {
    console.error('[codes] nikke 자동 수집 실패:', err.message);
    return [];
  }
}

// PocketGamer 코드 페이지 공용 파서 — h2 제목이 정확히 일치하는 "working/활성" 섹션의 ul 목록만 파싱
async function fetchPGWorkingList(url, h2Title, logTag) {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const codes = [];
    const want = h2Title.toLowerCase();
    $('h2').each((_, h) => {
      const got = $(h).text().trim().toLowerCase();
      if (got !== want && !got.startsWith(want)) return;
      let sib = $(h).next();
      let steps = 0;
      while (sib.length && !/^h[12]$/i.test(sib[0].tagName) && steps < 10) {
        if (sib[0].tagName === 'ul') {
          sib.find('li').each((__, li) => {
            const text = $(li).text().trim().replace(/\s+/g, ' ');
            const m = text.match(/^([A-Za-z0-9]{3,40})\s*[—–-]\s*(.+)$/);
            if (!m) return;
            const code = m[1].trim();
            if (seen.has(code.toUpperCase())) return;
            seen.add(code.toUpperCase());
            codes.push({ code, rewards: m[2].trim().slice(0, 200) || '보상 정보 없음' });
          });
        }
        sib = sib.next();
        steps++;
      }
    });
    return codes;
  } catch (err) {
    console.error(`[codes] ${logTag} 자동 수집 실패:`, err.message);
    return [];
  }
}

// 명조 코드표 (PocketGamer) — "Wuthering Waves codes - working" 섹션의 목록만 파싱 ("not working" 제외)
const WUWA_PG_URL = 'https://www.pocketgamer.com/wuthering-waves/codes/';

function fetchWuwaCodes() {
  return fetchPGWorkingList(WUWA_PG_URL, 'Wuthering Waves codes - working', 'wuwa');
}

// 소녀전선2 코드표 (PocketGamer) — 활성 섹션 목록 파싱 (서버 표기는 보상란에 유지)
const GFL2_PG_URL = 'https://www.pocketgamer.com/gfl2-exilium/codes/';

function fetchGfl2Codes() {
  return fetchPGWorkingList(GFL2_PG_URL, 'Active Girls Frontline 2 Exilium codes', 'gfl2');
}

// 블루아카이브 쿠폰표 — Code|Rewards 테이블 파싱 (만료 테이블은 보상 열이 없어 제외)
const BLUEARCHIVE_URL = 'https://www.dexerto.com/codes/blue-archive-codes-3311458/';

async function fetchBlueArchiveCodes() {
  try {
    const { data: html } = await axios.get(BLUEARCHIVE_URL, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const codes = [];
    $('table').each((_, tbl) => {
      const head = $(tbl).find('tr').first().text();
      if (!/Reward/i.test(head)) return; // 활성 테이블만
      $(tbl).find('tr').slice(1).each((__, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        const first = ($(cells[0]).text().trim().split(/\s+/)[0] || '');
        if (!/^[A-Za-z0-9]{3,30}$/.test(first)) return;
        if (seen.has(first.toUpperCase())) return;
        seen.add(first.toUpperCase());
        const rewardText = $(cells[1]).text().trim().replace(/\s+/g, ' ');
        codes.push({ code: first, rewards: rewardText ? rewardText.slice(0, 200) : '보상 정보 없음' });
      });
    });
    return codes;
  } catch (err) {
    console.error('[codes] bluearchive 자동 수집 실패:', err.message);
    return [];
  }
}

// 아주르 프로밀리아 코드표 — Code|Rewards|Status 활성 테이블 파싱 (미출시라 현재 0개, 출시 후 자동 반영)
const PROMILIA_URL = 'https://azurpromiliaguide.cc/codes';

async function fetchPromiliaCodes() {
  try {
    const { data: html } = await axios.get(PROMILIA_URL, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const codes = [];
    $('table').each((_, tbl) => {
      const heads = $(tbl).find('tr').first().find('th,td').map((__, c) => $(c).text().trim().toLowerCase()).get();
      if (heads.length < 3 || heads[0] !== 'code' || heads[1] !== 'rewards' || heads[2] !== 'status') return;
      $(tbl).find('tr').slice(1).each((__, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;
        const status = $(cells[2]).text().trim().toLowerCase();
        if (!/active|working|live|available/.test(status)) return;
        const code = $(cells[0]).text().trim().replace(/\s+/g, '');
        if (!/^[A-Za-z0-9]{3,40}$/.test(code)) return;
        if (seen.has(code.toUpperCase())) return;
        seen.add(code.toUpperCase());
        const rewardText = $(cells[1]).text().trim().replace(/\s+/g, ' ');
        codes.push({ code, rewards: rewardText ? rewardText.slice(0, 200) : '보상 정보 없음' });
      });
    });
    return codes;
  } catch (err) {
    console.error('[codes] promilia 자동 수집 실패:', err.message);
    return [];
  }
}

// 이환(NTE) 코드표 — Code|Rewards|Status 테이블 중 상태에 EXPIRED가 없는 행만 (아카이브 테이블 제외)
const NTE_URL = 'https://nte-codes.com/codes/';

async function fetchNteCodes() {
  try {
    const { data: html } = await axios.get(NTE_URL, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const codes = [];
    $('table').each((_, tbl) => {
      const heads = $(tbl).find('tr').first().find('th,td').map((__, c) => $(c).text().trim().toLowerCase()).get();
      if (heads.length < 3 || heads[0] !== 'code' || heads[1] !== 'rewards' || heads[2] !== 'status') return;
      $(tbl).find('tr').slice(1).each((__, row) => {
        const cells = $(row).find('td');
        if (cells.length < 3) return;
        const status = $(cells[2]).text().trim();
        if (/expired/i.test(status)) return; // 아카이브(만료) 행 제외 — "No expiry"는 활성이라 통과
        const code = $(cells[0]).text().trim().replace(/\s+/g, '');
        if (!/^[A-Za-z0-9]{3,40}$/.test(code)) return;
        if (seen.has(code.toUpperCase())) return;
        seen.add(code.toUpperCase());
        const rewardText = $(cells[1]).text().trim().replace(/\s+/g, ' ');
        codes.push({ code, rewards: rewardText ? rewardText.slice(0, 200) : '보상 정보 없음' });
      });
    });
    return codes;
  } catch (err) {
    console.error('[codes] nte 자동 수집 실패:', err.message);
    return [];
  }
}

// 트릭컬 쿠폰표 (gachafeed) — ul.codes > li.code 활성 목록 파싱 (한글 코드 허용)
const TRICKCAL_URL = 'https://gachafeed.moe/ko/trickcal/codes/';

async function fetchTrickcalCodes() {
  try {
    const { data: html } = await axios.get(TRICKCAL_URL, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const codes = [];
    $('ul.codes > li.code').each((_, li) => {
      const code = $(li).find('span.c').first().text().trim().replace(/\s+/g, '');
      if (!/^[A-Za-z0-9가-힣]{2,40}$/.test(code)) return;
      if (seen.has(code.toUpperCase())) return;
      const liText = $(li).text().trim().replace(/\s+/g, ' ');
      if (/만료됨|expired/i.test(liText)) return; // "만료일 미표기"는 활성이라 통과
      seen.add(code.toUpperCase());
      let rewards = liText.replace(code, '').split('·')[0].trim();
      codes.push({ code, rewards: rewards ? rewards.slice(0, 200) : '보상 정보 없음' });
    });
    return codes;
  } catch (err) {
    console.error('[codes] trickcal 자동 수집 실패:', err.message);
    return [];
  }
}

// 게임별 스크래퍼 등록 (api와 무관하게 자동 수집되는 게임)
const SCRAPERS = {
  endfield: fetchEndfieldCodes,
  nikke: fetchNikkeCodes,
  wuwa: fetchWuwaCodes,
  gfl2: fetchGfl2Codes,
  bluearchive: fetchBlueArchiveCodes,
  promilia: fetchPromiliaCodes,
  nte: fetchNteCodes,
  trickcal: fetchTrickcalCodes,
};

// 유효 코드 목록 가져오기 — 스크래퍼 우선, 없으면 hoyo-codes API, 둘 다 없으면 수동 등록만
async function fetchAutoCodes(gameKey) {
  const game = GAMES[gameKey];
  if (!game) return [];
  if (SCRAPERS[gameKey]) return SCRAPERS[gameKey]();
  if (!game.api) return [];
  try {
    const { data } = await axios.get(HOYO_CODES_API + game.api, { timeout: 15000 });
    return (data.codes || [])
      .filter((c) => c.status === 'OK')
      .map((c) => ({ code: c.code, rewards: c.rewards || '보상 정보 없음' }));
  } catch (err) {
    console.error(`[codes] ${gameKey} 자동 수집 실패:`, err.message);
    return [];
  }
}

// 자동 수집 가능한 모든 게임의 현재 코드 조회
async function fetchAllAutoCodes() {
  const result = {};
  for (const key of Object.keys(GAMES)) {
    if (GAMES[key].api || SCRAPERS[key]) result[key] = await fetchAutoCodes(key);
  }
  return result;
}

// 저장된 기록과 비교해 "새로 나온 코드"만 반환 + 기록 업데이트
// 수동 등록된 코드는 이미 기록돼 있으므로 자동 수집과 겹쳐도 중복 알림 안 됨
async function detectNewCodes() {
  const fresh = await fetchAllAutoCodes();
  const known = store.getKnownCodes();
  const news = {}; // { game: [{code, rewards}] }

  for (const [game, list] of Object.entries(fresh)) {
    const knownSet = new Set(known[game] || []);
    const onlyNew = list.filter((c) => !knownSet.has(c.code));
    if (onlyNew.length > 0) {
      news[game] = onlyNew;
      store.addKnownCodes(game, onlyNew.map((c) => c.code));
    }
  }
  return news;
}

// 첫 실행 시: 현재 코드들을 "신규"로 알리지 않고 조용히 기록만 (스팸 방지)
// data/codes.json이 비어 있을 때 index.js에서 1회 호출
async function seedKnownCodes() {
  const known = store.getKnownCodes();
  if (Object.keys(known).length > 0) return false;
  const fresh = await fetchAllAutoCodes();
  for (const [game, list] of Object.entries(fresh)) {
    if (list.length > 0) store.addKnownCodes(game, list.map((c) => c.code));
  }
  return true;
}

module.exports = { fetchAutoCodes, fetchAllAutoCodes, detectNewCodes, seedKnownCodes, fetchEndfieldCodes, fetchNikkeCodes, fetchWuwaCodes, fetchGfl2Codes, fetchBlueArchiveCodes, fetchPromiliaCodes, fetchNteCodes, fetchTrickcalCodes };
