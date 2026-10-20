/**
 * Main script to refresh all data
 * 1. Discover PDFs
 * 2. Download PDFs
 * 3. Show which ones need extraction
 */

import { discoverAllPDFs, filterRelevantPDFs } from './pdf-discovery';
import { downloadAllPDFs } from './pdf-download';

async function main() {
  console.log('=== さいたま市子育て支援センタースケジュール データ更新 ===\n');
  
  console.log('Step 1: PDF発見...');
  const allLinks = await discoverAllPDFs();
  const relevantLinks = filterRelevantPDFs(allLinks);
  
  console.log(`  見つかったPDF: ${allLinks.length}件`);
  console.log(`  対象月のPDF: ${relevantLinks.length}件\n`);
  
  console.log('Step 2: PDFダウンロード...');
  const documents = await downloadAllPDFs(relevantLinks);
  console.log(`  ダウンロード完了: ${documents.length}件\n`);
  
  const needsExtraction = documents.filter(d => !d.extractedAt);
  
  if (needsExtraction.length > 0) {
    console.log('Step 3: AI抽出が必要なドキュメント:');
    for (const doc of needsExtraction) {
      console.log(`  - ${doc.centerId} ${doc.month}`);
    }
    console.log('\n次のコマンドでスキルを使用して抽出を実行してください:');
    console.log('  .cursor/skills/refresh-schedule-data/SKILL.md を参照\n');
  } else {
    console.log('すべてのPDFが抽出済みです。\n');
  }
  
  console.log('データ更新完了！');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
