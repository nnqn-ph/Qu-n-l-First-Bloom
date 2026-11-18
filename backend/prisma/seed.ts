import { PrismaClient, ProductType, RecipeItemType, ExpenseType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu gieo dữ liệu mẫu ban đầu (Database Seeding)...');

  // 1. Khởi tạo Roles
  console.log('1. Khởi tạo Roles (ADMIN, STAFF)...');
  await prisma.role.upsert({
    where: { id: 'ADMIN' },
    update: { name: 'Chủ cửa hàng (Admin)', description: 'Toàn quyền quản trị hệ thống First Bloom' },
    create: { id: 'ADMIN', name: 'Chủ cửa hàng (Admin)', description: 'Toàn quyền quản trị hệ thống First Bloom' },
  });

  await prisma.role.upsert({
    where: { id: 'STAFF' },
    update: { name: 'Nhân viên bán hàng (Staff)', description: 'Quản lý đơn hàng, khách hàng và xem tồn kho' },
    create: { id: 'STAFF', name: 'Nhân viên bán hàng (Staff)', description: 'Quản lý đơn hàng, khách hàng và xem tồn kho' },
  });

  // 2. Khởi tạo Users
  console.log('2. Khởi tạo Users mặc định...');
  const adminPasswordHash = await bcrypt.hash('Admin@FirstBloom2026!', 10);
  const staffPasswordHash = await bcrypt.hash('Staff@FirstBloom2026!', 10);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      fullName: 'Chủ Tiệm First Bloom',
      roleId: 'ADMIN',
      phone: '0988123456',
    },
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      fullName: 'Chủ Tiệm First Bloom',
      roleId: 'ADMIN',
      phone: '0988123456',
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { username: 'staff01' },
    update: {
      fullName: 'Nguyễn Thu Ngân',
      roleId: 'STAFF',
      phone: '0912345678',
    },
    create: {
      username: 'staff01',
      passwordHash: staffPasswordHash,
      fullName: 'Nguyễn Thu Ngân',
      roleId: 'STAFF',
      phone: '0912345678',
    },
  });

  // 3. Khởi tạo Danh mục Nguyên vật liệu
  console.log('3. Khởi tạo Danh mục Nguyên vật liệu...');
  const catKem = await prisma.materialCategory.upsert({
    where: { code: 'CAT-KEM' },
    update: { name: 'Kẽm nhung các màu' },
    create: { code: 'CAT-KEM', name: 'Kẽm nhung các màu' },
  });

  const catCanh = await prisma.materialCategory.upsert({
    where: { code: 'CAT-CANH' },
    update: { name: 'Kẽm cành & Thân hoa' },
    create: { code: 'CAT-CANH', name: 'Kẽm cành & Thân hoa' },
  });

  const catGiay = await prisma.materialCategory.upsert({
    where: { code: 'CAT-GIAY' },
    update: { name: 'Giấy gói & Giấy nhún' },
    create: { code: 'CAT-GIAY', name: 'Giấy gói & Giấy nhún' },
  });

  const catPhuKien = await prisma.materialCategory.upsert({
    where: { code: 'CAT-PHUKIEN' },
    update: { name: 'Keo nến, Sáp, Ruy băng' },
    create: { code: 'CAT-PHUKIEN', name: 'Keo nến, Sáp, Ruy băng' },
  });

  // 4. Khởi tạo Nguyên vật liệu & Tồn kho ban đầu
  console.log('4. Khởi tạo Nguyên vật liệu và Sổ kho...');
  const materialsData = [
    { sku: 'NVL-KN-DO', name: 'Kẽm nhung Đỏ đô (bó 100 sợi)', unit: 'bó', defaultPrice: 25000, categoryId: catKem.id, minStockAlert: 5, initialQty: 20, avgCost: 22000 },
    { sku: 'NVL-KN-HONG', name: 'Kẽm nhung Hồng pastel (bó 100 sợi)', unit: 'bó', defaultPrice: 25000, categoryId: catKem.id, minStockAlert: 5, initialQty: 20, avgCost: 22000 },
    { sku: 'NVL-KN-XANH', name: 'Kẽm nhung Xanh rêu làm lá (bó 100 sợi)', unit: 'bó', defaultPrice: 25000, categoryId: catKem.id, minStockAlert: 5, initialQty: 15, avgCost: 22000 },
    { sku: 'NVL-KN-VANG', name: 'Kẽm nhung Vàng chanh làm nhụy (bó 100 sợi)', unit: 'bó', defaultPrice: 25000, categoryId: catKem.id, minStockAlert: 3, initialQty: 10, avgCost: 22000 },
    { sku: 'NVL-KC-40', name: 'Kẽm cành 40cm bọc giấy xanh (bó 50 cây)', unit: 'bó', defaultPrice: 18000, categoryId: catCanh.id, minStockAlert: 5, initialQty: 10, avgCost: 16000 },
    { sku: 'NVL-BKS-XANH', name: 'Băng keo sáp xanh quấn cành', unit: 'cuộn', defaultPrice: 8000, categoryId: catPhuKien.id, minStockAlert: 5, initialQty: 15, avgCost: 7000 },
    { sku: 'NVL-KEO-NEN', name: 'Keo nến nhỏ 7mm', unit: 'cây', defaultPrice: 3000, categoryId: catPhuKien.id, minStockAlert: 20, initialQty: 50, avgCost: 2500 },
    { sku: 'NVL-GG-CREAM', name: 'Giấy gói xi măng / Hàn Quốc kem', unit: 'tờ', defaultPrice: 5000, categoryId: catGiay.id, minStockAlert: 10, initialQty: 30, avgCost: 4500 },
    { sku: 'NVL-RB-HONG', name: 'Ruy băng voan hồng lụa (cuộn 20m)', unit: 'cuộn', defaultPrice: 35000, categoryId: catPhuKien.id, minStockAlert: 2, initialQty: 5, avgCost: 30000 },
  ];

  const materialMap = new Map<string, string>();

  for (const m of materialsData) {
    const mat = await prisma.material.upsert({
      where: { sku: m.sku },
      update: {
        name: m.name,
        unit: m.unit,
        defaultPrice: m.defaultPrice,
        minStockAlert: m.minStockAlert,
        categoryId: m.categoryId,
      },
      create: {
        sku: m.sku,
        name: m.name,
        unit: m.unit,
        defaultPrice: m.defaultPrice,
        minStockAlert: m.minStockAlert,
        categoryId: m.categoryId,
      },
    });

    materialMap.set(m.sku, mat.id);

    await prisma.materialInventory.upsert({
      where: { materialId: mat.id },
      update: {
        quantity: m.initialQty,
        avgCost: m.avgCost,
      },
      create: {
        materialId: mat.id,
        quantity: m.initialQty,
        avgCost: m.avgCost,
      },
    });
  }

  // 5. Khởi tạo Nhà cung cấp
  console.log('5. Khởi tạo Nhà cung cấp mẫu...');
  await prisma.supplier.upsert({
    where: { code: 'NCC-XUONGKEM' },
    update: {
      name: 'Tổng kho Kẽm Nhung Hà Nội - Sỉ Lẻ Toàn Quốc',
      phone: '0903123888',
      address: 'Số 45 Ngõ 120 Hoàng Hoa Thám, Ba Đình, Hà Nội',
      notes: 'Giao hàng nhanh trong 24h, chiết khấu 5% khi đơn trên 2 triệu',
    },
    create: {
      code: 'NCC-XUONGKEM',
      name: 'Tổng kho Kẽm Nhung Hà Nội - Sỉ Lẻ Toàn Quốc',
      phone: '0903123888',
      address: 'Số 45 Ngõ 120 Hoàng Hoa Thám, Ba Đình, Hà Nội',
      notes: 'Giao hàng nhanh trong 24h, chiết khấu 5% khi đơn trên 2 triệu',
    },
  });

  // 6. Khởi tạo Danh mục Sản phẩm & Sản phẩm
  console.log('6. Khởi tạo Danh mục Sản phẩm & Sản phẩm...');
  const catHoaLe = await prisma.productCategory.upsert({
    where: { code: 'CAT-HOA-LE' },
    update: { name: 'Cành hoa lẻ (Bán thành phẩm)' },
    create: { code: 'CAT-HOA-LE', name: 'Cành hoa lẻ (Bán thành phẩm)' },
  });

  const catBoHoa = await prisma.productCategory.upsert({
    where: { code: 'CAT-BO-HOA' },
    update: { name: 'Bó hoa thành phẩm' },
    create: { code: 'CAT-BO-HOA', name: 'Bó hoa thành phẩm' },
  });

  // Tạo Bán thành phẩm: Cành tulip đỏ
  const pTulipCanh = await prisma.product.upsert({
    where: { sku: 'SP-CANH-TULIP-DO' },
    update: {
      name: 'Cành hoa Tulip Đỏ lẻ',
      type: ProductType.INTERMEDIATE,
      sellingPrice: 25000,
      categoryId: catHoaLe.id,
      description: 'Cành tulip làm từ 5 cánh kẽm nhung đỏ, nhụy vàng, đài lá xanh rêu và thân kẽm 40cm',
    },
    create: {
      sku: 'SP-CANH-TULIP-DO',
      name: 'Cành hoa Tulip Đỏ lẻ',
      type: ProductType.INTERMEDIATE,
      sellingPrice: 25000,
      categoryId: catHoaLe.id,
      description: 'Cành tulip làm từ 5 cánh kẽm nhung đỏ, nhụy vàng, đài lá xanh rêu và thân kẽm 40cm',
    },
  });

  await prisma.productInventory.upsert({
    where: { productId: pTulipCanh.id },
    update: { actualQuantity: 25, reservedQuantity: 0, avgCost: 8500 },
    create: { productId: pTulipCanh.id, actualQuantity: 25, reservedQuantity: 0, avgCost: 8500 },
  });

  // Tạo Thành phẩm: Bó hoa Tulip 5 bông
  const pBoTulip5 = await prisma.product.upsert({
    where: { sku: 'SP-BO-TULIP-5' },
    update: {
      name: 'Bó hoa Tulip 5 bông kem đỏ',
      type: ProductType.FINISHED,
      sellingPrice: 180000,
      categoryId: catBoHoa.id,
      description: 'Bó gồm 5 cành tulip phối giấy gói xi măng kem và ruy băng hồng thanh lịch',
    },
    create: {
      sku: 'SP-BO-TULIP-5',
      name: 'Bó hoa Tulip 5 bông kem đỏ',
      type: ProductType.FINISHED,
      sellingPrice: 180000,
      categoryId: catBoHoa.id,
      description: 'Bó gồm 5 cành tulip phối giấy gói xi măng kem và ruy băng hồng thanh lịch',
    },
  });

  await prisma.productInventory.upsert({
    where: { productId: pBoTulip5.id },
    update: { actualQuantity: 5, reservedQuantity: 1, avgCost: 65000 },
    create: { productId: pBoTulip5.id, actualQuantity: 5, reservedQuantity: 1, avgCost: 65000 },
  });

  // 7. Khởi tạo Công thức sản xuất (BOM Đa cấp)
  console.log('7. Khởi tạo Công thức BOM Đa cấp mẫu...');
  // Công thức Cấp 1: Cành Tulip Đỏ (từ NVL thô)
  const recipeTulipCanh = await prisma.recipe.upsert({
    where: {
      productId_version: {
        productId: pTulipCanh.id,
        version: 1,
      },
    },
    update: {
      name: 'Công thức chuẩn: 1 Cành Tulip Đỏ',
      expectedCost: 8500,
      notes: 'Định mức: 5 sợi đỏ (0.05 bó), 1 sợi vàng (0.01 bó), 2 sợi xanh (0.02 bó), 1 thân kẽm (0.02 bó), 0.05 cuộn sáp, 0.5 cây keo nến',
    },
    create: {
      productId: pTulipCanh.id,
      version: 1,
      name: 'Công thức chuẩn: 1 Cành Tulip Đỏ',
      expectedCost: 8500,
      createdById: adminUser.id,
      notes: 'Định mức: 5 sợi đỏ (0.05 bó), 1 sợi vàng (0.01 bó), 2 sợi xanh (0.02 bó), 1 thân kẽm (0.02 bó), 0.05 cuộn sáp, 0.5 cây keo nến',
    },
  });

  // Xóa items cũ của recipe nếu có để tránh duplicate khi re-seed
  await prisma.recipeItem.deleteMany({ where: { recipeId: recipeTulipCanh.id } });
  await prisma.recipeItem.createMany({
    data: [
      { recipeId: recipeTulipCanh.id, itemType: RecipeItemType.MATERIAL, materialId: materialMap.get('NVL-KN-DO')!, quantity: 0.05, lossRate: 2, snapshotCost: 1100 },
      { recipeId: recipeTulipCanh.id, itemType: RecipeItemType.MATERIAL, materialId: materialMap.get('NVL-KN-VANG')!, quantity: 0.01, lossRate: 0, snapshotCost: 220 },
      { recipeId: recipeTulipCanh.id, itemType: RecipeItemType.MATERIAL, materialId: materialMap.get('NVL-KN-XANH')!, quantity: 0.02, lossRate: 2, snapshotCost: 440 },
      { recipeId: recipeTulipCanh.id, itemType: RecipeItemType.MATERIAL, materialId: materialMap.get('NVL-KC-40')!, quantity: 0.02, lossRate: 0, snapshotCost: 320 },
      { recipeId: recipeTulipCanh.id, itemType: RecipeItemType.MATERIAL, materialId: materialMap.get('NVL-BKS-XANH')!, quantity: 0.05, lossRate: 5, snapshotCost: 350 },
      { recipeId: recipeTulipCanh.id, itemType: RecipeItemType.MATERIAL, materialId: materialMap.get('NVL-KEO-NEN')!, quantity: 0.5, lossRate: 0, snapshotCost: 1250 },
    ],
  });

  // Công thức Cấp 2: Bó Hoa Tulip 5 bông (từ Bán thành phẩm + NVL gói)
  const recipeBoTulip5 = await prisma.recipe.upsert({
    where: {
      productId_version: {
        productId: pBoTulip5.id,
        version: 1,
      },
    },
    update: {
      name: 'Công thức chuẩn: 1 Bó Tulip 5 cành kem đỏ',
      expectedCost: 65000,
      notes: 'Bao gồm 5 cành tulip bán thành phẩm + 2 tờ giấy gói xi măng kem + 0.1 cuộn ruy băng',
    },
    create: {
      productId: pBoTulip5.id,
      version: 1,
      name: 'Công thức chuẩn: 1 Bó Tulip 5 cành kem đỏ',
      expectedCost: 65000,
      createdById: adminUser.id,
      notes: 'Bao gồm 5 cành tulip bán thành phẩm + 2 tờ giấy gói xi măng kem + 0.1 cuộn ruy băng',
    },
  });

  await prisma.recipeItem.deleteMany({ where: { recipeId: recipeBoTulip5.id } });
  await prisma.recipeItem.createMany({
    data: [
      { recipeId: recipeBoTulip5.id, itemType: RecipeItemType.SUB_PRODUCT, subProductId: pTulipCanh.id, quantity: 5, lossRate: 0, snapshotCost: 42500 },
      { recipeId: recipeBoTulip5.id, itemType: RecipeItemType.MATERIAL, materialId: materialMap.get('NVL-GG-CREAM')!, quantity: 2, lossRate: 5, snapshotCost: 9000 },
      { recipeId: recipeBoTulip5.id, itemType: RecipeItemType.MATERIAL, materialId: materialMap.get('NVL-RB-HONG')!, quantity: 0.1, lossRate: 0, snapshotCost: 3000 },
    ],
  });

  // 8. Khởi tạo Danh mục Chi phí
  console.log('8. Khởi tạo Danh mục Chi phí...');
  const expenseCats = [
    { code: 'EXP-MAT', name: 'Tiền mua nguyên vật liệu', type: ExpenseType.MATERIAL_PURCHASE },
    { code: 'EXP-RENT', name: 'Chi phí thuê mặt bằng', type: ExpenseType.OPERATING },
    { code: 'EXP-UTIL', name: 'Điện, nước, internet', type: ExpenseType.OPERATING },
    { code: 'EXP-SHIP', name: 'Chi phí vận chuyển đối tác', type: ExpenseType.SHIPPING },
    { code: 'EXP-PACK', name: 'Túi bóng, bao bì, phụ kiện', type: ExpenseType.PACKAGING },
    { code: 'EXP-MKT', name: 'Quảng cáo & Marketing', type: ExpenseType.OPERATING },
    { code: 'EXP-MISC', name: 'Chi phí phát sinh khác', type: ExpenseType.OTHER },
  ];

  for (const ec of expenseCats) {
    await prisma.expenseCategory.upsert({
      where: { code: ec.code },
      update: { name: ec.name, type: ec.type },
      create: { code: ec.code, name: ec.name, type: ec.type },
    });
  }

  // 9. Khởi tạo Khách hàng mẫu
  console.log('9. Khởi tạo Khách hàng mẫu...');
  await prisma.customer.upsert({
    where: { phone: '0977889900' },
    update: {
      fullName: 'Trần Thị Mai Phương',
      address: 'Số 12 Chùa Bộc, Đống Đa, Hà Nội',
      notes: 'Khách quen thích hoa tông màu pastel nhẹ nhàng',
    },
    create: {
      code: 'KH-001',
      fullName: 'Trần Thị Mai Phương',
      phone: '0977889900',
      address: 'Số 12 Chùa Bộc, Đống Đa, Hà Nội',
      notes: 'Khách quen thích hoa tông màu pastel nhẹ nhàng',
    },
  });

  // 10. Khởi tạo Settings hệ thống
  console.log('10. Khởi tạo Settings hệ thống...');
  await prisma.setting.upsert({
    where: { key: 'SHOP_INFO' },
    update: {
      value: {
        shopName: 'First Bloom – Handmade Flowers & Gifts',
        address: 'Hà Nội, Việt Nam',
        hotline: '0988 123 456',
        currency: 'VND',
        defaultDepositRate: 0.5,
      },
      description: 'Thông tin cơ bản của tiệm hoa First Bloom',
    },
    create: {
      key: 'SHOP_INFO',
      value: {
        shopName: 'First Bloom – Handmade Flowers & Gifts',
        address: 'Hà Nội, Việt Nam',
        hotline: '0988 123 456',
        currency: 'VND',
        defaultDepositRate: 0.5,
      },
      description: 'Thông tin cơ bản của tiệm hoa First Bloom',
    },
  });

  console.log('✅ Hoàn tất gieo dữ liệu khởi đầu thành công!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi gieo dữ liệu seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
