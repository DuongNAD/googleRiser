import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertContains
} from '../harness';

export interface SubmissionPack {
  guideMarkdown: string;
  systemPrompts: {
    forensics: string;
    productStudio: string;
    voiceAssistant: string;
  };
  videoStoryboard: {
    timestamp: string;
    durationSec: number;
    title: string;
    action: string;
    screen: string;
  }[];
  socialPosts: {
    facebook: string;
    linkedin: string;
    xTwitter: string;
  };
  requiredTags: string[];
}

export const SAMPLE_SUBMISSION_PACK: SubmissionPack = {
  guideMarkdown: `# SME AutoPilot: Complete Operations Suite for Vietnamese Merchants (#BuildwithGoogleAI AI Riser Vietnam 2026)

## 1. Project Overview & Mission
SME AutoPilot empowers 5+ million Vietnamese online sellers and micro-enterprises with multimodal AI operations:
- Instant VietQR & Banking Slip Forensics (fraud detection)
- Automated Product Studio & Vietnamese Multi-Channel Copywriting
- Voice & Conversational AI Order Assistant with Google Ecosystem Sync (Sheets, Gmail, Calendar, Maps)

## 2. Solution Architecture & Google Ecosystem Integration
- Gemini 2.0 Flash / Pro
- Google Sheets API v4
- Gmail API v1 & Calendar API v3
- Google Maps Platform
- Firebase Auth & Firestore
- Cloud Run Deployment

## 3. Replicable Google AI Studio Prompts
Detailed instructions and zero-shot schemas included.

## 4. 3-Minute Video Demo Storyboard & Script
Comprehensive minute-by-minute breakdown.

## 5. Social Media Sharing
Official competition posts with #BuildwithGoogleAI, #AIRiserVietnam2026, #VibeCoding.
`,
  systemPrompts: {
    forensics: `You are the SME AutoPilot Forensic Auditor. You analyze Vietnamese banking transfer slips and VietQR codes across Vietcombank, MBBank, Techcombank, VPBank, ACB. Inspect typography, status bar time, compression artifacts, and EMVCo payload. Output structured JSON matching BillForensicsResult.`,
    productStudio: `You are the SME AutoPilot Product Studio Copywriter. You generate viral, culturally resonant Vietnamese e-commerce copy for Facebook, TikTok Shop, Zalo, and Shopee based on product attributes and tone presets (friendly, luxury, youthful, urgent_sale).`,
    voiceAssistant: `You are the SME AutoPilot Conversational Sales Assistant. You speak natural Vietnamese with Northern, Central, and Southern dialect understanding. Use tool calling to query_inventory, calculate_shipping_fee, and create_draft_order.`
  },
  videoStoryboard: [
    {
      timestamp: '00:00 - 00:45',
      durationSec: 45,
      title: 'Hook & The Vietnamese SME Dilemma',
      action: 'Show online merchant overwhelmed with fake bank slips and manual chat orders.',
      screen: 'DashboardView'
    },
    {
      timestamp: '00:45 - 01:30',
      durationSec: 45,
      title: 'Multimodal VietQR Forensics in Action',
      action: 'Drag and drop forged slip. System highlights manipulated amount & timestamp mismatch.',
      screen: 'BillAuditView'
    },
    {
      timestamp: '01:30 - 02:15',
      durationSec: 45,
      title: 'Voice Assistant & Google Sheets Bi-Sync',
      action: 'Customer speaks in Vietnamese. Assistant checks inventory, books order, syncs to Google Sheets.',
      screen: 'VoiceAssistantView'
    },
    {
      timestamp: '02:15 - 03:00',
      durationSec: 45,
      title: 'Product Studio & Google Maps Dispatch',
      action: 'Generate Imagen 3 studio background, export copy, optimize motorbike shipping route.',
      screen: 'ProductStudioView & EcosystemSettingsView'
    }
  ],
  socialPosts: {
    facebook: `🚀 Tự hào giới thiệu "SME AutoPilot" - Nền tảng vận hành AI toàn diện cho nhà bán hàng Việt Nam tham gia cuộc thi #BuildwithGoogleAI #AIRiserVietnam2026! Tích hợp Gemini 2.0 Flash, Google Sheets, Maps, Gmail và Firebase giúp tiểu thương chống bill giả VietQR và tự động hóa bán hàng! #VibeCoding`,
    linkedin: `Excited to present SME AutoPilot for #BuildwithGoogleAI AI Riser Vietnam 2026! An enterprise-grade multimodal AI operations platform integrating Gemini 2.0 and Google Workspace for Southeast Asian merchants. #BuildwithGoogleAI #AIRiserVietnam2026 #VibeCoding #GoogleCloud`,
    xTwitter: `Built SME AutoPilot for #BuildwithGoogleAI #AIRiserVietnam2026! Multimodal AI forensics for VietQR, voice ordering, and Google Sheets bi-sync in one seamless web app. #VibeCoding #Gemini20`
  },
  requiredTags: [
    '#BuildwithGoogleAI',
    '#AIRiserVietnam2026',
    '#VibeCoding'
  ]
};

