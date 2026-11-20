import { prisma } from '../../config/prisma';
import {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  ProductFilterDto,
  CreateRecipeDto,
  SimulateRecipeCostDto,
  RecipeItemDto,
} from './products.dto';
import { RecipeItemType } from '@prisma/client';
import { broadcastSyncEvent, WsEvent } from '../../websocket/socket.server';
import { generateSafeCode } from '../../common/code-generator';

export class ProductsService {
  // ==========================================
  // 1. DANH MỤC SẢN PHẨM (PRODUCT CATEGORIES)
  // ==========================================

  async getProductCategories() {
    return prisma.productCategory.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            products: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createProductCategory(dto: CreateProductCategoryDto, userId: string) {
    let code = dto.code?.trim();
    if (!code) {
      const now = new Date();
      const prefix = `DM-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      code = await generateSafeCode(prisma, 'productCategory', prefix);
    } else {
      code = code.toUpperCase();
      const existing = await prisma.productCategory.findFirst({
        where: {
          code,
          deletedAt: null,
        },
      });

      if (existing) {
        throw new Error(`Mã danh mục '${code}' đã tồn tại trong hệ thống`);
      }
    }

    const category = await prisma.productCategory.create({
      data: {
        code,
        name: dto.name.trim(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_PRODUCT_CATEGORY',
        entity: 'PRODUCT_CATEGORY',
        entityId: category.id,
        newValues: category,
      },
    });

    broadcastSyncEvent(WsEvent.PRODUCT_UPDATED, {
      entity: 'PRODUCT_CATEGORY',
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      data: { categoryId: category.id },
    });

    return category;
  }

  async updateProductCategory(id: string, dto: UpdateProductCategoryDto, userId: string) {
    const category = await prisma.productCategory.findUnique({
      where: { id },
    });

    if (!category || category.deletedAt !== null) {
      throw new Error('Danh mục sản phẩm không tồn tại');
    }

    if (dto.code && dto.code.toUpperCase() !== category.code) {
      const existing = await prisma.productCategory.findFirst({
        where: {
          code: dto.code.toUpperCase(),
          id: { not: id },
          deletedAt: null,
        },
      });
      if (existing) {
        throw new Error(`Mã danh mục '${dto.code}' đã được sử dụng`);
      }
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.toUpperCase() : undefined,
        name: dto.name,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_PRODUCT_CATEGORY',
        entity: 'PRODUCT_CATEGORY',
        entityId: id,
        oldValues: category,
        newValues: updated,
      },
    });

    broadcastSyncEvent(WsEvent.PRODUCT_UPDATED, {
      entity: 'PRODUCT_CATEGORY',
      action: 'UPDATED',
      timestamp: new Date().toISOString(),
      data: { categoryId: id },
    });

    return updated;
  }

  async deleteProductCategory(id: string, userId: string) {
    const category = await prisma.productCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: { where: { deletedAt: null } } },
        },
      },
    });

    if (!category || category.deletedAt !== null) {
      throw new Error('Danh mục không tồn tại');
    }

    if (category._count.products > 0) {
      throw new Error(
        `Không thể xóa danh mục này vì vẫn còn ${category._count.products} sản phẩm đang trực thuộc`
      );
    }

    const deleted = await prisma.productCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_PRODUCT_CATEGORY',
        entity: 'PRODUCT_CATEGORY',
        entityId: id,
        oldValues: category,
      },
    });

    broadcastSyncEvent(WsEvent.PRODUCT_UPDATED, {
      entity: 'PRODUCT_CATEGORY',
      action: 'DELETED',
      timestamp: new Date().toISOString(),
      data: { categoryId: id },
    });

    return deleted;
  }

  // ==========================================
  // 2. SẢN PHẨM & BÁN THÀNH PHẨM (PRODUCTS)
  // ==========================================

  async getProducts(filters?: ProductFilterDto, isStaff = false) {
    const where: any = {
      deletedAt: null,
    };

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, code: true, name: true },
        },
        inventory: {
          select: {
            actualQuantity: true,
            reservedQuantity: true,
            avgCost: true,
          },
        },
        recipes: {
          where: { isActive: true },
          select: {
            id: true,
            version: true,
            name: true,
            expectedCost: true,
            _count: { select: { items: true } },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((p: any) => {
      const actualQty = p.inventory ? Number(p.inventory.actualQuantity) : 0;
      const reservedQty = p.inventory ? Number(p.inventory.reservedQuantity) : 0;
      const availableQty = Math.max(0, actualQty - reservedQty);
      const activeRecipe = p.recipes.length > 0 ? p.recipes[0] : null;
      const sellingPrice = Number(p.sellingPrice);
      const expectedCost = activeRecipe ? Number(activeRecipe.expectedCost) : 0;
      const grossMargin = sellingPrice > 0 ? ((sellingPrice - expectedCost) / sellingPrice) * 100 : 0;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        imageUrl: p.imageUrl,
        type: p.type,
        sellingPrice,
        description: p.description,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        category: p.category,
        inventory: {
          actualQuantity: actualQty,
          reservedQuantity: reservedQty,
          availableQuantity: availableQty,
          avgCost: isStaff ? undefined : p.inventory ? Number(p.inventory.avgCost) : 0,
        },
        activeRecipe: isStaff
          ? undefined
          : activeRecipe
          ? {
              id: activeRecipe.id,
              version: activeRecipe.version,
              name: activeRecipe.name,
              expectedCost,
              itemsCount: activeRecipe._count.items,
              grossMarginPercent: Number(grossMargin.toFixed(1)),
            }
          : null,
      };
    });
  }

  async getProductById(id: string, isStaff = false) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        inventory: true,
        recipes: {
          orderBy: { version: 'desc' },
          include: {
            createdBy: { select: { id: true, fullName: true, username: true } },
            items: {
              include: {
                material: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                    unit: true,
                    inventory: { select: { avgCost: true, quantity: true } },
                  },
                },
                subProduct: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                    type: true,
                    sellingPrice: true,
                    inventory: { select: { avgCost: true, actualQuantity: true } },
                  },
                },
              },
            },
          },
        },
        recipeItemsAsSubProduct: {
          select: {
            recipe: {
              select: {
                id: true,
                name: true,
                product: { select: { id: true, sku: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!product || product.deletedAt !== null) {
      throw new Error('Sản phẩm không tồn tại');
    }

    const actualQty = product.inventory ? Number(product.inventory.actualQuantity) : 0;
    const reservedQty = product.inventory ? Number(product.inventory.reservedQuantity) : 0;
    const availableQty = Math.max(0, actualQty - reservedQty);
    const sellingPrice = Number(product.sellingPrice);

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      imageUrl: product.imageUrl,
      type: product.type,
      sellingPrice,
      description: product.description,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      category: product.category,
      inventory: {
        actualQuantity: actualQty,
        reservedQuantity: reservedQty,
        availableQuantity: availableQty,
        avgCost: isStaff ? undefined : product.inventory ? Number(product.inventory.avgCost) : 0,
      },
      recipes: isStaff
        ? undefined
        : product.recipes.map((r: any) => ({
            id: r.id,
            version: r.version,
            name: r.name,
            isActive: r.isActive,
            expectedCost: Number(r.expectedCost),
            notes: r.notes,
            createdBy: r.createdBy,
            createdAt: r.createdAt,
            items: r.items.map((it: any) => ({
              id: it.id,
              itemType: it.itemType,
              materialId: it.materialId,
              subProductId: it.subProductId,
              quantity: Number(it.quantity),
              lossRate: Number(it.lossRate),
              snapshotCost: Number(it.snapshotCost),
              material: it.material
                ? {
                    id: it.material.id,
                    sku: it.material.sku,
                    name: it.material.name,
                    unit: it.material.unit,
                    currentAvgCost: it.material.inventory ? Number(it.material.inventory.avgCost) : 0,
                    inStock: it.material.inventory ? Number(it.material.inventory.quantity) : 0,
                  }
                : null,
              subProduct: it.subProduct
                ? {
                    id: it.subProduct.id,
                    sku: it.subProduct.sku,
                    name: it.subProduct.name,
                    type: it.subProduct.type,
                    currentAvgCost: it.subProduct.inventory ? Number(it.subProduct.inventory.avgCost) : 0,
                    inStock: it.subProduct.inventory ? Number(it.subProduct.inventory.actualQuantity) : 0,
                  }
                : null,
            })),
          })),
      usedInParentProducts: isStaff
        ? undefined
        : product.recipeItemsAsSubProduct.map((ri: any) => ({
            recipeId: ri.recipe.id,
            recipeName: ri.recipe.name,
            parentProductId: ri.recipe.product.id,
            parentProductSku: ri.recipe.product.sku,
            parentProductName: ri.recipe.product.name,
          })),
    };
  }

  async createProduct(dto: CreateProductDto, userId: string) {
    // 1. Tự động sinh mã SKU nếu không truyền hoặc để trống
    let sku = dto.sku?.trim();
    if (!sku) {
      const now = new Date();
      const prefix = `SP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      sku = await generateSafeCode(prisma, 'product', prefix);
    } else {
      sku = sku.toUpperCase();
      const existingSku = await prisma.product.findFirst({
        where: {
          sku,
          deletedAt: null,
        },
      });

      if (existingSku) {
        throw new Error(`Mã sản phẩm '${dto.sku}' đã tồn tại trong danh mục`);
      }
    }

    // 2. Tự động gán danh mục nếu chưa truyền hoặc danh sách rỗng
    let categoryId = dto.categoryId?.trim();
    if (!categoryId) {
      const firstCat = await prisma.productCategory.findFirst({
        where: { deletedAt: null },
      });
      if (firstCat) {
        categoryId = firstCat.id;
      } else {
        const defaultCat = await prisma.productCategory.create({
          data: {
            code: 'DM-HOA',
            name: 'Hoa thành phẩm',
          },
        });
        categoryId = defaultCat.id;
      }
    } else {
      const category = await prisma.productCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category || category.deletedAt !== null) {
        throw new Error('Danh mục sản phẩm không tồn tại');
      }
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const product = await tx.product.create({
        data: {
          categoryId,
          sku,
          name: dto.name.trim(),
          imageUrl: dto.imageUrl?.trim() || null,
          type: dto.type || 'FINISHED',
          sellingPrice: dto.sellingPrice,
          description: dto.description?.trim() || null,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        },
        include: { category: true },
      });

      const inventory = await tx.productInventory.create({
        data: {
          productId: product.id,
          actualQuantity: 0,
          reservedQuantity: 0,
          avgCost: 0,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_PRODUCT',
          entity: 'PRODUCT',
          entityId: product.id,
          newValues: {
            sku: product.sku,
            name: product.name,
            type: product.type,
            sellingPrice: product.sellingPrice,
          },
        },
      });

      return { product, inventory };
    });

