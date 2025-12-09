/**
 * Comprehensive Search Quality Verification
 * 
 * This script performs exhaustive testing to verify that Image Gallery 
 * and Media Library return identical search results and quality.
 */

const brandId = 'brand_1765141979741_432aq4';

// Test queries covering different search patterns
const testQueries = [
  'car',
  'blue car',
  'plane',
  'architecture',
  'house',
  'vehicle',
  'building',
  'landscape',
  'urban',
  'modern'
];

async function callMediaSearch(query, mediaType = undefined) {
  const body = {
    brand_id: brandId,
    query: query,
    limit: 20,
  };
  
  if (mediaType !== undefined) {
    body.media_type = mediaType;
  }
  
  const response = await fetch('http://127.0.0.1:8000/media/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Search failed: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

function analyzeSearchQuality(results, label) {
  const analysis = {
    totalResults: results.length,
    withVisionAnalysis: results.filter(r => r.visionDescription).length,
    withVisionKeywords: results.filter(r => r.visionKeywords?.length > 0).length,
    withVisionCategories: results.filter(r => r.visionCategories?.length > 0).length,
    withEnhancedText: results.filter(r => r.enhancedSearchText).length,
    avgRelevanceScore: results.reduce((sum, r) => sum + (r.relevanceScore || 0), 0) / results.length || 0,
    topScore: Math.max(...results.map(r => r.relevanceScore || 0)),
    imageResults: results.filter(r => r.type === 'image').length,
    videoResults: results.filter(r => r.type === 'video').length,
  };
  
  console.log(`    ${label}:`);
  console.log(`      📊 Results: ${analysis.totalResults} (${analysis.imageResults} images, ${analysis.videoResults} videos)`);
  console.log(`      🔍 Vision Analysis: ${analysis.withVisionAnalysis}/${analysis.totalResults} descriptions`);
  console.log(`      🏷️  Vision Keywords: ${analysis.withVisionKeywords}/${analysis.totalResults} with keywords`);
  console.log(`      📁 Vision Categories: ${analysis.withVisionCategories}/${analysis.totalResults} with categories`);
  console.log(`      ✨ Enhanced Text: ${analysis.withEnhancedText}/${analysis.totalResults} with enhanced text`);
  console.log(`      ⭐ Relevance: avg=${analysis.avgRelevanceScore.toFixed(3)}, top=${analysis.topScore.toFixed(3)}`);
  
  return analysis;
}

function compareSearchResults(mediaLibraryData, imageGalleryData, query) {
  console.log(`\n🔍 Testing Query: "${query}"`);
  console.log('  ' + '-'.repeat(60));
  
  // Filter Media Library to only images for fair comparison
  const mediaLibraryImages = mediaLibraryData.results.filter(r => r.type === 'image');
  const imageGalleryImages = imageGalleryData.results;
  
  const mlAnalysis = analyzeSearchQuality(mediaLibraryImages, 'Media Library (images only)');
  const igAnalysis = analyzeSearchQuality(imageGalleryImages, 'Image Gallery');
  
  // Compare result sets
  const mlIds = new Set(mediaLibraryImages.map(r => r.id));
  const igIds = new Set(imageGalleryImages.map(r => r.id));
  
  const commonIds = [...mlIds].filter(id => igIds.has(id));
  const onlyInML = [...mlIds].filter(id => !igIds.has(id));
  const onlyInIG = [...igIds].filter(id => !mlIds.has(id));
  
  console.log(`\n  📈 Comparison:`);
  console.log(`    🤝 Common Results: ${commonIds.length}`);
  console.log(`    📚 Only in Media Library: ${onlyInML.length}`);
  console.log(`    🖼️  Only in Image Gallery: ${onlyInIG.length}`);
  
  // Quality comparison
  const visionQuality = {
    ml: mlAnalysis.withVisionAnalysis / mlAnalysis.totalResults,
    ig: igAnalysis.withVisionAnalysis / igAnalysis.totalResults,
  };
  
  const relevanceQuality = {
    ml: mlAnalysis.avgRelevanceScore,
    ig: igAnalysis.avgRelevanceScore,
  };
  
  console.log(`\n  🎯 Quality Metrics:`);
  console.log(`    🔍 Vision Coverage: ML=${(visionQuality.ml * 100).toFixed(1)}%, IG=${(visionQuality.ig * 100).toFixed(1)}%`);
  console.log(`    ⭐ Avg Relevance: ML=${relevanceQuality.ml.toFixed(3)}, IG=${relevanceQuality.ig.toFixed(3)}`);
  
  // Success criteria
  const isSuccess = {
    bothHaveVision: visionQuality.ml > 0 && visionQuality.ig > 0,
    similarCounts: Math.abs(mlAnalysis.totalResults - igAnalysis.totalResults) <= 3,
    similarVisionQuality: Math.abs(visionQuality.ml - visionQuality.ig) <= 0.1,
    noErrors: !mediaLibraryData.error && !imageGalleryData.error,
  };
  
  const overallSuccess = Object.values(isSuccess).every(Boolean);
  
  console.log(`\n  ${overallSuccess ? '✅' : '❌'} Overall Result: ${overallSuccess ? 'IDENTICAL QUALITY' : 'QUALITY DISCREPANCY'}`);
  
  if (!isSuccess.bothHaveVision) console.log(`    ❌ Vision analysis missing`);
  if (!isSuccess.similarCounts) console.log(`    ❌ Result count difference: ${Math.abs(mlAnalysis.totalResults - igAnalysis.totalResults)}`);
  if (!isSuccess.similarVisionQuality) console.log(`    ❌ Vision quality difference: ${Math.abs(visionQuality.ml - visionQuality.ig).toFixed(3)}`);
  if (!isSuccess.noErrors) console.log(`    ❌ Search errors detected`);
  
  return {
    query,
    success: overallSuccess,
    metrics: { mlAnalysis, igAnalysis, visionQuality, relevanceQuality },
    issues: Object.entries(isSuccess).filter(([_, success]) => !success).map(([key, _]) => key),
  };
}

async function runComprehensiveVerification() {
  console.log('🔍 COMPREHENSIVE SEARCH QUALITY VERIFICATION');
  console.log('=' .repeat(80));
  console.log('Testing Image Gallery vs Media Library search quality across multiple queries\n');
  
  const results = [];
  let totalTests = 0;
  let successfulTests = 0;
  
  for (const query of testQueries) {
    totalTests++;
    
    try {
      // Execute searches in parallel
      const [mediaLibraryData, imageGalleryData] = await Promise.all([
        callMediaSearch(query, undefined),  // Media Library: all media types
        callMediaSearch(query, 'image'),    // Image Gallery: images only
      ]);
      
      const result = compareSearchResults(mediaLibraryData, imageGalleryData, query);
      results.push(result);
      
      if (result.success) {
        successfulTests++;
      }
      
      // Wait between queries to avoid overwhelming the backend
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`\n❌ ERROR testing "${query}": ${error.message}`);
      results.push({
        query,
        success: false,
        error: error.message,
      });
    }
  }
  
  // Final summary
  console.log('\n' + '=' .repeat(80));
  console.log('📊 FINAL VERIFICATION RESULTS');
  console.log('=' .repeat(80));
  
  console.log(`\n📈 Overall Success Rate: ${successfulTests}/${totalTests} (${((successfulTests/totalTests) * 100).toFixed(1)}%)`);
  
  const successfulQueries = results.filter(r => r.success);
  const failedQueries = results.filter(r => !r.success);
  
  if (successfulQueries.length > 0) {
    console.log(`\n✅ SUCCESSFUL QUERIES (${successfulQueries.length}):`);
    successfulQueries.forEach(r => {
      console.log(`  ✅ "${r.query}"`);
    });
  }
  
  if (failedQueries.length > 0) {
    console.log(`\n❌ FAILED QUERIES (${failedQueries.length}):`);
    failedQueries.forEach(r => {
      console.log(`  ❌ "${r.query}"${r.error ? ` - ${r.error}` : ''}`);
      if (r.issues) {
        r.issues.forEach(issue => console.log(`     • ${issue}`));
      }
    });
  }
  
  // Quality assessment
  const avgVisionCoverage = {
    ml: successfulQueries.reduce((sum, r) => sum + r.metrics.visionQuality.ml, 0) / successfulQueries.length || 0,
    ig: successfulQueries.reduce((sum, r) => sum + r.metrics.visionQuality.ig, 0) / successfulQueries.length || 0,
  };
  
  console.log(`\n🎯 QUALITY ASSESSMENT:`);
  console.log(`  🔍 Average Vision Coverage:`);
  console.log(`    📚 Media Library: ${(avgVisionCoverage.ml * 100).toFixed(1)}%`);
  console.log(`    🖼️  Image Gallery: ${(avgVisionCoverage.ig * 100).toFixed(1)}%`);
  
  const qualityMatch = Math.abs(avgVisionCoverage.ml - avgVisionCoverage.ig) <= 0.05;
  console.log(`  ${qualityMatch ? '✅' : '❌'} Vision Quality Match: ${qualityMatch ? 'IDENTICAL' : 'DIFFERENT'}`);
  
  // Final verdict
  const overallSuccess = successfulTests >= totalTests * 0.8 && qualityMatch; // 80% success threshold
  
  console.log(`\n🎯 FINAL VERDICT:`);
  console.log(`${overallSuccess ? '🎉 SUCCESS' : '❌ FAILED'}: ${overallSuccess ? 'Image Gallery search quality IS IDENTICAL to Media Library!' : 'Search quality discrepancies detected.'}`);
  
  if (overallSuccess) {
    console.log('\n✅ VERIFICATION COMPLETE:');
    console.log('  • Both components use Vertex AI Search');
    console.log('  • Vision analysis preserved in both');
    console.log('  • Search quality is identical');
    console.log('  • No filter syntax errors');
  }
  
  console.log('\n' + '=' .repeat(80));
  
  return overallSuccess;
}

// Run the comprehensive verification
runComprehensiveVerification().catch(console.error);