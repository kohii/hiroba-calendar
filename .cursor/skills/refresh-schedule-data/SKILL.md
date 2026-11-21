# さいたま市子育て支援センタースケジュール抽出スキル

このスキルは、さいたま市の単独型子育て支援センター10箇所と、桜区の菁莪保育園子育て支援センター、ひなどり幼稚園子育て支援ROOMが公開するスケジュールから、イベント情報を抽出してデータセットに統合します。

## 概要

エージェント自身がPDFテキストを読み取り、イベント情報をJSONとして抽出します。外部APIは使用しません。

## 前提条件

視覚的な検証のため、Poppler utilities (`pdftoppm`) が必要です:

```bash
sudo apt-get update && sudo apt-get install -y poppler-utils
```

これにより、OPEN印などの視覚マーク（ひなどり、せいが）やグレーの地（みなみ）をPDFページ画像として確認できます。

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

`# layout: visual-lines` のページ、または文字にならない印があるページは、画像で日付と印を対応させます。みなみの「午前行事のみ」「午後行事のみ」「終日測定のみ」に付くグレーの地がそれです。凡例は「このマークがある時間帯は『にこにこ広場』はお休みです」と言い、グレーの地はテキスト層に出ません。白枠の「午前0歳専用」「11:00～にこにこ広場」と、ハートの「0歳さんの広場」はこのマークではありません。

```bash
pdftoppm -png -f 1 -l 1 -r 150 data/pdf-cache/minami-202610.pdf /tmp/minami-202610
```

`pdftoppm` は Poppler のコマンドです。Python の依存には入れません。コマンドが無いときは、その印の日付を closure に書かず、未確認として残します。

**重要: 視覚マークの検証プロセス**

画像確認機能はエージェントにより異なります。そのため、視覚マークに依存する抽出項目は PR に明記し、画像確認が可能なレビュアーによる検証を経る仕組みとします。

1. **視覚マークやレイアウトに依存する抽出項目は PR に明記する**
   - ひなどりの OPEN 印（青い鳥のスタンプ）
   - せいがの OPEN マーク
   - みなみのグレー地（行事のみの時間帯）
   - うらわのセル隣接によるテキスト漏れ

2. **PR 作成後、画像確認が可能なレビュアーが検証を実施**
   - レビュアーが `pdftoppm -png -r 200` で PDF をレンダリング
   - カレンダー格子を日付ごとに目視
   - 抽出データと PDF を `pnpm day-summary` で照合
   - 不一致があれば PR にコメントで修正依頼

3. **インポートエージェントが絶対にやってはいけないこと**:
   - `pdfimages` でスタンプ画像数をカウントし、その数だけイベントを作成
     - 例: ひなどり November 2026 エラー — 11 個の画像 → 11 イベント作成 → しかし日付が間違っていた
     - 画像数は分かっても、**どの日付に印があるかは特定できない**
   - 画像確認なしに「視覚検証完了」と記載

4. **PR 記述での明記事項**:
   - 視覚マークに依存する項目をリストアップ
   - テキスト抽出のみで完結する項目と明確に区別
   - レビュアーが何を画像で確認すべきかを明示

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

予定表の見かたに「このマークがある時間帯は『にこにこ広場』はお休みです」とあるときは、そのマークが付いた日を `closures` に入れる。quote はその日のマークの文言（例「午前行事のみ」）を使う。

「中止の際は」のように、中止したとは書いていない文は closure にしない。毎月の休館曜日はセンターの `regularHours.closed` にあり、同じ日を `closures` に重ねてよい。

通常開室の補完は開室時間から `closures` を除いた時間帯に行を作る。抽出した行の有無は見ず、抽出した行は消さない。`all-day`、または午前と午後の両方がある日は行を作らない。`am` だけの日は午後の時間の引用だけ、`pm` だけの日は午前の引用だけを description にする。`hoursQuote` を午前と午後に分けられないときは、閉じた側を含む引用を出さないので行を作らない。

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
- `regularHours` が `fill` のセンターでは、通常ひろば（`regularHours.title`）の行が無いこと。ほかのひろば行が通常時間帯の休憩（例 12:00-13:00）をまたがないこと

### 4. データセットへのマージ

ソースドキュメントは `data/source-documents.json` に書く。ID は `{centerId}-{YYYY-MM}`、`pdfUrl` はPDFそのもののURL、`sha256` は `data/pdf-cache/{centerId}-{YYYY-MM}.pdf` のハッシュ。`closures` もここに書く。検証とマージは次のコマンドで一度に行う。

```bash
node --experimental-strip-types scripts/validate-and-merge.ts {centerId} {YYYY-MM}
```

`public/data/dataset.json` の同じソースドキュメントのイベントが置き換わる。

### 5. 通常開室の補完

抽出JSONに通常開室の行を足さない。補完は次のコマンドが行う。

```bash
pnpm apply-schedule-model
```

`scripts/apply-schedule-model.ts` は各センターの `regularHours` を読み、開室日の `closures` で閉じていない時間帯に通常開室を足す。

補完のあと `pnpm day-summary {centerId}-{YYYY-MM}` で日ごとの行と休みを出し、PDFのカレンダーと1日ずつ突き合わせる。

## フィールド定義

### 必須フィールド

- **id**: 一意のID。推奨形式: `{centerId}-{YYYY-MM-DD}-{イベント名の一部}`
  - 例: `"nishi-2026-10-13-oimohori"`
  
- **centerId**: センターID (nishi, kita, omiya, minuma, yono, sakura, urawa, minami, midori, iwatsuki, seiga, hinadori)

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

