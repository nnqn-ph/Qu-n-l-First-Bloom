import { prisma } from '../../config/prisma';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  AddPaymentDto,
  OrderFilterDto,
} from './orders.dto';
import {
  OrderStatus,
  PaymentType,
  PaymentMethod,
  StockDocumentType,
  StockReferenceType,
  WarehouseType,
  CashFlowType,
  ProductionType,
  ProductionStatus,
} from '@prisma/client';
import { broadcastSyncEvent, WsEvent } from '../../websocket/socket.server';
import { generateSafeCode } from '../../common/code-generator';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.SHIPPING, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export class OrdersService {
  // ==========================================
  // 1. QUẢN LÝ KHÁCH HÀNG (CUSTOMERS)
  // ==========================================

  async getCustomers(search?: string) {
    const where: any = { deletedAt: null };

    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return customers.map((c: any) => ({
      id: c.id,
      code: c.code,
      fullName: c.fullName,
      phone: c.phone,
      address: c.address,
      notes: c.notes,
      totalOrdersCount: c.totalOrdersCount,
      totalSpent: Number(c.totalSpent),
      createdAt: c.createdAt,
    }));
  }

  async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            code: true,
            orderDate: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
            remainingAmount: true,
          },
        },
      },
    });

    if (!customer || customer.deletedAt !== null) {
      throw new Error('Khách hàng không tồn tại');
    }

    return {
      ...customer,
      totalSpent: Number(customer.totalSpent),
      orders: customer.orders.map((o: any) => ({
        ...o,
        totalAmount: Number(o.totalAmount),
        paidAmount: Number(o.paidAmount),
        remainingAmount: Number(o.remainingAmount),
      })),
    };
  }

  async createCustomer(dto: CreateCustomerDto, userId: string) {
    // Kiểm tra trùng số điện thoại
    const existing = await prisma.customer.findFirst({
      where: { phone: dto.phone.trim(), deletedAt: null },
    });

    if (existing) {
      throw new Error(`Số điện thoại '${dto.phone}' đã được đăng ký cho khách hàng '${existing.fullName}'`);
    }

    // Sinh mã khách hàng KH-YYYYMM-XXXX an toàn, chống trùng
    const now = new Date();
    const prefix = `KH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const code = await generateSafeCode(prisma, 'customer', prefix);

    const customer = await prisma.customer.create({
      data: {
        code,
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        address: dto.address?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_CUSTOMER',
        entity: 'CUSTOMER',
        entityId: customer.id,
        newValues: customer,
      },
    });

    broadcastSyncEvent(WsEvent.CUSTOMER_UPDATED, {
      entity: 'CUSTOMER',
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      data: { customerId: customer.id, code: customer.code },
    });

    return {
      ...customer,
      totalSpent: Number(customer.totalSpent),
    };
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, userId: string) {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer || customer.deletedAt !== null) {
      throw new Error('Khách hàng không tồn tại');
    }

    if (dto.phone && dto.phone.trim() !== customer.phone) {
      const existing = await prisma.customer.findFirst({
        where: { phone: dto.phone.trim(), id: { not: id }, deletedAt: null },
      });
      if (existing) {
        throw new Error(`Số điện thoại '${dto.phone}' đã được sử dụng bởi khách hàng khác`);
      }
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim() || undefined,
        phone: dto.phone?.trim() || undefined,
        address: dto.address !== undefined ? dto.address.trim() || null : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_CUSTOMER',
        entity: 'CUSTOMER',
        entityId: id,
        oldValues: customer,
        newValues: updated,
      },
    });

    broadcastSyncEvent(WsEvent.CUSTOMER_UPDATED, {
      entity: 'CUSTOMER',
      action: 'UPDATED',
      timestamp: new Date().toISOString(),
      data: { customerId: updated.id, code: updated.code },
    });

    return {
      ...updated,
      totalSpent: Number(updated.totalSpent),
    };
  }

  // ==========================================
  // 2. QUẢN LÝ ĐƠN HÀNG (ORDERS)
  // ==========================================

  async getOrders(filters?: OrderFilterDto, isStaff = false) {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.customerId) where.customerId = filters.customerId;

    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters?.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters?.toDate) where.createdAt.lte = new Date(filters.toDate);
    }

    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        { customer: { fullName: { contains: term, mode: 'insensitive' } } },
        { customer: { phone: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, code: true, fullName: true, phone: true } },
        createdBy: { select: { id: true, fullName: true, username: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            product: { select: { id: true, sku: true, name: true, imageUrl: true } },
          },
        },
        _count: { select: { payments: true, productionOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return orders.map((o: any) => ({
      id: o.id,
      code: o.code,
      orderDate: o.orderDate,
      expectedDeliveryDate: o.expectedDeliveryDate,
      status: o.status,
      subtotal: Number(o.subtotal),
      discountAmount: Number(o.discountAmount),
      shippingFeeCollected: Number(o.shippingFeeCollected),
      shippingCostPaid: Number(o.shippingCostPaid),
      totalAmount: Number(o.totalAmount),
      depositAmount: Number(o.depositAmount),
      paidAmount: Number(o.paidAmount),
      remainingAmount: Number(o.remainingAmount),
      // Ẩn giá vốn COGS với Staff
      totalCogs: isStaff ? undefined : Number(o.totalCogs),
      deliveryAddress: o.deliveryAddress,
      notes: o.notes,
      createdAt: o.createdAt,
      customer: o.customer,
      createdBy: o.createdBy,
      itemsSummary: o.items.map((it: any) => ({
        productName: it.product.name,
        productSku: it.product.sku,
        quantity: Number(it.quantity),
      })),
      itemsCount: o.items.length,
      paymentsCount: o._count.payments,
      hasLinkedProduction: o._count.productionOrders > 0,
    }));
  }

  async getOrderById(id: string, isStaff = false) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { id: true, fullName: true, username: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                type: true,
                imageUrl: true,
                sellingPrice: true,
                inventory: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            collectedBy: { select: { id: true, fullName: true, username: true } },
          },
        },
        productionOrders: {
          select: {
            id: true,
            code: true,
            status: true,
            plannedQuantity: true,
            completedQuantity: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Đơn hàng không tồn tại');
    }

    return {
      id: order.id,
      code: order.code,
      orderDate: order.orderDate,
      expectedDeliveryDate: order.expectedDeliveryDate,
      status: order.status,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      shippingFeeCollected: Number(order.shippingFeeCollected),
      shippingCostPaid: Number(order.shippingCostPaid),
      totalAmount: Number(order.totalAmount),
      depositAmount: Number(order.depositAmount),
      paidAmount: Number(order.paidAmount),
      remainingAmount: Number(order.remainingAmount),
      totalCogs: isStaff ? undefined : Number(order.totalCogs),
      grossProfit: isStaff ? undefined : Number(order.totalAmount) - Number(order.totalCogs),
      deliveryAddress: order.deliveryAddress,
      notes: order.notes,
      createdAt: order.createdAt,
      customer: order.customer,
      createdBy: order.createdBy,
      items: order.items.map((it: any) => ({
        id: it.id,
        productId: it.productId,
        productName: it.product.name,
        productSku: it.product.sku,
        productType: it.product.type,
        imageUrl: it.product.imageUrl,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        unitCogsSnapshot: isStaff ? undefined : Number(it.unitCogsSnapshot),
        discount: Number(it.discount),
        lineTotal: Number(it.lineTotal),
        currentAvailableStock: it.product.inventory
          ? Number(it.product.inventory.actualQuantity) - Number(it.product.inventory.reservedQuantity)
          : 0,
      })),
      payments: order.payments.map((p: any) => ({
        id: p.id,
        code: p.code,
        paymentType: p.paymentType,
        paymentMethod: p.paymentMethod,
        amount: Number(p.amount),
        paymentDate: p.paymentDate,
        transactionReference: p.transactionReference,
        notes: p.notes,
        collectedBy: p.collectedBy,
      })),
      productionOrders: order.productionOrders.map((po: any) => ({
        ...po,
        plannedQuantity: Number(po.plannedQuantity),
        completedQuantity: Number(po.completedQuantity),
      })),
    };
  }

  /**
   * Tạo đơn hàng mới với Transaction, Row Locking và Giữ chỗ tồn kho (Stock Reservation)
   */
  async createOrder(dto: CreateOrderDto, userId: string) {
    const now = new Date();

    // Transaction chính với Row Locking và Giữ chỗ an toàn
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Sinh mã đơn hàng an toàn bên trong transaction
      const orderPrefix = `DH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const orderCode = await generateSafeCode(tx, 'order', orderPrefix);

      // 2. Khách hàng: Lấy khách cũ hoặc tạo khách mới
      let customerId = dto.customerId;
      if (!customerId && dto.customer) {
        let existingCust = await tx.customer.findUnique({
          where: { phone: dto.customer.phone.trim() },
        });

        if (existingCust) {
          customerId = existingCust.id;
        } else {
          const custPrefix = `KH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
          const custCode = await generateSafeCode(tx, 'customer', custPrefix);
          const newCust = await tx.customer.create({
            data: {
              code: custCode,
              fullName: dto.customer.fullName.trim(),
              phone: dto.customer.phone.trim(),
              address: dto.customer.address?.trim() || null,
              notes: dto.customer.notes?.trim() || null,
            },
          });
          customerId = newCust.id;
        }
      }

      if (!customerId) {
        throw new Error('Không xác định được khách hàng');
      }

      // 3. Tính toán tiền hàng và kiểm tra tồn kho chi tiết
      let subtotal = 0;
      let totalCogs = 0;
      const calculatedItems = [];

      for (const item of dto.items) {
        // Khóa hàng tồn kho thành phẩm (Row Lock)
        const currentProdRows = await tx.$queryRaw<
          Array<{ actual_quantity: any; reserved_quantity: any; avg_cost: any; version: number }>
        >`
          SELECT actual_quantity, reserved_quantity, avg_cost, version
          FROM product_inventory
          WHERE product_id = ${item.productId}
          FOR UPDATE
        `;

        if (currentProdRows.length === 0) {
          throw new Error(`Sản phẩm ID '${item.productId}' chưa có bản ghi tồn kho`);
        }

        const actualQty = Number(currentProdRows[0].actual_quantity);
        const reservedQty = Number(currentProdRows[0].reserved_quantity);
        const avgCost = Number(currentProdRows[0].avg_cost);
        const version = currentProdRows[0].version;

        // Tồn kho khả dụng = Tồn thực tế - Đã giữ chỗ
        const availableStock = Math.max(0, actualQty - reservedQty);

        // Nếu Bán có sẵn (không bật MTO): Bắt buộc tồn kho khả dụng phải đủ
        if (!dto.createMtoProduction && availableStock < item.quantity) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          const missingQty = item.quantity - availableStock;
          throw new Error(
            `Sản phẩm [${product?.sku || item.productId}] "${product?.name || ''}" không đủ hàng có sẵn để bán! (Khả dụng: ${availableStock}, Đặt: ${item.quantity}, Thiếu: ${missingQty}). Vui lòng chọn "Sản xuất theo đơn (MTO)" hoặc giảm số lượng đặt.`
          );
        }

        // Tính toán phân bổ kho và sản xuất Make-to-Order:
        // - Ưu tiên giữ chỗ số lượng thành phẩm đang có sẵn trong kho: min(availableStock, quantity)
        const reservedFromStock = Math.min(availableStock, item.quantity);
        // - Số lượng còn thiếu cần tạo lệnh sản xuất:
        const neededToProduce = dto.createMtoProduction ? Math.max(0, item.quantity - reservedFromStock) : 0;

        const lineTotal = item.quantity * item.unitPrice - (item.discount || 0);
        subtotal += lineTotal;
        totalCogs += item.quantity * avgCost;

        // Chỉ tăng reserved_quantity cho phần hàng ĐANG CÓ SẴN trong kho!
        if (reservedFromStock > 0) {
          await tx.productInventory.update({
            where: { productId: item.productId },
            data: {
              reservedQuantity: reservedQty + reservedFromStock,
              version: version + 1,
            },
          });
        }

        calculatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          reservedFromStock,
          neededToProduce,
          unitPrice: item.unitPrice,
          unitCogsSnapshot: avgCost,
          discount: item.discount || 0,
          lineTotal,
        });
      }

      const totalAmount = subtotal - (dto.discountAmount || 0) + (dto.shippingFeeCollected || 0);
      const depositAmount = dto.depositAmount || 0;
      const paidAmount = depositAmount;
      const remainingAmount = Math.max(0, totalAmount - paidAmount);

      // Trạng thái: Nếu có cọc hoặc thanh toán thì CONFIRMED, nếu chưa thì PENDING
      const initialStatus = depositAmount > 0 ? OrderStatus.CONFIRMED : OrderStatus.PENDING;

      // 4. Tạo Đơn hàng
      const order = await tx.order.create({
        data: {
          code: orderCode,
          customerId,
          createdById: userId,
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
          deliveryAddress: dto.deliveryAddress || null,
          status: initialStatus,
          subtotal,
          discountAmount: dto.discountAmount || 0,
          shippingFeeCollected: dto.shippingFeeCollected || 0,
          shippingCostPaid: dto.shippingCostPaid || 0,
          totalAmount,
          depositAmount,
          paidAmount,
          remainingAmount,
          totalCogs,
          notes: dto.notes || null,
        },
      });

      // 5. Tạo các dòng OrderItem
      for (const it of calculatedItems) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            unitCogsSnapshot: it.unitCogsSnapshot,
            discount: it.discount,
            lineTotal: it.lineTotal,
          },
        });
      }

      // 6. Nếu có tiền đặt cọc: Tạo Payment & FinancialTransaction (Phiếu thu) an toàn
      if (depositAmount > 0) {
        const payPrefix = `TT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const paymentCode = await generateSafeCode(tx, 'payment', payPrefix);

        const sqPrefix = `PT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const financialCode = await generateSafeCode(tx, 'financialTransaction', sqPrefix);

        const payment = await tx.payment.create({
          data: {
            code: paymentCode,
            orderId: order.id,
            collectedById: userId,
            paymentType: depositAmount >= totalAmount ? PaymentType.FULL_PAYMENT : PaymentType.DEPOSIT,
            paymentMethod: dto.depositPaymentMethod,
            amount: depositAmount,
            notes: `Thu tiền cọc đơn hàng ${order.code}`,
          },
        });

        await tx.financialTransaction.create({
          data: {
            code: financialCode,
            flowType: CashFlowType.INFLOW,
            paymentMethod: dto.depositPaymentMethod,
            amount: depositAmount,
            sourceOrderId: order.id,
            paymentId: payment.id,
            performedById: userId,
            description: `Thu tiền cọc đơn hàng ${order.code} [${dto.depositPaymentMethod === PaymentMethod.CASH ? 'Tiền mặt' : 'Chuyển khoản'}]`,
          },
        });
      }

      // 7. Nếu bật tùy chọn MTO (Make-to-Order): Chỉ tạo lệnh sản xuất cho phần hàng CÒN THIẾU
      if (dto.createMtoProduction) {
        const prodPrefix = `LSX-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

        for (const item of calculatedItems) {
          // Bỏ qua nếu kho đã có sẵn đủ hàng (neededToProduce === 0)
          if (item.neededToProduce <= 0) {
            console.log(`ℹ️ [MTO] Sản phẩm ${item.productId} đã đủ hàng có sẵn trong kho (${item.reservedFromStock} bó), không cần sản xuất thêm.`);
            continue;
          }

          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { recipes: { where: { isActive: true }, take: 1, include: { items: true } } },
          });

          if (product && product.recipes.length > 0) {
            const recipe = product.recipes[0];
            const pOrderCode = await generateSafeCode(tx, 'productionOrder', prodPrefix);
            const pOrder = await tx.productionOrder.create({
              data: {
                code: pOrderCode,
                type: ProductionType.MAKE_TO_ORDER,
                productId: product.id,
                recipeId: recipe.id,
                linkedOrderId: order.id,
                plannedQuantity: item.neededToProduce, // CHỈ SẢN XUẤT PHẦN CÒN THIẾU!
                status: ProductionStatus.PLANNED,
                createdById: userId,
                notes: `Sản xuất theo đơn hàng ${order.code}: Cần sản xuất ${item.neededToProduce} bó còn thiếu (Kho đã giữ chỗ sẵn ${item.reservedFromStock} bó)`,
              },
            });

            for (const rItem of recipe.items) {
              const baseQty = Number(rItem.quantity);
              const lossRate = Number(rItem.lossRate);
              const effectiveQty = baseQty * (1 + lossRate / 100);
              await tx.productionConsumption.create({
                data: {
                  productionOrderId: pOrder.id,
                  itemType: rItem.itemType,
                  materialId: rItem.materialId,
                  subProductId: rItem.subProductId,
                  plannedQuantity: effectiveQty * item.neededToProduce,
                  actualQuantity: 0,
                  unitCostSnapshot: rItem.snapshotCost,
                  totalCost: 0,
                },
              });
            }
          }
        }
      }

      // 8. Cập nhật thống kê khách hàng (chỉ tăng totalSpent bằng tiền thực thu)
      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalOrdersCount: { increment: 1 },
          totalSpent: { increment: depositAmount },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_ORDER',
          entity: 'ORDER',
          entityId: order.id,
          newValues: {
            code: order.code,
            totalAmount,
            depositAmount,
            itemsCount: calculatedItems.length,
          },
        },
      });

      return order;
    });

    // Phát sự kiện realtime
    broadcastSyncEvent(WsEvent.ORDER_CREATED, {
      entity: 'ORDER',
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      data: { orderId: result.id, code: result.code },
    });

    broadcastSyncEvent(WsEvent.PRODUCT_STOCK_CHANGED, {
      entity: 'PRODUCT_INVENTORY',
      action: 'STOCK_RESERVED',
      timestamp: new Date().toISOString(),
      data: { orderCode: result.code },
    });

    if (dto.depositAmount && dto.depositAmount > 0) {
      broadcastSyncEvent(WsEvent.FINANCE_UPDATED, {
        entity: 'FINANCE',
        action: 'DEPOSIT_COLLECTED',
        timestamp: new Date().toISOString(),
        data: { amount: dto.depositAmount },
      });
    }

    return this.getOrderById(result.id);
  }

  /**
   * Cập nhật trạng thái đơn hàng & Quản lý vòng đời tồn kho
   */
  async updateOrderStatus(id: string, dto: UpdateOrderStatusDto, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new Error('Đơn hàng không tồn tại');
    }

    if (order.status === dto.status) {
      return this.getOrderById(order.id);
    }

    // Kiểm tra quy tắc chuyển trạng thái hợp lệ (State Machine)
    const allowedTransitions = VALID_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes(dto.status)) {
      throw new Error(
        `Không thể chuyển trạng thái đơn hàng từ '${order.status}' sang '${dto.status}'. Quy trình cho phép: ${allowedTransitions.join(', ') || 'Không có (đơn hàng đã kết thúc)'}`
      );
    }

    const now = new Date();

    // Transaction chuyển đổi trạng thái với Pessimistic Locking
    await prisma.$transaction(async (tx: any) => {
      // 1. Chuyển sang COMPLETED: Xuất kho thành phẩm thực tế (SALE_EXPORT)
      if (dto.status === OrderStatus.COMPLETED) {
        // Kiểm tra chống trừ kho và tạo chứng từ 2 lần
        const existingDoc = await tx.stockDocument.findFirst({
          where: {
            referenceType: StockReferenceType.ORDER,
            referenceId: order.id,
            type: StockDocumentType.SALE_EXPORT,
          },
        });

        if (existingDoc) {
          throw new Error(`Đơn hàng ${order.code} đã được xuất kho thành phẩm trước đó (${existingDoc.code}), không thể xuất kho lần 2!`);
        }

        const docPrefix = `CTK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const docCode = await generateSafeCode(tx, 'stockDocument', docPrefix);

        const stockDoc = await tx.stockDocument.create({
          data: {
            code: docCode,
            type: StockDocumentType.SALE_EXPORT,
            referenceType: StockReferenceType.ORDER,
            referenceId: order.id,
            warehouseType: WarehouseType.PRODUCT,
            issuedById: userId,
            notes: `Xuất kho hoàn tất đơn hàng ${order.code}`,
          },
        });

        for (const item of order.items) {
          const qty = Number(item.quantity);

          // Lock row product_inventory
          const currentProdRows = await tx.$queryRaw<
            Array<{ actual_quantity: any; reserved_quantity: any; avg_cost: any; version: number }>
          >`
            SELECT actual_quantity, reserved_quantity, avg_cost, version
            FROM product_inventory
            WHERE product_id = ${item.productId}
            FOR UPDATE
          `;

          const currentActual = currentProdRows.length > 0 ? Number(currentProdRows[0].actual_quantity) : 0;
          const currentReserved = currentProdRows.length > 0 ? Number(currentProdRows[0].reserved_quantity) : 0;
          const currentAvgCost = currentProdRows.length > 0 ? Number(currentProdRows[0].avg_cost) : 0;
          const version = currentProdRows.length > 0 ? currentProdRows[0].version : 1;

          const newActual = Math.max(0, currentActual - qty);
          const newReserved = Math.max(0, currentReserved - qty);

          await tx.productInventory.update({
            where: { productId: item.productId },
            data: {
              actualQuantity: newActual,
              reservedQuantity: newReserved,
              version: version + 1,
            },
          });

          await tx.stockDocumentItem.create({
            data: {
              documentId: stockDoc.id,
              productId: item.productId,
              qtyBefore: currentActual,
              qtyChange: qty,
              qtyAfter: newActual,
              unitCost: currentAvgCost,
              totalCost: qty * currentAvgCost,
            },
          });
        }
      }

      // 2. Chuyển sang CANCELLED: Giải phóng số lượng giữ chỗ (reserved_quantity) và hủy lệnh sản xuất chưa chạy
      if (dto.status === OrderStatus.CANCELLED) {
        for (const item of order.items) {
          const qty = Number(item.quantity);

          const currentProdRows = await tx.$queryRaw<
            Array<{ reserved_quantity: any; version: number }>
          >`
            SELECT reserved_quantity, version
            FROM product_inventory
            WHERE product_id = ${item.productId}
            FOR UPDATE
          `;

          const currentReserved = currentProdRows.length > 0 ? Number(currentProdRows[0].reserved_quantity) : 0;
          const version = currentProdRows.length > 0 ? currentProdRows[0].version : 1;

          await tx.productInventory.update({
            where: { productId: item.productId },
            data: {
              reservedQuantity: Math.max(0, currentReserved - qty),
              version: version + 1,
            },
          });
        }

        // Tự động hủy các lệnh sản xuất MTO gắn với đơn hàng đang ở trạng thái PLANNED hoặc DRAFT
        await tx.productionOrder.updateMany({
          where: {
            linkedOrderId: order.id,
            status: { in: [ProductionStatus.PLANNED, ProductionStatus.DRAFT] },
          },
          data: {
            status: ProductionStatus.CANCELLED,
            notes: `Hủy tự động do đơn hàng ${order.code} đã bị hủy`,
          },
        });
      }

      // 3. Cập nhật Order status
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: dto.status,
          notes: dto.cancellationReason
            ? `${order.notes || ''}\n[Lý do hủy]: ${dto.cancellationReason}`.trim()
            : dto.notes
            ? `${order.notes || ''}\n[Cập nhật]: ${dto.notes}`.trim()
            : order.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_ORDER_STATUS',
          entity: 'ORDER',
          entityId: order.id,
          oldValues: { status: order.status },
          newValues: { status: dto.status, reason: dto.cancellationReason },
        },
      });
    });

    broadcastSyncEvent(WsEvent.ORDER_STATUS_CHANGED, {
      entity: 'ORDER',
      action: 'STATUS_UPDATED',
      timestamp: new Date().toISOString(),
      data: { orderId: order.id, code: order.code, status: dto.status },
    });

    if (dto.status === OrderStatus.COMPLETED || dto.status === OrderStatus.CANCELLED) {
      broadcastSyncEvent(WsEvent.PRODUCT_STOCK_CHANGED, {
        entity: 'PRODUCT_INVENTORY',
        action: dto.status === OrderStatus.COMPLETED ? 'SALE_EXPORTED' : 'STOCK_RELEASED',
        timestamp: new Date().toISOString(),
        data: { orderCode: order.code },
      });
    }

    return this.getOrderById(order.id);
  }

  /**
   * Thêm thanh toán / tiền cọc / hoàn tiền cho đơn hàng với kiểm tra chặt chẽ
   */
  async addPayment(orderId: string, dto: AddPaymentDto, userId: string) {
    if (!dto.amount || dto.amount <= 0) {
      throw new Error('Số tiền thanh toán phải lớn hơn 0');
    }

    const now = new Date();

    const newPayment = await prisma.$transaction(async (tx: any) => {
      // Row lock order để chống race condition khi nhiều thiết bị bấm thanh toán đồng thời
      const orderRows = await tx.$queryRaw<
        Array<{ id: string; code: string; customer_id: string; total_amount: any; paid_amount: any; remaining_amount: any; status: string }>
      >`
        SELECT id, code, customer_id, total_amount, paid_amount, remaining_amount, status
        FROM orders
        WHERE id = ${orderId}
        FOR UPDATE
      `;

      if (orderRows.length === 0) {
        throw new Error('Đơn hàng không tồn tại');
      }

      const order = orderRows[0];
      const currentPaid = Number(order.paid_amount);
      const currentRemaining = Number(order.remaining_amount);
      const currentTotal = Number(order.total_amount);

      if (order.status === OrderStatus.CANCELLED) {
        throw new Error('Không thể thanh toán hoặc hoàn tiền cho đơn hàng đã bị hủy');
      }

      const isRefund = dto.paymentType === PaymentType.REFUND;

      // Kiểm tra hạn mức thanh toán / hoàn tiền
      if (!isRefund) {
        if (dto.amount > currentRemaining) {
          throw new Error(
            `Số tiền thanh toán (${dto.amount.toLocaleString()} đ) không được vượt quá số tiền còn lại của đơn hàng (${currentRemaining.toLocaleString()} đ)`
          );
        }
      } else {
        if (dto.amount > currentPaid) {
          throw new Error(
            `Số tiền hoàn trả (${dto.amount.toLocaleString()} đ) không được vượt quá số tiền khách đã thanh toán (${currentPaid.toLocaleString()} đ)`
          );
        }
      }

      const payPrefix = `TT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const paymentCode = await generateSafeCode(tx, 'payment', payPrefix);

      const sqPrefix = isRefund ? `PC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}` : `PT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const financialCode = await generateSafeCode(tx, 'financialTransaction', sqPrefix);

      const payment = await tx.payment.create({
        data: {
          code: paymentCode,
          orderId: order.id,
          collectedById: userId,
          paymentType: dto.paymentType,
          paymentMethod: dto.paymentMethod,
          amount: dto.amount,
          transactionReference: dto.transactionReference || null,
          notes: dto.notes || `${isRefund ? 'Hoàn tiền' : 'Thanh toán'} cho đơn hàng ${order.code}`,
        },
      });

      // Tạo giao dịch sổ quỹ
      await tx.financialTransaction.create({
        data: {
          code: financialCode,
          flowType: isRefund ? CashFlowType.OUTFLOW : CashFlowType.INFLOW,
          paymentMethod: dto.paymentMethod,
          amount: dto.amount,
          sourceOrderId: order.id,
          paymentId: payment.id,
          performedById: userId,
          description: `${isRefund ? 'Hoàn tiền' : 'Thu tiền'} đơn hàng ${order.code} [${dto.paymentMethod === PaymentMethod.CASH ? 'Tiền mặt' : 'Chuyển khoản'}]`,
        },
      });

      // Cập nhật lại số tiền đã thanh toán và còn lại trên đơn hàng
      const newPaidAmount = isRefund
        ? Math.max(0, currentPaid - dto.amount)
        : currentPaid + dto.amount;

      const newRemaining = Math.max(0, currentTotal - newPaidAmount);

      await tx.order.update({
        where: { id: order.id },
        data: {
          paidAmount: newPaidAmount,
          remainingAmount: newRemaining,
          // Nếu đã thanh toán hết và đang ở PENDING -> tự động chuyển sang CONFIRMED
          status:
            order.status === OrderStatus.PENDING && newPaidAmount > 0 ? OrderStatus.CONFIRMED : order.status,
        },
      });

      // Cập nhật tổng chi tiêu của khách hàng
      await tx.customer.update({
        where: { id: order.customer_id },
        data: {
          totalSpent: isRefund ? { decrement: dto.amount } : { increment: dto.amount },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: isRefund ? 'REFUND_PAYMENT' : 'ADD_PAYMENT',
          entity: 'PAYMENT',
          entityId: payment.id,
          newValues: {
            orderCode: order.code,
            amount: dto.amount,
            paymentType: dto.paymentType,
            method: dto.paymentMethod,
            newPaidAmount,
            newRemaining,
          },
        },
      });

      return payment;
    });

    broadcastSyncEvent(WsEvent.FINANCE_UPDATED, {
      entity: 'FINANCE',
      action: dto.paymentType === PaymentType.REFUND ? 'REFUND_RECORDED' : 'PAYMENT_RECORDED',
      timestamp: new Date().toISOString(),
      data: { orderId: orderId, amount: dto.amount },
    });

    broadcastSyncEvent(WsEvent.ORDER_STATUS_CHANGED, {
      entity: 'ORDER',
      action: 'PAYMENT_UPDATED',
      timestamp: new Date().toISOString(),
      data: { orderId: orderId },
    });

    broadcastSyncEvent(WsEvent.CUSTOMER_UPDATED, {
      entity: 'CUSTOMER',
      action: 'SPENT_UPDATED',
      timestamp: new Date().toISOString(),
      data: { orderId: orderId },
    });

    return this.getOrderById(orderId);
  }
}

export const ordersService = new OrdersService();
