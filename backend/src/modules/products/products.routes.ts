import { Router } from 'express';
import { productsController } from './products.controller';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';

const router = Router();

// ==========================================
// 1. DANH MỤC SẢN PHẨM
// ==========================================
router.get(
  '/product-categories',
  authenticate,
  productsController.getCategories.bind(productsController)
);

router.post(
  '/product-categories',
  authenticate,
  requireRole('ADMIN'),
  productsController.createCategory.bind(productsController)
);

router.patch(
  '/product-categories/:id',
  authenticate,
  requireRole('ADMIN'),
  productsController.updateCategory.bind(productsController)
);

router.delete(
  '/product-categories/:id',
  authenticate,
  requireRole('ADMIN'),
  productsController.deleteCategory.bind(productsController)
);

// ==========================================
// 2. SẢN PHẨM & BÁN THÀNH PHẨM
// ==========================================
router.get(
  '/products',
  authenticate,
  productsController.getProducts.bind(productsController)
);

router.get(
  '/products/:id',
  authenticate,
  productsController.getProductById.bind(productsController)
);

router.post(
  '/products',
  authenticate,
  requireRole('ADMIN'),
  productsController.createProduct.bind(productsController)
);

router.patch(
  '/products/:id',
  authenticate,
  requireRole('ADMIN'),
  productsController.updateProduct.bind(productsController)
);

router.delete(
  '/products/:id',
  authenticate,
  requireRole('ADMIN'),
  productsController.deleteProduct.bind(productsController)
);

// ==========================================
// 3. CÔNG THỨC SẢN XUẤT (RECIPES / BOM)
// ==========================================
router.get(
  '/recipes',
  authenticate,
  requireRole('ADMIN'),
  productsController.getAllRecipes.bind(productsController)
);

router.get(
  '/recipes/:id',
  authenticate,
  requireRole('ADMIN'),
  productsController.getRecipeById.bind(productsController)
);

router.post(
  '/recipes/simulate-cost',
  authenticate,
  requireRole('ADMIN'),
  productsController.simulateCost.bind(productsController)
);

router.post(
  '/recipes',
  authenticate,
  requireRole('ADMIN'),
  productsController.createRecipe.bind(productsController)
);

router.patch(
  '/products/:productId/recipes/:recipeId/activate',
  authenticate,
  requireRole('ADMIN'),
  productsController.setActiveRecipe.bind(productsController)
);

export default router;
