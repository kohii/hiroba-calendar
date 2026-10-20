# さいたま市子育て支援センタースケジュール抽出スキル

このスキルは、さいたま市の単独型子育て支援センター10箇所が公開するPDFスケジュールから、イベント情報を抽出してデータセットに統合します。

## 概要

エージェント自身がPDFテキストを読み取り、イベント情報をJSONとして抽出します。外部APIは使用しません。

## ワークフロー

### 1. PDF準備とテキスト抽出

```bash
# PDFのダウンロード（最新のPDFを取得）
npm run download-pdfs
```

PDFは `data/pdf-cache/{centerId}-{month}.pdf` に保存されます。

**テキスト抽出**には以下のコマンドを使用:

```bash
# pdf-parseを使用してテキスト抽出
npx tsx -e "
import { readFileSync } from 'fs';
import PDFParser from 'pdf-parse';

const pdfPath = 'data/pdf-cache/{centerId}-{month}.pdf';
const dataBuffer = readFileSync(pdfPath);

PDFParser(dataBuffer).then(data => {
  console.log(data.text);
}).catch(err => {
  console.error('Error:', err);
});
"
```

または、PDFを直接読み取ってテキストを表示:

```bash
npm exec pdf-parse data/pdf-cache/nishi-2026-10.pdf
```

### 2. イベント情報の抽出

エージェントは抽出したPDFテキストを読み、以下のJSON形式でイベント情報を出力します。

**出力パス**: `data/extracted-events/{centerId}-{month}.json`

**出力形式**:

```json
[
  {
    "id": "nishi-2026-10-01-wakuwaku",
    "centerId": "nishi",
    "sourceDocumentId": "nishi-2026-10",
    "date": "2026-10-01",
    "startTime": "09:00",
    "endTime": "12:00",
    "title": "みんなのひろば",
    "description": "自由に遊べる時間です",
    "targetAge": "0～3歳未満",
    "reservationRequired": false,
    "tags": ["自由遊び"]
  }
]
```

### 3. データ検証

抽出後、以下のコマンドで検証:

```bash
npx tsx scripts/validator.ts data/extracted-events/{centerId}-{month}.json
```

検証は以下をチェックします:
- 必須フィールドの存在 (id, centerId, sourceDocumentId, date, title)
- 日付形式 (YYYY-MM-DD)
- 時刻形式 (HH:MM)
- centerIdの整合性
- sourceDocumentIdの整合性

### 4. データセットへのマージ

検証が成功したら、データセットに統合:

```bash
npx tsx scripts/merge-dataset.ts merge data/extracted-events/{centerId}-{month}.json
```

これにより `public/data/dataset.json` が更新されます。

## フィールド定義

### 必須フィールド

- **id**: 一意のID。推奨形式: `{centerId}-{YYYY-MM-DD}-{イベント名の一部}`
  - 例: `"nishi-2026-10-13-oimohori"`
  
- **centerId**: センターID (nishi, kita, omiya, minuma, yono, sakura, urawa, minami, midori, iwatsuki)

- **sourceDocumentId**: ソースドキュメントID
  - 形式: `{centerId}-{YYYY-MM}`
  - 例: `"nishi-2026-10"`

- **date**: イベント日付 (YYYY-MM-DD形式)
  - 例: `"2026-10-13"`

- **title**: イベント名
  - 例: `"お芋掘り"`

### オプショナルフィールド

- **startTime**: 開始時刻 (HH:MM形式、24時間制)
  - 例: `"10:15"`

- **endTime**: 終了時刻 (HH:MM形式、24時間制)
  - 例: `"11:30"`

- **description**: イベントの詳細説明
  - 例: `"現地集合・現地解散。保険料・お芋代が必要です"`

- **targetAge**: 対象年齢
  - 例: `"1歳以上"`, `"0～2歳"`, `"1歳2か月まで"`

- **reservationRequired**: 予約が必要な場合 true
  - デフォルト: false

- **location**: 開催場所（センター以外の場合のみ）
  - 例: `"現地"`, `"公園"`

- **capacity**: 定員
  - 例: `10`, `20`

- **tags**: タグの配列
  - 例: `["屋外イベント", "予約制", "有料"]`

## 抽出ガイドライン

### 日付の解釈

- PDFの形式は月間カレンダー、日付リスト、説明文など様々
- 月は `sourceDocumentId` から取得 (例: `nishi-2026-10` → 2026年10月)
- 日付は必ず YYYY-MM-DD 形式に正規化

