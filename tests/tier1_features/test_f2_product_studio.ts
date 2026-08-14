import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertContains,
  assertRange,
  createMockProductMarketingPack
} from '../harness';
import { ProductMarketingPack } from '../../shared';

export type TonePreset = 'friendly' | 'luxury' | 'youthful' | 'urgent_sale';

export function buildImagen3Prompt(
  productTitle: string,
  category: string,
  theme: string,
  aspectRatio: '1:1' | '9:16' | '16:9' = '1:1'
): { prompt: string; negativePrompt: string; aspectRatio: string } {
  const prompt = `Professional commercial studio photography of ${productTitle}, category ${category}. Staged in a high-end ${theme} setting, clean studio softbox lighting, 8k resolution, authentic Vietnamese aesthetic, sharp focus, hyperrealistic.`;
  const negativePrompt = 'distorted, blurry, low resolution, noisy, plastic artifacts, duplicate, watermarks, text overlay.';
  return { prompt, negativePrompt, aspectRatio };
}

export function generateVietnameseCopy(
  product: { title: string; category: string; price: number; highlights: string[] },
  tone: TonePreset
): ProductMarketingPack['channelCopies'] {
  const formattedPrice = product.price.toLocaleString('vi-VN') + 'đ';

  if (tone === 'luxury') {
    return {
      facebook: {
        headline: `👑 ĐẲNG CẤP VÀ TINH HOA: ${product.title.toUpperCase()}`,
        body: `Tuyệt tác ${product.category} tôn vinh vẻ đẹp quý phái. Từng chi tiết được hoàn thiện tỉ mỉ. Sở hữu ngay với giá đặc quyền ${formattedPrice}.`,
        callToAction: '👉 Liên hệ quản gia riêng để đặt lịch tư vấn và trải nghiệm VIP.',
        hashtags: ['#HangHieu', '#DangCap', '#LuxuryVN', '#SMEAutoPilot']
      },
      tiktokShop: {
        videoHook: 'Đây là lý do giới thượng lưu luôn chọn BST này! ✨',
        videoScript: `Cận cảnh độ hoàn thiện không tì vết của ${product.title}. Chất liệu độc quyền, chạm nhẹ là cảm nhận sự khác biệt.`,
        soundRecommendation: 'Classical Piano & Symphony Ambient',
        hashtags: ['#LuxuryLifestyle', '#TikTokShopLuxury', '#SangTrong']
      },
      zalo: {
        greeting: 'Kính chào Quý khách VIP! 💎',
        promotionText: `Chúng tôi trân trọng giới thiệu siêu phẩm ${product.title} số lượng giới hạn dành riêng cho danh sách ưu tiên.`,
        directOrderLink: `https://smeautopilot.vn/vip/${encodeURIComponent(product.title)}`
      },
      shopee: {
        seoTitle: `[Cao Cấp] ${product.title} - Chất Liệu Thượng Hạng Sang Trọng`,
        bulletPoints: product.highlights.map(h => `• ${h}`),
        searchKeywords: [product.title.toLowerCase(), 'cao cấp', 'chính hãng', 'sang trọng']
      }
    };
  } else if (tone === 'youthful') {
    return {
      facebook: {
        headline: `🔥 GEN Z CHECK! Rinh ngay ${product.title} cực cháy! 🔥`,
        body: `Item quốc dân cho hội mê style đỉnh chóp! Giá học sinh sinh viên chỉ ${formattedPrice}. Nhanh tay kẻo hết size nha mấy bồ!`,
        callToAction: '👉 Thả tim và cmt "CHỐT" để nhận mã freeship liền tay!',
        hashtags: ['#GenZ', '#OOTD', '#TrendingVN', '#DealHot']
      },
      tiktokShop: {
        videoHook: 'U là trời, tìm được em này đúng là chân ái luôn á mọi người ơi! 😱',
        videoScript: `Outfit hôm nay cùng ${product.title}. Mix match kiểu gì cũng xinh xỉu. Bấm ngay giỏ hàng bên dưới để săn mã giảm 50k nha!`,
        soundRecommendation: 'Top Trending V-Pop Remix TikTok 2026',
        hashtags: ['#TikTokShopStyle', '#ReviewDoXinh', '#GenZTrend']
      },
      zalo: {
        greeting: 'Hế lô bạn iu ơi! ✌️',
        promotionText: `Mẫu ${product.title} vừa cập bến là shop nhắn bạn đầu tiên nè. Check liền nha!`,
        directOrderLink: `https://smeautopilot.vn/genz/${encodeURIComponent(product.title)}`
      },
      shopee: {
        seoTitle: `[Hot Trend GenZ] ${product.title} Siêu Xinh Phong Cách Mới Nhất`,
        bulletPoints: product.highlights.map(h => `✨ ${h}`),
        searchKeywords: [product.title.toLowerCase(), 'hot trend', 'gen z', 'giá rẻ']
      }
    };
  } else if (tone === 'urgent_sale') {
    return {
      facebook: {
        headline: `⚡ XẢ KHO DUY NHẤT HÔM NAY: ${product.title.toUpperCase()} ⚡`,
        body: `Cơ hội cuối cùng! Giảm sập sàn chỉ còn ${formattedPrice}. Chỉ còn 15 suất duy nhất trước khi đóng cổng khuyến mãi!`,
        callToAction: '💥 BẤM MUA NGAY ĐỂ GIỮ SUẤT GIẢM GIÁ!',
        hashtags: ['#XaKho', '#SaleSoc', '#GiaHoi', '#DealChopNhoang']
      },
      tiktokShop: {
        videoHook: 'DỪNG LẠI 3 GIÂY! Kho đang xả lỗ mẫu này chỉ hôm nay! 🚨',
        videoScript: `Chỉ 50 đơn đầu tiên có giá ${formattedPrice}! Nhanh tay nhấn vào giỏ hàng trước khi hết voucher!`,
        soundRecommendation: 'High Energy Countdown Drumbeat',
        hashtags: ['#FlashSale', '#GiaReVoDich', '#TikTokShopSale']
      },
      zalo: {
        greeting: 'Thông báo khẩn cấp từ Shop! ⏰',
        promotionText: `Flash Sale 2 giờ cho ${product.title}. Giá giảm sâu chỉ ${formattedPrice}.`,
        directOrderLink: `https://smeautopilot.vn/flash-sale/${encodeURIComponent(product.title)}`
      },
      shopee: {
        seoTitle: `[Flash Sale Chỉ Hôm Nay] ${product.title} - Giảm Cực Sốc`,
        bulletPoints: product.highlights.map(h => `🔥 ${h}`),
        searchKeywords: [product.title.toLowerCase(), 'flash sale', 'xả kho', 'giảm giá']
      }
    };
  } else {
    // Friendly
    return {
      facebook: {
        headline: `🌸 Gửi nàng chút dịu dàng cùng ${product.title} 🌸`,
        body: `Chào ngày mới với thiết kế tươi tắn từ ${product.category}. Giá thân thương chỉ ${formattedPrice}. Phù hợp mặc đi làm, đi chơi hay cà phê cuối tuần.`,
        callToAction: '👉 Nhắn tin cho shop để chọn size vừa vặn nhất nhé!',
        hashtags: ['#ThoiTrangNu', '#DiChoiXinh', '#ShopThanThien']
      },
      tiktokShop: {
        videoHook: 'Có ai đang tìm một em vừa xinh vừa thoải mái thế này không? 🥰',
        videoScript: `Cùng mình trải nghiệm ${product.title} nha. Mặc lên nhẹ tênh mà tôn dáng cực kỳ. Shop có đủ size từ S đến XL nhé!`,
        soundRecommendation: 'Acoustic Guitar Gentle Melody',
        hashtags: ['#GocLamDep', '#ThoiTrangHangNgay', '#ShopYeuThich']
      },
      zalo: {
        greeting: 'Dạ Shop em chào Chị ạ! 🌷',
        promotionText: `Shop vừa về mẫu ${product.title} siêu ưng ý. Em gửi hình thật và thông số cho Chị tham khảo nha!`,
        directOrderLink: `https://smeautopilot.vn/friendly/${encodeURIComponent(product.title)}`
      },
      shopee: {
        seoTitle: `[Chính Hãng] ${product.title} Dáng Chuẩn Vải Mát Thoải Mái`,
        bulletPoints: product.highlights.map(h => `🌿 ${h}`),
        searchKeywords: [product.title.toLowerCase(), 'thời trang', 'đẹp', 'chính hãng']
      }
    };
  }
}