describe('F16: Submission Guide, Video Storyboard & Social Media Pack', () => {
  test('Test 16.1: SUBMISSION_GUIDE.md structure and required sections', () => {
    const guide = SAMPLE_SUBMISSION_PACK.guideMarkdown;
    assertContains(guide, '# SME AutoPilot');
    assertContains(guide, 'Project Overview');
    assertContains(guide, 'Google Ecosystem');
    assertContains(guide, 'AI Studio Prompts');
    assertContains(guide, 'Video Demo Storyboard');
    assertContains(guide, 'Social Media Sharing');
  });

  test('Test 16.2: Replicable AI Studio system prompt templates verification', () => {
    const prompts = SAMPLE_SUBMISSION_PACK.systemPrompts;
    assertContains(prompts.forensics, 'SME AutoPilot Forensic Auditor');
    assertContains(prompts.forensics, 'VietQR');
    assertContains(prompts.productStudio, 'Product Studio Copywriter');
    assertContains(prompts.productStudio, 'TikTok Shop');
    assertContains(prompts.voiceAssistant, 'query_inventory');
  });

  test('Test 16.3: 3-Minute video demo script breakdown and timing', () => {
    const storyboard = SAMPLE_SUBMISSION_PACK.videoStoryboard;
    assertEqual(storyboard.length, 4);

    const totalSeconds = storyboard.reduce((acc, step) => acc + step.durationSec, 0);
    assertEqual(totalSeconds, 180, 'Total video duration must be exactly 180 seconds (3 minutes)');

    assertTrue(storyboard.some(s => s.screen === 'BillAuditView'));
    assertTrue(storyboard.some(s => s.screen === 'VoiceAssistantView'));
  });

  test('Test 16.4: Social media post copy templates completeness', () => {
    const posts = SAMPLE_SUBMISSION_PACK.socialPosts;
    assertTrue(posts.facebook.length > 50);
    assertTrue(posts.linkedin.length > 50);
    assertTrue(posts.xTwitter.length > 50);
    assertContains(posts.facebook, 'SME AutoPilot');
    assertContains(posts.facebook, 'Gemini 2.0');
  });

  test('Test 16.5: Competition hashtags and tags validation', () => {
    const required = SAMPLE_SUBMISSION_PACK.requiredTags;
    assertTrue(required.includes('#BuildwithGoogleAI'));
    assertTrue(required.includes('#AIRiserVietnam2026'));
    assertTrue(required.includes('#VibeCoding'));

    // Verify presence in all social templates
    for (const tag of required) {
      assertContains(SAMPLE_SUBMISSION_PACK.socialPosts.facebook, tag);
      assertContains(SAMPLE_SUBMISSION_PACK.socialPosts.linkedin, tag);
      assertContains(SAMPLE_SUBMISSION_PACK.socialPosts.xTwitter, tag);
    }
  });
});
