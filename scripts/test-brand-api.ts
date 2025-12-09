
import { getBrandThemeAction } from './src/app/actions/ai-branding';

async function test() {
  const brandId = 'test-brand-id'; // Replace with a real brand ID if possible
  console.log(`Testing brand theme for: ${brandId}`);
  const result = await getBrandThemeAction(brandId);
  console.log('Result:', JSON.stringify(result, null, 2));
}

test();
