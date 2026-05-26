export interface Product {
  id: string;
  slug?: string;
  ref: string;
  name: string;
  category: string;
  description?: string;
  image: string;
  images: string[];
  price: number;
  oldPrice?: number;
  discount: number;
  isNew?: boolean;
  pageNumber?: number;
  reference?: string;
  storeIds?: string[];
}
