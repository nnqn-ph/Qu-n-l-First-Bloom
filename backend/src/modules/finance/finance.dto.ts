import { z } from 'zod';
import { CashFlowType, PaymentMethod, ExpenseType } from '@prisma/client';

// ==========================================
// 1. DTO CHO DANH MỤC THU / CHI
// ==========================================

export const createExpenseCategorySchema = z.object({
  code: z
    .string()
    .min(2, 'Mã danh mục tối thiểu 2 ký tự')
    .max(20, 'Mã danh mục tối đa 20 ký tự')
    .transform((val) => val.trim().toUpperCase()),
  name: z.string().min(2, 'Tên danh mục tối thiểu 2 ký tự').max(100),
  type: z.nativeEnum(ExpenseType).default(ExpenseType.OPERATING),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

// ==========================================
// 2. DTO CHO GIAO DỊCH SỔ QUỸ (FINANCIAL TRANSACTIONS)
// ==========================================

export const createFinancialTransactionSchema = z.object({
  flowType: z.nativeEnum(CashFlowType, {
    errorMap: () => ({ message: 'Loại dòng tiền phải là INFLOW (Thu) hoặc OUTFLOW (Chi)' }),
  }),
  categoryId: z.string().uuid('ID danh mục chi phí không hợp lệ').optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Phương thức thanh toán phải là CASH hoặc BANK_TRANSFER' }),
  }),
  amount: z.number().positive('Số tiền phải lớn hơn 0'),
  transactionDate: z.string().optional(),
  description: z.string().min(2, 'Diễn giải tối thiểu 2 ký tự').max(500),
});

export const transactionFilterSchema = z.object({
  flowType: z.nativeEnum(CashFlowType).optional(),
  categoryId: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(50),
});

// ==========================================
// 3. DTO CHO BÁO CÁO KINH DOANH (P&L REPORT)
// ==========================================

export const reportFilterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
});

export type CreateExpenseCategoryDto = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryDto = z.infer<typeof updateExpenseCategorySchema>;
export type CreateFinancialTransactionDto = z.infer<typeof createFinancialTransactionSchema>;
export type TransactionFilterDto = z.infer<typeof transactionFilterSchema>;
export type ReportFilterDto = z.infer<typeof reportFilterSchema>;
