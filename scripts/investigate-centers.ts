/**
 * Comprehensive center investigation script
 * Discovers schedule sources for all 10 centers
 */

import * as cheerio from 'cheerio';
import { CENTERS } from '../lib/schema';

interface CenterInvestigation {
  centerId: string;
  centerName: string;
  websiteUrl: string;
  scheduleType: 'pdf' | 'html' | 'image' | 'instagram' | 'not_found';
  octoberAvailable: boolean;
  novemberAvailable: boolean;
  octoberUrl?: string;
  novemberUrl?: string;
  notes: string;
}

async function investigateCenter(centerId: string): Promise<CenterInvestigation> {
  const center = CENTERS.find(c => c.id === centerId);
  if (!center) {
    throw new Error(`Center not found: ${centerId}`);
  }

  const result: CenterInvestigation = {
    centerId: center.id,
    centerName: center.nameJa,
    websiteUrl: center.websiteUrl,
    scheduleType: 'not_found',
    octoberAvailable: false,
    novemberAvailable: false,
    notes: '',
  };

  console.log(`\n===== Investigating ${center.nameJa} (${center.id}) =====`);
  console.log(`URL: ${center.websiteUrl}`);

  try {
    // Handle Instagram separately
    if (center.websiteUrl.includes('instagram.com')) {
      result.scheduleType = 'instagram';
      result.notes = 'Instagram account - requires manual check or Instagram API';
      console.log('  Type: Instagram');
      return result;
    }

    // Fetch the website
    const response = await fetch(center.websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaitamaCityScheduleApp/1.0)',
      },
    });

    if (!response.ok) {
      result.notes = `Failed to fetch: ${response.status} ${response.statusText}`;
      console.log(`  Error: ${result.notes}`);
      return result;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for PDF links
    const pdfLinks: { text: string; href: string }[] = [];
    $('a[href*=".pdf"], a[href*=".PDF"]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) {
        pdfLinks.push({ text, href });
      }
    });

    console.log(`  Found ${pdfLinks.length} PDF links`);

    // Check for October and November PDFs
    for (const link of pdfLinks) {
      const combined = link.text + ' ' + link.href;
      
      // Make absolute URL
      let url = link.href;
      if (link.href.startsWith('/')) {
        const baseUrl = new URL(center.websiteUrl).origin;
        url = baseUrl + link.href;
      } else if (!link.href.startsWith('http')) {
        url = new URL(link.href, center.websiteUrl).href;
      }

      // Check for October (10月 or 202610)
      if (combined.match(/10月|2026.*10|202610/i)) {
        result.octoberAvailable = true;
        result.octoberUrl = url;
        result.scheduleType = 'pdf';
        console.log(`  ✓ October PDF found: ${url}`);
      }

      // Check for November (11月 or 202611)
      if (combined.match(/11月|2026.*11|202611/i)) {
        result.novemberAvailable = true;
        result.novemberUrl = url;
        result.scheduleType = 'pdf';
        console.log(`  ✓ November PDF found: ${url}`);
      }
    }

    // If no PDFs found, check for HTML schedule content
    if (result.scheduleType === 'not_found') {
      const hasScheduleContent = $('body').text().match(/イベント|プログラム|スケジュール|カレンダー/);
      if (hasScheduleContent) {
        result.scheduleType = 'html';
        result.notes = 'Schedule appears to be embedded in HTML, not PDF';
        console.log('  Type: HTML embedded schedule');
      }
    }

    if (!result.octoberAvailable && !result.novemberAvailable) {
      result.notes = result.notes || 'No October or November schedules found';
      console.log(`  ${result.notes}`);
    }

  } catch (error) {
    result.notes = `Error: ${error.message}`;
    console.log(`  Error: ${error.message}`);
  }

  return result;
}

async function investigateAllCenters(): Promise<CenterInvestigation[]> {
  const results: CenterInvestigation[] = [];
  
  // Centers to investigate
  const centersToCheck = [
    'kita',
    'omiya', 
    'yono',
    'sakura',
    'minami',
    'midori',
    'iwatsuki',
  ];

  for (const centerId of centersToCheck) {
    const result = await investigateCenter(centerId);
    results.push(result);
    // Be respectful with requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

// Print summary table
function printSummary(results: CenterInvestigation[]) {
  console.log('\n\n===== INVESTIGATION SUMMARY =====\n');
  console.log('| Center | Schedule Type | Oct Available | Nov Available | Notes |');
  console.log('|--------|--------------|---------------|---------------|-------|');
  
  for (const r of results) {
    const oct = r.octoberAvailable ? '✓ Yes' : '✗ No';
    const nov = r.novemberAvailable ? '✓ Yes' : '✗ No';
    const notes = r.notes.slice(0, 40);
    console.log(`| ${r.centerName} | ${r.scheduleType} | ${oct} | ${nov} | ${notes} |`);
  }

  console.log('\n===== DETAILED URLS =====\n');
  for (const r of results) {
    if (r.octoberUrl || r.novemberUrl) {
      console.log(`\n${r.centerName} (${r.centerId}):`);
      if (r.octoberUrl) console.log(`  October:  ${r.octoberUrl}`);
      if (r.novemberUrl) console.log(`  November: ${r.novemberUrl}`);
    }
  }

  // Count statistics
  const withOct = results.filter(r => r.octoberAvailable).length;
  const withNov = results.filter(r => r.novemberAvailable).length;
  const withPdf = results.filter(r => r.scheduleType === 'pdf').length;
  
  console.log('\n===== STATISTICS =====');
  console.log(`Total centers investigated: ${results.length}`);
  console.log(`With October schedule: ${withOct}/${results.length}`);
  console.log(`With November schedule: ${withNov}/${results.length}`);
  console.log(`Using PDF format: ${withPdf}/${results.length}`);
}

// Main execution
if (require.main === module) {
  investigateAllCenters()
    .then(results => {
      printSummary(results);
      
      // Save results to file
      const fs = require('fs');
      fs.writeFileSync(
        'data/center-investigation.json',
        JSON.stringify(results, null, 2)
      );
      console.log('\nResults saved to data/center-investigation.json');
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { investigateCenter, investigateAllCenters, CenterInvestigation };
