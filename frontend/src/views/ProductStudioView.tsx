import React, { useState } from 'react';
import {
  Sparkles,
  Camera,
  Layers,
  Copy,
  Check,
  Share2,
  Tv,
  MessageSquare,
  ShoppingBag,
  Wand2,
  Image as ImageIcon,
  Palette,
  Ratio
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { aiApi } from '../api/aiApi';
import { Dropzone } from '../components/common/Dropzone';
import { ProductMarketingPack } from '@shared';
import { TonePreset } from '../utils/validators';

interface PresetProduct {
  id: string;
  name: string;
  category: string;
  industry: 'fashion' | 'fnb' | 'cosmetics';
  price: number;
  imageSrc: string;
  description: string;
}

const PRESET_PRODUCTS: PresetProduct[] = [
  {
    id: 'P-AODAI',
    name: 'Áo Dài Gấm Phượng Hoàng',
    category: 'Thời Trang Nữ',
    industry: 'fashion',
    price: 650000,
    imageSrc: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="%23991b1b"><rect width="400" height="400" rx="24" fill="%23991B1B"/><circle cx="200" cy="160" r="70" fill="%23FBBF24" opacity="0.2"/><path d="M200 100 Q240 180 230 320 L170 320 Q160 180 200 100 Z" fill="%23FEF08A"/><text x="200" y="360" fill="%23ffffff" font-size="16" font-weight="bold" text-anchor="middle">Áo Dài Gấm Phượng Hoàng</text></svg>',
    description: 'Chất liệu lụa tơ tằm dệt hoa văn gấm nổi, thêu phượng hoàng hoàng gia tôn vinh nét đẹp truyền thống Việt Nam.'
  },
  {
    id: 'P-TRASUA',
    name: 'Trà Sữa Trân Châu Hoàng Gia',
    category: 'F&B Trà Sữa',
    industry: 'fnb',
    price: 45000,
    imageSrc: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="%2378350f"><rect width="400" height="400" rx="24" fill="%2378350F"/><rect x="130" y="100" width="140" height="200" rx="20" fill="%23FEF3C7"/><circle cx="160" cy="270" r="12" fill="%231E293B"/><circle cx="200" cy="280" r="14" fill="%231E293B"/><circle cx="230" cy="265" r="12" fill="%231E293B"/><text x="200" y="360" fill="%23ffffff" font-size="16" font-weight="bold" text-anchor="middle">Trà Sữa Trân Châu Hoàng Gia</text></svg>',
    description: 'Trà đen Ceylon ủ lạnh đậm vị kết hợp trân châu hoàng kim dẻo quánh nấu mật ong hoa rừng.'
  },
  {
    id: 'P-SERUM',
    name: 'Serum Rau Má Diếp Cá Organic',
    category: 'Mỹ Phẩm Serum',
    industry: 'cosmetics',
    price: 320000,
    imageSrc: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="%23064e3b"><rect width="400" height="400" rx="24" fill="%23064E3B"/><rect x="150" y="120" width="100" height="180" rx="16" fill="%23D1FAE5"/><rect x="180" y="80" width="40" height="40" rx="6" fill="%2310B981"/><text x="200" y="360" fill="%23ffffff" font-size="16" font-weight="bold" text-anchor="middle">Serum Rau Má Diếp Cá</text></svg>',
    description: 'Chiết xuất 85% rau má tươi và diếp cá hữu cơ giúp làm dịu da mụn, mờ thâm và phục hồi hàng rào ẩm tự nhiên.'
  }
];

export const ProductStudioView: React.FC = () => {
  const { addToast } = useApp();
  const [selectedPreset, setSelectedPreset] = useState<PresetProduct>(PRESET_PRODUCTS[0]);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState<string>(PRESET_PRODUCTS[0].name);
  const [productDescription, setProductDescription] = useState<string>(PRESET_PRODUCTS[0].description);
  const [selectedTheme, setSelectedTheme] = useState<'LUXURY_MINIMALIST' | 'NEON_CYBERPUNK' | 'PASTEL_COZY' | 'TRADITIONAL_TET'>('TRADITIONAL_TET');
  const [selectedTone, setSelectedTone] = useState<TonePreset>('friendly');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [activeChannel, setActiveChannel] = useState<'facebook' | 'tiktokShop' | 'zalo' | 'shopee'>('facebook');
  const [generatedPack, setGeneratedPack] = useState<ProductMarketingPack | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeImage = customImage || selectedPreset.imageSrc;

  const handleSelectPreset = (p: PresetProduct) => {
    setSelectedPreset(p);
    setCustomImage(null);
    setProductTitle(p.name);
    setProductDescription(p.description);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await aiApi.generateMarketingCopy({
        productName: productTitle,
        rawDescription: productDescription,
        imageBase64: activeImage,
        tone: selectedTone,
        stagingTheme: selectedTheme
      });

      if (res.success && res.data) {
        setGeneratedPack(res.data);
        addToast({
          type: 'success',
          title: 'Tạo Nội Dung Thành Công',
          message: `Đã khởi tạo bộ bài đăng đa kênh (Facebook, TikTok Shop, Zalo, Shopee) chuẩn văn phong Việt.`
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Lỗi Tạo Nội Dung',
        message: err.message || 'Không thể tạo bài đăng'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    addToast({
      type: 'success',
      title: 'Đã Sao Chép!',
      message: 'Nội dung bài viết đã được lưu vào bộ nhớ tạm.'
    });
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const exportFormattedCopy = (channel: 'facebook' | 'tiktokShop' | 'zalo' | 'shopee'): string => {
    if (!generatedPack) return '';
    const copies = generatedPack.channelCopies;

    if (channel === 'facebook') {
      const fb = copies.facebook;
      return `${fb.headline}\n\n${fb.body}\n\n${fb.callToAction}\n\n${fb.hashtags.join(' ')}`;
    } else if (channel === 'tiktokShop') {
      const tt = copies.tiktokShop;
      return `[HOOK]: ${tt.videoHook}\n\n[SCRIPT]: ${tt.videoScript}\n\n[SOUND]: ${tt.soundRecommendation}\n\n${tt.hashtags.join(' ')}`;
    } else if (channel === 'zalo') {
      const zl = copies.zalo;
      return `${zl.greeting}\n\n${zl.promotionText}\n\nLink: ${zl.directOrderLink}`;
    } else {
      const sp = copies.shopee;
      return `${sp.seoTitle}\n\n${sp.bulletPoints.join('\n')}\n\nTags: ${sp.searchKeywords.join(', ')}`;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Imagen 3 Staging & Gemini 2.0 Copywriting</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Product Studio & Tạo Bài Đăng Bán Hàng Đa Kênh
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dựng bối cảnh chụp ảnh sản phẩm thông minh và tạo kịch bản video TikTok Shop, bài post Facebook, tin nhắn Zalo VIP, SEO Shopee.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-purple-600/30 transition disabled:opacity-50"
        >
          <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          <span>{isGenerating ? 'Đang Tạo Bằng AI...' : 'Tạo Nội Dung Bán Hàng'}</span>
        </button>
      </div>

      {/* Preset Products Selector */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Chọn Sản Phẩm Mẫu Hoặc Tải Ảnh Riêng
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESET_PRODUCTS.map((p) => {
            const isSelected = selectedPreset.id === p.id && !customImage;
            return (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500 ring-2 ring-purple-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-950 flex items-center justify-center border border-slate-800">
                  <img src={p.imageSrc} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-white truncate">{p.name}</h4>
                  <p className="text-[11px] text-purple-300 font-semibold">{p.category}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workbench Grid: Left Configuration & Studio / Right Multi-Channel Copy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Staging Workbench (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Visual Staging Preview */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-purple-400" />
              <span>Phòng Dựng Bối Cảnh Studio (Imagen 3)</span>
            </h3>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center p-2 min-h-[260px]">
              <img
                src={activeImage}
                alt="Product Preview"
                className={`max-h-64 object-contain rounded-xl shadow-2xl transition-all duration-300 ${
                  aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '16:9' ? 'aspect-[16/9]' : 'aspect-square'
                }`}
              />

              {/* Theme Badge Overlay */}
              <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-950/80 backdrop-blur-md text-purple-300 border border-purple-500/30">
                {selectedTheme === 'TRADITIONAL_TET' && '🧧 Bối cảnh Tết Cổ Truyền'}
                {selectedTheme === 'LUXURY_MINIMALIST' && '✨ Bối cảnh Sang Trọng'}
                {selectedTheme === 'NEON_CYBERPUNK' && '⚡ Bối cảnh Neon Hiện Đại'}
                {selectedTheme === 'PASTEL_COZY' && '🌿 Bối cảnh Phong Cách Sống'}
              </div>
            </div>

            {/* Staging Theme Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>Chủ Đề Dựng Bối Cảnh Studio</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'TRADITIONAL_TET', label: 'Tết Cổ Truyền', icon: '🧧' },
                  { id: 'LUXURY_MINIMALIST', label: 'Sang Trọng', icon: '✨' },
                  { id: 'PASTEL_COZY', label: 'Pastel Ấm Áp', icon: '🌿' },
                  { id: 'NEON_CYBERPUNK', label: 'Neon Cyberpunk', icon: '⚡' }
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setSelectedTheme(th.id as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition text-left flex items-center gap-2 ${
                      selectedTheme === th.id
                        ? 'bg-purple-600/20 text-purple-200 border-purple-500 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{th.icon}</span>
                    <span>{th.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Ratio className="w-3.5 h-3.5 text-purple-400" />
                <span>Tỷ Lệ Khung Hình Chụp</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '1:1', label: '1:1 Vuông (Shopee/IG)' },
                  { id: '9:16', label: '9:16 Dọc (TikTok/Story)' },
                  { id: '16:9', label: '16:9 Ngang (Banner/FB)' }
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setAspectRatio(r.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition text-center ${
                      aspectRatio === r.id
                        ? 'bg-purple-600/20 text-purple-200 border-purple-500 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Photo Upload */}
            <Dropzone
              onFileSelect={(file, base64) => setCustomImage(base64)}
              previewUrl={customImage}
              onClear={() => setCustomImage(null)}
              title="Tải ảnh sản phẩm gốc từ máy"
              subtitle="Hỗ trợ JPG, PNG, WEBP tối đa 25MB"
            />
          </div>
        </div>

        {/* Right Column: Copywriting Studio (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tone & Parameters Configuration */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-400" />
              <span>Cấu Hình Giọng Điệu & Nội Dung Sản Phẩm</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Tên Sản Phẩm:</label>
                <input
                  type="text"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Mô Tả Chi Tiết & Điểm Bán Hàng (USP):</label>
                <textarea
                  rows={2}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Tone Selector */}
              <div>
                <label className="text-slate-300 font-semibold mb-1.5 block">Văn Phong (Tone Preset):</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'friendly', label: '🌸 Thân thiện' },
                    { id: 'luxury', label: '✨ Sang trọng' },
                    { id: 'youthful', label: '⚡ Gen Z / Năng động' },
                    { id: 'urgent_sale', label: '🔥 Xả kho gấp' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTone(t.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition text-center ${
                        selectedTone === t.id
                          ? 'bg-purple-600/20 text-purple-200 border-purple-500 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Channel Copy Tabs & Output */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              {/* Channel Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto">
                {[
                  { id: 'facebook', label: 'Facebook Post', icon: Share2, color: 'text-blue-400' },
                  { id: 'tiktokShop', label: 'TikTok Video Script', icon: Tv, color: 'text-pink-400' },
                  { id: 'zalo', label: 'Zalo VIP OA', icon: MessageSquare, color: 'text-sky-400' },
                  { id: 'shopee', label: 'Shopee SEO', icon: ShoppingBag, color: 'text-orange-400' }
                ].map((ch) => {
                  const Icon = ch.icon;
                  const isActive = activeChannel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChannel(ch.id as any)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{ch.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 1-Click Copy Button */}
              {generatedPack && (
                <button
                  onClick={() => copyToClipboard(exportFormattedCopy(activeChannel), activeChannel)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
                >
                  {copiedKey === activeChannel ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Đã Chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao Chép</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Generated Content Body */}
            {!generatedPack ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Wand2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Sẵn Sàng Tạo Bài Đăng</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Nhấn "Tạo Nội Dung Bán Hàng" để Gemini 2.0 tự động sinh bài post, kịch bản 3s hook video TikTok và tiêu đề chuẩn SEO.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeChannel === 'facebook' && (
                  <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <h4 className="text-sm font-extrabold text-indigo-300">
                      {generatedPack.channelCopies.facebook.headline}
                    </h4>
                    <p className="text-slate-200 whitespace-pre-line leading-relaxed">
                      {generatedPack.channelCopies.facebook.body}
                    </p>
                    <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 font-semibold">
                      {generatedPack.channelCopies.facebook.callToAction}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {generatedPack.channelCopies.facebook.hashtags.map((h, i) => (
                        <span key={i} className="text-indigo-400 font-mono">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeChannel === 'tiktokShop' && (
                  <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <div className="p-3 rounded-xl bg-pink-950/40 border border-pink-500/40">
                      <span className="font-bold text-pink-400 uppercase tracking-wider text-[10px]">
                        🎬 3-Second Video Hook (Kéo Người Xem):
                      </span>
                      <p className="text-white font-bold text-xs mt-1">
                        "{generatedPack.channelCopies.tiktokShop.videoHook}"
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                        📝 Kịch Bản Video Ngắn (Shorts Script):
                      </span>
                      <p className="text-slate-200 mt-1 leading-relaxed whitespace-pre-line">
                        {generatedPack.channelCopies.tiktokShop.videoScript}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Âm thanh đề xuất: </span>
                      <strong className="text-pink-300">
                        {generatedPack.channelCopies.tiktokShop.soundRecommendation}
                      </strong>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {generatedPack.channelCopies.tiktokShop.hashtags.map((h, i) => (
                        <span key={i} className="text-pink-400 font-mono">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeChannel === 'zalo' && (
                  <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <p className="font-bold text-slate-200">{generatedPack.channelCopies.zalo.greeting}</p>
                    <p className="text-slate-300 leading-relaxed">{generatedPack.channelCopies.zalo.promotionText}</p>
                    <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-300 font-mono break-all">
                      {generatedPack.channelCopies.zalo.directOrderLink}
                    </div>
                  </div>
                )}

                {activeChannel === 'shopee' && (
                  <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Tiêu Đề Chuẩn SEO:</span>
                      <h5 className="text-xs font-bold text-orange-300 mt-0.5">
                        {generatedPack.channelCopies.shopee.seoTitle}
                      </h5>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Đặc Điểm Nổi Bật:</span>
                      <ul className="list-disc list-inside text-slate-200 space-y-1 mt-1">
                        {generatedPack.channelCopies.shopee.bulletPoints.map((bp, i) => (
                          <li key={i}>{bp}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {generatedPack.channelCopies.shopee.searchKeywords.map((k, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 text-[10px]">
                          #{k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
