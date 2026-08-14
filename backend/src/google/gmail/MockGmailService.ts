/**
 * SME AutoPilot — In-Memory Stateful Mock Gmail Engine
 * backend/src/google/gmail/MockGmailService.ts
 *
 * Implements:
 * - In-memory outbox queue with filtering and inspection
 * - Responsive Vietnamese HTML invoice template with embedded VietQR payment badge
 * - Order shipping notification with carrier tracking status stepper
 * - Low-stock replenishment alerts for warehouse operators
 */

import { SentEmailRecord, Order, TrackingInfo, InventoryItem, IGmailService } from '../../../../shared';

export class MockGmailService implements IGmailService {
  private outbox: SentEmailRecord[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.outbox = [];
  }

  public clearOutbox(): void {
    this.outbox = [];
  }

  public renderInvoiceHtml(order: Order, shopName: string = 'Thời Trang Mai Anh Boutique'): string {
    const formattedSubtotal = (order.itemsSubtotal || 0).toLocaleString('vi-VN') + ' ₫';
    const formattedShipping = (order.shippingFee || 0).toLocaleString('vi-VN') + ' ₫';
    const formattedDiscount = (order.discountAmount || 0).toLocaleString('vi-VN') + ' ₫';
    const formattedTotal = (order.totalAmount || 0).toLocaleString('vi-VN') + ' ₫';

    const itemRows = (order.items || [])
      .map(
        item => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 8px; font-size: 14px; color: #1f2937;">
            <strong>${item.name}</strong><br/>
            <span style="font-size: 12px; color: #6b7280;">SKU: ${item.sku}</span>
          </td>
          <td style="padding: 10px 8px; text-align: center; font-size: 14px; color: #1f2937;">${item.quantity}</td>
          <td style="padding: 10px 8px; text-align: right; font-size: 14px; color: #1f2937;">${item.unitPrice.toLocaleString('vi-VN')} ₫</td>
          <td style="padding: 10px 8px; text-align: right; font-size: 14px; font-weight: 600; color: #1f2937;">${item.subtotal.toLocaleString('vi-VN')} ₫</td>
        </tr>`
      )
      .join('');

    const qrUrl = `https://img.vietqr.io/image/970436-0011004567890-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(
      order.orderId
    )}&accountName=NGUYEN%20MAI%20ANH`;

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Hóa Đơn & Xác Nhận Đơn Hàng #${order.orderId}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #111827;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
    <tr>
      <td style="background-color: #1e3a8a; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">${shopName}</h1>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Xác Nhận Đơn Hàng & Hóa Đơn Điện Tử</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <p style="font-size: 16px; margin: 0 0 16px 0;">Xin chào <strong>${order.customerName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.5; color: #4b5563; margin: 0 0 20px 0;">
          Cảm ơn bạn đã đặt hàng tại <strong>${shopName}</strong>! Đơn hàng của bạn đã được ghi nhận vào hệ thống và đang được chuẩn bị.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
          <table width="100%">
            <tr>
              <td style="font-size: 13px; color: #64748b;">Mã đơn hàng:</td>
              <td style="font-size: 14px; font-weight: bold; text-align: right; color: #0f172a;">#${order.orderId}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #64748b;">Ngày tạo:</td>
              <td style="font-size: 13px; text-align: right; color: #0f172a;">${order.createdAt}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #64748b;">Phương thức thanh toán:</td>
              <td style="font-size: 13px; text-align: right; color: #0f172a; font-weight: 600;">${order.paymentMethod}</td>
            </tr>
          </table>
        </div>

        <h3 style="font-size: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin: 0 0 12px 0;">Chi Tiết Đơn Hàng</h3>
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f9fafb; font-size: 12px; color: #6b7280; text-transform: uppercase;">
              <th style="padding: 8px; text-align: left;">Sản phẩm</th>
              <th style="padding: 8px; text-align: center;">SL</th>
              <th style="padding: 8px; text-align: right;">Đơn giá</th>
              <th style="padding: 8px; text-align: right;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <table width="100%" style="margin-bottom: 24px;">
          <tr>
            <td style="font-size: 14px; color: #4b5563; padding: 4px 0;">Tiền hàng:</td>
            <td style="font-size: 14px; text-align: right; color: #111827;">${formattedSubtotal}</td>
          </tr>
          <tr>
            <td style="font-size: 14px; color: #4b5563; padding: 4px 0;">Phí vận chuyển:</td>
            <td style="font-size: 14px; text-align: right; color: #111827;">+${formattedShipping}</td>
          </tr>
          ${
            order.discountAmount > 0
              ? `<tr>
            <td style="font-size: 14px; color: #16a34a; padding: 4px 0;">Khuyến mãi / Giảm giá:</td>
            <td style="font-size: 14px; text-align: right; color: #16a34a; font-weight: 600;">-${formattedDiscount}</td>
          </tr>`
              : ''
          }
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="font-size: 16px; font-weight: bold; color: #111827; padding-top: 8px;">Tổng thanh toán:</td>
            <td style="font-size: 18px; font-weight: bold; color: #dc2626; text-align: right; padding-top: 8px;">${formattedTotal}</td>
          </tr>
        </table>

        <!-- VietQR Payment Embed -->
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
          <h4 style="margin: 0 0 8px 0; color: #1e40af; font-size: 15px;">Thanh Toán Nhanh Qua VietQR 24/7</h4>
          <p style="margin: 0 0 12px 0; font-size: 13px; color: #3b82f6;">Mở ứng dụng ngân hàng bất kỳ để quét mã QR thanh toán tức thì:</p>
          <img src="${qrUrl}" alt="VietQR Payment #${order.orderId}" style="max-width: 220px; height: auto; border: 1px solid #cbd5e1; border-radius: 6px;"/>
          <div style="margin-top: 10px; font-size: 12px; color: #475569; line-height: 1.6;">
            <strong>Ngân hàng:</strong> Vietcombank (970436)<br/>
            <strong>Số tài khoản:</strong> <code>0011004567890</code><br/>
            <strong>Chủ tài khoản:</strong> NGUYEN MAI ANH<br/>
            <strong>Nội dung CK:</strong> <code>${order.orderId}</code>
          </div>
        </div>

        <h3 style="font-size: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin: 0 0 12px 0;">Thông Tin Giao Hàng</h3>
        <p style="font-size: 13px; color: #4b5563; margin: 0 0 4px 0;"><strong>Người nhận:</strong> ${order.customerName} - ${order.customerPhone}</p>
        <p style="font-size: 13px; color: #4b5563; margin: 0 0 4px 0;"><strong>Địa chỉ:</strong> ${order.deliveryAddress}, ${order.city}</p>
        ${order.notes ? `<p style="font-size: 13px; color: #4b5563; margin: 0;"><strong>Ghi chú:</strong> ${order.notes}</p>` : ''}
      </td>
    </tr>
    <tr>
      <td style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
        Email được gửi tự động bởi <strong>SME AutoPilot</strong> (#BuildwithGoogleAI AI Riser Vietnam 2026).
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  public renderShippingNotificationHtml(trackingInfo: TrackingInfo): string {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Thông Báo Giao Hàng - Vận Đơn #${trackingInfo.trackingCode}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #111827;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
    <tr>
      <td style="background-color: #059669; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px;">Đơn Hàng Đang Được Vận Chuyển 🚚</h1>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Mã vận đơn: ${trackingInfo.trackingCode}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <p style="font-size: 15px; margin: 0 0 16px 0;">Xin chào <strong>${trackingInfo.recipientName}</strong>,</p>
        <p style="font-size: 14px; color: #4b5563; margin: 0 0 20px 0;">
          Đơn hàng <strong>#${trackingInfo.orderId}</strong> của bạn đã được bàn giao cho đơn vị vận chuyển <strong>${trackingInfo.shippingCarrier}</strong>.
        </p>

        <!-- Stepper UI -->
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table width="100%" style="text-align: center;">
            <tr>
              <td style="font-size: 24px;">📦</td>
              <td style="font-size: 18px; color: #059669;">➔</td>
              <td style="font-size: 24px;">🚚</td>
              <td style="font-size: 18px; color: #d1d5db;">➔</td>
              <td style="font-size: 24px;">🏠</td>
            </tr>
            <tr style="font-size: 12px; color: #374151; font-weight: 600;">
              <td>Đã lấy hàng</td>
              <td></td>
              <td style="color: #059669;">Đang giao hàng</td>
              <td></td>
              <td style="color: #9ca3af;">Đã giao hàng</td>
            </tr>
          </table>
        </div>

        <table width="100%" style="font-size: 14px; margin-bottom: 20px; line-height: 1.6;">
          <tr>
            <td style="color: #6b7280; width: 40%;">Đơn vị vận chuyển:</td>
            <td style="color: #111827; font-weight: bold;">${trackingInfo.shippingCarrier}</td>
          </tr>
          <tr>
            <td style="color: #6b7280;">Dự kiến giao:</td>
            <td style="color: #059669; font-weight: bold;">${trackingInfo.estimatedDeliveryTime}</td>
          </tr>
          <tr>
            <td style="color: #6b7280;">Địa chỉ nhận hàng:</td>
            <td style="color: #111827;">${trackingInfo.destinationAddress}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  public async sendInvoiceEmail(
    recipient: string,
    order: Order,
    invoiceHtml?: string,
    customSubject?: string
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_inv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const html = invoiceHtml || this.renderInvoiceHtml(order);
    const subject = customSubject || `[SME AutoPilot] Hóa Đơn & Xác Nhận Đơn Hàng #${order.orderId}`;

