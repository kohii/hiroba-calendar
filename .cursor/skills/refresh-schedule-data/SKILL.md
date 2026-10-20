# さいたま市子育て支援センタースケジュール更新スキル

このスキルは、さいたま市の子育て支援センターのPDFスケジュールから イベント情報を抽出し、データセットを更新します。

## 概要

1. **PDF発見**: 各センターのウェブサイトから最新のPDFリンクを自動検出
2. **PDFダウンロード**: PDFをダウンロードしてキャッシュ (SHA256でchange detection)
3. **AI抽出**: PDFからイベント情報を抽出 (このスキルで実施)
4. **検証**: 抽出データをスキーマに対して検証
5. **マージ**: 検証済みデータをメインデータセットに統合

## 実行手順

### ステップ1: PDF発見とダウンロード

```bash
# PDFリンクの発見
npm run discover-pdfs

# PDFのダウンロード (新規・更新のみ)
npm run download-pdfs

# まとめて実行
npm run refresh-data
```

これにより`data/pdf-cache/`にPDFが保存され、`data/source-documents.json`にメタデータが記録されます。

### ステップ2: AI抽出が必要なPDFの確認

抽出が必要なPDF (extractedAt が null) を確認:

```bash
npm run list-pending
```

### ステップ3: PDF内容の抽出

抽出が必要な各PDFに対して、以下を実施:

1. **PDFを読み込む**: `data/pdf-cache/{centerId}-{month}.pdf`
2. **PDFをテキストまたは画像に変換** (pdf-parse または pdf-to-image)
3. **AI (Claude) でイベント抽出**
4. **結果を検証**
5. **データセットにマージ**

## AI抽出の詳細

### 入力

- **PDF ファイルパス**: `data/pdf-cache/{centerId}-{month}.pdf`
- **ソースドキュメント情報**: `data/source-documents.json` から取得
  ```json
  {
    "id": "nishi-2026-10",
    "centerId": "nishi",
    "month": "2026-10",
    "pdfUrl": "https://...",
    "fetchedAt": "2026-10-20T...",
    "sha256": "abc123..."
  }
  ```

### 出力スキーマ

AIは以下の形式のJSONを出力する必要があります:

```json
[
  {
    "id": "nishi-2026-10-01-わくわくひろば",
    "centerId": "nishi",
    "sourceDocumentId": "nishi-2026-10",
    "date": "2026-10-01",
    "startTime": "09:00",
    "endTime": "12:00",
    "title": "わくわくひろば",
    "description": "自由に遊べる時間です",
    "targetAge": "0～3歳未満",
    "reservationRequired": false,
    "location": null,
    "capacity": null,
    "tags": ["自由遊び"]
  },
  {
    "id": "nishi-2026-10-13-お芋掘り",
    "centerId": "nishi",
    "sourceDocumentId": "nishi-2026-10",
    "date": "2026-10-13",
    "startTime": "10:15",
    "endTime": "11:00",
    "title": "お芋掘り",
    "description": "現地集合・現地解散。保険料・お芋代有",
    "targetAge": "1歳以上",
    "reservationRequired": true,
    "location": "現地",
    "capacity": null,
    "tags": ["屋外イベント", "予約制"]
  }
]
```

### 必須フィールド

- `id`: 一意のID (`{centerId}-{month}-{day}-{イベント名の一部}` 形式推奨)
- `centerId`: ソースドキュメントの centerId と同じ
- `sourceDocumentId`: ソースドキュメントの id と同じ
- `date`: YYYY-MM-DD 形式
- `title`: イベント名

### オプショナルフィールド

- `startTime`, `endTime`: HH:MM 形式 (24時間制)
- `description`: イベントの詳細説明
- `targetAge`: 対象年齢 (例: "0～1歳", "1歳2か月まで")
- `reservationRequired`: 予約が必要な場合 true
- `location`: 開催場所 (センター以外の場所の場合)
- `capacity`: 定員
- `tags`: タグの配列

### 抽出時の注意点

1. **日付の解釈**
   - PDFは月間カレンダー形式や日付リスト形式などさまざま
   - 日付は必ず YYYY-MM-DD 形式に正規化
   - 月は source document の month フィールドから取得

