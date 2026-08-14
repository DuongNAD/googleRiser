import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  assertContains,
  assertThrows,
  runAllRegisteredSuites
} from '../harness';

export function validateImageUpload(mimeType: string, fileSizeMb: number): { valid: boolean; normalizedMime: string } {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  // Boundary 1: Unsupported image MIME type
  if (!allowedMimes.includes(mimeType)) {
    throw new Error(`UNSUPPORTED_MIME_TYPE: File type "${mimeType}" is not supported. Allowed formats: JPG, PNG, WEBP.`);
  }

  if (fileSizeMb > 25) {
    throw new Error(`FILE_TOO_LARGE: Image size (${fileSizeMb}MB) exceeds 25MB limit.`);
  }

  return { valid: true, normalizedMime: mimeType };
}

export function normalizeAspectRatio(requestedRatio: string): '1:1' | '9:16' | '16:9' {
  // Boundary 2: Extreme aspect ratio normalization
  if (requestedRatio === '1:1' || requestedRatio === '9:16' || requestedRatio === '16:9') {
    return requestedRatio;
  }

  // Parse custom ratio numbers e.g. 1:9, 20:1
  const parts = requestedRatio.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
    const decimal = parts[0] / parts[1];
    if (decimal < 0.75) return '9:16'; // tall portrait
    if (decimal > 1.33) return '16:9'; // wide landscape
    return '1:1';
  }

  return '1:1'; // default fallback
}

export function renderPromptTemplate(template: string, variables: Record<string, any>): string {
  // Boundary 3: Missing variables replaced with fallback
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, varName) => {
    if (variables[varName] !== undefined && variables[varName] !== null) {
      return String(variables[varName]);
    }
    return ''; // safe empty string fallback
  });
}

export function calculateCopyLengthLimit(platform: 'facebook' | 'tiktokShop' | 'zalo' | 'shopee', userWordLimit?: number): number {
  const platformDefaults: Record<string, number> = {
    facebook: 150,
    tiktokShop: 80,
    zalo: 50,
    shopee: 200
  };

  // Boundary 4: 0 or negative word limit fallback
  if (userWordLimit === undefined || userWordLimit <= 0 || isNaN(userWordLimit)) {
    return platformDefaults[platform] || 100;
  }

  return userWordLimit;
}

export function validateMarketingChannel(channel: string): void {
  const supported = ['facebook', 'tiktokShop', 'zalo', 'shopee'];
  // Boundary 5: Invalid channel target
  if (!supported.includes(channel)) {
    throw new Error(`UNSUPPORTED_CHANNEL: Channel "${channel}" is not supported. Valid channels: ${supported.join(', ')}`);
  }
}

describe('Tier 2 Feature B13: Product Workbench Edges Boundary Tests', () => {
  test('B13.1 - Unsupported image MIME type (application/pdf, image/tiff) throws UNSUPPORTED_MIME_TYPE', async () => {
    await assertThrows(
      () => validateImageUpload('application/pdf', 2),
      'UNSUPPORTED_MIME_TYPE'
    );

    await assertThrows(
      () => validateImageUpload('image/tiff', 5),
      'UNSUPPORTED_MIME_TYPE'
    );

    const validResult = validateImageUpload('image/png', 3);
    assertTrue(validResult.valid);
  });

  test('B13.2 - Extreme aspect ratios (1:9, 20:1) normalize to standard studio ratios', () => {
    assertEqual(normalizeAspectRatio('1:9'), '9:16');
    assertEqual(normalizeAspectRatio('20:1'), '16:9');
    assertEqual(normalizeAspectRatio('unrecognized_ratio'), '1:1');
    assertEqual(normalizeAspectRatio('1:1'), '1:1');
  });

  test('B13.3 - Prompt template with missing variables renders without error or unresolved raw tags', () => {
    const template = 'Chụp ảnh sản phẩm {{productTitle}} phong cách {{style}} tại {{location}} với chất liệu {{material}}.';
    const rendered = renderPromptTemplate(template, {
      productTitle: 'Áo Dài Lụa',
      style: 'Cổ Điển'
      // location and material are missing
    });

    assertContains(rendered, 'Áo Dài Lụa');
    assertContains(rendered, 'Cổ Điển');
    assertFalse(rendered.includes('{{location}}'));
    assertFalse(rendered.includes('{{material}}'));
  });

  test('B13.4 - Copy generation with 0 or negative word limit falls back to platform default', () => {
    const fbLimit = calculateCopyLengthLimit('facebook', 0);
    assertEqual(fbLimit, 150);

    const tiktokLimit = calculateCopyLengthLimit('tiktokShop', -50);
    assertEqual(tiktokLimit, 80);

    const customLimit = calculateCopyLengthLimit('zalo', 75);
    assertEqual(customLimit, 75);
  });

  test('B13.5 - Unsupported channel target throws UNSUPPORTED_CHANNEL error with valid list', async () => {
    await assertThrows(
      () => validateMarketingChannel('myspace'),
      'UNSUPPORTED_CHANNEL'
    );

    await assertThrows(
      () => validateMarketingChannel('unknown_platform'),
      'UNSUPPORTED_CHANNEL'
    );
  });
});

if (require.main === module) {
  runAllRegisteredSuites().then(results => {
    let failed = 0;
    for (const r of results) {
      console.log(`Suite: ${r.name} (${r.passed}/${r.total} passed)`);
      failed += r.failed;
    }
    process.exit(failed > 0 ? 1 : 0);
  });
}
