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
  modelName: 'order' | 'customer' | 'payment' | 'financialTransaction' | 'productionOrder' | 'stockDocument' | 'purchaseReceipt',
  prefix: string,
  padLength: number = 4
): Promise<string> {
  // Tìm bản ghi có mã lớn nhất trong tháng bắt đầu bằng prefix
  const lastRecord = await tx[modelName].findFirst({
    where: {
      code: { startsWith: prefix },
    },
    orderBy: {
      code: 'desc',
    },
    select: {
      code: true,
    },
  });

  let nextSeq = 1;
  if (lastRecord?.code) {
    const parts = lastRecord.code.split('-');
    const lastNumStr = parts[parts.length - 1];
    const parsed = parseInt(lastNumStr, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      nextSeq = parsed + 1;
    }
  }

  // Vòng lặp kiểm tra tránh trùng tuyệt đối (nếu đã có mã này thì tự tăng)
  let candidate = `${prefix}-${String(nextSeq).padStart(padLength, '0')}`;
  let exists = await tx[modelName].findUnique({
    where: { code: candidate },
    select: { id: true },
  });

  let loopLimit = 100;
  while (exists && loopLimit > 0) {
    nextSeq++;
    candidate = `${prefix}-${String(nextSeq).padStart(padLength, '0')}`;
    exists = await tx[modelName].findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    loopLimit--;
  }

  return candidate;
}
