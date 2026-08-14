import React from 'react';
import { Cpu, CheckCircle2, Clock, XCircle, Wrench } from 'lucide-react';
import { VoiceToolCall, VoiceToolResult } from '@shared';

interface ToolCallBadgeProps {
  toolCall: VoiceToolCall;
  toolResult?: VoiceToolResult;
  status?: 'PENDING' | 'EXECUTED' | 'FAILED';
  className?: string;
}

export const ToolCallBadge: React.FC<ToolCallBadgeProps> = ({
  toolCall,
  toolResult,
  status: explicitStatus,
  className = ''
}) => {
  const status =
    explicitStatus ||
    (toolResult ? (toolResult.error ? 'FAILED' : 'EXECUTED') : 'PENDING');

  const getToolSummary = (name: string, args: any) => {
    switch (name) {
      case 'query_inventory':
        return `Kiểm tra tồn kho: ${args?.skuOrName || 'sản phẩm'}`;
      case 'calculate_shipping_fee':
        return `Tính phí ship: ${args?.district ? `${args.district}, ` : ''}${args?.city || 'toàn quốc'}`;
      case 'create_draft_order':
        return `Tạo đơn hàng nháp: ${args?.customerName || 'khách hàng'}`;
      case 'apply_discount_voucher':
        return `Áp dụng voucher: ${args?.voucherCode || 'TET2026'}`;
      case 'track_order_status':
        return `Tra cứu đơn hàng: ${args?.orderId || 'ORD'}`;
      default:
        return `Gọi công cụ: ${name}`;
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border transition-all ${
        status === 'EXECUTED'
          ? 'bg-indigo-950/50 border-indigo-500/40 text-indigo-200'
          : status === 'PENDING'
          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
          : 'bg-red-950/40 border-red-500/40 text-red-200'
      } ${className}`}
    >
      <div className="flex items-center gap-1.5 font-bold">
        <Wrench className="w-3.5 h-3.5 text-indigo-400" />
        <span className="font-mono text-[11px] text-indigo-300">[{toolCall.name}]</span>
      </div>

      <span className="text-slate-300 font-medium text-[11px]">
        {getToolSummary(toolCall.name, toolCall.args)}
      </span>

      <div className="flex items-center gap-1 ml-auto">
        {status === 'EXECUTED' && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Xong</span>
          </span>
        )}
        {status === 'PENDING' && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
            <Clock className="w-3 h-3 animate-spin" />
            <span>Đang xử lý</span>
          </span>
        )}
        {status === 'FAILED' && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20">
            <XCircle className="w-3 h-3" />
            <span>Lỗi</span>
          </span>
        )}
      </div>
    </div>
  );
};