2. **時刻の解釈**
   - "10:00～11:30" → startTime: "10:00", endTime: "11:30"
   - "午前9時～12時" → startTime: "09:00", endTime: "12:00"
   - "午後1時～4時" → startTime: "13:00", endTime: "16:00"
   - 時刻情報がない場合は null

3. **予約の判定**
   - "予約制", "要予約", "★", "申込み" などのキーワード
   - "予約不要", "自由", "申込み不要" の場合は false

4. **重複イベント**
   - 同じイベントが複数日に開催される場合、日付ごとに別エントリを作成
   - 例: "わくわくひろば" が毎日開催 → 日付ごとに個別のイベント

5. **不明確な情報**
   - 情報が不明確な場合は null を使用
   - 確信が持てない場合は description に詳細を記載

## 実装例

```typescript
import { readPDF } from './read-pdf';
import { validateExtractedEvents } from './validator';
import { loadDataSet, mergeSourceDocument, mergeEvents, saveDataSet } from './merge-dataset';

async function extractEventsFromPDF(sourceDoc: SourceDocument) {
  // 1. PDFを読み込み
  const pdfPath = `data/pdf-cache/${sourceDoc.centerId}-${sourceDoc.month}.pdf`;
  const pdfText = await readPDF(pdfPath);
  
  // 2. AI (Claude) でイベント抽出
  const prompt = `
以下のPDFテキストから、イベント情報を抽出してJSON形式で出力してください。

ソースドキュメント情報:
${JSON.stringify(sourceDoc, null, 2)}

出力スキーマ: (スキーマ定義...)

PDFテキスト:
${pdfText}
`;
  
  const extractedEvents = await callAI(prompt); // AIを呼び出し
  
  // 3. 検証
  const validation = validateExtractedEvents(extractedEvents, sourceDoc);
  if (!validation.valid) {
    console.error('Validation failed:', validation.errors);
    throw new Error('Invalid extracted events');
  }
  
  if (validation.warnings.length > 0) {
    console.warn('Warnings:', validation.warnings);
  }
  
  // 4. マージ
  const dataset = await loadDataSet();
  
  sourceDoc.extractedAt = new Date().toISOString();
  mergeSourceDocument(dataset, sourceDoc);
  mergeEvents(dataset, extractedEvents, sourceDoc.id);
  
  await saveDataSet(dataset);
  
  console.log(`Extracted ${extractedEvents.length} events from ${sourceDoc.id}`);
}
```

## 実際のPDF例

### にし (2026年10月)

- 形式: 月間カレンダーグリッド
- 特徴: 各日にイベント名と時間が記載
- 予約必要なイベントは ★ マーク
- 年齢制限が各イベントに記載

### おおみや (2026年9月)

- 形式: 月間カレンダー + 詳細説明
- 特徴: カレンダーにイベント名、下部に詳細説明
- "わくわく広場" は予約不要
- その他のプログラムは予約制

### みぬま

- 形式: テキスト説明中心
- 特徴: イベント一覧が日付順
- Zoom参加可能なプログラムあり
- 詳細な説明文が多い

## 検証コマンド

抽出後、以下で検証:

```bash
# データセットの統計を表示
npm run dataset-stats

# 特定の月のイベント数を確認
npm run list-events -- --month 2026-10

# 検証のみ実行 (実際のマージはしない)
npm run validate-events -- --dry-run
```

## トラブルシューティング

### PDFが画像の場合

PDFがスキャン画像の場合、OCRが必要:
1. pdf-to-image で画像に変換
2. Vision API (Claude) で画像を直接読み取り
3. または Tesseract などでOCR

### 検証エラー

- 日付形式を確認 (YYYY-MM-DD)
- 時刻形式を確認 (HH:MM)
- 必須フィールドが存在するか確認
- centerId と sourceDocumentId が一致しているか確認

### データが不正確

AI抽出は100%正確ではないため:
1. 各イベントに pdfUrl へのリンクを表示
2. ユーザーが元PDFで確認可能
3. フィードバックを受けて再抽出

## データセットの利用

最終的な`data/dataset.json`は静的サイトで直接利用可能:

```typescript
import dataset from '@/data/dataset.json';

// センター一覧
const centers = dataset.centers;

// 特定月のイベント
const octoberEvents = dataset.events.filter(
  e => e.date.startsWith('2026-10')
);

// 特定センターのイベント
const nishiEvents = dataset.events.filter(
  e => e.centerId === 'nishi'
);
```
