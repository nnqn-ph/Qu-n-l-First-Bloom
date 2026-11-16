import { Router } from 'express';
import { materialsController } from './materials.controller';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';

// 1. Router Danh mục NVL
export const materialCategoriesRouter = Router();
materialCategoriesRouter.use(authenticate);

materialCategoriesRouter.get('/', (req, res) => materialsController.getCategories(req, res));
materialCategoriesRouter.post('/', requireRole('ADMIN'), (req, res) => materialsController.createCategory(req, res));
materialCategoriesRouter.put('/:id', requireRole('ADMIN'), (req, res) => materialsController.updateCategory(req, res));
materialCategoriesRouter.delete('/:id', requireRole('ADMIN'), (req, res) => materialsController.deleteCategory(req, res));

// 2. Router Nguyên vật liệu
export const materialsRouter = Router();
materialsRouter.use(authenticate);

materialsRouter.get('/', (req, res) => materialsController.getMaterials(req, res));
materialsRouter.get('/:id', (req, res) => materialsController.getMaterialById(req, res));
materialsRouter.post('/', requireRole('ADMIN'), (req, res) => materialsController.createMaterial(req, res));
materialsRouter.put('/:id', requireRole('ADMIN'), (req, res) => materialsController.updateMaterial(req, res));
materialsRouter.delete('/:id', requireRole('ADMIN'), (req, res) => materialsController.deleteMaterial(req, res));

// 3. Router Nhà cung cấp
export const suppliersRouter = Router();
suppliersRouter.use(authenticate, requireRole('ADMIN'));

suppliersRouter.get('/', (req, res) => materialsController.getSuppliers(req, res));
suppliersRouter.post('/', (req, res) => materialsController.createSupplier(req, res));
suppliersRouter.put('/:id', (req, res) => materialsController.updateSupplier(req, res));
suppliersRouter.delete('/:id', (req, res) => materialsController.deleteSupplier(req, res));

// 4. Router Phiếu nhập kho (Purchase Receipts)
export const purchaseReceiptsRouter = Router();
purchaseReceiptsRouter.use(authenticate, requireRole('ADMIN'));

purchaseReceiptsRouter.get('/', (req, res) => materialsController.getPurchaseReceipts(req, res));
purchaseReceiptsRouter.get('/:id', (req, res) => materialsController.getPurchaseReceiptById(req, res));
purchaseReceiptsRouter.post('/', (req, res) => materialsController.createPurchaseReceipt(req, res));

// 5. Router Sổ cái & Kiểm kê kho NVL
export const materialInventoryRouter = Router();
materialInventoryRouter.use(authenticate, requireRole('ADMIN'));

materialInventoryRouter.post('/adjust', (req, res) => materialsController.adjustMaterialStock(req, res));
materialInventoryRouter.get('/ledger', (req, res) => materialsController.getMaterialStockLedger(req, res));
