import { Prisma } from '@prisma/client';

/**
 * Hàm sinh mã chứng từ / định danh an toàn, chống trùng lặp khi có nhiều request đồng thời
 * @param tx Prisma Transaction client
 * @param tableName Tên bảng trong Prisma
 * @param prefix Tiền tố mã (VD: DH-202611, TT-202611, KH-202611)
 * @param padLength Số chữ số thứ tự (mặc định 4 chữ số: 0001, 0002...)
 */
export async function generateSafeCode(
  tx: any,
  modelName:
    | 'order'
    | 'customer'
    | 'payment'
    | 'financialTransaction'
    | 'productionOrder'
    | 'stockDocument'
    | 'purchaseReceipt'
    | 'product'
    | 'material'
    | 'productCategory'
    | 'materialCategory'
    | 'supplier',
  prefix: string,
  padLength: number = 4
): Promise<string> {
  const codeField = modelName === 'product' || modelName === 'material' ? 'sku' : 'code';

  // Tìm bản ghi có mã/SKU lớn nhất bắt đầu bằng prefix
  const lastRecord = await tx[modelName].findFirst({
    where: {
      [codeField]: { startsWith: prefix },
    },
    orderBy: {
      [codeField]: 'desc',
    },
    select: {
      [codeField]: true,
    },
  });

  let nextSeq = 1;
  const currentCode = lastRecord ? (lastRecord as any)[codeField] : null;
  if (currentCode) {
    const parts = currentCode.split('-');
    const lastNumStr = parts[parts.length - 1];
    const parsed = parseInt(lastNumStr, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      nextSeq = parsed + 1;
    }
  }

  // Vòng lặp kiểm tra tránh trùng tuyệt đối (nếu đã có mã này thì tự tăng)
  let candidate = `${prefix}-${String(nextSeq).padStart(padLength, '0')}`;
  let exists = await tx[modelName].findUnique({
    where: { [codeField]: candidate },
    select: { id: true },
  });

  let loopLimit = 100;
  while (exists && loopLimit > 0) {
    nextSeq++;
    candidate = `${prefix}-${String(nextSeq).padStart(padLength, '0')}`;
    exists = await tx[modelName].findUnique({
      where: { [codeField]: candidate },
      select: { id: true },
    });
    loopLimit--;
  }

  return candidate;
}
