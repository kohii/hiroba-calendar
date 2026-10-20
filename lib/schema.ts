/**
 * Data schema for Saitama City child-rearing support centers event schedules
 */

export interface Center {
  id: string;
  name: string;
  nameJa: string;
  address: string;
  phone: string;
  websiteUrl: string;
  closedDays: string;
}

export interface SourceDocument {
  id: string;
  centerId: string;
  month: string; // YYYY-MM format
  pdfUrl: string;
  fetchedAt: string; // ISO date string
  sha256: string;
  extractedAt?: string; // ISO date string when AI extraction was performed
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
}

export interface DataSet {
  centers: Center[];
  sourceDocuments: SourceDocument[];
  events: Event[];
  generatedAt: string; // ISO date string
  version: string;
}

export const CENTERS: Center[] = [
  {
    id: "nishi",
    name: "Nishi",
    nameJa: "にし",
    address: "西区三橋6-382-1 2階",
    phone: "048-625-1300",
    websiteUrl: "https://seisinkai.ed.jp/center/",
    closedDays: "第1・第3木曜日",
  },
  {
    id: "kita",
    name: "Kita",
    nameJa: "きた",
    address: "北区宮原町3-432-2 岸ビル201",
    phone: "048-662-0022",
    websiteUrl: "https://www.city.saitama.lg.jp/kosodate/map/category11/",
    closedDays: "第2・第4水曜日",
  },
  {
    id: "omiya",
    name: "Omiya",
    nameJa: "おおみや",
    address: "大宮区桜木町1-185-2 のびのびプラザ大宮3階",
    phone: "048-649-3030",
    websiteUrl: "https://www.wakaba-asunaro.jp/omiya",
    closedDays: "第1・第3月曜日",
  },
  {
    id: "minuma",
    name: "Minuma",
    nameJa: "みぬま",
    address: "見沼区大和田町1-1387-1",
    phone: "048-747-4531",
    websiteUrl: "https://www.sainoko.net/minuma/",
    closedDays: "第2・第4木曜日",
  },
  {
    id: "yono",
    name: "Yono",
    nameJa: "よの",
    address: "中央区本町東3-5-23 与野本町小学校複合施設いーよの2階",
    phone: "048-840-1788",
    websiteUrl: "https://www.city.saitama.lg.jp/kosodate/map/category11/",
    closedDays: "第2・第4火曜日",
  },
  {
    id: "sakura",
    name: "Sakura",
    nameJa: "さくら",
    address: "桜区栄和6-9-4",
    phone: "048-859-3031",
    websiteUrl: "http://www.ichiju-fukushi.or.jp/sakura.html",
    closedDays: "第1・第3火曜日",
  },
  {
    id: "urawa",
    name: "Urawa",
    nameJa: "うらわ",
    address: "浦和区高砂1丁目10番1号-213区画 浦和カルエ2階",
    phone: "048-814-0481",
    websiteUrl: "https://www.urawanyuyouji.com/urawa/",
    closedDays: "第2・第4月曜日",
  },
  {
    id: "minami",
    name: "Minami",
    nameJa: "みなみ",
    address: "南区別所7-20-1 サウスピア1階",
    phone: "048-844-7223",
    websiteUrl: "https://www.city.saitama.lg.jp/kosodate/map/category11/",
    closedDays: "第2・第4月曜日",
  },
  {
    id: "midori",
    name: "Midori",
    nameJa: "みどり",
    address: "緑区東浦和7-20-4",
    phone: "048-874-7388",
    websiteUrl: "https://www.instagram.com/shiencenter_midori/",
    closedDays: "第2・第4水曜日",
  },
  {
    id: "iwatsuki",
    name: "Iwatsuki",
    nameJa: "いわつき",
    address: "岩槻区本町3-1-1 WATSU西館4階",
    phone: "048-790-0020",
    websiteUrl: "https://www.city.saitama.lg.jp/kosodate/map/category11/",
    closedDays: "第2火曜日・WATSU西館休館日",
  },
];
