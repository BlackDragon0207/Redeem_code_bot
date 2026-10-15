// 지원하는 게임 정의
// key: 내부 ID / api: hoyo-codes API game 파라미터
// api가 null이어도 codes.js 스크래퍼가 있으면 자동 수집, 둘 다 없으면 수동 등록(/코드등록)만 가능
const GAMES = {
  genshin: {
    name: '원신',
    emoji: '✨',
    color: 0x4dd0e1,
    api: 'genshin',
    redeemUrl: 'https://genshin.hoyoverse.com/gift',
    redeemHint: '웹에서 교환: 아래 링크 → 로그인 → 서버/캐릭터 선택 → 코드 입력',
  },
  hsr: {
    name: '붕괴: 스타레일',
    emoji: '🚂',
    color: 0x9d7bea,
    api: 'hkrpg',
    redeemUrl: 'https://hsr.hoyoverse.com/gift',
    redeemHint: '웹에서 교환: 아래 링크 → 로그인 → 서버 선택 → 코드 입력',
  },
  zzz: {
    name: '젠레스 존 제로',
    emoji: '📼',
    color: 0xffb300,
    api: 'nap',
    redeemUrl: 'https://zenless.hoyoverse.com/redemption',
    redeemHint: '웹에서 교환: 아래 링크 → 로그인 → 서버/캐릭터 선택 → 코드 입력',
  },
  wuwa: {
    name: '명조 (Wuthering Waves)',
    emoji: '🌊',
    color: 0x64b5f6,
    api: null, // hoyo-codes 미지원 → PocketGamer working 목록 스크래핑으로 자동 수집 (codes.js fetchWuwaCodes)
    redeemUrl: null,
    redeemHint: '인게임에서 교환: 터미널 → 설정 → 기타 → 교환 코드 (Union Lv.2 필요)',
  },
  endfield: {
    name: '명일방주: 엔드필드',
    emoji: '🏭',
    color: 0xff8a65,
    api: null, // hoyo-codes 미지원 → Game8 코드표 스크래핑으로 자동 수집 (codes.js fetchEndfieldCodes)
    redeemUrl: 'https://endfield.gryphline.com/',
    redeemHint: '인게임 또는 공식 사이트의 교환 페이지에서 입력',
  },
  nikke: {
    name: '니케 (NIKKE)',
    emoji: '🔫',
    color: 0xf06292,
    api: null, // hoyo-codes 미지원 → nikke.gg 활성 코드표 스크래핑으로 자동 수집 (codes.js fetchNikkeCodes)
    redeemUrl: null,
    redeemHint: '인게임에서 교환: 메인 화면 → 공지 → CD-Key 교환 메뉴',
  },
  gfl2: {
    name: '소녀전선2: 망명',
    emoji: '🎯',
    color: 0xf4a259,
    api: null, // PocketGamer 활성 목록 스크래핑으로 자동 수집 (codes.js fetchGfl2Codes)
    redeemUrl: 'https://gf2exilium.sunborngame.com/main/code',
    redeemHint: '인게임: 설정 → 개인정보 → 교환코드, 또는 공식 교환 페이지 (서버별 코드 주의, 대소문자 구분)',
  },
  bluearchive: {
    name: '블루아카이브',
    emoji: '📚',
    color: 0x56ccf2,
    api: null, // 코드표 스크래핑으로 자동 수집 (codes.js fetchBlueArchiveCodes)
    redeemUrl: 'https://mcoupon.nexon.com/bluearchive',
    redeemHint: '안드로이드: 인게임 메뉴 → 계정 → 쿠폰 / iOS·PC: 공식 쿠폰 페이지 (서버 확인 필수)',
  },
  trickcal: {
    name: '트릭컬 RE:VIVE',
    emoji: '🃏',
    color: 0xff6b9d,
    api: null, // 코드표 스크래핑으로 자동 수집 (codes.js fetchTrickcalCodes)
    redeemUrl: 'https://coupon.a.prod.service.trickcal.io/',
    redeemHint: '공식 쿠폰 페이지 또는 인게임 설정에서 입력 (계정당 1회, 만료일 확인)',
  },
  silverpalace: {
    name: '실버 팰리스',
    emoji: '🏰',
    color: 0x9b9b9b,
    api: null, // 미출시(베타 중) → 코드 나오는 대로 수동 등록
    redeemUrl: null,
    redeemHint: '출시 후 교환 방법이 공개되면 안내 예정',
  },
  promilia: {
    name: '아주르 프로밀리아',
    emoji: '🌸',
    color: 0xffb7d5,
    api: null, // 미출시(현재 코드 0개) → 활성 코드표 감시 중, 출시 후 자동 반영 (codes.js fetchPromiliaCodes)
    redeemUrl: null,
    redeemHint: '출시 후 교환 방법이 공개되면 안내 예정',
  },
  nte: {
    name: '이환 (NTE)',
    emoji: '🌃',
    color: 0x7b61ff,
    api: null, // 코드표 스크래핑으로 자동 수집 (codes.js fetchNteCodes)
    redeemUrl: null,
    redeemHint: '인게임에서 교환: 휴대폰 메뉴(Esc) → 아바타 옆 점 3개 → 교환 코드 (프롤로그 완료 필요, 대소문자 구분)',
  },
};

const GAME_KEYS = Object.keys(GAMES);
const GAME_CHOICES = GAME_KEYS.map((key) => ({ name: `${GAMES[key].emoji} ${GAMES[key].name}`, value: key }));

module.exports = { GAMES, GAME_KEYS, GAME_CHOICES };
