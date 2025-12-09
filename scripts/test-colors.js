function hslToHex(hsl) {
  // Handle hsl(h, s%, l%) format
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#000000'; // Fallback

  const h = parseInt(match[1]);
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n, k = (n + h / 30) % 12) => {
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

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
