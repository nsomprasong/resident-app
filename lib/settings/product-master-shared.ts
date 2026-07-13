export type ProductTypeRecord = {
  id: string;
  name: string;
  requiresFoodCategory: boolean;
  isActive: boolean;
};

export type FoodCategoryRecord = {
  id: string;
  name: string;
  isActive: boolean;
};

export type ProductMasterRecord = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  typeId: string;
  typeName: string;
  requiresFoodCategory: boolean;
  categoryId: string | null;
  categoryName: string | null;
  isMinibar: boolean;
  imageUrl: string | null;
  isActive: boolean;
};