### 時刻の解釈

- "10:00～11:30" → startTime: "10:00", endTime: "11:30"
- "午前9時～12時" → startTime: "09:00", endTime: "12:00"
- "午後1時～4時" → startTime: "13:00", endTime: "16:00"
- 時刻情報がない場合は null

### 予約の判定

**予約必要 (reservationRequired: true)** のキーワード:
- "予約制", "要予約", "★", "申込み", "申し込み"

**予約不要 (reservationRequired: false)** のキーワード:
- "予約不要", "自由", "申込み不要", "予約なし"

### 重複イベント

同じイベントが複数日に開催される場合、**日付ごとに別エントリを作成**:

```json
[
  {
    "id": "nishi-2026-10-01-wakuwaku",
    "date": "2026-10-01",
    "title": "わくわくひろば",
    ...
  },
  {
    "id": "nishi-2026-10-02-wakuwaku",
    "date": "2026-10-02",
    "title": "わくわくひろば",
    ...
  }
]
```

### 不明確な情報

- 確信が持てない場合は null を使用
- 重要な情報は description に記載

## センター別のPDF形式

### にし (nishi)
- 形式: 月間カレンダーグリッド
- 特徴: 各日にイベント名と時間
- 予約必要なイベントは ★ マーク

### おおみや (omiya)
- 形式: 月間カレンダー + 詳細説明
- 特徴: カレンダーにイベント名、下部に詳細

### みぬま (minuma)
- 形式: テキスト説明中心
- 特徴: イベント一覧が日付順
- Zoom参加可能なプログラムあり

### その他
- 各センターで形式が異なるため、柔軟に対応

## 単独型10センター一覧

スケジュールPDFを公開している単独型センター:

1. **にし** (nishi) - https://seisinkai.ed.jp/center/
2. **きた** (kita)
3. **おおみや** (omiya) - https://www.wakaba-asunaro.jp/omiya
4. **みぬま** (minuma) - https://www.sainoko.net/minuma/
5. **よの** (yono)
6. **さくら** (sakura) - http://www.ichiju-fukushi.or.jp/sakura.html
7. **うらわ** (urawa) - https://www.urawanyuyouji.com/urawa/
8. **みなみ** (minami)
9. **みどり** (midori) - https://www.instagram.com/shiencenter_midori/
10. **いわつき** (iwatsuki)

## 抽出パイプライン実行例

```bash
# 1. PDFをダウンロード
npm run download-pdfs

# 2. テキスト抽出（エージェントが実行）
npm exec pdf-parse data/pdf-cache/nishi-2026-10.pdf > /tmp/nishi-2026-10.txt

# 3. テキストを読み取り、JSONを作成
# （エージェントが /tmp/nishi-2026-10.txt を読んでイベントを抽出）
# （エージェントが data/extracted-events/nishi-2026-10.json に書き込み）

# 4. 検証
npx tsx scripts/validator.ts data/extracted-events/nishi-2026-10.json

# 5. マージ
npx tsx scripts/merge-dataset.ts merge data/extracted-events/nishi-2026-10.json

# 6. 統計確認
npm run dataset-stats
```

## 既知の制限事項

- AI抽出は100%正確ではない
- 各イベントに元PDFへのリンクを表示してユーザーが確認可能
- PDFが画像スキャンの場合、OCRが必要（pdf-to-imageなど）
- 一部のセンターはPDFを公開していない

## トラブルシューティング

### PDFが読み取れない

PDFが画像ベースの場合:
1. pdf-to-imageで画像に変換
2. OCRツール (Tesseract等) でテキスト化
3. または画像認識可能なLLMで直接読み取り

### 検証エラー

- 日付形式を確認 (YYYY-MM-DD)
- 時刻形式を確認 (HH:MM)
- 必須フィールドの存在を確認
- centerIdとsourceDocumentIdの整合性を確認

### データが不正確

- フィードバックを受けて再抽出
- descriptionに詳細を追加
- 元PDFリンクでユーザー確認可能

## データの利用

最終的な `public/data/dataset.json` は静的サイトで利用:

```typescript
import dataset from '@/public/data/dataset.json';

// 特定月のイベント
const octoberEvents = dataset.events.filter(
  e => e.date.startsWith('2026-10')
);

// 特定センターのイベント
const nishiEvents = dataset.events.filter(
  e => e.centerId === 'nishi'
);
```
