/**
 * Data schema for Saitama City child-rearing support centers event schedules
 */

export type ScheduleType = "pdf" | "html" | "image" | "instagram" | "not_found";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HoursWindow {
  start: string;
  end: string;
}

export type ClosedRule =
  | { kind: "nth-weekday"; nth: number[]; weekday: Weekday }
  | { kind: "sunday-from"; nth: number }
  | { kind: "public-holiday" }
  | { kind: "month-day-range"; from: string; to: string };

export type ClosureScope = "all-day" | "am" | "pm";

export interface DayClosure {
  date: string;
  scope: ClosureScope;
  quote: string;
}

export type RegularHoursPolicy =
  | {
      decision: "unknown";
      sourceUrl: string;
      quote: string;
      decisionNote: string;
    }
  | {
      decision: "fill";
      sourceUrl: string;
      quote: string;
      decisionNote: string;
      title: string;
      hoursQuote: string;
      windows: HoursWindow[];
      openWeekdays: Weekday[];
      closed: ClosedRule[];
      targetAge?: string;
    };

export interface Center {
  id: string;
  name: string;
  nameJa: string;
  address: string;
  phone: string;
  websiteUrl: string;
  closedDays: string;
  regularHours: RegularHoursPolicy;
  scheduleType?: ScheduleType;
  scheduleUrlPattern?: string; // Pattern for constructing schedule URLs
  scheduleNotes?: string;
}

export interface SourceDocument {
  id: string;
  centerId: string;
  month: string; // YYYY-MM format
  pdfUrl: string;
  fetchedAt: string; // ISO date string
  sha256: string;
  extractedAt?: string; // ISO date string when AI extraction was performed
  closures?: DayClosure[];
}

export interface Event {
  id: string;
  centerId: string;
  sourceDocumentId: string;
  date: string; // YYYY-MM-DD format
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  title: string;
  description?: string;
  targetAge?: string;
  reservationRequired?: boolean;
  location?: string;
  capacity?: number;
  tags?: string[];
  kind: "hiroba" | "event";
  origin: "extracted" | "regular-hours";
}

export interface DataSet {
  centers: Center[];
  sourceDocuments: SourceDocument[];
  events: Event[];
  generatedAt: string; // ISO date string
  version: string;
}

const everyDay: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const splitDayWindows: HoursWindow[] = [
  { start: "09:00", end: "12:00" },
  { start: "13:00", end: "16:00" },
];

