import { CashFlowType, PaymentMethod } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
  CreateFinancialTransactionDto,
  TransactionFilterDto,
  ReportFilterDto,
} from './finance.dto';
import { broadcastSyncEvent, WsEvent } from '../../websocket/socket.server';
import * as XLSX from 'xlsx';

export class FinanceService {
  // ==========================================
  // 1. QUẢN LÝ DANH MỤC CHI PHÍ (EXPENSE CATEGORIES)
  // ==========================================

  async getCategories() {
    return await prisma.expenseCategory.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { financialTransactions: true },
        },
      },
    });
  }

  async createCategory(dto: CreateExpenseCategoryDto, userId: string) {
    const existing = await prisma.expenseCategory.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      if (existing.deletedAt) {
        return await prisma.expenseCategory.update({
          where: { id: existing.id },
          data: {
            name: dto.name,
            type: dto.type,
            deletedAt: null,
          },
        });
      }
      throw new Error(`Mã danh mục '${dto.code}' đã tồn tại trên hệ thống`);
    }

    const category = await prisma.expenseCategory.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_EXPENSE_CATEGORY',
        entity: 'ExpenseCategory',
        entityId: category.id,
        newValues: category as any,
      },
    });

    return category;
  }

  async updateCategory(id: string, dto: UpdateExpenseCategoryDto, userId: string) {
    const category = await prisma.expenseCategory.findUnique({
      where: { id },
    });
    if (!category || category.deletedAt) {
      throw new Error('Danh mục chi phí không tồn tại');
    }

    if (dto.code && dto.code !== category.code) {
      const existing = await prisma.expenseCategory.findUnique({
        where: { code: dto.code },
      });
      if (existing && existing.id !== id) {
        throw new Error(`Mã danh mục '${dto.code}' đã được sử dụng`);
      }
    }

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_EXPENSE_CATEGORY',
        entity: 'ExpenseCategory',
        entityId: id,
        oldValues: category as any,
        newValues: updated as any,
      },
    });

    return updated;
  }

  async deleteCategory(id: string, userId: string) {
    const category = await prisma.expenseCategory.findUnique({
      where: { id },
      include: { _count: { select: { financialTransactions: true } } },
    });
    if (!category || category.deletedAt) {
      throw new Error('Danh mục chi phí không tồn tại');
    }

    const deleted = await prisma.expenseCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_EXPENSE_CATEGORY',
        entity: 'ExpenseCategory',
        entityId: id,
        oldValues: category as any,
      },
    });

    return deleted;
  }

  // ==========================================
  // 2. SỔ QUỸ THU CHI (FINANCIAL TRANSACTIONS)
  // ==========================================

  private async generateTransactionCode(tx: any, date: Date = new Date()): Promise<string> {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `SQ-${year}${month}`;

    const count = await tx.financialTransaction.count({
      where: {
        code: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async createManualTransaction(dto: CreateFinancialTransactionDto, userId: string) {
    const txDate = dto.transactionDate ? new Date(dto.transactionDate) : new Date();

    if (dto.categoryId) {
      const cat = await prisma.expenseCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat || cat.deletedAt) {
        throw new Error('Danh mục chi phí không hợp lệ hoặc đã bị xóa');
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const code = await this.generateTransactionCode(tx, txDate);

      const created = await tx.financialTransaction.create({
        data: {
          code,
          flowType: dto.flowType,
          categoryId: dto.categoryId || null,
          paymentMethod: dto.paymentMethod,
          amount: dto.amount,
          performedById: userId,
          transactionDate: txDate,
          description: dto.description.trim(),
        },
        include: {
          category: true,
          performedBy: {
            select: { id: true, fullName: true, username: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_FINANCIAL_TRANSACTION',
          entity: 'FinancialTransaction',
          entityId: created.id,
          newValues: created as any,
        },
      });

      return created;
    });

    // Phát sự kiện đồng bộ đa thiết bị
    broadcastSyncEvent(WsEvent.FINANCE_UPDATED, {
      entity: 'FINANCIAL_TRANSACTION',
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      data: transaction,
    });

    return transaction;
  }

  async getTransactions(filters: TransactionFilterDto) {
    const where: any = {};

    if (filters.flowType) {
      where.flowType = filters.flowType;
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    const dateFilter: any = {};
    if (filters.fromDate) {
      dateFilter.gte = new Date(filters.fromDate);
    }
    if (filters.toDate) {
      const end = new Date(filters.toDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    if (filters.fromDate || filters.toDate) {
      where.transactionDate = dateFilter;
    }

    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { category: { name: { contains: s, mode: 'insensitive' } } },
      ];
    }

    // 1. Tính toán số dư đầu kỳ (Opening Balance trước fromDate)
    let openingBalance = 0;
    if (filters.fromDate) {
      const priorWhere = {
        transactionDate: { lt: new Date(filters.fromDate) },
      };
      const priorInflows = await prisma.financialTransaction.aggregate({
        where: { ...priorWhere, flowType: CashFlowType.INFLOW },
        _sum: { amount: true },
      });
      const priorOutflows = await prisma.financialTransaction.aggregate({
        where: { ...priorWhere, flowType: CashFlowType.OUTFLOW },
        _sum: { amount: true },
      });
      const inVal = Number(priorInflows._sum.amount || 0);
      const outVal = Number(priorOutflows._sum.amount || 0);
      openingBalance = inVal - outVal;
    }

    // 2. Tính tổng Thu, Chi và Số dư theo từng phương thức trong kỳ
    const inPeriodWhere = { ...where };

    const totalInflowAgg = await prisma.financialTransaction.aggregate({
      where: { ...inPeriodWhere, flowType: CashFlowType.INFLOW },
      _sum: { amount: true },
    });
    const totalOutflowAgg = await prisma.financialTransaction.aggregate({
      where: { ...inPeriodWhere, flowType: CashFlowType.OUTFLOW },
      _sum: { amount: true },
    });

    const totalInflow = Number(totalInflowAgg._sum.amount || 0);
    const totalOutflow = Number(totalOutflowAgg._sum.amount || 0);
    const netCashFlow = totalInflow - totalOutflow;
    const closingBalance = openingBalance + netCashFlow;

    // Phân bổ Quỹ Tiền mặt vs Quỹ Ngân hàng
    const cashInflowAgg = await prisma.financialTransaction.aggregate({
      where: { ...inPeriodWhere, flowType: CashFlowType.INFLOW, paymentMethod: PaymentMethod.CASH },
      _sum: { amount: true },
    });
    const cashOutflowAgg = await prisma.financialTransaction.aggregate({
      where: { ...inPeriodWhere, flowType: CashFlowType.OUTFLOW, paymentMethod: PaymentMethod.CASH },
      _sum: { amount: true },
    });
    const bankInflowAgg = await prisma.financialTransaction.aggregate({
      where: { ...inPeriodWhere, flowType: CashFlowType.INFLOW, paymentMethod: PaymentMethod.BANK_TRANSFER },
      _sum: { amount: true },
    });
    const bankOutflowAgg = await prisma.financialTransaction.aggregate({
      where: { ...inPeriodWhere, flowType: CashFlowType.OUTFLOW, paymentMethod: PaymentMethod.BANK_TRANSFER },
      _sum: { amount: true },
    });

    const cashInflow = Number(cashInflowAgg._sum.amount || 0);
    const cashOutflow = Number(cashOutflowAgg._sum.amount || 0);
    const bankInflow = Number(bankInflowAgg._sum.amount || 0);
    const bankOutflow = Number(bankOutflowAgg._sum.amount || 0);

    // 3. Phân trang và danh sách giao dịch
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.financialTransaction.count({ where }),
      prisma.financialTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          category: true,
          performedBy: {
            select: { id: true, fullName: true, username: true },
          },
          sourceOrder: {
            select: { id: true, code: true, totalAmount: true },
          },
          sourcePurchase: {
            select: { id: true, code: true, totalAmount: true },
          },
          payment: {
            select: { id: true, code: true, paymentType: true },
          },
        },
      }),
    ]);

    return {
      summary: {
        openingBalance,
        totalInflow,
        totalOutflow,
        netCashFlow,
        closingBalance,
        cashFund: {
          inflow: cashInflow,
          outflow: cashOutflow,
          net: cashInflow - cashOutflow,
        },
        bankFund: {
          inflow: bankInflow,
          outflow: bankOutflow,
          net: bankInflow - bankOutflow,
        },
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      items,
    };
  }

  async getTransactionById(id: string) {
    const item = await prisma.financialTransaction.findUnique({
      where: { id },
      include: {
        category: true,
        performedBy: {
          select: { id: true, fullName: true, username: true, phone: true },
        },
        sourceOrder: {
          include: { customer: true },
        },
        sourcePurchase: {
          include: { supplier: true },
        },
        payment: true,
      },
    });

    if (!item) {
      throw new Error('Phiếu thu/chi không tồn tại');
    }
    return item;
  }

  // ==========================================
  // 3. BÁO CÁO KINH DOANH & LỢI NHUẬN (P&L ANALYTICS)
  // ==========================================

  async getProfitAndLoss(filters: ReportFilterDto) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();

    if (filters.fromDate && filters.toDate) {
      startDate = new Date(filters.fromDate);
      endDate = new Date(filters.toDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Mặc định tháng hiện tại
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // A. DOANH THU & GIÁ VỐN TỪ CÁC ĐƠN HÀNG HOÀN THÀNH (COMPLETED)
    const completedOrders = await prisma.order.findMany({
      where: {
        status: 'COMPLETED',
        orderDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
      },
    });

    let grossRevenue = 0;
    let totalDiscount = 0;
    let netRevenue = 0;
    let shippingCollected = 0;
    let shippingCostPaid = 0;
    let totalCogs = 0;

    for (const ord of completedOrders) {
      const subtotal = Number(ord.subtotal);
      const discount = Number(ord.discountAmount);
      const shipColl = Number(ord.shippingFeeCollected);
      const shipPaid = Number(ord.shippingCostPaid);
      const cogs = Number(ord.totalCogs);

      grossRevenue += subtotal + shipColl;
      totalDiscount += discount;
      netRevenue += subtotal - discount;
      shippingCollected += shipColl;
      shippingCostPaid += shipPaid;
      totalCogs += cogs;
    }

    const grossProfit = netRevenue - totalCogs;
    const grossProfitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // B. CHI PHÍ HOẠT ĐỘNG (OPEX)
    // Lấy các khoản chi phát sinh trong kỳ mà KHÔNG PHẢI nhập nguyên vật liệu
    // (Vì nguyên vật liệu đã tính vào Giá Vốn COGS khi hoàn thành bó hoa, tránh tính trùng 2 lần)
    const opexTransactions = await prisma.financialTransaction.findMany({
      where: {
        flowType: CashFlowType.OUTFLOW,
        sourcePurchaseId: null, // Không tính tiền nhập kho nguyên vật liệu
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { category: true },
    });

    const opexByCategoryMap: Record<string, { categoryId: string; categoryName: string; amount: number }> = {};
    let totalOpex = 0;

    for (const tx of opexTransactions) {
      const amt = Number(tx.amount);
      const catId = tx.categoryId || 'UNCATEGORIZED';
      const catName = tx.category?.name || 'Chi phí khác / Chưa phân loại';

      if (!opexByCategoryMap[catId]) {
        opexByCategoryMap[catId] = {
          categoryId: catId,
          categoryName: catName,
          amount: 0,
        };
      }
      opexByCategoryMap[catId].amount += amt;
      totalOpex += amt;
    }

    // Nếu tiệm có trả phí ship cho shipper ngoài, cộng vào chi phí vận chuyển nếu chưa ghi sổ quỹ
    if (shippingCostPaid > 0) {
      totalOpex += shippingCostPaid;
      if (!opexByCategoryMap['SHIPPING']) {
        opexByCategoryMap['SHIPPING'] = {
          categoryId: 'SHIPPING',
          categoryName: 'Cước vận chuyển / Giao hàng (Shipper)',
          amount: 0,
        };
      }
      opexByCategoryMap['SHIPPING'].amount += shippingCostPaid;
    }

    const opexBreakdown = Object.values(opexByCategoryMap).map((it) => ({
      ...it,
      percentage: totalOpex > 0 ? (it.amount / totalOpex) * 100 : 0,
    }));

    // C. THU NHẬP KHÁC (Thu không phải từ đơn hàng bán hoa, ví dụ: thanh lý, tài trợ...)
    const otherInflows = await prisma.financialTransaction.findMany({
      where: {
        flowType: CashFlowType.INFLOW,
        sourceOrderId: null,
        paymentId: null,
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalOtherIncome = otherInflows.reduce((sum: number, it: any) => sum + Number(it.amount), 0);

    // D. LỢI NHUẬN RÒNG (NET PROFIT)
    const netProfit = grossProfit - totalOpex + totalOtherIncome;
    const netProfitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    // E. DỮ LIỆU BIỂU ĐỒ THEO CHU KỲ (TIMESERIES CHART DATA)
    const timeseriesData = this.generateTimeseriesData(
      startDate,
      endDate,
      completedOrders,
      opexTransactions
    );

    // F. TOP SẢN PHẨM BÁN CHẠY NHẤT VÀ TỶ SUẤT LỢI NHUẬN
    const productStatsMap: Record<
      string,
      {
        id: string;
        sku: string;
        name: string;
        categoryName: string;
        quantitySold: number;
        revenue: number;
        cogs: number;
        profit: number;
      }
    > = {};

    for (const ord of completedOrders) {
      for (const it of ord.items) {
        const prod = it.product;
        const qty = Number(it.quantity);
        const rev = Number(it.lineTotal);
        const cogs = Number(it.unitCogsSnapshot) * qty;

        if (!productStatsMap[prod.id]) {
          productStatsMap[prod.id] = {
            id: prod.id,
            sku: prod.sku,
            name: prod.name,
            categoryName: prod.category?.name || 'Khác',
            quantitySold: 0,
            revenue: 0,
            cogs: 0,
            profit: 0,
          };
        }
        productStatsMap[prod.id].quantitySold += qty;
        productStatsMap[prod.id].revenue += rev;
        productStatsMap[prod.id].cogs += cogs;
        productStatsMap[prod.id].profit += rev - cogs;
      }
    }

    const topProducts = Object.values(productStatsMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      kpis: {
        completedOrdersCount: completedOrders.length,
        grossRevenue,
        totalDiscount,
        netRevenue,
        shippingCollected,
        shippingCostPaid,
        totalCogs,
        grossProfit,
        grossProfitMargin: Number(grossProfitMargin.toFixed(2)),
        totalOpex,
        totalOtherIncome,
        netProfit,
        netProfitMargin: Number(netProfitMargin.toFixed(2)),
      },
      opexBreakdown,
      topProducts,
      timeseries: timeseriesData,
    };
  }

  private generateTimeseriesData(
    startDate: Date,
    endDate: Date,
    orders: any[],
    opexTxs: any[]
  ) {
    const diffDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Nếu thời gian <= 31 ngày -> Gom nhóm theo ngày (YYYY-MM-DD)
    // Nếu thời gian > 31 ngày -> Gom nhóm theo tháng (YYYY-MM)
    const isDaily = diffDays <= 31;
    const buckets: Record<
      string,
      {
        label: string;
        date: string;
        revenue: number;
        cogs: number;
        grossProfit: number;
        opex: number;
        netProfit: number;
      }
    > = {};

    const curr = new Date(startDate);
    while (curr <= endDate) {
      const key = isDaily
        ? curr.toISOString().split('T')[0]
        : `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;

      if (!buckets[key]) {
        const label = isDaily
          ? `${curr.getDate()}/${curr.getMonth() + 1}`
          : `Th${curr.getMonth() + 1}/${curr.getFullYear()}`;

        buckets[key] = {
          label,
          date: key,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          opex: 0,
          netProfit: 0,
        };
      }

      if (isDaily) {
        curr.setDate(curr.getDate() + 1);
      } else {
        curr.setMonth(curr.getMonth() + 1);
      }
    }

    // Đổ dữ liệu đơn hàng vào bucket
    for (const ord of orders) {
      const d = new Date(ord.orderDate);
      const key = isDaily
        ? d.toISOString().split('T')[0]
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (buckets[key]) {
        const netRev = Number(ord.subtotal) - Number(ord.discountAmount);
        const cogs = Number(ord.totalCogs);
        buckets[key].revenue += netRev;
        buckets[key].cogs += cogs;
        buckets[key].grossProfit += netRev - cogs;
        buckets[key].netProfit += netRev - cogs;
      }
    }

    // Đổ chi phí hoạt động vào bucket
    for (const tx of opexTxs) {
      const d = new Date(tx.transactionDate);
      const key = isDaily
        ? d.toISOString().split('T')[0]
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (buckets[key]) {
        const amt = Number(tx.amount);
        buckets[key].opex += amt;
        buckets[key].netProfit -= amt;
      }
    }

    return Object.values(buckets);
  }

  // ==========================================
  // 4. XUẤT EXCEL / FILE BÁO CÁO (XLSX EXPORT)
  // ==========================================

  async exportTransactionsExcel(filters: TransactionFilterDto): Promise<Buffer> {
    const { items } = await this.getTransactions({ ...filters, limit: 10000 });

    const rows = items.map((it: any, idx: number) => ({
      STT: idx + 1,
      'Mã phiếu': it.code,
      'Thời gian': new Date(it.transactionDate).toLocaleString('vi-VN'),
      'Loại giao dịch': it.flowType === 'INFLOW' ? 'Thu' : 'Chi',
      'Danh mục': it.category?.name || 'Khác',
      'Phương thức': it.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản',
      'Số tiền (VND)': Number(it.amount),
      'Người thực hiện': it.performedBy?.fullName || it.performedBy?.username || '',
      'Diễn giải': it.description,
      'Tham chiếu': it.sourceOrder?.code || it.sourcePurchase?.code || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sổ Quỹ Thu Chi');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async exportProfitAndLossExcel(filters: ReportFilterDto): Promise<Buffer> {
    const data = await this.getProfitAndLoss(filters);

    // Sheet 1: Báo cáo Kết quả Kinh doanh P&L
    const plRows = [
      { 'Chỉ tiêu tài chính': 'I. Doanh thu bán hàng gộp', 'Giá trị (VND)': data.kpis.grossRevenue },
      { 'Chỉ tiêu tài chính': '  - Chiết khấu giảm giá', 'Giá trị (VND)': -data.kpis.totalDiscount },
      { 'Chỉ tiêu tài chính': 'II. Doanh thu thuần', 'Giá trị (VND)': data.kpis.netRevenue },
      { 'Chỉ tiêu tài chính': 'III. Giá vốn hàng bán (COGS)', 'Giá trị (VND)': -data.kpis.totalCogs },
      { 'Chỉ tiêu tài chính': 'IV. Lợi nhuận gộp (Gross Profit)', 'Giá trị (VND)': data.kpis.grossProfit },
      { 'Chỉ tiêu tài chính': '  - Tỷ suất biên gộp (%)', 'Giá trị (VND)': `${data.kpis.grossProfitMargin}%` },
      { 'Chỉ tiêu tài chính': 'V. Chi phí vận hành kinh doanh (OPEX)', 'Giá trị (VND)': -data.kpis.totalOpex },
      ...data.opexBreakdown.map((op) => ({
        'Chỉ tiêu tài chính': `  + ${op.categoryName}`,
        'Giá trị (VND)': -op.amount,
      })),
      { 'Chỉ tiêu tài chính': 'VI. Thu nhập tài chính / Khác', 'Giá trị (VND)': data.kpis.totalOtherIncome },
      { 'Chỉ tiêu tài chính': 'VII. LỢI NHUẬN RÒNG (NET PROFIT)', 'Giá trị (VND)': data.kpis.netProfit },
      { 'Chỉ tiêu tài chính': '  - Tỷ suất biên ròng (%)', 'Giá trị (VND)': `${data.kpis.netProfitMargin}%` },
    ];

    // Sheet 2: Top Sản phẩm bán chạy
    const topProdRows = data.topProducts.map((p, idx) => ({
      Hạng: idx + 1,
      'Mã SP': p.sku,
      'Tên sản phẩm': p.name,
      'Danh mục': p.categoryName,
      'Số lượng bán': p.quantitySold,
      'Doanh thu (VND)': p.revenue,
      'Giá vốn (VND)': p.cogs,
      'Lợi nhuận gộp (VND)': p.profit,
    }));

    const workbook = XLSX.utils.book_new();
    const wsPL = XLSX.utils.json_to_sheet(plRows);
    const wsTop = XLSX.utils.json_to_sheet(topProdRows);

    XLSX.utils.book_append_sheet(workbook, wsPL, 'Báo Cáo P&L');
    XLSX.utils.book_append_sheet(workbook, wsTop, 'Top Sản Phẩm');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}

export const financeService = new FinanceService();
