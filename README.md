# さいたま市子育て支援センター イベントスケジュール

さいたま市の10箇所の子育て支援センターが公開している月間PDFスケジュールから、イベント情報を集約して一覧表示するWebアプリケーションです。

## 特徴

スマートフォンで見ることを前提にした 1 ページのアプリです。下のタブで 2 つの見方を切り替えます。

- **予定**: 横に日付、縦に施設を並べた表。今日（または選んだ日）から予定表がある月の末日まで並び、スマホでは 3 日分ずつ横にスクロールして見る。セルを押すとその日の詳細を出す
- **施設**: 1 つの施設の 1 か月をカレンダーとイベント一覧で見る

よく行く施設を「マイ施設」に登録すると、予定の画面にはその施設だけを表示します。登録は端末の localStorage に保存します。ヘッダーの「すべて」で全施設に切り替えられます。

ひろば（予約なしで遊べる通常開室）は緑の時間帯、イベントはオレンジの線が付いた時刻とタイトルで表示します。お休みの日は「休」、予定表がない日は「—」です。表示中の画面は URL に入るので、URL を共有すれば同じ画面を開けます。

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
   ↓ 手書きバリデータで検証
5. マージ (scripts/merge-dataset.ts)
   ↓
6. 静的JSON (public/data/dataset.json)
   ↓
7. フロントエンド表示 (Astro)
```

### ディレクトリ構成

```
/workspace
├── src/                      # Astro
│   ├── pages/index.astro
│   ├── scripts/app.ts       # 画面の状態とイベント処理
│   ├── scripts/render.ts    # 各画面のHTMLを組み立てる
│   └── styles/global.css
├── lib/
│   ├── schema.ts            # TypeScript型定義とセンター一覧
│   ├── schedule.ts          # 施設×日の状態（開室・休館・未掲載）と日付計算
│   └── url-state.ts         # URL状態管理
├── scripts/                 # 決定論的スクリプト群
│   ├── pdf-discovery.ts     # PDF URLの自動検出
│   ├── pdf-download.ts      # ダウンロードとキャッシュ
│   ├── validator.ts         # AI抽出結果の検証
│   ├── merge-dataset.ts     # データセット統合
│   └── extract-pdf-text.py  # PyPDF2 で PDF テキスト抽出
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
pnpm install
python3 -m pip install -r requirements.txt
```

### 開発サーバーの起動

```bash
pnpm dev
```

ブラウザで http://localhost:43123 にアクセス

## データ更新方法

### 自動更新

```bash
pnpm discover-pdfs
pnpm download-pdfs
python3 scripts/extract-pdf-text.py data/pdf-cache/<centerId>-<month>.pdf /tmp/<centerId>-<month>.txt
```

### AI抽出 (Agent Skill使用)

1. `.cursor/skills/refresh-schedule-data/SKILL.md` を参照
2. `data/pdf-cache/` 内のPDFからClaude APIで情報抽出
3. `scripts/validator.ts` で検証
4. `scripts/merge-dataset.ts` でマージ

抽出スキルの詳細は [SKILL.md](./.cursor/skills/refresh-schedule-data/SKILL.md) を参照してください。

### 手動スクリプト

```bash
pnpm discover-pdfs
pnpm download-pdfs
pnpm dataset-stats
pnpm cleanup
```

## テスト

```bash
pnpm test
```

テスト対象:
- URL状態のエンコード/デコード
- 施設×日の状態判定と各画面の描画
- イベントスキーマの検証
- データセットマージロジック

## ビルドとデプロイ

### Cloudflare Pages へのデプロイ

このプロジェクトは静的サイトとして出力され、Cloudflare Pages に直接デプロイできます。

**ビルド設定**:
- **Build command**: `pnpm build`
- **Build output directory**: `dist`

1. **ビルド**

```bash
pnpm build
```

ビルドにより、完全な静的HTMLファイルが `dist/` ディレクトリに生成されます。

2. **Wrangler設定** (wrangler.toml)

```toml
name = "hiroba-calendar"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist"
```

3. **デプロイ**

```bash
npx wrangler pages deploy ./dist --project-name=hiroba-calendar
```

### 静的出力

Astro は `output: 'static'` で `dist/` に書き出します。画像最適化は使わないので、`astro.config.mjs` の image service は noop です。

## データソース

### 対象センター (10箇所の単独型センター)

このアプリケーションは、PDFスケジュールを公開している**単独型**子育て支援センター10箇所を対象としています。

| ID | 名前 | 所在地 | 2026年10月データ |
|----|------|--------|-----------------|
| nishi | にし | 西区三橋6-382-1 2階 | 18 |
| kita | きた | 北区宮原町3-432-2 岸ビル201 | 0 |
| omiya | おおみや | 大宮区桜木町1-185-2 | 37 |
| minuma | みぬま | 見沼区大和田町1-1387-1 | 13 |
| yono | よの | 中央区本町東3-5-23 | 33 |
| sakura | さくら | 桜区栄和6-9-4 | 0 |
| urawa | うらわ | 浦和区高砂1丁目10番1号-213区画 | 9 |
| minami | みなみ | 南区別所7-20-1 サウスピア1階 | 20 |
| midori | みどり | 緑区東浦和7-20-4 | 0 |
| iwatsuki | いわつき | 岩槻区本町3-1-1 WATSU西館4階 | 10 |

**注**: 支援センターは「単独型」と「親子ひろば型」の2種類があり、このアプリは単独型10箇所のみを対象としています。

### 現在のデータ状況 (2026年10月20日時点)

- **2026年10月にイベントがあるセンター**: 7箇所 (にし、よの、いわつき、おおみや、みぬま、みなみ、うらわ)
- **2026年10月のイベント**: 140件
- **データセット全体**: 229件。きた、さくら、みどりは登録のみでイベント 0件

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

- **きた、さくら、みどり**: データセットにイベントがない
- 一部のセンターはInstagram等で情報公開しており、PDFスケジュールを公開していない可能性があります

## 技術スタック

- **フロントエンド**: Astro 7 の静的出力、Vanilla TypeScript、素の CSS
- **検証**: `scripts/validator.ts` の手書きバリデータ
- **PDFテキスト**: Python PyPDF2 (`scripts/extract-pdf-text.py`)
- **テスト**: Node の `node:test`
- **パッケージ**: pnpm（`package.json` の `packageManager`）。Node は `.node-version` のバージョン
- **デプロイ**: Cloudflare Pages。ビルドは `pnpm build`、出力は `dist`

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
