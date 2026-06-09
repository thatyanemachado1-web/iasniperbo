export type CrmDealStage =
  | "novo"
  | "contato"
  | "negociacao"
  | "ganho"
  | "perdido";

export type CrmInvoiceStatus = "aberta" | "paga" | "vencida" | "cancelada";

export interface CrmClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDeal {
  id: string;
  clientId: string;
  title: string;
  value: number;
  stage: CrmDealStage;
  notes: string;
  expectedCloseDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmInvoice {
  id: string;
  clientId: string;
  dealId: string;
  amount: number;
  status: CrmInvoiceStatus;
  dueDate: string;
  paidAt: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmSummary {
  clients: number;
  openDeals: number;
  openDealValue: number;
  openInvoices: number;
  overdueInvoices: number;
  paidInvoiceValue: number;
  openInvoiceValue: number;
}

export interface CrmResponse {
  clients: CrmClient[];
  deals: CrmDeal[];
  invoices: CrmInvoice[];
  summary: CrmSummary;
  storageConfigured: boolean;
}
