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
import { PromptTemplate } from '../../shared';

export interface StoryboardScene {
  sceneNumber: number;
  timeRange: string; // e.g. "0:00 - 0:30"
  durationSeconds: number;
  visualDescription: string;
  voiceoverScriptVi: string;
}

export function validatePromptTemplateSchema(template: Partial<PromptTemplate>): void {
  // Boundary 1: Empty prompt parameter validation
  if (!template.title || template.title.trim() === '') {
    throw new Error('INVALID_PROMPT_TEMPLATE: Title is required and cannot be empty');
  }
  if (!template.systemInstruction || template.systemInstruction.trim() === '') {
    throw new Error('INVALID_PROMPT_TEMPLATE: systemInstruction is required and cannot be empty');
  }
  if (!template.userPromptTemplate || template.userPromptTemplate.trim() === '') {
    throw new Error('INVALID_PROMPT_TEMPLATE: userPromptTemplate is required and cannot be empty');
  }
  if (template.temperature === undefined || template.temperature < 0 || template.temperature > 2) {
    throw new Error('INVALID_PROMPT_TEMPLATE: Temperature must be between 0.0 and 2.0');
  }
}

export function validateVideoStoryboard(scenes: StoryboardScene[]): { totalDurationSeconds: number; isValid: boolean } {
  // Boundary 2: 3-minute (180s) maximum limit & scene content integrity
  if (scenes.length === 0) {
    throw new Error('EMPTY_STORYBOARD: Video storyboard must contain at least one scene.');
  }

  let totalDuration = 0;
  for (const scene of scenes) {
    if (scene.durationSeconds <= 0) {
      throw new Error(`INVALID_SCENE_DURATION: Scene #${scene.sceneNumber} duration must be > 0s.`);
    }
    if (!scene.voiceoverScriptVi || scene.voiceoverScriptVi.trim() === '') {
      throw new Error(`MISSING_VOICEOVER: Scene #${scene.sceneNumber} is missing Vietnamese voiceover script.`);
    }
    totalDuration += scene.durationSeconds;
  }

  if (totalDuration > 180) { // > 3 minutes
    throw new Error(`DURATION_EXCEEDED: Storyboard total duration (${totalDuration}s) exceeds competition limit of 180s (3 minutes).`);
  }

  return { totalDurationSeconds: totalDuration, isValid: true };
}

export function validateSocialMediaPost(platform: 'facebook' | 'tiktok' | 'twitter', text: string): { isValid: boolean; charCount: number } {
  const limits: Record<string, number> = {
    twitter: 280,
    tiktok: 2200,
    facebook: 63206
  };

  // Boundary 3: Social media character limit validation
  const maxLimit = limits[platform] || 2000;
  const charCount = text.length;

  if (charCount > maxLimit) {
    throw new Error(`CHARACTER_LIMIT_EXCEEDED: Post length (${charCount}) exceeds ${platform} limit of ${maxLimit} characters.`);
  }

  return { isValid: true, charCount };
}

