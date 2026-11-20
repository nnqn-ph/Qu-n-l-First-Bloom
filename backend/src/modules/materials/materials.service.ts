import { prisma } from '../../config/prisma';
import { 
  CreateCategoryDto, 
  UpdateCategoryDto, 
  CreateMaterialDto, 
  UpdateMaterialDto, 
  CreateSupplierDto, 
  UpdateSupplierDto, 
  CreatePurchaseReceiptDto,
  AdjustMaterialStockDto
} from './materials.dto';
import { broadcastSyncEvent, WsEvent } from '../../websocket/socket.server';
import { StockDocumentType, StockReferenceType, WarehouseType, CashFlowType, PaymentMethod } from '@prisma/client';
import { generateSafeCode } from '../../common/code-generator';

export class MaterialsService {
  // ==========================================
  // 1. DANH MỤC NGUYÊN VẬT LIỆU
  // ==========================================

  async getCategories() {
    return prisma.materialCategory.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { materials: { where: { deletedAt: null } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    let code = dto.code?.trim();
    if (!code) {
      const now = new Date();
      const prefix = `CAT-NVL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      code = await generateSafeCode(prisma, 'materialCategory', prefix);
    } else {
      code = code.toUpperCase();
      const existing = await prisma.materialCategory.findUnique({
        where: { code },
      });
      if (existing) {
        throw new Error(`Mã danh mục '${code}' đã tồn tại`);
      }
    }

    return prisma.materialCategory.create({
      data: {
        code,
        name: dto.name.trim(),
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    return prisma.materialCategory.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  async deleteCategory(id: string) {
    const count = await prisma.material.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (count > 0) {
      throw new Error(`Không thể xóa danh mục đang chứa ${count} nguyên vật liệu`);
    }

    return prisma.materialCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================
  // 2. NGUYÊN VẬT LIỆU
  // ==========================================

  async getMaterials(options: { categoryId?: string; search?: string; lowStockOnly?: boolean }) {
    const where: any = { deletedAt: null };

    if (options.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options.search) {
      const term = options.search.trim();
      where.OR = [
        { sku: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
      ];
    }

    const materials = await prisma.material.findMany({
      where,
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
        inventory: true,
      },
      orderBy: { sku: 'asc' },
    });

    const mapped = materials.map((m) => {
      const qty = Number(m.inventory?.quantity || 0);
      const avgCost = Number(m.inventory?.avgCost || 0);
      const minAlert = Number(m.minStockAlert || 0);
      const isLowStock = qty <= minAlert;

      return {
        id: m.id,
        sku: m.sku,
        name: m.name,
        unit: m.unit,
        defaultPrice: Number(m.defaultPrice),
        minStockAlert: minAlert,
        isActive: m.isActive,
        notes: m.notes,
        createdAt: m.createdAt,
        category: m.category,
        inventory: {
          quantity: qty,
          avgCost: avgCost,
          totalInventoryValue: qty * avgCost,
          isLowStock,
        },
      };
    });

    if (options.lowStockOnly) {
      return mapped.filter((m) => m.inventory.isLowStock);
    }

    return mapped;
  }

  async getMaterialById(id: string) {
    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        category: true,
        inventory: true,
        purchaseReceiptItems: {
          take: 5,
          orderBy: { receipt: { receiptDate: 'desc' } },
          include: { receipt: { include: { supplier: true } } },
        },
      },
    });

    if (!material || material.deletedAt !== null) {
      throw new Error('Nguyên vật liệu không tồn tại');
    }

    return {
      ...material,
      defaultPrice: Number(material.defaultPrice),
      minStockAlert: Number(material.minStockAlert),
      inventory: material.inventory
        ? {
            quantity: Number(material.inventory.quantity),
            avgCost: Number(material.inventory.avgCost),
            totalValue: Number(material.inventory.quantity) * Number(material.inventory.avgCost),
          }
        : null,
      recentPurchases: material.purchaseReceiptItems.map((pi) => ({
        receiptCode: pi.receipt.code,
        receiptDate: pi.receipt.receiptDate,
        supplierName: pi.receipt.supplier.name,
        quantity: Number(pi.quantity),
        unitPrice: Number(pi.unitPrice),
        lineTotal: Number(pi.lineTotal),
      })),
    };
  }

  async createMaterial(dto: CreateMaterialDto, userId: string) {
    let sku = dto.sku?.trim();
    if (!sku) {
      const now = new Date();
      const prefix = `NVL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      sku = await generateSafeCode(prisma, 'material', prefix);
    } else {
      sku = sku.toUpperCase();
      const existing = await prisma.material.findUnique({
        where: { sku },
      });
      if (existing) {
        throw new Error(`Mã nguyên vật liệu SKU '${sku}' đã tồn tại`);
      }
    }

    let categoryId = dto.categoryId?.trim();
    if (!categoryId) {
      const firstCat = await prisma.materialCategory.findFirst({
        where: { deletedAt: null },
      });
      if (firstCat) {
        categoryId = firstCat.id;
      } else {
        const defaultCat = await prisma.materialCategory.create({
          data: {
            code: 'CAT-NVL-CHUNG',
            name: 'Nguyên vật liệu chung',
          },
        });
        categoryId = defaultCat.id;
      }
    } else {
      const category = await prisma.materialCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category || category.deletedAt !== null) {
        throw new Error('Danh mục nguyên vật liệu không tồn tại');
      }
    }

    return prisma.$transaction(async (tx) => {
      const material = await tx.material.create({
        data: {
          sku,
          name: dto.name.trim(),
          categoryId,
          unit: dto.unit.trim(),
          defaultPrice: dto.defaultPrice,
          minStockAlert: dto.minStockAlert,
          notes: dto.notes?.trim() || null,
        },
        include: { category: true },
      });

      // Khởi tạo bản ghi tồn kho ban đầu = 0
      const inventory = await tx.materialInventory.create({
        data: {
          materialId: material.id,
          quantity: 0,
          avgCost: 0,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_MATERIAL',
          entity: 'MATERIAL',
          entityId: material.id,
          newValues: { sku: material.sku, name: material.name },
        },
      });

      return {
        ...material,
        defaultPrice: Number(material.defaultPrice),
        minStockAlert: Number(material.minStockAlert),
        inventory: {
          quantity: Number(inventory.quantity),
          avgCost: Number(inventory.avgCost),
          isLowStock: true,
        },
      };
    });
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto, userId: string) {
    const material = await prisma.material.findUnique({ where: { id } });
    if (!material || material.deletedAt !== null) {
      throw new Error('Nguyên vật liệu không tồn tại');
    }

    const updated = await prisma.material.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.defaultPrice !== undefined && { defaultPrice: dto.defaultPrice }),
        ...(dto.minStockAlert !== undefined && { minStockAlert: dto.minStockAlert }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { category: true, inventory: true },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_MATERIAL',
        entity: 'MATERIAL',
        entityId: id,
        newValues: dto as any,
      },
    });

    return {
      ...updated,
      defaultPrice: Number(updated.defaultPrice),
      minStockAlert: Number(updated.minStockAlert),
      inventory: updated.inventory
        ? {
            quantity: Number(updated.inventory.quantity),
            avgCost: Number(updated.inventory.avgCost),
          }
        : null,
    };
  }

  async deleteMaterial(id: string, userId: string) {
    const inventory = await prisma.materialInventory.findUnique({
      where: { materialId: id },
    });

    if (inventory && Number(inventory.quantity) > 0) {
      throw new Error(`Không thể xóa nguyên vật liệu còn số lượng tồn kho (${inventory.quantity})`);
    }

    const updated = await prisma.material.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_MATERIAL',
        entity: 'MATERIAL',
        entityId: id,
      },
    });

    return updated;
  }

  // ==========================================
  // 3. NHÀ CUNG CẤP
  // ==========================================

  async getSuppliers() {
    const suppliers = await prisma.supplier.findMany({
      where: { deletedAt: null },
      include: {
        purchaseReceipts: {
          select: { totalAmount: true },
        },
        _count: {
          select: { purchaseReceipts: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return suppliers.map((s) => {
      const totalPurchased = s.purchaseReceipts.reduce((sum, r) => sum + Number(r.totalAmount), 0);
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        phone: s.phone,
        address: s.address,
        notes: s.notes,
        totalReceiptsCount: s._count.purchaseReceipts,
        totalPurchasedAmount: totalPurchased,
        createdAt: s.createdAt,
      };
    });
  }

  async createSupplier(dto: CreateSupplierDto) {
    let code = dto.code?.trim();
    if (!code) {
      const now = new Date();
      const prefix = `NCC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      code = await generateSafeCode(prisma, 'supplier', prefix);
    } else {
      code = code.toUpperCase();
      const existing = await prisma.supplier.findUnique({
        where: { code },
      });
      if (existing) {
        throw new Error(`Mã nhà cung cấp '${code}' đã tồn tại`);
      }
    }

    return prisma.supplier.create({
      data: {
        code,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    return prisma.supplier.update({
      where: { id },
      data: dto,
    });
  }

  async deleteSupplier(id: string) {
    const count = await prisma.purchaseReceipt.count({
      where: { supplierId: id },
    });
    if (count > 0) {
      throw new Error(`Không thể xóa nhà cung cấp đã có ${count} phiếu nhập kho trong hệ thống`);
    }

    return prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================
  // 4. PHIẾU NHẬP KHO & THUẬT TOÁN GIÁ VỐN MWAC
  // ==========================================

  async getPurchaseReceipts(filters?: { supplierId?: string; fromDate?: string; toDate?: string }) {
    const where: any = {};
    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }
    if (filters?.fromDate || filters?.toDate) {
      where.receiptDate = {};
      if (filters?.fromDate) where.receiptDate.gte = new Date(filters.fromDate);
      if (filters?.toDate) where.receiptDate.lte = new Date(filters.toDate);
    }

    const receipts = await prisma.purchaseReceipt.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true, phone: true } },
        createdBy: { select: { id: true, fullName: true, username: true } },
        _count: { select: { items: true } },
      },
      orderBy: { receiptDate: 'desc' },
    });

    return receipts.map((r) => ({
      id: r.id,
      code: r.code,
      receiptDate: r.receiptDate,
      totalAmount: Number(r.totalAmount),
      status: r.status,
      notes: r.notes,
      createdAt: r.createdAt,
      supplier: r.supplier,
      createdBy: r.createdBy,
      itemsCount: r._count.items,
    }));
  }

  async getPurchaseReceiptById(id: string) {
    const receipt = await prisma.purchaseReceipt.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
        items: {
          include: {
            material: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
        financialTransactions: true,
      },
    });

    if (!receipt) {
      throw new Error('Phiếu nhập kho không tồn tại');
    }

    return {
      ...receipt,
      totalAmount: Number(receipt.totalAmount),
      items: receipt.items.map((it) => ({
        id: it.id,
        materialId: it.materialId,
        material: it.material,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
      })),
      financialTransactions: receipt.financialTransactions.map((ft) => ({
        id: ft.id,
        code: ft.code,
        amount: Number(ft.amount),
        paymentMethod: ft.paymentMethod,
        transactionDate: ft.transactionDate,
      })),
    };
  }

  /**
   * Tạo phiếu nhập kho và tính toán giá vốn bình quân gia quyền di động (MWAC)
   * trong Database Transaction có Row Locking chống xung đột đồng thời.
   */
  async createPurchaseReceipt(dto: CreatePurchaseReceiptDto, userId: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || supplier.deletedAt !== null) {
      throw new Error('Nhà cung cấp không tồn tại');
    }

    // Tính tổng tiền toàn phiếu nhập
    const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const now = new Date();
    const datePrefix = `PNK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const docPrefix = `CTK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const txPrefix = `PC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Lấy hoặc tạo danh mục chi mua NVL
    let expCategory = await prisma.expenseCategory.findUnique({ where: { code: 'EXP-MAT' } });
    if (!expCategory) {
      expCategory = await prisma.expenseCategory.create({
        data: {
          code: 'EXP-MAT',
          name: 'Tiền mua nguyên vật liệu',
          type: 'MATERIAL_PURCHASE',
        },
      });
    }

    // THỰC THI TRANSACTION NGHIỆP VỤ BẮT BUỘC
    const createdReceipt = await prisma.$transaction(async (tx) => {
      const receiptCode = await generateSafeCode(tx, 'purchaseReceipt', datePrefix);
      const stockDocCode = await generateSafeCode(tx, 'stockDocument', docPrefix);
      const financeCode = await generateSafeCode(tx, 'financialTransaction', txPrefix);

      // 1. Tạo phiếu nhập kho chính
      const receipt = await tx.purchaseReceipt.create({
        data: {
          code: receiptCode,
          supplierId: dto.supplierId,
          createdById: userId,
          receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : now,
          totalAmount,
          status: 'CONFIRMED',
          notes: dto.notes,
          items: {
            create: dto.items.map((it) => ({
              materialId: it.materialId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              lineTotal: it.quantity * it.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      // 2. Tạo chứng từ sổ kho
      const stockDoc = await tx.stockDocument.create({
        data: {
          code: stockDocCode,
          type: StockDocumentType.PURCHASE_IMPORT,
          referenceType: StockReferenceType.PURCHASE_RECEIPT,
          referenceId: receipt.id,
          warehouseType: WarehouseType.MATERIAL,
          issuedById: userId,
          notes: `Nhập kho từ phiếu nhập ${receipt.code} (NCC: ${supplier.name})`,
        },
      });

      // 3. Khóa và tính lại giá vốn bình quân di động (MWAC) cho từng nguyên vật liệu
      for (const item of dto.items) {
        // Áp dụng Row-Level Locking (Pessimistic Locking) trong PostgreSQL
        const currentInvRows = await tx.$queryRaw<Array<{ id: string; quantity: any; avg_cost: any; version: number }>>`
          SELECT id, quantity, avg_cost, version
          FROM material_inventory
          WHERE material_id = ${item.materialId}
          FOR UPDATE
        `;

        let oldQty = 0;
        let oldAvgCost = 0;
        let currentVersion = 1;

        if (currentInvRows.length > 0) {
          oldQty = Number(currentInvRows[0].quantity);
          oldAvgCost = Number(currentInvRows[0].avg_cost);
          currentVersion = currentInvRows[0].version;
        }

        const inboundQty = item.quantity;
        const inboundPrice = item.unitPrice;
        const newQty = oldQty + inboundQty;

        // Công thức Giá vốn bình quân gia quyền di động (MWAC)
        let newAvgCost = 0;
        if (newQty > 0) {
          if (oldQty <= 0) {
            newAvgCost = inboundPrice;
          } else {
            newAvgCost = (oldQty * oldAvgCost + inboundQty * inboundPrice) / newQty;
          }
        }

        // Làm tròn 2 chữ số thập phân cho đơn giá vốn kế toán
        newAvgCost = Math.round(newAvgCost * 100) / 100;

        // Cập nhật tồn kho và giá vốn mới
        await tx.materialInventory.upsert({
          where: { materialId: item.materialId },
          update: {
            quantity: newQty,
            avgCost: newAvgCost,
            version: currentVersion + 1,
          },
          create: {
            materialId: item.materialId,
            quantity: newQty,
            avgCost: newAvgCost,
            version: 1,
          },
        });

        // Ghi chi tiết chứng từ sổ kho
        await tx.stockDocumentItem.create({
          data: {
            documentId: stockDoc.id,
            materialId: item.materialId,
            qtyBefore: oldQty,
            qtyChange: inboundQty,
            qtyAfter: newQty,
            unitCost: inboundPrice,
            totalCost: inboundQty * inboundPrice,
          },
        });
      }

      // 4. Ghi nhận bút toán chi tiền trong Sổ Quỹ (Financial Transaction)
      await tx.financialTransaction.create({
        data: {
          code: financeCode,
          flowType: CashFlowType.OUTFLOW,
          categoryId: expCategory.id,
          paymentMethod: dto.paymentMethod as PaymentMethod,
          amount: totalAmount,
          sourcePurchaseId: receipt.id,
          performedById: userId,
          description: `Chi tiền mua NVL phiếu ${receipt.code} từ ${supplier.name}`,
        },
      });

      // 5. Ghi nhật ký kiểm toán (Audit Log)
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_PURCHASE_RECEIPT',
          entity: 'PURCHASE_RECEIPT',
          entityId: receipt.id,
          newValues: {
            code: receipt.code,
            supplier: supplier.name,
            totalAmount,
            itemsCount: dto.items.length,
          },
        },
      });

      return receipt;
    });

    // Sau khi transaction thành công, phát sự kiện realtime đa thiết bị
    broadcastSyncEvent(WsEvent.MATERIAL_UPDATED, {
      entity: 'MATERIAL',
      action: 'PURCHASE_RECEIPT_CONFIRMED',
      timestamp: new Date().toISOString(),
      data: { receiptCode: createdReceipt.code },
    });

    broadcastSyncEvent(WsEvent.FINANCE_UPDATED, {
      entity: 'FINANCE',
      action: 'EXPENSE_RECORDED',
      timestamp: new Date().toISOString(),
      data: { amount: totalAmount },
    });

    return createdReceipt;
  }

  // ==========================================
  // 5. KIỂM KÊ & SỔ CÁI KHO NGUYÊN VẬT LIỆU
  // ==========================================

  async adjustMaterialStock(dto: AdjustMaterialStockDto, userId: string) {
    const material = await prisma.material.findUnique({ where: { id: dto.materialId } });
    if (!material || material.deletedAt !== null) {
      throw new Error('Nguyên vật liệu không tồn tại');
    }

    const now = new Date();
    const docPrefix = `CTK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    return prisma.$transaction(async (tx) => {
      const docCode = await generateSafeCode(tx, 'stockDocument', docPrefix);
      // Row lock
      const currentRows = await tx.$queryRaw<Array<{ quantity: any; avg_cost: any; version: number }>>`
        SELECT quantity, avg_cost, version
        FROM material_inventory
        WHERE material_id = ${dto.materialId}
        FOR UPDATE
      `;

      const oldQty = currentRows.length > 0 ? Number(currentRows[0].quantity) : 0;
      const currentAvgCost = currentRows.length > 0 ? Number(currentRows[0].avg_cost) : 0;
      const currentVersion = currentRows.length > 0 ? currentRows[0].version : 1;

      const diff = dto.actualQuantity - oldQty;
      if (diff === 0) {
        throw new Error('Số lượng kiểm kê bằng với số lượng tồn kho hiện tại, không cần điều chỉnh');
      }

      const docType = diff > 0 ? StockDocumentType.ADJUSTMENT_IN : StockDocumentType.ADJUSTMENT_OUT;

      const doc = await tx.stockDocument.create({
        data: {
          code: docCode,
          type: docType,
          referenceType: StockReferenceType.MANUAL,
          warehouseType: WarehouseType.MATERIAL,
          issuedById: userId,
          notes: `Kiểm kê kho NVL [${material.sku} - ${material.name}]: ${dto.reason}`,
        },
      });

      await tx.materialInventory.upsert({
        where: { materialId: dto.materialId },
        update: {
          quantity: dto.actualQuantity,
          version: currentVersion + 1,
        },
        create: {
          materialId: dto.materialId,
          quantity: dto.actualQuantity,
          avgCost: currentAvgCost,
          version: 1,
        },
      });

      await tx.stockDocumentItem.create({
        data: {
          documentId: doc.id,
          materialId: dto.materialId,
          qtyBefore: oldQty,
          qtyChange: Math.abs(diff),
          qtyAfter: dto.actualQuantity,
          unitCost: currentAvgCost,
          totalCost: Math.abs(diff) * currentAvgCost,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'ADJUST_MATERIAL_STOCK',
          entity: 'MATERIAL_INVENTORY',
          entityId: dto.materialId,
          oldValues: { quantity: oldQty },
          newValues: { quantity: dto.actualQuantity, diff, reason: dto.reason },
        },
      });

      // Phát sự kiện realtime
      broadcastSyncEvent(WsEvent.MATERIAL_UPDATED, {
        entity: 'MATERIAL',
        action: 'STOCK_ADJUSTED',
        timestamp: new Date().toISOString(),
        data: { materialId: dto.materialId, newQuantity: dto.actualQuantity },
      });

      return {
        materialId: dto.materialId,
        oldQuantity: oldQty,
        newQuantity: dto.actualQuantity,
        diff,
        documentCode: doc.code,
      };
    });
  }

  async getMaterialStockLedger(filters?: { materialId?: string; fromDate?: string; toDate?: string }) {
    const where: any = {
      warehouseType: WarehouseType.MATERIAL,
    };

    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters?.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters?.toDate) where.createdAt.lte = new Date(filters.toDate);
    }

    const itemsWhere: any = {};
    if (filters?.materialId) {
      itemsWhere.materialId = filters.materialId;
    }

    const docs = await prisma.stockDocument.findMany({
      where,
      include: {
        issuedBy: { select: { id: true, fullName: true, username: true } },
        items: {
          where: itemsWhere,
          include: {
            material: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return docs.flatMap((doc) =>
      doc.items.map((it) => ({
        id: it.id,
        documentCode: doc.code,
        documentType: doc.type,
        referenceType: doc.referenceType,
        createdAt: doc.createdAt,
        issuedBy: doc.issuedBy,
        material: it.material,
        qtyBefore: Number(it.qtyBefore),
        qtyChange: Number(it.qtyChange),
        qtyAfter: Number(it.qtyAfter),
        unitCost: Number(it.unitCost),
        totalCost: Number(it.totalCost),
        notes: doc.notes,
      }))
    );
  }
}

export const materialsService = new MaterialsService();
