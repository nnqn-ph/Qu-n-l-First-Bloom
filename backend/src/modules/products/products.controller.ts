import { Request, Response } from 'express';
import { productsService } from './products.service';
import {
  createProductCategorySchema,
  updateProductCategorySchema,
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
  createRecipeSchema,
  simulateRecipeCostSchema,
} from './products.dto';
import { sendSuccess, sendError } from '../../common/response';

export class ProductsController {
  // ==========================================
  // 1. DANH MỤC SẢN PHẨM
  // ==========================================

  async getCategories(req: Request, res: Response) {
    try {
      const categories = await productsService.getProductCategories();
      return sendSuccess(res, categories, 'Lấy danh mục sản phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const parsed = createProductCategorySchema.parse(req.body);
      const category = await productsService.createProductCategory(parsed, req.user!.id);
      return sendSuccess(res, category, 'Tạo danh mục sản phẩm thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const parsed = updateProductCategorySchema.parse(req.body);
      const category = await productsService.updateProductCategory(req.params.id, parsed, req.user!.id);
      return sendSuccess(res, category, 'Cập nhật danh mục sản phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      await productsService.deleteProductCategory(req.params.id, req.user!.id);
      return sendSuccess(res, null, 'Đã xóa danh mục sản phẩm');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  // ==========================================
  // 2. SẢN PHẨM & BÁN THÀNH PHẨM
  // ==========================================

  async getProducts(req: Request, res: Response) {
    try {
      const parsedFilters = productFilterSchema.parse(req.query);
      const isStaff = req.user?.roleId === 'STAFF';
      const products = await productsService.getProducts(parsedFilters, isStaff);
      return sendSuccess(res, products, 'Lấy danh sách sản phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async getProductById(req: Request, res: Response) {
    try {
      const isStaff = req.user?.roleId === 'STAFF';
      const product = await productsService.getProductById(req.params.id, isStaff);
      return sendSuccess(res, product, 'Lấy chi tiết sản phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  async createProduct(req: Request, res: Response) {
    try {
      const parsed = createProductSchema.parse(req.body);
      const product = await productsService.createProduct(parsed, req.user!.id);
      return sendSuccess(res, product, 'Tạo sản phẩm thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateProduct(req: Request, res: Response) {
    try {
      const parsed = updateProductSchema.parse(req.body);
      const product = await productsService.updateProduct(req.params.id, parsed, req.user!.id);
      return sendSuccess(res, product, 'Cập nhật sản phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async deleteProduct(req: Request, res: Response) {
    try {
      await productsService.deleteProduct(req.params.id, req.user!.id);
      return sendSuccess(res, null, 'Đã xóa sản phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  // ==========================================
  // 3. CÔNG THỨC SẢN XUẤT (RECIPES / BOM)
  // ==========================================

  async getAllRecipes(req: Request, res: Response) {
    try {
      const { productId, search } = req.query;
      const recipes = await productsService.getAllRecipes({
        productId: productId ? String(productId) : undefined,
        search: search ? String(search) : undefined,
      });
      return sendSuccess(res, recipes, 'Lấy danh sách công thức thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getRecipeById(req: Request, res: Response) {
    try {
      const recipe = await productsService.getRecipeById(req.params.id);
      return sendSuccess(res, recipe, 'Lấy chi tiết công thức thành công');
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  async simulateCost(req: Request, res: Response) {
    try {
      const parsed = simulateRecipeCostSchema.parse(req.body);
      const result = await productsService.simulateRecipeCost(parsed);
      return sendSuccess(res, result, 'Mô phỏng tính giá vốn thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async createRecipe(req: Request, res: Response) {
    try {
      const parsed = createRecipeSchema.parse(req.body);
      const recipe = await productsService.createRecipe(parsed, req.user!.id);
      return sendSuccess(res, recipe, 'Tạo công thức định mức BOM thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async setActiveRecipe(req: Request, res: Response) {
    try {
      const { productId, recipeId } = req.params;
      const result = await productsService.setActiveRecipe(productId, recipeId, req.user!.id);
      return sendSuccess(res, result, result.message);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export const productsController = new ProductsController();
