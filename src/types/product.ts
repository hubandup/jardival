export interface Product {
  id: string;
  ref: string;
  name: string;
  category: string;
  image: string;
  images: string[];
  price: number;
  oldPrice?: number;
  discount: number;
  isNew?: boolean;
}