export function validateMarkdownIntegrity(markdownText: string): { isValid: boolean; codeFencesBalanced: boolean } {
  // Boundary 4: Markdown syntax integrity
  const codeBlockCount = (markdownText.match(/```/g) || []).length;
  const codeFencesBalanced = codeBlockCount % 2 === 0;

  if (!codeFencesBalanced) {
    throw new Error('UNBALANCED_MARKDOWN_CODE_FENCE: Markdown contains unclosed code fence block ```');
  }

  return { isValid: true, codeFencesBalanced: true };
}

export function validateCompetitionTags(postContent: string): { missingTags: string[]; hasAllRequiredTags: boolean } {
  // Boundary 5: Required competition tags check
  const requiredTags = ['#BuildwithGoogleAI', '#AIRiserVietnam2026', '#VibeCoding', '#SMEAutoPilot'];
  const missingTags: string[] = [];

  for (const tag of requiredTags) {
    if (!postContent.includes(tag)) {
      missingTags.push(tag);
    }
  }

  return {
    missingTags,
    hasAllRequiredTags: missingTags.length === 0
  };
}

describe('Tier 2 Feature B16: Submission Assets Edges Boundary Tests', () => {
  test('B16.1 - Empty prompt template parameter schema throws INVALID_PROMPT_TEMPLATE', async () => {
    await assertThrows(
      () => validatePromptTemplateSchema({ title: '', systemInstruction: 'Valid', userPromptTemplate: 'Valid', temperature: 0.7 }),
      'INVALID_PROMPT_TEMPLATE'
    );

    await assertThrows(
      () => validatePromptTemplateSchema({ title: 'Tmpl', systemInstruction: '', userPromptTemplate: 'Valid', temperature: 0.7 }),
      'INVALID_PROMPT_TEMPLATE'
    );

    await assertThrows(
      () => validatePromptTemplateSchema({ title: 'Tmpl', systemInstruction: 'Valid', userPromptTemplate: '', temperature: 0.7 }),
      'INVALID_PROMPT_TEMPLATE'
    );

    await assertThrows(
      () => validatePromptTemplateSchema({ title: 'Tmpl', systemInstruction: 'Valid', userPromptTemplate: 'Valid', temperature: 2.5 }),
      'INVALID_PROMPT_TEMPLATE'
    );
  });

  test('B16.2 - Video demo storyboard timing enforces 180s (3-min) competition limit and non-empty narration', async () => {
    const validScenes: StoryboardScene[] = [
      { sceneNumber: 1, timeRange: '0:00 - 0:30', durationSeconds: 30, visualDescription: 'Intro', voiceoverScriptVi: 'Giới thiệu SME AutoPilot' },
      { sceneNumber: 2, timeRange: '0:30 - 1:30', durationSeconds: 60, visualDescription: 'Forensics Demo', voiceoverScriptVi: 'Kiểm tra hóa đơn VietQR' },
      { sceneNumber: 3, timeRange: '1:30 - 3:00', durationSeconds: 90, visualDescription: 'Voice Order Demo', voiceoverScriptVi: 'Đặt hàng giọng nói' }
    ];

    const result = validateVideoStoryboard(validScenes);
    assertTrue(result.isValid);
    assertEqual(result.totalDurationSeconds, 180);

    // Over-length storyboard (>180s)
    const longScenes: StoryboardScene[] = [
      ...validScenes,
      { sceneNumber: 4, timeRange: '3:00 - 3:30', durationSeconds: 30, visualDescription: 'Extra', voiceoverScriptVi: 'Quá giờ' }
    ];
    await assertThrows(
      () => validateVideoStoryboard(longScenes),
      'DURATION_EXCEEDED'
    );
  });

  test('B16.3 - Social media character limit validator catches oversized posts for Twitter/X and TikTok', async () => {
    const shortPost = 'SME AutoPilot ra mắt tại #BuildwithGoogleAI #AIRiserVietnam2026';
    const resTwitter = validateSocialMediaPost('twitter', shortPost);
    assertTrue(resTwitter.isValid);

    const longTwitterPost = 'A'.repeat(300); // > 280
    await assertThrows(
      () => validateSocialMediaPost('twitter', longTwitterPost),
      'CHARACTER_LIMIT_EXCEEDED'
    );

    const longTikTokPost = 'B'.repeat(2500); // > 2200
    await assertThrows(
      () => validateSocialMediaPost('tiktok', longTikTokPost),
      'CHARACTER_LIMIT_EXCEEDED'
    );
  });

  test('B16.4 - Markdown syntax integrity validator detects unclosed code fences', async () => {
    const validMd = '# Hướng Dẫn\n```typescript\nconst x = 1;\n```\nNội dung tiếp theo';
    const validResult = validateMarkdownIntegrity(validMd);
    assertTrue(validResult.codeFencesBalanced);

    const brokenMd = '# Hướng Dẫn\n```typescript\nconst x = 1;\nQuên đóng code block!';
    await assertThrows(
      () => validateMarkdownIntegrity(brokenMd),
      'UNBALANCED_MARKDOWN_CODE_FENCE'
    );
  });

  test('B16.5 - Required competition tags validator detects missing mandatory hashtags', () => {
    const completePost = 'Chào mừng bạn đến với SME AutoPilot! #BuildwithGoogleAI #AIRiserVietnam2026 #VibeCoding #SMEAutoPilot';
    const completeCheck = validateCompetitionTags(completePost);
    assertTrue(completeCheck.hasAllRequiredTags);
    assertEqual(completeCheck.missingTags.length, 0);

    const incompletePost = 'Chào mừng bạn đến với SME AutoPilot! #BuildwithGoogleAI';
    const incompleteCheck = validateCompetitionTags(incompletePost);
    assertFalse(incompleteCheck.hasAllRequiredTags);
    assertContains(incompleteCheck.missingTags, '#AIRiserVietnam2026');
    assertContains(incompleteCheck.missingTags, '#VibeCoding');
    assertContains(incompleteCheck.missingTags, '#SMEAutoPilot');
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
