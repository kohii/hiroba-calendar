# Center Investigation Report - October 20, 2026

## Executive Summary

**Total Centers Investigated**: 7 of 10 single-standing centers
- Already had data: 3 centers (nishi, minuma, urawa)
- Newly investigated: 7 centers (kita, omiya, yono, sakura, minami, midori, iwatsuki)

## Investigation Results

| Center | Schedule Type | Oct Available | Nov Available | Status |
|--------|--------------|---------------|---------------|---------|
| きた (kita) | image | ✗ No | ✗ No | Schedule on website as images |
| おおみや (omiya) | pdf | ✓ Yes | ✓ Yes | **READY TO EXTRACT** |
| よの (yono) | pdf | ✓ Yes | ✓ Yes | **READY TO EXTRACT** |
| さくら (sakura) | not_found | ✗ No | ✗ No | Not available online |
| みなみ (minami) | pdf | ✓ Yes | ✓ Yes | **READY TO EXTRACT** |
| みどり (midori) | instagram | ✗ No | ✗ No | Instagram only |
| いわつき (iwatsuki) | pdf | ✓ Yes | ✓ Yes | **READY TO EXTRACT** |

## Detailed Findings

### Centers With October & November Schedules (4 Centers)

#### 1. おおみや (Omiya) ✓
- **Website**: https://www.wakaba-asunaro.jp/omiya
- **October PDF**: https://www.wakaba-asunaro.jp/library/6662c3046985d13334e93bf0/6aa2318955d0ebeb15ea578c.pdf
- **November PDF**: https://www.wakaba-asunaro.jp/library/6662c3046985d13334e93bf0/6acec02b0e118c59d4e04436.pdf
- **Update Dates**: Oct posted 2026.9.10, Nov posted 2026.10.14
- **Format**: Clean PDF documents

#### 2. よの (Yono) ✓
- **Website**: https://www.himawarikkoland.com/yono
- **October Page**: https://www.himawarikkoland.com/yono202610
- **October PDF**: https://www.himawarikkoland.com/library/67e0faf1ee78e14239888cb6/6aab8fd00d9ae03ba8e0c508.pdf
- **November Page**: https://www.himawarikkoland.com/yono202611  
- **November PDF**: https://www.himawarikkoland.com/library/67e0faf1ee78e14239888cb6/6ad6bab4055a68706e9f2176.pdf
- **Format**: HTML preview pages with PDF downloads
- **Events**: Includes baby story sessions, welcome saitama, twin time, first aid training, birthday parties, body measurements, Halloween activities

#### 3. みなみ (Minami) ✓
- **Website**: https://www.urawanyuyouji.com/minami/
- **October PDF**: https://www.urawanyuyouji.com/admin/wp-content/uploads/2026/09/202610_minami.pdf
- **November PDF**: https://www.urawanyuyuyouji.com/admin/wp-content/uploads/2026/10/202611_minami.pdf
- **Format**: Well-organized WordPress site with clear schedule links

#### 4. いわつき (Iwatsuki) ✓
- **Website**: https://kawai-daynursery.jp/shiencenter
- **October PDF**: https://kawai-daynursery.jp/wp-content/uploads/2026/09/hina-202610.pdf
- **November PDF**: https://kawai-daynursery.jp/wp-content/uploads/2026/10/hina-202611.pdf
- **Newsletter Name**: 雛だより (Hina Dayori)
- **Format**: Clean website with clear PDF links

### Centers Without Online Schedules (3 Centers)

#### 5. きた (Kita) ⚠️
- **Website**: https://kodomo-bunka.jp/support/
- **Issue**: Schedule displayed as images on website, no downloadable PDFs
- **Found**: Images from Aug/Sept 2026 but not Oct/Nov
- **Recommendation**: Manual check needed or image extraction

#### 6. さくら (Sakura) ⚠️
- **Website**: http://www.ichiju-fukushi.or.jp/sakuraSch_next.html
- **Issue**: Website mentions "さくらチャンネル" but link not functional
- **Available**: Only general facility info and consultation hours
- **Recommendation**: Phone contact (048-859-3031) or in-person visit required

#### 7. みどり (Midori) ⚠️
- **Website**: https://www.instagram.com/shiencenter_midori/
- **Issue**: Instagram account only - cannot auto-scrape
- **Recommendation**: Manual Instagram check or Instagram API integration

