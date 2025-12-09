/**
 * Diagnostic Script: Identify Vision Analysis Failures
 * 
 * This script identifies which images haven't been analyzed and why
 */

const brandId = 'brand_1765141979741_432aq4';

async function diagnoseVisionAnalysis() {
    console.log('🔍 DIAGNOSING VISION ANALYSIS FAILURES');
    console.log('=' .repeat(60));
    
    try {
        // Get vision statistics
        const statsResponse = await fetch(`http://127.0.0.1:8000/media/vision-stats/${brandId}`);
        const stats = await statsResponse.json();
        
        console.log('📊 Current Statistics:');
        console.log(`  Total Images: ${stats.stats.total_images}`);
        console.log(`  Analyzed: ${stats.stats.analyzed}`);
        console.log(`  Unanalyzed: ${stats.stats.unanalyzed}`);
        console.log(`  Success Rate: ${((stats.stats.analyzed / stats.stats.total_images) * 100).toFixed(1)}%`);
        
        if (stats.stats.unanalyzed === 0) {
            console.log('✅ All images are analyzed! 100% success rate achieved.');
            return;
        }
        
        console.log(`\n❌ Found ${stats.stats.unanalyzed} unanalyzed images. Investigating...`);
        
        // Try to trigger analysis to see specific errors
        console.log('\n🔧 Attempting analysis to capture error details...');
        
        const analysisResponse = await fetch('http://127.0.0.1:8000/media/analyze-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                brand_id: brandId,
                analyze_all: true
            })
        });
        
        const analysisResult = await analysisResponse.json();
        
        console.log('\n📋 Analysis Result:');
        console.log(`  Status: ${analysisResult.status}`);
        console.log(`  Analyzed Count: ${analysisResult.analyzed_count}`);
        console.log(`  Total Items: ${analysisResult.total_items}`);
        
        if (analysisResult.errors && analysisResult.errors.length > 0) {
            console.log('\n❌ Specific Errors Found:');
            analysisResult.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }
        
        if (analysisResult.error_breakdown) {
            console.log('\n📊 Error Breakdown:');
            console.log(`  Vision Analysis Errors: ${analysisResult.error_breakdown.vision_analysis_errors}`);
            console.log(`  Firestore Update Errors: ${analysisResult.error_breakdown.firestore_update_errors}`);
            console.log(`  Total Errors: ${analysisResult.error_breakdown.total_errors}`);
        }
        
        // Calculate current success rate
        const newSuccessRate = ((analysisResult.analyzed_count / analysisResult.total_items) * 100).toFixed(1);
        console.log(`\n📈 Current Success Rate: ${newSuccessRate}%`);
        
        if (newSuccessRate === '100.0') {
            console.log('🎉 SUCCESS: 100% vision analysis achieved!');
        } else {
            console.log(`\n🎯 Goal: Get from ${newSuccessRate}% to 100% success rate`);
            console.log(`📝 Remaining issues: ${analysisResult.total_items - analysisResult.analyzed_count} images`);
        }
        
    } catch (error) {
        console.error('❌ Error during diagnosis:', error);
    }
}

// Run the diagnosis
diagnoseVisionAnalysis().catch(console.error);