export function generateHashtags(category: string, platform: 'facebook' | 'tiktok' | 'shopee'): string[] {
  const baseTags = ['#SMEAutoPilot', '#BuildwithGoogleAI', '#AIRiserVietnam2026'];
  const categoryTag = '#' + category.replace(/\s+/g, '');

  if (platform === 'tiktok') {
    return [...baseTags, categoryTag, '#TikTokShopVN', '#XuHuong', '#ReviewHangTot'];
  } else if (platform === 'facebook') {
    return [...baseTags, categoryTag, '#MuaSamOnline', '#HangChinhHang', '#Freeship'];
  } else {
    return [...baseTags, categoryTag, '#ShopeeCheck', '#ShopeeLiveVN', '#DealHotShopee'];
  }
}

describe('F2: Product Studio & Multi-Channel Copy Generator', () => {
  test('Test 2.1: Automated visual attribute and selling point extraction', () => {
    const pack = createMockProductMarketingPack();
    assertEqual(pack.extractedAttributes.category, 'Thời Trang Nữ Truyền Thống');
    assertEqual(pack.extractedAttributes.material, '100% Lụa Tơ Tằm Hà Đông tự nhiên');
    assertTrue(pack.extractedAttributes.keySellingPoints.length >= 3);
    assertContains(pack.extractedAttributes.keySellingPoints[0], 'Vạn Phúc');
  });

  test('Test 2.2: Imagen 3 studio staging prompt generation and aspect ratio handling', () => {
    const prompt1 = buildImagen3Prompt('Váy Hoa Nhí Vintage', 'Thời Trang Nữ', 'Modern Minimalist Studio', '1:1');
    assertContains(prompt1.prompt, 'Váy Hoa Nhí Vintage');
    assertContains(prompt1.prompt, 'Modern Minimalist Studio');
    assertEqual(prompt1.aspectRatio, '1:1');
    assertContains(prompt1.negativePrompt, 'blurry');

    const promptTikTok = buildImagen3Prompt('Son Môi Gấc Hữu Cơ', 'Mỹ Phẩm', 'Luxury Marble Table', '9:16');
    assertEqual(promptTikTok.aspectRatio, '9:16');
  });

  test('Test 2.3: Multi-channel localized copywriting for FB, TikTok Shop, Zalo, Shopee', () => {
    const product = {
      title: 'Cà Phê Muối Huế Đóng Chai',
      category: 'Đồ Uống & F&B',
      price: 35000,
      highlights: ['Cà phê Robusta Đắk Lắk nguyên chất', 'Lớp kem béo ngậy mằn mặn', 'Bảo quản ngăn mát 7 ngày']
    };

    const copies = generateVietnameseCopy(product, 'friendly');
    // Facebook verification
    assertTrue(copies.facebook.headline.length > 10);
    assertContains(copies.facebook.callToAction, 'Nhắn tin cho shop');

    // TikTok Shop verification
    assertTrue(copies.tiktokShop.videoHook.length > 15);
    assertTrue(copies.tiktokShop.videoScript.length > 20);
    assertContains(copies.tiktokShop.soundRecommendation, 'Acoustic');

    // Zalo verification
    assertContains(copies.zalo.greeting, 'Shop em chào');
    assertContains(copies.zalo.directOrderLink, 'smeautopilot.vn');

    // Shopee SEO verification
    assertContains(copies.shopee.seoTitle, 'Cà Phê Muối');
    assertEqual(copies.shopee.bulletPoints.length, 3);
  });

  test('Test 2.4: Vietnamese tone preset switcher (friendly, luxury, youthful, urgent_sale)', () => {
    const product = {
      title: 'Túi Xách Da Thủ Công',
      category: 'Phụ Kiện Da',
      price: 1800000,
      highlights: ['Da bò thật 100%', 'Khâu tay thủ công từng đường kim']
    };

    const luxury = generateVietnameseCopy(product, 'luxury');
    assertContains(luxury.facebook.headline, 'ĐẲNG CẤP');
    assertContains(luxury.zalo.greeting, 'Quý khách VIP');

    const youthful = generateVietnameseCopy(product, 'youthful');
    assertContains(youthful.facebook.headline, 'GEN Z');
    assertContains(youthful.tiktokShop.videoHook, 'chân ái');

    const urgent = generateVietnameseCopy(product, 'urgent_sale');
    assertContains(urgent.facebook.headline, 'XẢ KHO DUY NHẤT');
    assertContains(urgent.facebook.callToAction, 'BẤM MUA NGAY');
  });

  test('Test 2.5: Automated hashtag generator for Vietnamese social platforms', () => {
    const ttTags = generateHashtags('ThoiTrangNu', 'tiktok');
    assertContains(ttTags, '#BuildwithGoogleAI');
    assertContains(ttTags, '#TikTokShopVN');
    assertContains(ttTags, '#ThoiTrangNu');

    const fbTags = generateHashtags('DoGiaDung', 'facebook');
    assertContains(fbTags, '#MuaSamOnline');
    assertContains(fbTags, '#DoGiaDung');
  });
});