    const record: SentEmailRecord = {
      messageId,
      recipient,
      recipientName: order.customerName,
      subject,
      emailType: 'INVOICE',
      htmlBody: html,
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: order.orderId,
      vietqrPayload: order.vietqrPayload
    };

    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  public async sendShippingNotification(
    recipient: string,
    trackingInfo: TrackingInfo
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_ship_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const html = this.renderShippingNotificationHtml(trackingInfo);
    const subject = `[Giao Hàng] Đơn Hàng #${trackingInfo.orderId} đang được giao - Vận đơn: ${trackingInfo.trackingCode}`;

    const record: SentEmailRecord = {
      messageId,
      recipient,
      recipientName: trackingInfo.recipientName,
      subject,
      emailType: 'SHIPPING_NOTIFICATION',
      htmlBody: html,
      sentAt: new Date().toISOString(),
      status: 'SENT',
      orderId: trackingInfo.orderId
    };

    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  public async sendRestockAlert(
    recipient: string,
    lowStockItems: InventoryItem[]
  ): Promise<{ messageId: string; status: 'SENT' | 'QUEUED' }> {
    const messageId = `msg_restock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const subject = `[CẢNH BÁO KHO] ${lowStockItems.length} sản phẩm sắp hết hàng cần nhập bổ sung`;

    const record: SentEmailRecord = {
      messageId,
      recipient,
      subject,
      emailType: 'RESTOCK_ALERT',
      sentAt: new Date().toISOString(),
      status: 'SENT'
    };

    this.outbox.push(record);
    return { messageId, status: 'SENT' };
  }

  public async getOutbox(filter?: {
    recipient?: string;
    emailType?: string;
    orderId?: string;
  }): Promise<SentEmailRecord[]> {
    let result = [...this.outbox];
    if (filter?.recipient) {
      result = result.filter(r => r.recipient.toLowerCase() === filter.recipient!.toLowerCase());
    }
    if (filter?.emailType) {
      result = result.filter(r => r.emailType === filter.emailType);
    }
    if (filter?.orderId) {
      result = result.filter(r => r.orderId === filter.orderId);
    }
    return result;
  }

  public async getEmailById(messageId: string): Promise<SentEmailRecord | null> {
    const email = this.outbox.find(e => e.messageId === messageId);
    return email ? { ...email } : null;
  }
}
