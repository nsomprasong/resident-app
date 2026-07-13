export interface MenuShowModel {
  id?: string;
  image: string;
  alt: string;
  title: string;
  price: number;
  categoryId?: string | null;
  categoryName?: string | null;
}