## Schema Updates

Updated `lib/schema.ts` with per-center configuration:
- Added `scheduleType` field: 'pdf' | 'html' | 'image' | 'instagram' | 'not_found'
- Added `scheduleUrlPattern` for URL construction
- Added `scheduleNotes` for manual notes
- Corrected website URLs for all 7 investigated centers

## Next Steps

### Immediate Actions (Automatable)
1. ✅ Download 4 center PDFs (omiya, yono, minami, iwatsuki) for Oct & Nov
2. ✅ Extract events from 8 PDFs (4 centers × 2 months)
3. ✅ Validate extracted data
4. ✅ Merge into dataset
5. ✅ Add comprehensive tests (30+ tests)

### Manual Actions Required
1. **Kita**: Check website for updated image schedules
2. **Sakura**: Contact center directly for schedule information
3. **Midori**: Manual Instagram check for schedule posts

### 併設型 Centers Investigation
Sample 5 centers to verify they don't publish monthly schedules:
1. あすなろ保育園 子育て支援センター
2. ふたば保育園 子育て支援センター
3. ChaCha Children Suzuya 子育て支援センター
4. やまばと保育園 子育て支援センター
5. まきば保育園 子育て支援センター

## Dataset Status

### Current State
- **Total Centers**: 10 (all registered)
- **Centers with Oct Data**: 3 (nishi, minuma, urawa) → will be 7
- **Centers with Nov Data**: 0 → will be 4
- **Total Events**: 76 → will be 200+

### Expected After Extraction
- **Centers with Oct Data**: 7 (adding omiya, yono, minami, iwatsuki)
- **Centers with Nov Data**: 4 (omiya, yono, minami, iwatsuki)
- **Total Events**: Estimated 200-300 events

## Technical Updates

### Scripts Updated
- `lib/schema.ts`: Added schedule type configuration
- `scripts/investigate-centers.ts`: New comprehensive investigation script
- `data/center-investigation.json`: Detailed investigation results

### Scripts To Create
- `scripts/source-discovery.ts`: Generic source discovery (not just PDFs)
- Updated `scripts/pdf-discovery.ts`: Handle different formats

### Tests To Add
1. Source URL verification with mocked fetch
2. Validate-and-merge deduplication
3. Validate-and-merge reject malformed extraction
4. Validate-and-merge replace center-month on re-extraction
5. Discovery parsing with saved HTML fixtures
6. Calendar date bucketing
7. Event ID uniqueness
8. Date format validation
9. Time format validation
10. Required field presence
... (targeting 30+ total tests)

## Artifacts To Save
Will be saved to `/opt/cursor/artifacts/`:
1. `list-view-all-centers.png`
2. `calendar-grid-october.png`
3. `filtered-with-favorites.png`
4. `event-source-link-proof.png`

## URL Patterns Discovered

### Omiya
- Pattern: `https://www.wakaba-asunaro.jp/library/{library_id}/{document_id}.pdf`
- Discovery: Scrape homepage for latest PDF links

### Yono
- Pattern: `https://www.himawarikkoland.com/yono{YYYYMM}`
- PDF Pattern: `https://www.himawarikkoland.com/library/{library_id}/{hash}.pdf`
- Discovery: Direct URL construction + scrape for PDF link

### Minami
- Pattern: `https://www.urawanyuyouji.com/admin/wp-content/uploads/{YYYY}/{MM}/{YYYYMM}_minami.pdf`
- Discovery: Predictable URL pattern

### Iwatsuki
- Pattern: `https://kawai-daynursery.jp/wp-content/uploads/{YYYY}/{MM}/hina-{YYYYMM}.pdf`
- Discovery: Predictable URL pattern

## Recommendations

### Short Term
1. Implement PDF download and extraction for 4 ready centers
2. Add comprehensive test suite
3. Update discovery scripts to handle multiple source types
4. Generate demo artifacts

### Medium Term
1. Contact Sakura center for schedule access
2. Monitor Kita website for image schedule updates
3. Set up manual Midori Instagram monitoring process
4. Investigate 併設型 centers

### Long Term
1. Consider Instagram API integration for Midori
2. Implement image-to-text extraction for Kita
3. Set up automated monthly schedule discovery
4. Add notification system for new schedule availability