`regularHours` が `fill` のセンターでは、通常ひろば（`regularHours.title`。例 ぴよぴよ広場、わくわくひろば）の行を作らない。通常開室は `apply-schedule-model` が開室時間から closures を除いて足す。通常ひろばが半日だけの日（「＜午後＞わくわくひろば」「★午前はお申込者のみ」、みなみの「午前0歳専用」など）は、通常ひろばが無い側を `am` / `pm` の closure にし、セルの文言を quote にする。おおみや・にしのように開いている日と時間帯に通常ひろばの名前を書く予定表では、その名前が無い時間帯と日も closure にする。月齢限定のひろば（0歳さんの広場など）は通常ひろばとは別の行として作る。欄外の「利用時間 ①9:00～12:00 ②13:00～16:00」を 09:00～16:00 のような1つの時間帯にまとめない。間の 12:00～13:00 は閉まっている。

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

## 桜区の併設・園内支援室

単独型10箇所とは別施設。空欄を通常開室として埋めない。開室日は予定表の印だけ。

11. **菁莪保育園子育て支援センター** (seiga) - 桜区西堀1-11-1。保育施設併設型。市の施設ページは https://www.city.saitama.lg.jp/kosodate/map/category10/p105322.html 。園のページは https://seiga.or.jp/support/ 。おたより一覧は https://seiga.or.jp/square/ 。PDFのファイル名に年月が無いので、一覧の「せいがのひろば○月号」の投稿からPDFを取る（投稿URLはPDFへリダイレクトする）。開室日は月ごとの絵の印（10月はカボチャ、11月はどんぐり）。テキスト抽出は `# layout: visual-lines` になるので、印は `pdftoppm -png` で読む。

12. **ひなどり幼稚園子育て支援ROOM** (hinadori) - 桜区西堀2-6-18。認定こども園の支援室。市の保育施設併設型一覧の「与野ひなどり保育園 子育て支援センター」（中央区本町西2-1-11、https://www.city.saitama.lg.jp/kosodate/map/category10/p105321.html ）とは別。市の施設ページは認定こども園 https://www.city.saitama.lg.jp/kosodate/map/category18/p105886.html 。おたよりは https://hinadori.ed.jp/category/support/ 。2026年10月号は https://hinadori.ed.jp/2026/09/28/30367/ と https://hinadori.ed.jp/wp-content/uploads/2026/09/9e44390e5305308ee6397861405a8985.pdf 。予約制のOPEN印の日だけ開室。予定表の文字の多くは画像なので `pdftoppm -png` で読む。同じ表の「ひばり」「見学会」「入園説明会」はOPEN印ではない。2026-10-29時点で11月号はカテゴリに無い。

## 抽出パイプライン実行例

Read `/tmp/nishi-2026-10.txt` and write the events to `data/extracted-events/nishi-2026-10.json` before validation. For a calendar grid, read each `## cell` block.

```bash
pnpm download-pdfs
python3 scripts/extract-pdf-text.py data/pdf-cache/nishi-2026-10.pdf /tmp/nishi-2026-10.txt
node --experimental-strip-types scripts/validator.ts "$(cat data/extracted-events/nishi-2026-10.json)" '{"id":"nishi-2026-10","centerId":"nishi","month":"2026-10","pdfUrl":"https://example.com/nishi.pdf","fetchedAt":"2026-10-20T00:00:00Z","sha256":"abc"}'
node --experimental-strip-types scripts/validate-and-merge.ts nishi 2026-10
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

## 作業のベストプラクティスと教訓

### PDF 発見の改善

`scripts/pdf-discovery.ts` は以下を処理できるように改善されました:
- **ハッシュ名の PDF**: omiya, yono, seiga は `6afd4b24....pdf` のような名前。リンクテキストから月を抽出
- **全角数字**: にしの `令和8年度１２月` → 半角に正規化
- **リンク一覧ページ**: seiga の `/square/`, hinadori の `category/support/` は手動チェックが必要

### 公開タイミング

施設ごとに公開時期が異なる（前月の何日に出るか）:
- おおみや: 前月10～14日頃
- 多くの施設: 前月18～20日頃  
- みぬま、にし、せいが、ひなどり: 前月23日～月末

### 視覚マーク検証の責任分担

ひなどり、せいがの OPEN 印、みなみのグレー地など、テキスト層にない印の検証は PR レビューで行う。

**インポートエージェントの役割**:
- PDF をレンダリング (`pdftoppm -png -r 200 <PDF> <output-prefix>`)
- PR に視覚マーク依存項目を明記（例: "hinadori OPEN days need visual confirmation"）
- **絶対に画像数から日付を推測しない**

**レビュアー（メンテナンスボット）の役割**:
- レンダリングされた画像を日付ごとに目視
- OPEN 印がある日付を正確にリスト化
- 抽出データと PDF を `pnpm day-summary` で照合
- 不一致があれば PR にコメントで修正依頼

**重要な教訓 (hinadori November 2026 エラー)**:
- `pdfimages -list` で 11 個の OPEN 印画像を検出
- エージェントが 11 日分の hiroba イベントを作成
- **しかし日付が間違っていた** — 画像数では日付を特定できない
- レビュアーの目視確認で正しい 10 日分（2, 4, 6, 9, 10, 18, 24, 25, 26, 27）に修正

### 改訂版への対応

にしは月の途中で「改正版」を出すことがある。既存PDFの SHA256 が変わったら再抽出。
