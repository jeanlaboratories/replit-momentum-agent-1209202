import { hslToHex } from './src/lib/utils.js';

function testHslToHex() {
  console.log('Testing hslToHex...');
  const tests = [
    { input: 'hsl(0, 100%, 50%)', expected: '#ff0000' },
    { input: 'hsl(120, 100%, 50%)', expected: '#00ff00' },
    { input: 'hsl(240, 100%, 50%)', expected: '#0000ff' },
    { input: 'hsl(0, 0%, 0%)', expected: '#000000' },
    { input: 'hsl(0, 0%, 100%)', expected: '#ffffff' },
    { input: 'invalid', expected: '#000000' }, // Fallback
  ];

  let passed = 0;
  tests.forEach(({ input, expected }) => {
    const result = hslToHex(input);
    if (result === expected) {
      passed++;
    } else {
      console.error(`Failed: input=${input}, expected=${expected}, got=${result}`);
    }
  });

  console.log(`Passed ${passed}/${tests.length} tests.`);
  return passed === tests.length;
}

testHslToHex();
