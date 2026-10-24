# さいたま市子育て支援センタースケジュール抽出スキル

このスキルは、さいたま市の単独型子育て支援センター10箇所が公開するPDFスケジュールから、イベント情報を抽出してデータセットに統合します。

## 概要

エージェント自身がPDFテキストを読み取り、イベント情報をJSONとして抽出します。外部APIは使用しません。

## ワークフロー

### 1. PDF準備とテキスト抽出

```bash
pnpm download-pdfs
```

PDFは `data/pdf-cache/{centerId}-{month}.pdf` に保存されます。

**テキスト抽出**は `scripts/extract-pdf-text.py` を使います。依存は `requirements.txt` の PyPDF2 3.0.1 だけです。pdfplumber は不要です。PyPDF2 の visitor が返すテキスト行列と、TJ 配列の送り幅で、各グリフの位置が取れます。

```bash
python3 scripts/extract-pdf-text.py data/pdf-cache/nishi-2026-10.pdf /tmp/nishi-2026-10.txt
```

カレンダー格子の PDF では、この出力だけを読みます。`# layout: calendar-cells` のとき、`## cell 6` のブロックが 6 日の文言です。内容ストリーム順の `extract_text()` は使いません。`data/extracted-text/` に残っているファイルもその順なので、格子の読み取りには使いません。

うらわの 2026 年 10 月は、その順だと 6 日が 5 日のセルから外れます。抽出テキストは次のとおりです。

```text
5
《午前》
リフレッシュヨガ
（★ライブ配信あり）
一時預かり予約
開始（ 1１月分） 6


終日 にこにこ広場
お休み  7
```

6 は 5 日のヨガの行末に付き、お休みは 7 と同じ行に出ます。失敗した段階はテキスト抽出です。お休みという語は残っていますが、6 日のセルには入っていません。座標で組むと `## cell 6` に「6」「終日」「身体測定」「にこにこ広場」「お休み」が入ります。

`# layout: visual-lines` のページ、または文字にならない印があるページは、画像で日付と印を対応させます。みなみのハートがそれです。凡例に「このマークがある時間帯は『にこにこ広場』はお休みです」とあり、印自体はテキスト層にありません。

```bash
pdftoppm -png -f 1 -l 1 -r 150 data/pdf-cache/minami-202610.pdf /tmp/minami-202610
```

`pdftoppm` は Poppler のコマンドです。Python の依存には入れません。コマンドが無いときは、その印の日付を closure に書かず、未確認として残します。

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
    "kind": "hiroba",
    "origin": "extracted",
    "tags": ["自由遊び"]
  }
]
```

休み・お休み・休館・休室・閉室・中止は、イベントとは別にソースドキュメントの `closures` へ取る。日付が特定できる印だけを書く。

```json
"closures": [
  {
    "date": "2026-10-06",
    "scope": "all-day",
    "quote": "終日 にこにこ広場 お休み"
  }
]
```

- **date**: `YYYY-MM-DD`。そのソースドキュメントの月に限る。
- **scope**: `all-day`、`am`、`pm`。終日、休館、休室、閉室、終日測定のみは `all-day`。午前だけ、または `AM×` や午前閉館は `am`。午後だけは `pm`。
- **quote**: PDFに書いてある文言をそのまま取る。例は「終日 にこにこ広場 お休み」「休館日」「終日測定のみ」「ウェルカムさいたまの為午前閉館」。

予定表の見かたに「このマークがある時間帯は『にこにこ広場』はお休みです」とあるときは、そのマークが付いた日を `closures` に入れる。quote はその文を使う。

「中止の際は」のように、中止したとは書いていない文は closure にしない。毎月の休館曜日はセンターの `regularHours.closed` にあり、同じ日を `closures` に重ねてよい。

通常開室の補完は `closures` を読む。`all-day`、または午前と午後の両方がある日は行を作らない。その日に既にある `kind: "hiroba"` の抽出行も除く。`kind: "event"` の測定や講座は残す。`am` だけの日は午後の時間の引用だけ、`pm` だけの日は午前の引用だけを description にする。`hoursQuote` を午前と午後に分けられないときは、閉じた側を含む引用を出さないので行を作らない。

### 3. データ検証

抽出後に検証する。`scripts/validator.ts` はファイルパスを受け取らない。`process.argv[2]` はイベント配列のJSON文字列、`process.argv[3]` はソースドキュメントのJSON文字列。

```bash
node --experimental-strip-types scripts/validator.ts "$(cat data/extracted-events/nishi-2026-10.json)" '{"id":"nishi-2026-10","centerId":"nishi","month":"2026-10","pdfUrl":"https://example.com/nishi.pdf","fetchedAt":"2026-10-20T00:00:00Z","sha256":"abc"}'
```

検証は以下をチェックします:
- 必須フィールドの存在 (id, centerId, sourceDocumentId, date, title, kind, origin)
- kind は `hiroba` または `event`
- origin は `extracted` または `regular-hours`
- 日付形式 (YYYY-MM-DD)
- 時刻形式 (HH:MM)
- centerIdの整合性
- sourceDocumentIdの整合性
- `closures` があるときは、各要素の date、scope（all-day / am / pm）、空でない quote。date はそのドキュメントの月の中にあること

### 4. データセットへのマージ

検証が成功したら、データセットに統合:

```bash
node --experimental-strip-types scripts/merge-dataset.ts merge data/extracted-events/{centerId}-{month}.json
```

これにより `public/data/dataset.json` が更新されます。

### 5. 通常開室の補完

抽出JSONに通常開室の行を足さない。補完は次のコマンドが行う。

```bash
pnpm apply-schedule-model
```

`scripts/apply-schedule-model.ts` は各センターの `regularHours` を読み、ひろば行が無い開室日だけ通常開室を足す。

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

- **kind**: `"hiroba"` または `"event"`
  - ひろば、広場、フリー、自由遊び、ももちゃんタイムのような月齢限定の名称は `"hiroba"`
  - 講座、測定、教室、ワークショップ、季節のイベントは `"event"`
  - タイトルがひろばの語と、講座・測定・教室・マッサージ・セミナー・コンサート・パーティーのいずれかを両方含むときは `"event"`

- **origin**: 抽出した行は `"extracted"`
  - 通常開室の行は作らない。`scripts/apply-schedule-model.ts` がセンターの `regularHours` から足す

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
    "kind": "hiroba",
    "origin": "extracted"
  },
  {
    "id": "nishi-2026-10-02-wakuwaku",
    "date": "2026-10-02",
    "title": "わくわくひろば",
    "kind": "hiroba",
    "origin": "extracted"
  }
]
```

