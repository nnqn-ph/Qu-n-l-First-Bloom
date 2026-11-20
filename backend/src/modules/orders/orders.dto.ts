import { z } from 'zod';
import { OrderStatus, PaymentType, PaymentMethod } from '@prisma/client';

// ==========================================
// 1. DTO CHO KHÁCH HÀNG (CUSTOMERS)
// ==========================================

export const createCustomerSchema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập tên khách hàng').max(100),
  phone: z
    .string()
    .min(8, 'Số điện thoại tối thiểu 8 số')
    .max(20, 'Số điện thoại tối đa 20 số')
    .regex(/^[0-9+() .\-]+$/, 'Số điện thoại không hợp lệ (chỉ chứa số, dấu +, -, khoảng cách, dấu chấm)'),
  address: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerFilterSchema = z.object({
  search: z.string().optional(),
});

// ==========================================
// 2. DTO CHO DÒNG ĐƠN HÀNG (ORDER ITEMS)
// ==========================================

export const orderItemSchema = z.object({
  productId: z.string().uuid('ID sản phẩm không hợp lệ'),
  quantity: z.coerce.number().positive('Số lượng sản phẩm phải lớn hơn 0'),
  unitPrice: z.coerce.number().min(0, 'Đơn giá không được âm'),
  discount: z.coerce.number().min(0, 'Giảm giá dòng không được âm').default(0),
});

// ==========================================
// 3. DTO CHO ĐƠN HÀNG (ORDERS)
// ==========================================

export const createOrderSchema = z
  .object({
    customerId: z
      .string()
      .uuid('ID khách hàng không hợp lệ')
      .optional()
      .or(z.literal(''))
      .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
    customer: createCustomerSchema.optional(),
    expectedDeliveryDate: z
      .string()
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
    deliveryAddress: z
      .string()
      .max(255)
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
    items: z.array(orderItemSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
    discountAmount: z.coerce.number().min(0, 'Giảm giá đơn hàng không được âm').default(0),
    shippingFeeCollected: z.coerce.number().min(0, 'Phí ship thu khách không được âm').default(0),
    shippingCostPaid: z.coerce.number().min(0, 'Tiền ship tiệm trả không được âm').default(0),
    depositAmount: z.coerce.number().min(0, 'Tiền đặt cọc không được âm').default(0),
    depositPaymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
    notes: z
      .string()
      .max(500)
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
    createMtoProduction: z.boolean().default(false),
  })
  .refine(
    (data) =>
      !!data.customerId || (!!data.customer && !!data.customer.fullName && !!data.customer.phone),
    {
      message: 'Vui lòng chọn khách hàng trong danh sách hoặc nhập họ tên và số điện thoại khách hàng mới',
      path: ['customerId'],
    }
  );

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, {
    errorMap: () => ({ message: 'Trạng thái đơn hàng không hợp lệ' }),
  }),
  notes: z.string().max(500).optional(),
  cancellationReason: z.string().max(300).optional(),
});

export const addPaymentSchema = z.object({
  paymentType: z.nativeEnum(PaymentType).default(PaymentType.FINAL_PAYMENT),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  amount: z.number().positive('Số tiền thanh toán phải lớn hơn 0'),
  transactionReference: z.string().max(100).optional(),
  notes: z.string().max(300).optional(),
});

export const orderFilterSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  customerId: z.string().uuid().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
export type CustomerFilterDto = z.infer<typeof customerFilterSchema>;
export type OrderItemDto = z.infer<typeof orderItemSchema>;
export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;
export type AddPaymentDto = z.infer<typeof addPaymentSchema>;
export type OrderFilterDto = z.infer<typeof orderFilterSchema>;
