import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { ArrowLeft, FileText, Share2, Tag, Clock, Check } from 'lucide-react';
import type { Product } from '../types/index';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { ProductReviews } from './ProductReviews';
import { useFavoritesStore } from '../stores/favoritesStore';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cartStore = useCartStore();
  const { user } = useAuthStore();
  const favoritesStore = useFavoritesStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState<number>(1); // Iniciar en 1 por defecto
  const [colorQuantities, setColorQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      if (!id) return;

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setProduct(data);
      if (data?.images?.length > 0) {
        setSelectedImage(data.images[0]);
      }
      
      // Si hay colores disponibles, seleccionar el primero por defecto
      if (data?.show_colors && data?.available_colors?.length > 0) {
        const firstColor = data.available_colors[0];
        setSelectedColor(firstColor);
        
        // Inicializar el contador de cantidades por color con 1 por defecto
        const initialColorQuantities: Record<string, number> = {};
        data.available_colors.forEach(color => {
          initialColorQuantities[color] = color === firstColor ? 1 : 0;
        });
        setColorQuantities(initialColorQuantities);
        
        // Si hay imágenes específicas para este color, mostrarla
        if (data.color_images && data.color_images.length > 0) {
          const colorImage = data.color_images.find(ci => ci.color === firstColor);
          if (colorImage && colorImage.image) {
            setSelectedImage(colorImage.image);
          }
        }
      }
      
      // Si hay tallas disponibles, seleccionar la primera por defecto
      if (data?.show_sizes && data?.available_sizes?.length > 0) {
        setSelectedSize(data.available_sizes[0]);
      }

      const { data: promotionData, error: promotionError } = await supabase
        .from('promotion_products')
        .select(`
          promotion:promotions(
            id, name, type, buy_quantity, get_quantity, total_price, active, 
            start_date, end_date, created_at, updated_at
          )
        `)
        .eq('product_id', id)
        .filter('promotion.active', 'eq', true)
        .filter('promotion.start_date', 'lte', new Date().toISOString())
        .filter('promotion.end_date', 'gte', new Date().toISOString())
        .maybeSingle();

      if (!promotionError && promotionData?.promotion) {
        setProduct(prev => prev ? { ...prev, promotion: promotionData.promotion } : null);
      }

      const { data: related, error: relatedError } = await supabase
        .from('products')
        .select('*')
        .neq('id', id)
        .eq('category', data.category)
        .limit(4);

      if (!relatedError && related) {
        setRelatedProducts(related);
      }
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Error al cargar el producto');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado al portapapeles');
    } catch (err) {
      toast.error('Error al copiar el enlace');
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!product) return;
    
    // Validar selección de color si es necesario
    if (product.show_colors && product.available_colors?.length && !selectedColor) {
      toast.error('Por favor selecciona un color');
      return;
    }
    
    // Validar selección de talla si es necesario
    if (product.show_sizes && product.available_sizes?.length && !selectedSize) {
      toast.error('Por favor selecciona una talla');
      return;
    }

    // Validar que la cantidad sea mayor que cero
    if (product.show_colors) {
      if (colorQuantities[selectedColor] <= 0) {
        toast.error('Por favor selecciona una cantidad mayor a cero');
        return;
      }
    } else {
      if (quantity <= 0) {
        toast.error('Por favor selecciona una cantidad mayor a cero');
        return;
      }
    }

    // Add promotion data to product if available
    const productWithPromotion = product.promotion 
      ? { ...product, promotion: product.promotion } 
      : product;

    // Si estamos usando colores, añadir la cantidad del color seleccionado
    if (product.show_colors) {
      cartStore.addItem(productWithPromotion, colorQuantities[selectedColor], selectedColor, selectedSize);

      toast.success(
        <div className="flex items-center">
          <div>
            <p className="font-medium">¡Producto agregado al carrito!</p>
            <p className="text-sm">
              {colorQuantities[selectedColor]} {colorQuantities[selectedColor] > 1 ? 'unidades' : 'unidad'} de {product.name}
              {selectedColor && ` (${selectedColor})`}
              {selectedSize && ` - Talla ${selectedSize}`}
            </p>
          </div>
        </div>,
        {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#4F46E5',
            color: '#ffffff',
            padding: '1rem',
            borderRadius: '0.5rem',
          },
        }
      );
    } else {
      cartStore.addItem(productWithPromotion, quantity, selectedColor, selectedSize);

      toast.success(
        <div className="flex items-center">
          <div>
            <p className="font-medium">¡Producto agregado al carrito!</p>
            <p className="text-sm">
              {quantity} {quantity > 1 ? 'unidades' : 'unidad'} de {product.name}
              {selectedColor && ` (${selectedColor})`}
              {selectedSize && ` - Talla ${selectedSize}`}
            </p>
          </div>
        </div>,
        {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#4F46E5',
            color: '#ffffff',
            padding: '1rem',
            borderRadius: '0.5rem',
          },
        }
      );
    }

    cartStore.toggleCart();
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!product) return;

    // Validar selección de color si es necesario
    if (product.show_colors && product.available_colors?.length && !selectedColor) {
      toast.error('Por favor selecciona un color');
      return;
    }
    
    // Validar selección de talla si es necesario
    if (product.show_sizes && product.available_sizes?.length && !selectedSize) {
      toast.error('Por favor selecciona una talla');
      return;
    }

    // Validar que la cantidad sea mayor que cero
    if (product.show_colors) {
      if (colorQuantities[selectedColor] <= 0) {
        toast.error('Por favor selecciona una cantidad mayor a cero');
        return;
      }
    } else {
      if (quantity <= 0) {
        toast.error('Por favor selecciona una cantidad mayor a cero');
        return;
      }
    }

    // Add promotion data to product if available
    const productWithPromotion = product.promotion 
      ? { ...product, promotion: product.promotion } 
      : product;

    cartStore.clearCart();
    
    // Si estamos usando colores, añadir la cantidad del color seleccionado
    if (product.show_colors) {
      cartStore.addItem(productWithPromotion, colorQuantities[selectedColor], selectedColor, selectedSize);
    } else {
      cartStore.addItem(productWithPromotion, quantity, selectedColor, selectedSize);
    }
    
    navigate('/checkout');
  };

  const handleToggleFavorite = async () => {
    if (!product) return;
    
    if (!user) {
      toast.error('Debes iniciar sesión para agregar favoritos');
      return;
    }

    const isFavorite = favoritesStore.isFavorite(product.id);
    
    if (isFavorite) {
      await favoritesStore.removeFromFavorites(user.id, product.id);
      toast.success('Producto eliminado de favoritos');
    } else {
      await favoritesStore.addToFavorites(user.id, product);
      toast.success('Producto agregado a favoritos');
    }
  };

  const getDiscountedPrice = () => {
    if (!product || !product.promotion) return null;
    
    if (product.promotion.type === 'discount' && product.promotion.total_price) {
      return product.promotion.total_price;
    }
    
    if (['2x1', '3x1', '3x2'].includes(product.promotion.type)) {
      const currentQty = product.show_colors ? colorQuantities[selectedColor] : quantity;
      
      if (currentQty >= product.promotion.buy_quantity) {
        const fullPriceSets = Math.floor(currentQty / product.promotion.buy_quantity);
        const remainder = currentQty % product.promotion.buy_quantity;
        
        const paidItems = (fullPriceSets * product.promotion.get_quantity) + remainder;
        
        return (paidItems * product.price).toFixed(2);
      }
    }
    
    const currentQty = product.show_colors ? colorQuantities[selectedColor] : quantity;
    return (currentQty * product.price).toFixed(2);
  };
  
  const getRegularPrice = () => {
    if (!product) return null;
    const currentQty = product.show_colors ? colorQuantities[selectedColor] : quantity;
    return (currentQty * product.price).toFixed(2);
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    
    // Buscar imagen específica para este color
    if (product?.color_images && product.color_images.length > 0) {
      const colorImage = product.color_images.find(ci => ci.color === color);
      if (colorImage && colorImage.image) {
        setSelectedImage(colorImage.image);
      }
    }
    
    // Si este color no tiene cantidad asign ada, establecerla en 1 por defecto
    if (!colorQuantities[color] && colorQuantities[color] !== 0) {
      setColorQuantities(prev => ({
        ...prev,
        [color]: 1
      }));
    }
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (product?.show_colors && selectedColor) {
      // Actualizar la cantidad para el color seleccionado
      setColorQuantities(prev => ({
        ...prev,
        [selectedColor]: Math.max(0, newQuantity)
      }));
    } else {
      // Actualizar la cantidad general
      setQuantity(Math.max(0, newQuantity));
    }
  };

  const getCurrentQuantity = (): number => {
    if (product?.show_colors && selectedColor) {
      return colorQuantities[selectedColor] || 0;
    }
    return quantity;
  };

  const getColorStock = (color: string): number => {
    if (!product || !product.color_images) return product?.stock || 0;
    
    const colorData = product.color_images.find(ci => ci.color === color);
    if (colorData && typeof colorData.stock === 'number') {
      return colorData.stock;
    }
    
    return product.stock || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Producto no encontrado</h2>
          <button
            onClick={() => navigate('/')}
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/')}
          className="mb-8 inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver
        </button>

        <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
          {/* Product images */}
          <div className="space-y-4">
            <div className="aspect-w-3 aspect-h-4 rounded-lg overflow-hidden">
              <img
                src={selectedImage || product.images?.[0]}
                alt={product.name}
                className="w-full h-full object-center object-cover"
              />
            </div>
            
            {/* Thumbnails gallery */}
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(image)}
                    className={`aspect-w-1 aspect-h-1 rounded-lg overflow-hidden ${
                      selectedImage === image ? 'ring-2 ring-indigo-500' : ''
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} - Vista ${index + 1}`}
                      className="w-full h-full object-center object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0">
            <div className="flex justify-between items-start">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                {product.name}
              </h1>
              {user?.role === 'admin' && (
                <button
                  onClick={handleShare}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartir
                </button>
              )}
            </div>

            <div className="mt-3">
              <h2 className="sr-only">Información del producto</h2>
              <div className="flex items-center">
                {product.promotion ? (
                  <>
                    {product.promotion.type === 'discount' ? (
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <p className="text-2xl text-gray-500 line-through mr-2">${getRegularPrice()}</p>
                          <p className="text-3xl font-bold text-red-600">
                            ${getDiscountedPrice()}
                          </p>
                        </div>
                        <div className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                          <Tag className="h-4 w-4 mr-1" />
                          {product.promotion.discount_percent || 
                           Math.round((1 - (product.promotion.total_price / product.price)) * 100)}% de descuento
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {getCurrentQuantity() >= product.promotion.buy_quantity ? (
                          <>
                            <div className="flex items-center">
                              <p className="text-2xl text-gray-500 line-through mr-2">${getRegularPrice()}</p>
                              <p className="text-3xl font-bold text-red-600">
                                ${getDiscountedPrice()}
                              </p>
                            </div>
                            <div className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                              <Tag className="h-4 w-4 mr-1" />
                              {product.promotion.type === '2x1' && 'Compra 2, paga 1'}
                              {product.promotion.type === '3x1' && 'Compra 3, paga 1'}
                              {product.promotion.type === '3x2' && 'Compra 3, paga 2'}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-3xl text-gray-900">${getRegularPrice()}</p>
                            <div className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                              <Tag className="h-4 w-4 mr-1" />
                              {product.promotion.type === '2x1' && `¡Compra ${product.promotion.buy_quantity} y paga ${product.promotion.get_quantity}!`}
                              {product.promotion.type === '3x1' && `¡Compra ${product.promotion.buy_quantity} y paga ${product.promotion.get_quantity}!`}
                              {product.promotion.type === '3x2' && `¡Compra ${product.promotion.buy_quantity} y paga ${product.promotion.get_quantity}!`}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-3xl text-gray-900">${getRegularPrice()}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="sr-only">Descripción</h3>
              <div className="text-base text-gray-700 space-y-6">
                {product.description}
              </div>
            </div>

            {/* Color selection */}
            {product.show_colors && product.available_colors && product.available_colors.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900">Colores disponibles</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.available_colors.map((color) => {
                    const colorStock = getColorStock(color);
                    const isDisabled = colorStock <= 0;
                    
                    return (
                      <button
                        key={color}
                        onClick={() => !isDisabled && handleColorChange(color)}
                        disabled={isDisabled}
                        className={`relative px-3 py-1 rounded-full text-sm ${
                          isDisabled 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                            : selectedColor === color
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {selectedColor === color && !isDisabled && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <Check className="h-3 w-3 text-white" />
                          </span>
                        )}
                        {color} {colorStock > 0 ? `(${colorStock})` : '(Agotado)'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size selection */}
            {product.show_sizes && product.available_sizes && product.available_sizes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900">Tallas disponibles</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.available_sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`relative px-3 py-1 rounded-full text-sm ${
                        selectedSize === size
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {selectedSize === size && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <Check className="h-3 w-3 text-white" />
                        </span>
                      )}
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.instructions_file && (
              <div className="mt-6">
                <a
                  href={product.instructions_file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-indigo-600 hover:text-indigo-500"
                >
                  <FileText className="h-5 w-5 mr-2" />
                  Ver instrucciones de uso
                </a>
              </div>
            )}

            {product.show_delivery_time && (product.delivery_time || product.shipping_days) && (
              <div className="mt-6">
                <div className="flex items-center text-sm text-gray-700">
                  <Clock className="h-5 w-5 text-gray-400 mr-2" />
                  <span>Tiempo estimado de entrega: {product.delivery_time || `${product.shipping_days} días hábiles`}</span>
                </div>
              </div>
            )}

            <div className="mt-6">
              <div className="flex items-center">
                <div className="text-sm text-gray-700">
                  Stock disponible: {product.stock}
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col space-y-4">
              <div className="flex items-center">
                <label htmlFor="quantity" className="mr-3 text-sm font-medium text-gray-700">
                  Cantidad:
                </label>
                <div className="flex items-center border border-gray-300 rounded-md">
                  <button
                    type="button"
                    className="px-3 py-1 text-gray-600 hover:text-gray-900 focus:outline-none"
                    onClick={() => handleQuantityChange(getCurrentQuantity() - 1)}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    min="0"
                    max={product.show_colors && selectedColor ? getColorStock(selectedColor) : product.stock}
                    value={getCurrentQuantity()}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
                    className="w-12 text-center border-0 focus:ring-0"
                  />
                  <button
                    type="button"
                    className="px-3 py-1 text-gray-600 hover:text-gray-900 focus:outline-none"
                    onClick={() => {
                      const maxStock = product.show_colors && selectedColor 
                        ? getColorStock(selectedColor) 
                        : product.stock;
                      handleQuantityChange(Math.min(maxStock, getCurrentQuantity() + 1));
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
              
              <div className="flex sm:flex-row gap-4">
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock === 0 || getCurrentQuantity() === 0}
                  className="flex-1 bg-indigo-600 border border-transparent rounded-md py-3 px-8 flex items-center justify-center text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Agregar al carrito
                </button>

                <button
                  onClick={handleBuyNow}
                  disabled={product.stock === 0 || getCurrentQuantity() === 0}
                  className="flex-1 bg-indigo-100 border border-transparent rounded-md py-3 px-8 flex items-center justify-center text-base font-medium text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Comprar ahora
                </button>
              </div>
              
              {user && (
                <button
                  onClick={handleToggleFavorite}
                  className={`flex items-center justify-center py-3 px-8 rounded-md text-sm font-medium ${
                    favoritesStore.isFavorite(product.id)
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-5 w-5 mr-2 ${
                      favoritesStore.isFavorite(product.id) ? 'text-red-500 fill-current' : 'text-gray-400'
                    }`} 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    fill="none"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
                    />
                  </svg>
                  {favoritesStore.isFavorite(product.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                </button>
              )}
            </div>

            {product.category && (
              <div className="mt-6">
                <div className="text-sm text-gray-700">
                  Categoría: {product.category}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16 border-t border-gray-200 pt-8">
          <ProductReviews productId={product.id} />
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Productos relacionados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <div
                  key={relatedProduct.id}
                  onClick={() => navigate(`/products/${relatedProduct.id}`)}
                  className="group relative cursor-pointer"
                >
                  <div className="aspect-w-1 aspect-h-1 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={relatedProduct.images?.[0]}
                      alt={relatedProduct.name}
                      className="object-center object-cover group-hover:opacity-75 transition-opacity"
                    />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-900">
                      {relatedProduct.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      ${relatedProduct.price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}