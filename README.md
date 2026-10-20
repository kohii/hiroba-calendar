# さいたま市子育て支援センター イベントスケジュール

さいたま市の10箇所の子育て支援センターが公開している月間PDFスケジュールから、イベント情報を集約して一覧表示するWebアプリケーションです。

## 特徴

- **複数センター横断表示**: 複数のセンターのイベントを日付順に一覧表示
- **カレンダー&リスト表示**: 月間カレンダーグリッドとリスト形式の2つの表示方法
- **お気に入り機能**: よく利用するセンターをお気に入り登録して優先表示
- **URL状態共有**: 選択したセンター・月・表示形式がURLに反映され、URLを共有するだけで同じ表示を再現可能
- **元PDF参照**: すべてのイベントに元PDFへのリンクを表示し、最新情報を確認可能
- **静的サイト**: 事前ビルドされたJSON データを使用し、サーバーレスで動作
- **レスポンシブデザイン**: スマートフォンでも快適に閲覧可能

## アーキテクチャ

### データフロー

```
1. PDF発見 (scripts/pdf-discovery.ts)
   ↓
2. PDFダウンロード (scripts/pdf-download.ts)
   ↓ SHA256でchange detection
3. AI抽出 (.cursor/skills/refresh-schedule-data/SKILL.md)
   ↓ Claude APIでイベント情報抽出
4. 検証 (scripts/validator.ts)
   ↓ スキーマに対してAjvで検証
5. マージ (scripts/merge-dataset.ts)
   ↓
6. 静的JSON (public/data/dataset.json)
   ↓
7. フロントエンド表示 (Next.js)
```

### ディレクトリ構成

```
/workspace
├── app/                      # Next.js App Router
│   ├── layout.tsx
│   └── page.tsx             # メインUI
├── lib/
│   ├── schema.ts            # TypeScript型定義とセンター一覧
│   └── url-state.ts         # URL状態管理
├── scripts/                 # 決定論的スクリプト群
│   ├── pdf-discovery.ts     # PDF URLの自動検出
│   ├── pdf-download.ts      # ダウンロードとキャッシュ
│   ├── validator.ts         # AI抽出結果の検証
│   ├── merge-dataset.ts     # データセット統合
│   └── refresh-all.ts       # 全体パイプライン実行
├── .cursor/skills/
│   └── refresh-schedule-data/
│       └── SKILL.md         # AI抽出スキル詳細
├── public/data/
│   └── dataset.json         # ビルド済みデータ
├── data/
│   ├── pdf-cache/           # ダウンロードしたPDF
│   └── source-documents.json # PDFメタデータ
└── tests/
    └── main.test.ts         # 単体テスト
```

## セットアップ

### 依存関係のインストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:43123 にアクセス

## データ更新方法

### 自動更新

```bash
# PDF発見 → ダウンロード → 抽出待ちリスト表示
npm run refresh-data
```

### AI抽出 (Agent Skill使用)

1. `.cursor/skills/refresh-schedule-data/SKILL.md` を参照
2. `data/pdf-cache/` 内のPDFからClaude APIで情報抽出
3. `scripts/validator.ts` で検証
4. `scripts/merge-dataset.ts` でマージ

抽出スキルの詳細は [SKILL.md](./.cursor/skills/refresh-schedule-data/SKILL.md) を参照してください。

### 手動スクリプト

```bash
# PDF URLを発見
npm run discover-pdfs

# PDFをダウンロード
npm run download-pdfs

# データセット統計
npm run dataset-stats

# 古いイベント削除
npm run cleanup
```

## テスト

```bash
# 単体テスト実行
npm test

# テスト（ウォッチモード）
npm test -- --watch
```

テスト対象:
- URL状態のエンコード/デコード
- イベントスキーマの検証
- データセットマージロジック

## ビルドとデプロイ

### Cloudflare Pages へのデプロイ

1. **ビルド**

```bash
npm run build
```

2. **Wrangler設定** (wrangler.toml)

```toml
name = "hiroba-calendar"
compatibility_date = "2024-01-01"

[site]
bucket = "./out"
```

3. **デプロイ**

```bash
npx wrangler pages deploy ./out --project-name=hiroba-calendar
```

### 静的エクスポート

Next.js の静的エクスポート機能を使用:

```javascript
// next.config.ts
const nextConfig = {
  output: 'export',
};
```

