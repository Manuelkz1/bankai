import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '../types/index';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  effectivePrice: number; // Precio efectivo que se debe cobrar (con promoción aplicada)
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  total: number;
  
  addItem: (product: Product, quantity: number, selectedColor?: string, selectedSize?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  calculateTotal: () => void;
  rehydrate: () => void;
  getEffectivePrice: (product: Product) => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      total: 0,

      getEffectivePrice: (product: Product) => {
        if (!product.promotion) {
          return product.price;
        }

        switch (product.promotion.type) {
          case 'discount':
            return product.promotion.total_price || product.price;
          case '2x1':
          case '3x1':
          case '3x2':
            // Para promociones de cantidad, el precio unitario sigue siendo el mismo
            // El descuento se aplica en el total según la cantidad
            return product.price;
          default:
            return product.price;
        }
      },

      addItem: (product, quantity = 1, selectedColor, selectedSize) => {
        console.log("cartStore - addItem called with:", { product: product.name, quantity, selectedColor, selectedSize });
        const items = [...get().items];
        const effectivePrice = get().getEffectivePrice(product);
        
        // Buscar si ya existe un item con el mismo producto y color/talla
        const existingItemIndex = items.findIndex(
          item => 
            item.product.id === product.id && 
            item.selectedColor === selectedColor &&
            item.selectedSize === selectedSize
        );

        if (existingItemIndex >= 0) {
          // Si existe, actualizar la cantidad
          items[existingItemIndex].quantity += quantity;
          // Actualizar el precio efectivo en caso de que haya cambiado
          items[existingItemIndex].effectivePrice = effectivePrice;
          console.log("cartStore - Existing item updated:", items[existingItemIndex]);
        } else {
          // Si no existe, añadir nuevo item
          items.push({ 
            product, 
            quantity, 
            selectedColor, 
            selectedSize,
            effectivePrice
          });
          console.log("cartStore - New item added:", items[items.length - 1]);
        }

        set({ items });
        get().calculateTotal();
        console.log("cartStore - Current items after addItem:", get().items);
      },

      removeItem: (productId) => {
        console.log("cartStore - removeItem called with:", { productId });
        const items = get().items.filter(item => item.product.id !== productId);
        set({ items });
        get().calculateTotal();
        console.log("cartStore - Current items after removeItem:", get().items);
      },

      updateQuantity: (productId, quantity) => {
        console.log("cartStore - updateQuantity called with:", { productId, quantity });
        const items = get().items.map(item => 
          item.product.id === productId 
            ? { ...item, quantity: Math.max(0, quantity) }
            : item
        ).filter(item => item.quantity > 0);

        set({ items });
        get().calculateTotal();
        console.log("cartStore - Current items after updateQuantity:", get().items);
      },

      clearCart: () => {
        set({ items: [], total: 0 });
      },

      toggleCart: () => {
        set(state => ({ isOpen: !state.isOpen }));
      },

      calculateTotal: () => {
        const items = get().items;
        let total = 0;

        items.forEach(item => {
          const { product, quantity, effectivePrice } = item;
          
          if (product.promotion) {
            if (product.promotion.type === 'discount') {
              // Para descuentos directos, usar el precio efectivo
              total += effectivePrice * quantity;
            } else if (product.promotion.type === '2x1' && quantity >= 2) {
              // Para 2x1, pagar por la mitad de los items (redondeado hacia arriba)
              const paidItems = Math.ceil(quantity / 2);
              total += paidItems * effectivePrice;
            } else if (product.promotion.type === '3x2' && quantity >= 3) {
              // Para 3x2, calcular sets y items restantes
              const sets = Math.floor(quantity / 3);
              const remainder = quantity % 3;
              const paidItems = (sets * 2) + remainder;
              total += paidItems * effectivePrice;
            } else if (product.promotion.type === '3x1' && quantity >= 3) {
              // Para 3x1, pagar por un item por set más los restantes
              const sets = Math.floor(quantity / 3);
              const remainder = quantity % 3;
              const paidItems = sets + remainder;
              total += paidItems * effectivePrice;
            } else {
              // Si no se cumplen las condiciones de promoción, usar precio efectivo
              total += effectivePrice * quantity;
            }
          } else {
            total += effectivePrice * quantity;
          }
        });

        set({ total });
      },

      rehydrate: () => {
        // Recalcular precios efectivos al rehidratar
        const items = get().items.map(item => ({
          ...item,
          effectivePrice: get().getEffectivePrice(item.product)
        }));
        
        set({ items });
        get().calculateTotal();
      }
    }),
    {
      name: 'cart-storage',
      getStorage: () => localStorage,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.rehydrate();
        }
      }
    }
  )
);