### 種別

自由あそびは `kind` を `"hiroba"` にする。タイトルに ひろば、広場、フリー、自由遊び があるとき、または ももちゃんタイム や 0歳さんの広場 のような月齢限定の名称のときがそれにあたる。講座、測定、教室、ワークショップ、季節のイベントは `"event"`。タイトルがひろばの語と講座・測定・教室・マッサージ・セミナー・コンサート・パーティーの語を両方含むときも `"event"`。例は 学びのひろば 防災講座、親子ふれあいひろば（ベビーマッサージ）、みんなのひろば・身体測定。

`origin` は `"extracted"`。通常開室の行を抽出JSONに足さない。空欄の日を自分で埋めない。

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

Read `/tmp/nishi-2026-10.txt` and write the events to `data/extracted-events/nishi-2026-10.json` before validation. For a calendar grid, read each `## cell` block.

```bash
pnpm download-pdfs
python3 scripts/extract-pdf-text.py data/pdf-cache/nishi-2026-10.pdf /tmp/nishi-2026-10.txt
node --experimental-strip-types scripts/validator.ts "$(cat data/extracted-events/nishi-2026-10.json)" '{"id":"nishi-2026-10","centerId":"nishi","month":"2026-10","pdfUrl":"https://example.com/nishi.pdf","fetchedAt":"2026-10-20T00:00:00Z","sha256":"abc"}'
node --experimental-strip-types scripts/merge-dataset.ts merge data/extracted-events/nishi-2026-10.json
pnpm apply-schedule-model
pnpm dataset-stats
```

## 既知の制限事項

- AI抽出は100%正確ではない
- 各イベントに元PDFへのリンクを表示してユーザーが確認可能
- PDFが画像スキャンの場合、OCRが必要（pdf-to-imageなど）
- 一部のセンターはPDFを公開していない

## トラブルシューティング

### PDFが読み取れない

カレンダー格子は `scripts/extract-pdf-text.py` のセル出力を読みます。`# layout: visual-lines` のとき、または印が文字になっていないときは `pdftoppm -png` でそのページを画像にします。ページ全体が画像だけのときは OCR が必要です。

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

const octoberEvents = dataset.events.filter(
  e => e.date.startsWith('2026-10')
);

const nishiEvents = dataset.events.filter(
  e => e.centerId === 'nishi'
);
```