    broadcastSyncEvent(WsEvent.PRODUCT_UPDATED, {
      entity: 'PRODUCT',
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      data: { productId: result.product.id, sku: result.product.sku },
    });

    return {
      ...result.product,
      sellingPrice: Number(result.product.sellingPrice),
      inventory: {
        actualQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        avgCost: 0,
      },
    };
  }

  async updateProduct(id: string, dto: UpdateProductDto, userId: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });

    if (!product || product.deletedAt !== null) {
      throw new Error('Sản phẩm không tồn tại');
    }

    if (dto.sku && dto.sku.toUpperCase() !== product.sku) {
      const existingSku = await prisma.product.findFirst({
        where: {
          sku: dto.sku.toUpperCase(),
          id: { not: id },
          deletedAt: null,
        },
      });
      if (existingSku) {
        throw new Error(`Mã SKU '${dto.sku}' đã được sử dụng bởi sản phẩm khác`);
      }
    }

    if (dto.categoryId && dto.categoryId !== product.categoryId) {
      const category = await prisma.productCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category || category.deletedAt !== null) {
        throw new Error('Danh mục sản phẩm không tồn tại');
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        sku: dto.sku ? dto.sku.toUpperCase() : undefined,
        name: dto.name,
        imageUrl: dto.imageUrl !== undefined ? dto.imageUrl || null : undefined,
        type: dto.type,
        sellingPrice: dto.sellingPrice !== undefined ? dto.sellingPrice : undefined,
        description: dto.description !== undefined ? dto.description || null : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
      include: {
        category: true,
        inventory: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_PRODUCT',
        entity: 'PRODUCT',
        entityId: id,
        oldValues: product,
        newValues: updated,
      },
    });

    broadcastSyncEvent(WsEvent.PRODUCT_UPDATED, {
      entity: 'PRODUCT',
      action: 'UPDATED',
      timestamp: new Date().toISOString(),
      data: { productId: id, sku: updated.sku },
    });

    const actualQty = updated.inventory ? Number(updated.inventory.actualQuantity) : 0;
    const reservedQty = updated.inventory ? Number(updated.inventory.reservedQuantity) : 0;

    return {
      ...updated,
      sellingPrice: Number(updated.sellingPrice),
      inventory: {
        actualQuantity: actualQty,
        reservedQuantity: reservedQty,
        availableQuantity: Math.max(0, actualQty - reservedQty),
        avgCost: updated.inventory ? Number(updated.inventory.avgCost) : 0,
      },
    };
  }

  async deleteProduct(id: string, userId: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        inventory: true,
        recipeItemsAsSubProduct: {
          include: {
            recipe: {
              include: { product: true },
            },
          },
        },
        _count: {
          select: {
            orderItems: true,
            productionOrders: true,
          },
        },
      },
    });

    if (!product || product.deletedAt !== null) {
      throw new Error('Sản phẩm không tồn tại');
    }

    if (product.recipeItemsAsSubProduct.length > 0) {
      const parents = product.recipeItemsAsSubProduct
        .map((ri: any) => `[${ri.recipe.product.sku} - ${ri.recipe.product.name}]`)
        .slice(0, 3)
        .join(', ');
      throw new Error(
        `Không thể xóa sản phẩm này vì đang được sử dụng làm bán thành phẩm trong công thức của: ${parents}`
      );
    }

    if (product.inventory && Number(product.inventory.actualQuantity) > 0) {
      throw new Error(
        `Không thể xóa sản phẩm vì trong kho vẫn còn ${product.inventory.actualQuantity} sản phẩm. Hãy điều chỉnh kho về 0 trước khi xóa hoặc chuyển trạng thái thành Ngừng kinh doanh.`
      );
    }

    const deleted = await prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_PRODUCT',
        entity: 'PRODUCT',
        entityId: id,
        oldValues: product,
      },
    });

    broadcastSyncEvent(WsEvent.PRODUCT_UPDATED, {
      entity: 'PRODUCT',
      action: 'DELETED',
      timestamp: new Date().toISOString(),
      data: { productId: id },
    });

    return deleted;
  }

  // ==========================================
  // 3. THUẬT TOÁN PHÁT HIỆN VÒNG LẶP BOM (CYCLE DETECTION - DFS)
  // ==========================================

  async detectBomCycle(
    targetProductId: string,
    subProductId: string,
    visitedPath: string[] = []
  ): Promise<string[] | null> {
    if (targetProductId === subProductId) {
      return [...visitedPath, subProductId, targetProductId];
    }

    const currentPath = [...visitedPath, subProductId];

    const subRecipes = await prisma.recipe.findMany({
      where: { productId: subProductId, isActive: true },
      include: {
        items: {
          where: { itemType: RecipeItemType.SUB_PRODUCT },
          select: { subProductId: true },
        },
      },
    });

    for (const recipe of subRecipes) {
      for (const item of recipe.items) {
        if (item.subProductId) {
          if (item.subProductId === targetProductId) {
            return [...currentPath, item.subProductId];
          }
          if (visitedPath.includes(item.subProductId)) {
            continue;
          }
          const cycleFound = await this.detectBomCycle(targetProductId, item.subProductId, currentPath);
          if (cycleFound) {
            return cycleFound;
          }
        }
      }
    }

    return null;
  }

  // ==========================================
  // 4. TÍNH TOÁN GIÁ VỐN ƯỚC TÍNH (COST ESTIMATION)
  // ==========================================

  async computeItemsCost(items: RecipeItemDto[]): Promise<{
    calculatedItems: Array<{
      itemType: RecipeItemType;
      materialId?: string;
      subProductId?: string;
      quantity: number;
      lossRate: number;
      unitCost: number;
      effectiveQuantity: number;
      lineCost: number;
      name: string;
      sku: string;
      unit: string;
    }>;
    totalExpectedCost: number;
  }> {
    let totalExpectedCost = 0;
    const calculatedItems = [];

    for (const item of items) {
      const quantity = item.quantity;
      const lossRate = item.lossRate || 0;
      const effectiveQuantity = quantity * (1 + lossRate / 100);

      if (item.itemType === RecipeItemType.MATERIAL && item.materialId) {
        const material = await prisma.material.findUnique({
          where: { id: item.materialId },
          include: { inventory: true },
        });

        if (!material || material.deletedAt !== null) {
          throw new Error(`Nguyên vật liệu ID '${item.materialId}' không tồn tại hoặc đã bị xóa`);
        }

        const unitCost =
          material.inventory && Number(material.inventory.avgCost) > 0
            ? Number(material.inventory.avgCost)
            : Number(material.defaultPrice);

        const lineCost = effectiveQuantity * unitCost;
        totalExpectedCost += lineCost;

        calculatedItems.push({
          itemType: RecipeItemType.MATERIAL,
          materialId: material.id,
          name: material.name,
          sku: material.sku,
          unit: material.unit,
          quantity,
          lossRate,
          effectiveQuantity: Number(effectiveQuantity.toFixed(4)),
          unitCost,
          lineCost: Number(lineCost.toFixed(2)),
        });
      } else if (item.itemType === RecipeItemType.SUB_PRODUCT && item.subProductId) {
        const subProduct = await prisma.product.findUnique({
          where: { id: item.subProductId },
          include: {
            inventory: true,
            recipes: {
              where: { isActive: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        });

        if (!subProduct || subProduct.deletedAt !== null) {
          throw new Error(`Bán thành phẩm ID '${item.subProductId}' không tồn tại hoặc đã bị xóa`);
        }

        let unitCost = 0;
        if (subProduct.recipes.length > 0 && Number(subProduct.recipes[0].expectedCost) > 0) {
          unitCost = Number(subProduct.recipes[0].expectedCost);
        } else if (subProduct.inventory && Number(subProduct.inventory.avgCost) > 0) {
          unitCost = Number(subProduct.inventory.avgCost);
        } else {
          unitCost = Number(subProduct.sellingPrice);
        }

        const lineCost = effectiveQuantity * unitCost;
        totalExpectedCost += lineCost;

        calculatedItems.push({
          itemType: RecipeItemType.SUB_PRODUCT,
          subProductId: subProduct.id,
          name: subProduct.name,
          sku: subProduct.sku,
          unit: 'cái',
          quantity,
          lossRate,
          effectiveQuantity: Number(effectiveQuantity.toFixed(4)),
          unitCost,
          lineCost: Number(lineCost.toFixed(2)),
        });
      }
    }

    return {
      calculatedItems,
      totalExpectedCost: Number(totalExpectedCost.toFixed(2)),
    };
  }

  // ==========================================
  // 5. QUẢN LÝ CÔNG THỨC SẢN XUẤT (RECIPES / BOM)
  // ==========================================

  async getAllRecipes(filters?: { productId?: string; search?: string }) {
    const where: any = {};
    if (filters?.productId) {
      where.productId = filters.productId;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { product: { name: { contains: filters.search, mode: 'insensitive' } } },
        { product: { sku: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            type: true,
            sellingPrice: true,
            category: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, fullName: true, username: true } },
        _count: { select: { items: true, productionOrders: true } },
      },
      orderBy: [{ productId: 'asc' }, { version: 'desc' }],
    });

    return recipes.map((r: any) => {
      const sellingPrice = Number(r.product.sellingPrice);
      const expectedCost = Number(r.expectedCost);
      const grossMargin = sellingPrice > 0 ? ((sellingPrice - expectedCost) / sellingPrice) * 100 : 0;

      return {
        id: r.id,
        productId: r.productId,
        version: r.version,
        name: r.name,
        isActive: r.isActive,
        expectedCost,
        notes: r.notes,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
        product: {
          ...r.product,
          sellingPrice,
        },
        itemsCount: r._count.items,
        productionOrdersCount: r._count.productionOrders,
        grossMarginPercent: Number(grossMargin.toFixed(1)),
      };
    });
  }

  async getRecipeById(id: string) {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
            inventory: true,
          },
        },
        createdBy: { select: { id: true, fullName: true, username: true } },
        items: {
          include: {
            material: {
              include: { inventory: true },
            },
            subProduct: {
              include: {
                inventory: true,
                recipes: { where: { isActive: true }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (!recipe) {
      throw new Error('Công thức không tồn tại');
    }

    const sellingPrice = Number(recipe.product.sellingPrice);
    const expectedCost = Number(recipe.expectedCost);
    const grossMargin = sellingPrice > 0 ? ((sellingPrice - expectedCost) / sellingPrice) * 100 : 0;

    let currentLiveTotalCost = 0;

    const formattedItems = recipe.items.map((it: any) => {
      const quantity = Number(it.quantity);
      const lossRate = Number(it.lossRate);
      const effectiveQty = quantity * (1 + lossRate / 100);
      let currentUnitCost = 0;
      let itemName = '';
      let itemSku = '';
      let itemUnit = '';

      if (it.itemType === RecipeItemType.MATERIAL && it.material) {
        itemName = it.material.name;
        itemSku = it.material.sku;
        itemUnit = it.material.unit;
        currentUnitCost =
          it.material.inventory && Number(it.material.inventory.avgCost) > 0
            ? Number(it.material.inventory.avgCost)
            : Number(it.material.defaultPrice);
      } else if (it.itemType === RecipeItemType.SUB_PRODUCT && it.subProduct) {
        itemName = it.subProduct.name;
        itemSku = it.subProduct.sku;
        itemUnit = 'cái';
        if (it.subProduct.recipes.length > 0 && Number(it.subProduct.recipes[0].expectedCost) > 0) {
          currentUnitCost = Number(it.subProduct.recipes[0].expectedCost);
        } else if (it.subProduct.inventory && Number(it.subProduct.inventory.avgCost) > 0) {
          currentUnitCost = Number(it.subProduct.inventory.avgCost);
        } else {
          currentUnitCost = Number(it.subProduct.sellingPrice);
        }
      }

      const liveLineCost = effectiveQty * currentUnitCost;
      currentLiveTotalCost += liveLineCost;

      return {
        id: it.id,
        itemType: it.itemType,
        materialId: it.materialId,
        subProductId: it.subProductId,
        name: itemName,
        sku: itemSku,
        unit: itemUnit,
        quantity,
        lossRate,
        effectiveQuantity: Number(effectiveQty.toFixed(4)),
        snapshotCost: Number(it.snapshotCost),
        currentLiveUnitCost: currentUnitCost,
        currentLiveLineCost: Number(liveLineCost.toFixed(2)),
      };
    });

    return {
      id: recipe.id,
      productId: recipe.productId,
      version: recipe.version,
      name: recipe.name,
      isActive: recipe.isActive,
      expectedCost,
      currentLiveTotalCost: Number(currentLiveTotalCost.toFixed(2)),
      costDifference: Number((currentLiveTotalCost - expectedCost).toFixed(2)),
      grossMarginPercent: Number(grossMargin.toFixed(1)),
      grossProfit: Number((sellingPrice - expectedCost).toFixed(2)),
      notes: recipe.notes,
      createdAt: recipe.createdAt,
      createdBy: recipe.createdBy,
      product: {
        id: recipe.product.id,
        sku: recipe.product.sku,
        name: recipe.product.name,
        type: recipe.product.type,
        sellingPrice,
        category: recipe.product.category,
      },
      items: formattedItems,
    };
  }

  async simulateRecipeCost(dto: SimulateRecipeCostDto) {
    const { calculatedItems, totalExpectedCost } = await this.computeItemsCost(dto.items);

    let sellingPrice = 0;
    if (dto.productId) {
      const prod = await prisma.product.findUnique({ where: { id: dto.productId } });
      if (prod) {
        sellingPrice = Number(prod.sellingPrice);
      }
    }

    const grossProfit = sellingPrice - totalExpectedCost;
    const grossMarginPercent = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

    return {
      items: calculatedItems,
      totalExpectedCost,
      sellingPrice,
      grossProfit: Number(grossProfit.toFixed(2)),
      grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
    };
  }

  async createRecipe(dto: CreateRecipeDto, userId: string) {
    const product = await prisma.product.findUnique({
      where: { id: dto.productId },
      include: { recipes: { orderBy: { version: 'desc' } } },
    });

    if (!product || product.deletedAt !== null) {
      throw new Error('Sản phẩm không tồn tại');
    }

    // Kiểm tra chu trình lặp BOM (Cycle Detection)
    for (const item of dto.items) {
      if (item.itemType === RecipeItemType.SUB_PRODUCT && item.subProductId) {
        if (item.subProductId === dto.productId) {
          throw new Error('Không thể thêm chính sản phẩm này làm bán thành phẩm của chính nó!');
        }

        const cycle = await this.detectBomCycle(dto.productId, item.subProductId);
        if (cycle) {
          const pathNames = await Promise.all(
            cycle.map(async (pId) => {
              const p = await prisma.product.findUnique({ where: { id: pId }, select: { sku: true, name: true } });
              return p ? `${p.sku} (${p.name})` : pId;
            })
          );
          throw new Error(
            `Phát hiện chu trình lặp vô hạn trong công thức định mức (BOM Cycle Detected): ${pathNames.join(' ➔ ')}. Vui lòng kiểm tra lại cấu trúc cây sản phẩm!`
          );
        }
      }
    }

    const { calculatedItems, totalExpectedCost } = await this.computeItemsCost(dto.items);
    const nextVersion = product.recipes.length > 0 ? product.recipes[0].version + 1 : 1;

    const newRecipe = await prisma.$transaction(async (tx: any) => {
      if (dto.isActive) {
        await tx.recipe.updateMany({
          where: { productId: dto.productId },
          data: { isActive: false },
        });
      }

      const recipe = await tx.recipe.create({
        data: {
          productId: dto.productId,
          version: nextVersion,
          name: dto.name,
          expectedCost: totalExpectedCost,
          notes: dto.notes || null,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
          createdById: userId,
        },
      });

      for (const calcItem of calculatedItems) {
        await tx.recipeItem.create({
          data: {
            recipeId: recipe.id,
            itemType: calcItem.itemType,
            materialId: calcItem.materialId || null,
            subProductId: calcItem.subProductId || null,
            quantity: calcItem.quantity,
            lossRate: calcItem.lossRate,
            snapshotCost: calcItem.unitCost,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_RECIPE',
          entity: 'RECIPE',
          entityId: recipe.id,
          newValues: {
            productSku: product.sku,
            version: recipe.version,
            name: recipe.name,
            expectedCost: totalExpectedCost,
            itemsCount: calculatedItems.length,
          },
        },
      });

      return recipe;
    });

    broadcastSyncEvent(WsEvent.RECIPE_UPDATED, {
      entity: 'RECIPE',
      action: 'CREATED',
      timestamp: new Date().toISOString(),
      data: { recipeId: newRecipe.id, productId: dto.productId },
    });

    return this.getRecipeById(newRecipe.id);
  }

  async setActiveRecipe(productId: string, recipeId: string, userId: string) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { product: true },
    });

    if (!recipe || recipe.productId !== productId) {
      throw new Error('Công thức không thuộc về sản phẩm này');
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.recipe.updateMany({
        where: { productId },
        data: { isActive: false },
      });

      await tx.recipe.update({
        where: { id: recipeId },
        data: { isActive: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'SET_ACTIVE_RECIPE',
          entity: 'RECIPE',
          entityId: recipeId,
          newValues: { version: recipe.version, name: recipe.name },
        },
      });
    });

    broadcastSyncEvent(WsEvent.RECIPE_UPDATED, {
      entity: 'RECIPE',
      action: 'ACTIVE_CHANGED',
      timestamp: new Date().toISOString(),
      data: { recipeId, productId },
    });

    return { success: true, message: `Đã thiết lập công thức v${recipe.version} làm công thức chuẩn` };
  }
}

export const productsService = new ProductsService();
