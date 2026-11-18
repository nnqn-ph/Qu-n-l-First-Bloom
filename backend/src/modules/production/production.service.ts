import { prisma } from '../../config/prisma';
import {
  CreateProductionOrderDto,
  CheckMaterialAvailabilityDto,
  CompleteProductionDto,
  AdjustProductStockDto,
  ProductionOrderFilterDto,
  ProductStockLedgerFilterDto,
} from './production.dto';
import {
  ProductionStatus,
  ProductionType,
  RecipeItemType,
  StockDocumentType,
  StockReferenceType,
  WarehouseType,
} from '@prisma/client';
import { broadcastSyncEvent, WsEvent } from '../../websocket/socket.server';
import { generateSafeCode } from '../../common/code-generator';

export class ProductionService {
  // ==========================================
  // 1. KIỂM TRA KHẢ DỤNG NGUYÊN VẬT LIỆU (AVAILABILITY CHECK)
  // ==========================================

  async checkMaterialAvailability(dto: CheckMaterialAvailabilityDto) {
    const product = await prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        recipes: {
          where: dto.recipeId ? { id: dto.recipeId } : { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            items: {
              include: {
                material: { include: { inventory: true } },
                subProduct: { include: { inventory: true } },
              },
            },
          },
        },
      },
    });

    if (!product || product.deletedAt !== null) {
      throw new Error('Sản phẩm không tồn tại');
    }

    if (product.recipes.length === 0) {
      throw new Error(`Sản phẩm [${product.sku}] ${product.name} chưa có công thức định mức BOM`);
    }

    const recipe = product.recipes[0];
    let isAllAvailable = true;
    const itemsCheck = [];
    const missingItems = [];

    for (const item of recipe.items) {
      const baseQty = Number(item.quantity);
      const lossRate = Number(item.lossRate);
      const effectivePerUnit = baseQty * (1 + lossRate / 100);
      const totalNeeded = Number((effectivePerUnit * dto.quantity).toFixed(4));

      if (item.itemType === RecipeItemType.MATERIAL && item.material) {
        const inStock = item.material.inventory ? Number(item.material.inventory.quantity) : 0;
        const isSufficient = inStock >= totalNeeded;
        const missing = isSufficient ? 0 : Number((totalNeeded - inStock).toFixed(4));

        if (!isSufficient) isAllAvailable = false;

        const checkResult = {
          itemType: RecipeItemType.MATERIAL,
          id: item.material.id,
          sku: item.material.sku,
          name: item.material.name,
          unit: item.material.unit,
          inStock,
          totalNeeded,
          missingQuantity: missing,
          isSufficient,
        };

        itemsCheck.push(checkResult);
        if (!isSufficient) missingItems.push(checkResult);
      } else if (item.itemType === RecipeItemType.SUB_PRODUCT && item.subProduct) {
        const actual = item.subProduct.inventory ? Number(item.subProduct.inventory.actualQuantity) : 0;
        const reserved = item.subProduct.inventory ? Number(item.subProduct.inventory.reservedQuantity) : 0;
        const availableStock = Math.max(0, actual - reserved);
        const isSufficient = availableStock >= totalNeeded;
        const missing = isSufficient ? 0 : Number((totalNeeded - availableStock).toFixed(4));

        if (!isSufficient) isAllAvailable = false;

        const checkResult = {
          itemType: RecipeItemType.SUB_PRODUCT,
          id: item.subProduct.id,
          sku: item.subProduct.sku,
          name: item.subProduct.name,
          unit: 'cái',
          inStock: availableStock,
          totalNeeded,
          missingQuantity: missing,
          isSufficient,
        };

        itemsCheck.push(checkResult);
        if (!isSufficient) missingItems.push(checkResult);
      }
    }

    return {
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeVersion: recipe.version,
      quantityPlanned: dto.quantity,
      isAllAvailable,
      items: itemsCheck,
      missingItems,
    };
  }

  // ==========================================
  // 2. LỆNH SẢN XUẤT (PRODUCTION ORDERS)
  // ==========================================

  async getProductionOrders(filters?: ProductionOrderFilterDto) {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.productId) where.productId = filters.productId;

    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters?.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters?.toDate) where.createdAt.lte = new Date(filters.toDate);
    }

    if (filters?.search) {
      const term = filters.search.trim();
      where.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        { product: { name: { contains: term, mode: 'insensitive' } } },
        { product: { sku: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const orders = await prisma.productionOrder.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, type: true, sellingPrice: true } },
        recipe: { select: { id: true, version: true, name: true, expectedCost: true } },
        createdBy: { select: { id: true, fullName: true, username: true } },
        linkedOrder: { select: { id: true, code: true } },
        _count: { select: { consumptions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o: any) => ({
      id: o.id,
      code: o.code,
      type: o.type,
      status: o.status,
      plannedQuantity: Number(o.plannedQuantity),
      completedQuantity: Number(o.completedQuantity),
      totalProductionCost: Number(o.totalProductionCost),
      unitProductionCost: Number(o.unitProductionCost),
      startDate: o.startDate,
      completedDate: o.completedDate,
      notes: o.notes,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      product: {
        ...o.product,
        sellingPrice: Number(o.product.sellingPrice),
      },
      recipe: {
        ...o.recipe,
        expectedCost: Number(o.recipe.expectedCost),
      },
      createdBy: o.createdBy,
      linkedOrder: o.linkedOrder,
      consumptionsCount: o._count.consumptions,
    }));
  }

  async getProductionOrderById(id: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
            inventory: true,
          },
        },
        recipe: {
          include: {
            items: true,
          },
        },
        createdBy: { select: { id: true, fullName: true, username: true } },
        linkedOrder: { select: { id: true, code: true } },
        consumptions: {
          include: {
            material: { select: { id: true, sku: true, name: true, unit: true, inventory: true } },
            subProduct: { select: { id: true, sku: true, name: true, inventory: true } },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Lệnh sản xuất không tồn tại');
    }

    // Lấy các chứng từ kho liên quan
    const stockDocs = await prisma.stockDocument.findMany({
      where: { referenceId: order.id },
      include: {
        items: {
          include: {
            material: { select: { sku: true, name: true, unit: true } },
            product: { select: { sku: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      id: order.id,
      code: order.code,
      type: order.type,
      status: order.status,
      plannedQuantity: Number(order.plannedQuantity),
      completedQuantity: Number(order.completedQuantity),
      totalProductionCost: Number(order.totalProductionCost),
      unitProductionCost: Number(order.unitProductionCost),
      startDate: order.startDate,
      completedDate: order.completedDate,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      product: {
        id: order.product.id,
        sku: order.product.sku,
        name: order.product.name,
        type: order.product.type,
        sellingPrice: Number(order.product.sellingPrice),
        category: order.product.category,
        inventory: order.product.inventory
          ? {
              actualQuantity: Number(order.product.inventory.actualQuantity),
              reservedQuantity: Number(order.product.inventory.reservedQuantity),
              avgCost: Number(order.product.inventory.avgCost),
            }
          : null,
      },
      recipe: {
        id: order.recipe.id,
        version: order.recipe.version,
        name: order.recipe.name,
        expectedCost: Number(order.recipe.expectedCost),
      },
      createdBy: order.createdBy,
      linkedOrder: order.linkedOrder,
      consumptions: order.consumptions.map((c: any) => ({
        id: c.id,
        itemType: c.itemType,
        materialId: c.materialId,
        subProductId: c.subProductId,
        name: c.material ? c.material.name : c.subProduct ? c.subProduct.name : '',
        sku: c.material ? c.material.sku : c.subProduct ? c.subProduct.sku : '',
        unit: c.material ? c.material.unit : 'cái',
        plannedQuantity: Number(c.plannedQuantity),
        actualQuantity: Number(c.actualQuantity),
        unitCostSnapshot: Number(c.unitCostSnapshot),
        totalCost: Number(c.totalCost),
        currentStock: c.material?.inventory
          ? Number(c.material.inventory.quantity)
          : c.subProduct?.inventory
          ? Number(c.subProduct.inventory.actualQuantity) - Number(c.subProduct.inventory.reservedQuantity)
          : 0,
      })),
      stockDocuments: stockDocs.map((doc: any) => ({
        id: doc.id,
        code: doc.code,
        type: doc.type,
        createdAt: doc.createdAt,
        itemsCount: doc.items.length,
      })),
    };
  }

  async createProductionOrder(dto: CreateProductionOrderDto, userId: string) {
    const product = await prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        recipes: {
          where: dto.recipeId ? { id: dto.recipeId } : { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
          include: { items: true },
        },
      },
    });

    if (!product || product.deletedAt !== null) {
      throw new Error('Sản phẩm không tồn tại');
    }

    if (product.recipes.length === 0) {
      throw new Error(`Sản phẩm [${product.sku}] ${product.name} chưa có công thức định mức BOM`);
    }

    const recipe = product.recipes[0];

    const now = new Date();
    const prefix = `LSX-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Tạo lệnh sản xuất và các dòng dự trù tiêu hao (Planned Consumptions) trong Transaction
    const newOrder = await prisma.$transaction(async (tx: any) => {
      const code = await generateSafeCode(tx, 'productionOrder', prefix);
      const order = await tx.productionOrder.create({
        data: {
          code,
          type: dto.type,
          productId: dto.productId,
          recipeId: recipe.id,
          linkedOrderId: dto.linkedOrderId || null,
          plannedQuantity: dto.plannedQuantity,
          status: ProductionStatus.PLANNED,
          createdById: userId,
          notes: dto.notes || null,
        },
      });

      // Tạo các dòng consumption dự kiến
      for (const item of recipe.items) {
        const baseQty = Number(item.quantity);
        const lossRate = Number(item.lossRate);
        const effectivePerUnit = baseQty * (1 + lossRate / 100);
        const plannedTotal = Number((effectivePerUnit * dto.plannedQuantity).toFixed(4));

        await tx.productionConsumption.create({
          data: {
            productionOrderId: order.id,
            itemType: item.itemType,
            materialId: item.materialId,
            subProductId: item.subProductId,
            plannedQuantity: plannedTotal,
            actualQuantity: 0,
            unitCostSnapshot: item.snapshotCost,
            totalCost: 0,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_PRODUCTION_ORDER',
          entity: 'PRODUCTION_ORDER',
          entityId: order.id,
          newValues: {
            code: order.code,
            productSku: product.sku,
            type: order.type,
            plannedQuantity: dto.plannedQuantity,
          },
        },
      });

      return order;
    });

    broadcastSyncEvent(WsEvent.PRODUCTION_STATUS_CHANGED, {
      entity: 'PRODUCTION_ORDER',
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      data: { orderId: newOrder.id, code: newOrder.code },
    });

    return this.getProductionOrderById(newOrder.id);
  }

  // ==========================================
  // 3. XUẤT KHO SẢN XUẤT (START PRODUCTION)
  // ==========================================

  async startProduction(id: string, userId: string, notes?: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: true,
        consumptions: true,
      },
    });

    if (!order) {
      throw new Error('Lệnh sản xuất không tồn tại');
    }

    if (order.status !== ProductionStatus.PLANNED && order.status !== ProductionStatus.DRAFT) {
      throw new Error(`Không thể bắt đầu lệnh sản xuất đang ở trạng thái '${order.status}'`);
    }

    const now = new Date();
    const docPrefix = `CTK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Transaction xuất kho nguyên vật liệu với Pessimistic Row Locking
    await prisma.$transaction(async (tx: any) => {
      const docCode = await generateSafeCode(tx, 'stockDocument', docPrefix);
      // 1. Tạo chứng từ xuất kho sản xuất
      const stockDoc = await tx.stockDocument.create({
        data: {
          code: docCode,
          type: StockDocumentType.PRODUCTION_EXPORT,
          referenceType: StockReferenceType.PRODUCTION_ORDER,
          referenceId: order.id,
          warehouseType: WarehouseType.MATERIAL,
          issuedById: userId,
          notes: notes || `Xuất kho nguyên vật liệu cho Lệnh sản xuất ${order.code} [${order.product.sku}]`,
        },
      });

      let totalMaterialCost = 0;

      // 2. Duyệt từng dòng tiêu hao và trừ kho
      for (const consumption of order.consumptions) {
        const qtyNeeded = Number(consumption.plannedQuantity);

        if (consumption.itemType === RecipeItemType.MATERIAL && consumption.materialId) {
          // Lock row material_inventory
          const currentMatRows = await tx.$queryRaw<Array<{ quantity: any; avg_cost: any; version: number }>>`
            SELECT quantity, avg_cost, version
            FROM material_inventory
            WHERE material_id = ${consumption.materialId}
            FOR UPDATE
          `;

          const currentQty = currentMatRows.length > 0 ? Number(currentMatRows[0].quantity) : 0;
          const currentAvgCost = currentMatRows.length > 0 ? Number(currentMatRows[0].avg_cost) : 0;
          const currentVersion = currentMatRows.length > 0 ? currentMatRows[0].version : 1;

          if (currentQty < qtyNeeded) {
            const mat = await tx.material.findUnique({ where: { id: consumption.materialId } });
            throw new Error(
              `Không đủ nguyên vật liệu [${mat?.sku || consumption.materialId}]. Tồn kho: ${currentQty}, Yêu cầu xuất: ${qtyNeeded}. Vui lòng nhập thêm hàng trước khi sản xuất!`
            );
          }

          const newQty = Number((currentQty - qtyNeeded).toFixed(4));
          const lineCost = Number((qtyNeeded * currentAvgCost).toFixed(2));
          totalMaterialCost += lineCost;

          // Cập nhật tồn kho NVL
          await tx.materialInventory.update({
            where: { materialId: consumption.materialId },
            data: {
              quantity: newQty,
              version: currentVersion + 1,
            },
          });

          // Ghi thẻ kho
          await tx.stockDocumentItem.create({
            data: {
              documentId: stockDoc.id,
              materialId: consumption.materialId,
              qtyBefore: currentQty,
              qtyChange: qtyNeeded,
              qtyAfter: newQty,
              unitCost: currentAvgCost,
              totalCost: lineCost,
            },
          });

          // Cập nhật consumption
          await tx.productionConsumption.update({
            where: { id: consumption.id },
            data: {
              actualQuantity: qtyNeeded,
              unitCostSnapshot: currentAvgCost,
              totalCost: lineCost,
            },
          });
        } else if (consumption.itemType === RecipeItemType.SUB_PRODUCT && consumption.subProductId) {
          // Lock row product_inventory của bán thành phẩm
          const currentProdRows = await tx.$queryRaw<
            Array<{ actual_quantity: any; reserved_quantity: any; avg_cost: any; version: number }>
          >`
            SELECT actual_quantity, reserved_quantity, avg_cost, version
            FROM product_inventory
            WHERE product_id = ${consumption.subProductId}
            FOR UPDATE
          `;

          const currentActual = currentProdRows.length > 0 ? Number(currentProdRows[0].actual_quantity) : 0;
          const currentReserved = currentProdRows.length > 0 ? Number(currentProdRows[0].reserved_quantity) : 0;
          const currentAvgCost = currentProdRows.length > 0 ? Number(currentProdRows[0].avg_cost) : 0;
          const currentVersion = currentProdRows.length > 0 ? currentProdRows[0].version : 1;
          const availableStock = currentActual - currentReserved;

          if (availableStock < qtyNeeded) {
            const subP = await tx.product.findUnique({ where: { id: consumption.subProductId } });
            throw new Error(
              `Không đủ bán thành phẩm [${subP?.sku || consumption.subProductId}]. Khả dụng: ${availableStock}, Yêu cầu: ${qtyNeeded}.`
            );
          }

          const newActual = Number((currentActual - qtyNeeded).toFixed(4));
          const lineCost = Number((qtyNeeded * currentAvgCost).toFixed(2));
          totalMaterialCost += lineCost;

          // Cập nhật tồn kho bán thành phẩm
          await tx.productInventory.update({
            where: { productId: consumption.subProductId },
            data: {
              actualQuantity: newActual,
              version: currentVersion + 1,
            },
          });

          // Ghi thẻ kho bán thành phẩm
          await tx.stockDocumentItem.create({
            data: {
              documentId: stockDoc.id,
              productId: consumption.subProductId,
              qtyBefore: currentActual,
              qtyChange: qtyNeeded,
              qtyAfter: newActual,
              unitCost: currentAvgCost,
              totalCost: lineCost,
            },
          });

          await tx.productionConsumption.update({
            where: { id: consumption.id },
            data: {
              actualQuantity: qtyNeeded,
              unitCostSnapshot: currentAvgCost,
              totalCost: lineCost,
            },
          });
        }
      }

      // 3. Cập nhật trạng thái lệnh sản xuất sang IN_PROGRESS
      await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          status: ProductionStatus.IN_PROGRESS,
          startDate: now,
          totalProductionCost: totalMaterialCost,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'START_PRODUCTION',
          entity: 'PRODUCTION_ORDER',
          entityId: order.id,
          newValues: {
            code: order.code,
            status: ProductionStatus.IN_PROGRESS,
            totalMaterialCost,
            stockDocumentCode: stockDoc.code,
          },
        },
      });
    });

    // Phát sự kiện realtime
    broadcastSyncEvent(WsEvent.PRODUCTION_STATUS_CHANGED, {
      entity: 'PRODUCTION_ORDER',
      action: 'STARTED',
      timestamp: new Date().toISOString(),
      data: { orderId: order.id, code: order.code },
    });

    broadcastSyncEvent(WsEvent.MATERIAL_UPDATED, {
      entity: 'MATERIAL_INVENTORY',
      action: 'PRODUCTION_DEDUCTED',
      timestamp: new Date().toISOString(),
      data: { orderCode: order.code },
    });

    return this.getProductionOrderById(order.id);
  }

  // ==========================================
  // 4. HOÀN THÀNH LỆNH SẢN XUẤT (COMPLETE PRODUCTION)
  // ==========================================

  async completeProduction(id: string, userId: string, dto: CompleteProductionDto) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: { include: { inventory: true } },
        consumptions: true,
      },
    });

    if (!order) {
      throw new Error('Lệnh sản xuất không tồn tại');
    }

    if (order.status !== ProductionStatus.IN_PROGRESS) {
      throw new Error(`Lệnh sản xuất đang ở trạng thái '${order.status}', chỉ có thể hoàn thành lệnh 'IN_PROGRESS'`);
    }

    if (!dto.completedQuantity || dto.completedQuantity <= 0) {
      throw new Error('Số lượng sản xuất hoàn thành phải lớn hơn 0');
    }

    const now = new Date();
    const docPrefix = `CTK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Transaction hoàn thành sản xuất, nhập kho thành phẩm và tính giá vốn MWAC
    await prisma.$transaction(async (tx: any) => {
      const docCode = await generateSafeCode(tx, 'stockDocument', docPrefix);

      // 1. Tính tổng chi phí sản xuất thực tế = Tổng chi phí NVL xuất kho + Chi phí phụ thêm
      const materialCost = Number(order.totalProductionCost);
      const additionalCost = Number(dto.additionalCost || 0);
      const totalCost = materialCost + additionalCost;
      const completedQty = dto.completedQuantity;
      const unitCost = Number((totalCost / completedQty).toFixed(2));

      // 2. Khóa dòng ProductInventory của thành phẩm với Row Lock (FOR UPDATE)
      const currentRows = await tx.$queryRaw<
        Array<{ actual_quantity: any; reserved_quantity: any; avg_cost: any; version: number }>
      >`
        SELECT actual_quantity, reserved_quantity, avg_cost, version
        FROM product_inventory
        WHERE product_id = ${order.productId}
        FOR UPDATE
      `;

      const oldQty = currentRows.length > 0 ? Number(currentRows[0].actual_quantity) : 0;
      const oldReserved = currentRows.length > 0 ? Number(currentRows[0].reserved_quantity) : 0;
      const oldAvgCost = currentRows.length > 0 ? Number(currentRows[0].avg_cost) : 0;
      const currentVersion = currentRows.length > 0 ? currentRows[0].version : 1;

      // 3. Tính Giá vốn bình quân gia quyền di động (MWAC) cho thành phẩm:
      // (Q_old * C_old + Q_in * P_in) / (Q_old + Q_in)
      const newQty = oldQty + completedQty;
      let newAvgCost = 0;
      if (newQty > 0) {
        newAvgCost = Number(((oldQty * oldAvgCost + completedQty * unitCost) / newQty).toFixed(2));
      }

      // 4. Nếu là lệnh sản xuất theo đơn MTO (Make-to-Order):
      // Giữ chỗ (reserve) ngay phần hàng mới sản xuất này cho đơn hàng tương ứng
      const isMto = order.type === ProductionType.MAKE_TO_ORDER && Boolean(order.linkedOrderId);
      const newReserved = isMto ? oldReserved + completedQty : oldReserved;

      // 5. Tạo chứng từ nhập kho thành phẩm
      const stockDoc = await tx.stockDocument.create({
        data: {
          code: docCode,
          type: StockDocumentType.PRODUCTION_IMPORT,
          referenceType: StockReferenceType.PRODUCTION_ORDER,
          referenceId: order.id,
          warehouseType: WarehouseType.PRODUCT,
          issuedById: userId,
          notes: dto.notes || `Nhập kho hoàn thành Lệnh sản xuất ${order.code} [${order.product.sku}]`,
        },
      });

      // 6. Ghi thẻ kho thành phẩm
      await tx.stockDocumentItem.create({
        data: {
          documentId: stockDoc.id,
          productId: order.productId,
          qtyBefore: oldQty,
          qtyChange: completedQty,
          qtyAfter: newQty,
          unitCost,
          totalCost,
        },
      });

      // 7. Cập nhật tồn kho thành phẩm
      await tx.productInventory.upsert({
        where: { productId: order.productId },
        update: {
          actualQuantity: newQty,
          reservedQuantity: newReserved,
          avgCost: newAvgCost,
          version: currentVersion + 1,
        },
        create: {
          productId: order.productId,
          actualQuantity: newQty,
          reservedQuantity: isMto ? completedQty : 0,
          avgCost: newAvgCost,
          version: 1,
        },
      });

      // 8. Nếu là MTO: Cập nhật giá vốn thực tế vào đơn hàng liên kết (Linked Order)
      if (isMto && order.linkedOrderId) {
        // Cập nhật giá vốn snapshot dòng sản phẩm trong đơn hàng
        await tx.orderItem.updateMany({
          where: {
            orderId: order.linkedOrderId,
            productId: order.productId,
          },
          data: {
            unitCogsSnapshot: unitCost,
          },
        });

        // Tính lại tổng giá vốn (totalCogs) cho đơn hàng
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: order.linkedOrderId },
        });
        const updatedTotalCogs = orderItems.reduce((sum: number, it: any) => {
          const itCost = it.productId === order.productId ? unitCost : Number(it.unitCogsSnapshot);
          return sum + Number(it.quantity) * itCost;
        }, 0);

        await tx.order.update({
          where: { id: order.linkedOrderId },
          data: { totalCogs: updatedTotalCogs },
        });

        console.log(`🌸 [MTO-Cost] Đã đồng bộ giá vốn thực tế (${unitCost.toLocaleString()} đ) cho đơn hàng linkedOrderId: ${order.linkedOrderId}`);
      }

      // 9. Ghi nhận chênh lệch số lượng thực tế vs kế hoạch
      const plannedQty = Number(order.plannedQuantity);
      const diff = completedQty - plannedQty;
      let diffNote = '';
      if (diff < 0) {
        diffNote = `\n[Hao hụt/Thiếu]: Thiếu ${Math.abs(diff)} bó so với kế hoạch (${plannedQty})`;
      } else if (diff > 0) {
        diffNote = `\n[Vượt kế hoạch]: Dôi dư ${diff} bó so với kế hoạch (${plannedQty})`;
      }

      // 10. Cập nhật lệnh sản xuất sang COMPLETED
      await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          status: ProductionStatus.COMPLETED,
          completedQuantity: completedQty,
          completedDate: now,
          totalProductionCost: totalCost,
          unitProductionCost: unitCost,
          notes: dto.notes
            ? `${order.notes || ''}\n[Hoàn thành]: ${dto.notes}${diffNote}`.trim()
            : `${order.notes || ''}${diffNote}`.trim(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'COMPLETE_PRODUCTION',
          entity: 'PRODUCTION_ORDER',
          entityId: order.id,
          newValues: {
            code: order.code,
            status: ProductionStatus.COMPLETED,
            completedQuantity: completedQty,
            unitCost,
            totalCost,
            newInventoryAvgCost: newAvgCost,
            stockDocumentCode: stockDoc.code,
          },
        },
      });
    });

    // Phát sự kiện realtime
    broadcastSyncEvent(WsEvent.PRODUCTION_STATUS_CHANGED, {
      entity: 'PRODUCTION_ORDER',
      action: 'COMPLETED',
      timestamp: new Date().toISOString(),
      data: { orderId: order.id, code: order.code },
    });

    broadcastSyncEvent(WsEvent.PRODUCT_STOCK_CHANGED, {
      entity: 'PRODUCT_INVENTORY',
      action: 'PRODUCTION_COMPLETED',
      timestamp: new Date().toISOString(),
      data: { productId: order.productId },
    });

    return this.getProductionOrderById(order.id);
  }

  // ==========================================
  // 5. HỦY LỆNH SẢN XUẤT (CANCEL PRODUCTION)
  // ==========================================

  async cancelProduction(id: string, userId: string, reason: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: { consumptions: true },
    });

    if (!order) {
      throw new Error('Lệnh sản xuất không tồn tại');
    }

    if (order.status === ProductionStatus.COMPLETED) {
      throw new Error('Không thể hủy lệnh sản xuất đã hoàn thành nhập kho');
    }

    if (order.status === ProductionStatus.CANCELLED) {
      throw new Error('Lệnh sản xuất này đã bị hủy trước đó');
    }

    // Nếu lệnh đang ở IN_PROGRESS, phải hoàn trả nguyên vật liệu đã xuất kho vào lại kho
    if (order.status === ProductionStatus.IN_PROGRESS) {
      const now = new Date();
      const docPrefix = `CTK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      await prisma.$transaction(async (tx: any) => {
        const docCode = await generateSafeCode(tx, 'stockDocument', docPrefix);
        const stockDoc = await tx.stockDocument.create({
          data: {
            code: docCode,
            type: StockDocumentType.ADJUSTMENT_IN,
            referenceType: StockReferenceType.PRODUCTION_ORDER,
            referenceId: order.id,
            warehouseType: WarehouseType.MATERIAL,
            issuedById: userId,
            notes: `Hoàn trả NVL do hủy Lệnh sản xuất ${order.code}: ${reason}`,
          },
        });

        for (const c of order.consumptions) {
          const qtyReturn = Number(c.actualQuantity);
          if (qtyReturn <= 0) continue;

          if (c.itemType === RecipeItemType.MATERIAL && c.materialId) {
            const currentMat = await tx.materialInventory.findUnique({
              where: { materialId: c.materialId },
            });
            const oldQ = currentMat ? Number(currentMat.quantity) : 0;
            const newQ = oldQ + qtyReturn;

            await tx.materialInventory.update({
              where: { materialId: c.materialId },
              data: { quantity: newQ },
            });

            await tx.stockDocumentItem.create({
              data: {
                documentId: stockDoc.id,
                materialId: c.materialId,
                qtyBefore: oldQ,
                qtyChange: qtyReturn,
                qtyAfter: newQ,
                unitCost: Number(c.unitCostSnapshot),
                totalCost: Number(c.totalCost),
              },
            });
          } else if (c.itemType === RecipeItemType.SUB_PRODUCT && c.subProductId) {
            const currentProd = await tx.productInventory.findUnique({
              where: { productId: c.subProductId },
            });
            const oldQ = currentProd ? Number(currentProd.actualQuantity) : 0;
            const newQ = oldQ + qtyReturn;

            await tx.productInventory.update({
              where: { productId: c.subProductId },
              data: { actualQuantity: newQ },
            });

            await tx.stockDocumentItem.create({
              data: {
                documentId: stockDoc.id,
                productId: c.subProductId,
                qtyBefore: oldQ,
                qtyChange: qtyReturn,
                qtyAfter: newQ,
                unitCost: Number(c.unitCostSnapshot),
                totalCost: Number(c.totalCost),
              },
            });
          }
        }

        await tx.productionOrder.update({
          where: { id: order.id },
          data: {
            status: ProductionStatus.CANCELLED,
            notes: `${order.notes || ''}\n[Hủy lệnh]: ${reason}`.trim(),
          },
        });
      });
    } else {
      // Nếu là PLANNED hoặc DRAFT, chỉ cần đổi trạng thái
      await prisma.productionOrder.update({
        where: { id: order.id },
        data: {
          status: ProductionStatus.CANCELLED,
          notes: `${order.notes || ''}\n[Hủy lệnh]: ${reason}`.trim(),
        },
      });
    }

    broadcastSyncEvent(WsEvent.PRODUCTION_STATUS_CHANGED, {
      entity: 'PRODUCTION_ORDER',
      action: 'CANCELLED',
      timestamp: new Date().toISOString(),
      data: { orderId: order.id, code: order.code },
    });

    return this.getProductionOrderById(order.id);
  }

  // ==========================================
  // 6. QUẢN LÝ TỒN KHO THÀNH PHẨM (PRODUCT INVENTORY)
  // ==========================================

  async getProductInventoryList(search?: string, categoryId?: string, isStaff = false) {
    const where: any = { deletedAt: null };

    if (categoryId) where.categoryId = categoryId;
    if (search) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, code: true, name: true } },
        inventory: true,
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p: any) => {
      const actualQuantity = p.inventory ? Number(p.inventory.actualQuantity) : 0;
      const reservedQuantity = p.inventory ? Number(p.inventory.reservedQuantity) : 0;
      const availableQuantity = Math.max(0, actualQuantity - reservedQuantity);
      const avgCost = p.inventory ? Number(p.inventory.avgCost) : 0;
      const totalInventoryValue = actualQuantity * avgCost;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        type: p.type,
        sellingPrice: Number(p.sellingPrice),
        imageUrl: p.imageUrl,
        category: p.category,
        inventory: {
          actualQuantity,
          reservedQuantity,
          availableQuantity,
          // Ẩn giá vốn và tổng giá trị kho nếu là Staff
          avgCost: isStaff ? undefined : avgCost,
          totalInventoryValue: isStaff ? undefined : Number(totalInventoryValue.toFixed(2)),
          isLowStock: availableQuantity <= 3, // Cảnh báo nếu còn dưới 3 sản phẩm
        },
      };
    });
  }

  async adjustProductStock(dto: AdjustProductStockDto, userId: string) {
    const product = await prisma.product.findUnique({
      where: { id: dto.productId },
      include: { inventory: true },
    });

    if (!product || product.deletedAt !== null) {
      throw new Error('Sản phẩm không tồn tại');
    }

    const now = new Date();
    const docPrefix = `CTK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    return prisma.$transaction(async (tx: any) => {
      const docCode = await generateSafeCode(tx, 'stockDocument', docPrefix);
      // Row lock
      const currentRows = await tx.$queryRaw<
        Array<{ actual_quantity: any; reserved_quantity: any; avg_cost: any; version: number }>
      >`
        SELECT actual_quantity, reserved_quantity, avg_cost, version
        FROM product_inventory
        WHERE product_id = ${dto.productId}
        FOR UPDATE
      `;

      const oldActual = currentRows.length > 0 ? Number(currentRows[0].actual_quantity) : 0;
      const reserved = currentRows.length > 0 ? Number(currentRows[0].reserved_quantity) : 0;
      const currentAvgCost = currentRows.length > 0 ? Number(currentRows[0].avg_cost) : 0;
      const currentVersion = currentRows.length > 0 ? currentRows[0].version : 1;

      const diff = dto.actualQuantity - oldActual;
      if (diff === 0) {
        throw new Error('Số lượng kiểm kê bằng với số lượng thực tế trong kho, không cần điều chỉnh');
      }

      const docType = diff > 0 ? StockDocumentType.ADJUSTMENT_IN : StockDocumentType.ADJUSTMENT_OUT;

      const doc = await tx.stockDocument.create({
        data: {
          code: docCode,
          type: docType,
          referenceType: StockReferenceType.MANUAL,
          warehouseType: WarehouseType.PRODUCT,
          issuedById: userId,
          notes: `Kiểm kê kho thành phẩm [${product.sku} - ${product.name}]: ${dto.reason}`,
        },
      });

      await tx.productInventory.upsert({
        where: { productId: dto.productId },
        update: {
          actualQuantity: dto.actualQuantity,
          version: currentVersion + 1,
        },
        create: {
          productId: dto.productId,
          actualQuantity: dto.actualQuantity,
          reservedQuantity: 0,
          avgCost: currentAvgCost,
          version: 1,
        },
      });

      await tx.stockDocumentItem.create({
        data: {
          documentId: doc.id,
          productId: dto.productId,
          qtyBefore: oldActual,
          qtyChange: Math.abs(diff),
          qtyAfter: dto.actualQuantity,
          unitCost: currentAvgCost,
          totalCost: Math.abs(diff) * currentAvgCost,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'ADJUST_PRODUCT_STOCK',
          entity: 'PRODUCT_INVENTORY',
          entityId: dto.productId,
          oldValues: { actualQuantity: oldActual },
          newValues: { actualQuantity: dto.actualQuantity, diff, reason: dto.reason },
        },
      });

      broadcastSyncEvent(WsEvent.PRODUCT_STOCK_CHANGED, {
        entity: 'PRODUCT_INVENTORY',
        action: 'STOCK_ADJUSTED',
        timestamp: new Date().toISOString(),
        data: { productId: dto.productId, newQuantity: dto.actualQuantity },
      });

      return {
        productId: dto.productId,
        oldActualQuantity: oldActual,
        newActualQuantity: dto.actualQuantity,
        availableQuantity: Math.max(0, dto.actualQuantity - reserved),
        diff,
        documentCode: doc.code,
      };
    });
  }

  async getProductStockLedger(filters?: ProductStockLedgerFilterDto) {
    const where: any = {
      warehouseType: WarehouseType.PRODUCT,
    };

    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters?.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters?.toDate) where.createdAt.lte = new Date(filters.toDate);
    }

    const itemsWhere: any = {};
    if (filters?.productId) {
      itemsWhere.productId = filters.productId;
    }

    const docs = await prisma.stockDocument.findMany({
      where,
      include: {
        issuedBy: { select: { id: true, fullName: true, username: true } },
        items: {
          where: itemsWhere,
          include: {
            product: { select: { id: true, sku: true, name: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return docs.flatMap((doc: any) =>
      doc.items
        .filter((it: any) => it.product !== null)
        .map((it: any) => ({
          id: it.id,
          documentCode: doc.code,
          documentType: doc.type,
          referenceType: doc.referenceType,
          createdAt: doc.createdAt,
          issuedBy: doc.issuedBy,
          product: it.product,
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

export const productionService = new ProductionService();