export const CENTERS: Center[] = [
  {
    id: "nishi",
    name: "Nishi",
    nameJa: "にし",
    address: "西区三橋6-382-1 2階",
    phone: "048-625-1300",
    websiteUrl: "https://seisinkai.ed.jp/center/",
    closedDays: "第1・第3木曜日",
    regularHours: {
      decision: "fill",
      sourceUrl:
        "https://seisinkai.ed.jp/wp-content/uploads/2026/09/令和8年度１０月のカレンダー.pdf",
      quote:
        "【開館時間】 ※12:00～13:00は一度閉室します。 午前9:00～12:00午後13:00～16:00 ◎毎月第１・３木曜日、第５日曜日、祝休日、年末年始 (12/29～1/3)は閉室となります。 ◎白い枠は、ご予約はいりませんが、イベントは (黄色い枠 )ご予約制となっております。",
      decisionNote:
        "白い枠は予約不要。開室日でひろば行が無い日だけ通常開室を足す。第1・第3木曜、第5日曜、祝休日、12/29～1/3は閉室。日付の入った閉室日と午前のAM×はソースドキュメントの closures に持つ。",
      title: "みんなのひろば",
      targetAge: "０～３歳未満 (３歳を迎えた年の３月まで利用可 )",
      hoursQuote: "午前9:00～12:00 午後13:00～16:00",
      windows: splitDayWindows,
      openWeekdays: everyDay,
      closed: [
        { kind: "nth-weekday", nth: [1, 3], weekday: 4 },
        { kind: "sunday-from", nth: 5 },
        { kind: "public-holiday" },
        { kind: "month-day-range", from: "12-29", to: "01-03" },
      ],
    },
  },
  {
    id: "kita",
    name: "Kita",
    nameJa: "きた",
    address: "北区宮原町3-432-2 岸ビル201",
    phone: "048-662-0022",
    websiteUrl: "https://kodomo-bunka.jp/support/",
    closedDays: "第2・第4水曜日",
    scheduleType: "image",
    scheduleNotes: "Schedule displayed as images on website",
    regularHours: {
      decision: "unknown",
      sourceUrl: "https://kodomo-bunka.jp/support/",
      quote: "",
      decisionNote: "data/pdf-cache にPDFが無く、空欄を通常開室とする引用が無い。埋めない。",
    },
  },
  {
    id: "omiya",
    name: "Omiya",
    nameJa: "おおみや",
    address: "大宮区桜木町1-185-2 のびのびプラザ大宮3階",
    phone: "048-649-3030",
    websiteUrl: "https://www.wakaba-asunaro.jp/omiya",
    closedDays: "第1・第3月曜日",
    scheduleType: "pdf",
    scheduleUrlPattern: "https://www.wakaba-asunaro.jp/library/6662c3046985d13334e93bf0/",
    regularHours: {
      decision: "fill",
      sourceUrl: "https://www.wakaba-asunaro.jp/omiya",
      quote:
        "✤ようこそ わくわくひろばへ ✤ 月曜日～土曜日、日曜日（第１～第４） ※毎月第１・第３月曜日はお休みです。 ９：００～１２：００ / １３：００～１６：００",
      decisionNote:
        "ひろばの文は祝日休館を言わない。予定表の休館日、または休館日と同じ斜線が入った日だけ追加で休む。一時預かりの国民の休日は使わない。第5日曜は「日曜日（第１～第４）」から閉じる。日付の入った休みはソースドキュメントの closures に持つ。",
      title: "わくわくひろば",
      hoursQuote: "９：００～１２：００ / １３：００～１６：００",
      windows: splitDayWindows,
      openWeekdays: everyDay,
      closed: [
        { kind: "nth-weekday", nth: [1, 3], weekday: 1 },
        { kind: "sunday-from", nth: 5 },
      ],
    },
  },
  {
    id: "minuma",
    name: "Minuma",
    nameJa: "みぬま",
    address: "見沼区大和田町1-1387-1",
    phone: "048-747-4531",
    websiteUrl: "https://www.sainoko.net/minuma/",
    closedDays: "第2・第4木曜日",
    regularHours: {
      decision: "unknown",
      sourceUrl: "https://www.sainoko.net/minuma/pdf/202610minuma.pdf",
      quote:
        "開室日時：月～土曜 第１～第 4日曜 9時～16時 休室日：第２・４木曜、第５日曜 、祝祭日・年末年始",
      decisionNote:
        "開室時間と休室日はある。空欄の日をひろばとする文は無い。親子ふれあいひろばは単発プログラム。埋めない。",
    },
  },
  {
    id: "yono",
    name: "Yono",
    nameJa: "よの",
    address: "中央区本町東3-5-23 与野本町小学校複合施設いーよの2階",
    phone: "048-840-1788",
    websiteUrl: "https://www.himawarikkoland.com/yono",
    closedDays: "第2・第4火曜日",
    scheduleType: "pdf",
    scheduleUrlPattern: "https://www.himawarikkoland.com/yono{YYYYMM}",
    regularHours: {
      decision: "fill",
      sourceUrl: "https://www.himawarikkoland.com/yono",
      quote:
        "開館時間　９：００～１２：００ １３：００～１６：００ 休館日　第２・４火曜日 第５日曜日 祝日・年末年始",
      decisionNote:
        "予定表は多くの日にぴよぴよ広場と書いてある。ひろば行が無い開室日だけ足す。休館日、斜線、午前閉館はソースドキュメントの closures に持つ。午前だけの休みは午後の引用だけ足す。年末年始の月日はPDFに無いので日付では閉じない。",
      title: "ぴよぴよ広場",
      hoursQuote: "９：００～１２：００ １３：００～１６：００",
      windows: splitDayWindows,
      openWeekdays: everyDay,
      closed: [
        { kind: "nth-weekday", nth: [2, 4], weekday: 2 },
        { kind: "sunday-from", nth: 5 },
        { kind: "public-holiday" },
      ],
    },
  },
  {
    id: "sakura",
    name: "Sakura",
    nameJa: "さくら",
    address: "桜区栄和6-9-4",
    phone: "048-859-3031",
    websiteUrl: "http://www.ichiju-fukushi.or.jp/sakuraSch_next.html",
    closedDays: "第1・第3火曜日",
    scheduleType: "not_found",
    scheduleNotes: "Schedule not available online - contact center directly",
    regularHours: {
      decision: "unknown",
      sourceUrl: "http://www.ichiju-fukushi.or.jp/sakuraSch_next.html",
      quote: "",
      decisionNote: "スケジュールPDFがリポジトリに無く、scheduleType は not_found。埋めない。",
    },
  },
  {
    id: "urawa",
    name: "Urawa",
    nameJa: "うらわ",
    address: "浦和区高砂1丁目10番1号-213区画 浦和カルエ2階",
    phone: "048-814-0481",
    websiteUrl: "https://www.urawanyuyouji.com/urawa/",
    closedDays: "第2・第4月曜日",
    regularHours: {
      decision: "fill",
      sourceUrl: "https://www.urawanyuyouji.com/admin/wp-content/uploads/2026/09/202610_urawa.pdf",
      quote:
        "★にこにこ広場★ 【予約不要】 《利用対象》 ０・１・２歳のお子さんと保護者 《利用時間》 午前9:00～１２:００ 午後13:00～１６:００ 《休館日》 第２・４月曜日 第５日曜日 祝日 年末年始 マークなし、空欄部分・・ 『にこにこ広場』 予約なしでご利用できます。 ※にこにこ広場は終日お休みです。（測定のみの利用となります。",
      decisionNote:
        "空欄はにこにこ広場。終日・午前・午後の「にこにこ広場 お休み」と休館はソースドキュメントの closures に日付で持つ。終日と休館の日は通常開室を足さない。午前だけの休みは午後の引用だけ、午後だけの休みは午前の引用だけを足す。",
      title: "にこにこ広場",
      targetAge: "０・１・２歳のお子さんと保護者",
      hoursQuote: "午前9:00～１２:００ 午後13:00～１６:００",
      windows: splitDayWindows,
      openWeekdays: everyDay,
      closed: [
        { kind: "nth-weekday", nth: [2, 4], weekday: 1 },
        { kind: "sunday-from", nth: 5 },
        { kind: "public-holiday" },
      ],
    },
  },
  {
    id: "minami",
    name: "Minami",
    nameJa: "みなみ",
    address: "南区別所7-20-1 サウスピア1階",
    phone: "048-844-7223",
    websiteUrl: "https://www.urawanyuyouji.com/minami/",
    closedDays: "第2・第4月曜日",
    scheduleType: "pdf",
    scheduleUrlPattern:
      "https://www.urawanyuyouji.com/admin/wp-content/uploads/{YYYY}/{MM}/{YYYYMM}_minami.pdf",
    regularHours: {
      decision: "fill",
      sourceUrl: "https://www.urawanyuyouji.com/minami/",
      quote:
        "★にこにこ広場 ★～予約なしでみんなが遊べる広場です ～ 《利用対象》 ０・１・２歳の親子 《利用時間》 9：00～ 12：00 13： 00～ 16：00 《休館日》 第2・4月曜日 第5日曜日 祝日 年末年始 PM 空欄部分 『にこにこ広場』 予約なしで利用できます",
      decisionNote:
        "PMの空欄はにこにこ広場。終日測定のみ、休館、予定表の見かたにあるマークの時間帯はソースドキュメントの closures に持つ。終日の休みは通常開室を足さない。午前または午後だけの休みは開いている側の時間だけ足す。年末年始の月日はPDFに無いので日付では閉じない。",
      title: "にこにこ広場",
      targetAge: "０・１・２歳の親子",
      hoursQuote: "9：00～ 12：00 13： 00～ 16：00",
      windows: splitDayWindows,
      openWeekdays: everyDay,
      closed: [
        { kind: "nth-weekday", nth: [2, 4], weekday: 1 },
        { kind: "sunday-from", nth: 5 },
        { kind: "public-holiday" },
      ],
    },
  },
  {
    id: "midori",
    name: "Midori",
    nameJa: "みどり",
    address: "緑区東浦和7-20-4",
    phone: "048-874-7388",
    websiteUrl: "https://www.instagram.com/shiencenter_midori/",
    closedDays: "第2・第4水曜日",
    scheduleType: "instagram",
    scheduleNotes: "Schedule posted on Instagram - requires manual check",
    regularHours: {
      decision: "unknown",
      sourceUrl: "https://www.instagram.com/shiencenter_midori/",
      quote: "",
      decisionNote: "予定はInstagramで、PDFも空欄規則の引用も無い。埋めない。",
    },
  },
  {
    id: "iwatsuki",
    name: "Iwatsuki",
    nameJa: "いわつき",
    address: "岩槻区本町3-1-1 WATSU西館4階",
    phone: "048-790-0020",
    websiteUrl: "https://kawai-daynursery.jp/shiencenter",
    closedDays: "第2火曜日・WATSU西館休館日",
    scheduleType: "pdf",
    scheduleUrlPattern:
      "https://kawai-daynursery.jp/wp-content/uploads/{YYYY}/{MM}/hina-{YYYYMM}.pdf",
    regularHours: {
      decision: "unknown",
      sourceUrl: "https://kawai-daynursery.jp/shiencenter",
      quote:
        "【利用時間 】９：００～１２：００ １３：００～１６：００ ひろば・おはなし会は予約不要です。",
      decisionNote:
        "2026-10の予定表は開室日にひろばと書き、12日・13日・27日は休館日（12日はスポーツの日）。空欄＝通常ひろばとは書いていない。テキスト抽出はセルと日付の対応が崩れるので、ひろばラベルから日付を推測して埋めない。",
    },
  },
];