ビルド後、`out/` ディレクトリに静的ファイルが生成されます。

## データソース

### 対象センター (10箇所の単独型センター)

このアプリケーションは、PDFスケジュールを公開している**単独型**子育て支援センター10箇所を対象としています。

| ID | 名前 | 所在地 | 2026年10月データ |
|----|------|--------|-----------------|
| nishi | にし | 西区三橋6-382-1 2階 | ✓ (18イベント) |
| kita | きた | 北区宮原町3-432-2 岸ビル201 | - |
| omiya | おおみや | 大宮区桜木町1-185-2 | - |
| minuma | みぬま | 見沼区大和田町1-1387-1 | ✓ (13イベント) |
| yono | よの | 中央区本町東3-5-23 | - |
| sakura | さくら | 桜区栄和6-9-4 | - |
| urawa | うらわ | 浦和区高砂1丁目10番1号-213区画 | ✓ (9イベント) |
| minami | みなみ | 南区別所7-20-1 サウスピア1階 | - |
| midori | みどり | 緑区東浦和7-20-4 | - |
| iwatsuki | いわつき | 岩槻区本町3-1-1 WATSU西館4階 | - |

**注**: 支援センターは「単独型」と「親子ひろば型」の2種類があり、このアプリは単独型10箇所のみを対象としています。

### 現在のデータ状況 (2026年10月20日時点)

- **稼働中のセンター**: 3箇所 (にし、みぬま、うらわ)
- **総イベント数**: 40件
- **対象期間**: 2026年10月

**PDFが確認できたセンター**:
- **にし** (nishi): カレンダーグリッド形式、詳細な時間・対象年齢情報
- **みぬま** (minuma): テキスト説明形式、Zoom参加可能イベント多数
- **うらわ** (urawa): カレンダー＋詳細説明形式、専門講師による講座充実

**その他のセンター**: PDFへのアクセスが確認できていないか、10月分のPDFが未公開のため、今後追加予定です。

### PDF形式の違い

各センターでPDF形式が異なります:

- **にし**: 月間カレンダーグリッド形式 (Excel風)
- **みぬま**: テキスト説明形式 (イベント詳細が豊富)
- **おおみや**: カレンダー + 下部に詳細説明

AI抽出はこれらの異なる形式に対応する必要があります。

## 制限事項と注意点

### 対象センター

- このアプリは**単独型**子育て支援センター10箇所を対象としています
- さいたま市には他に「親子ひろば型」センターが多数ありますが、これらは対象外です
- 一部のセンターはPDFスケジュールを公開していない、または10月分がまだ公開されていないため、データが含まれていません

### AI抽出の精度

- AI抽出は100%正確ではありません
- すべてのイベントに元PDFへのリンクを表示し、ユーザーが確認できるようにしています
- 日付、時刻、予約の要否などの重要情報は検証スクリプトでチェックしています

### 更新頻度

- PDFは各センターが月初に公開
- データ更新は手動実行が必要 (自動化は将来の課題)

### データの範囲

- 現在月と次月の2ヶ月分のみを保持
- 過去のイベントは定期的にクリーンアップ

### 既知の問題

- **きた、おおみや、よの、さくら、みなみ、みどり、いわつき**: PDFが確認できていないか、10月分が未公開
- 一部のセンターはInstagram等で情報公開しており、PDFスケジュールを公開していない可能性があります

## 技術スタック

- **フロントエンド**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **アイコン**: lucide-react
- **日付処理**: date-fns
- **検証**: Ajv (JSON Schema)
- **PDF処理**: ユーザーがスキルで選択 (pdf-parse, pdf-to-image + OCR等)
- **AI**: Claude API (スキル内で使用)
- **テスト**: Vitest
- **デプロイ**: Cloudflare Pages対応

## ライセンス

MIT

## 参考リンク

- [さいたま市公式 - 子育て支援センター](https://www.city.saitama.lg.jp/003/001/016/001/p002272.html)
- PDF URL例:
  - にし: https://seisinkai.ed.jp/center/
  - みぬま: https://www.sainoko.net/minuma/
  - おおみや: https://www.wakaba-asunaro.jp/omiya

---

**注意**: このアプリケーションは個人プロジェクトであり、さいたま市公式のものではありません。最新・正確な情報は必ず各センターの公式PDF及びウェブサイトでご確認ください。
