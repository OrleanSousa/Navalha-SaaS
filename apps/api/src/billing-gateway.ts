import { BillingGatewayProvider, InvoiceStatus } from '@prisma/client';

export type GatewayChargeInput = {
  invoiceId: string;
  amount: number;
  dueDate: Date;
  customer: { name: string; email?: string; document?: string };
};

export type GatewayChargeResult = {
  externalId: string;
  status: InvoiceStatus;
  checkoutUrl?: string;
};

export type GatewayRefundResult = {
  externalId: string;
  refundedAt: Date;
};

export interface BillingGatewayAdapter {
  readonly provider: BillingGatewayProvider;
  createCharge(input: GatewayChargeInput): Promise<GatewayChargeResult>;
  refund(externalId: string): Promise<GatewayRefundResult>;
  getCharge(externalId: string): Promise<GatewayChargeResult>;
}
