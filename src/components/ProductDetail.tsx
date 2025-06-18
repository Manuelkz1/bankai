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
    console.log('ProductDetail - Initial load or ID change. Product ID:', id);
  }, [id]);

  // Log para depurar cambios en selectedColor o selectedSize
  useEffect(() => {
    console.log('ProductDetail - selectedColor changed:', selectedColor, 'selectedSize changed:', selectedSize);
    if (product) {
      const existingCartItem = cartStore.items.find(
        item =>
          item.product.id === product.id &&
          item.selectedColor === selectedColor &&
          item.selectedSize === selectedSize
      );
      if (existingCartItem) {
        console.log('ProductDetail - Found existing item in cart for this color/size:', existingCartItem.quantity);
        setQuantity(existingCartItem.quantity);
      } else {
        console.log('ProductDetail - No existing item for this color/size, setting quantity to 1.');
        setQuantity(1); // Cantidad predeterminada para una nueva selección
      }
    }
  }, [selectedColor, selectedSize, product, cartStore.items]);

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
        
        // Inicializar el contador de cantidades por color todos en 0
        const initialColorQuantities: Record<string, number> = {};
        data.available_colors.forEach(color => {
          initialColorQuantities[color] = 0;
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
    
    // Validar selección de talla si es necesario
    if (product.show_sizes && product.available_sizes?.length && !selectedSize) {
      toast.error('Por favor selecciona una talla');
      return;
    }

    // Add promotion data to product if available
    const productWithPromotion = product.promotion 
      ? { ...product, promotion: product.promotion } 
      : product;

    // Si estamos usando colores, añadir TODAS las variantes con cantidad > 0
    if (product.show_colors) {
      const colorsToAdd = Object.entries(colorQuantities).filter(([color, qty]) => qty > 0);
      
      if (colorsToAdd.length === 0) {
        toast.error('Por favor selecciona al menos una cantidad mayor a cero para cualquier color');
        return;
      }

      let totalItems = 0;
      const addedColors: string[] = [];

      // Añadir cada color con su cantidad al carrito
      colorsToAdd.forEach(([color, qty]) => {
        cartStore.addItem(productWithPromotion, qty, color, selectedSize);
        totalItems += qty;
        addedColors.push(`${color} (${qty})`);
      });

      toast.success(
        <div className="flex items-center">
          <div>
            <p className="font-medium">¡Producto agregado al carrito!</p>
            <p className="text-sm">
              {totalItems} {totalItems > 1 ? 'unidades' : 'unidad'} de {product.name}
              <br />Colores: {addedColors.join(', ')}
              {selectedSize && ` - Talla ${selectedSize}`}
            </p>
          </div>
        </div>,
        {
          duration: 4000,
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
      // Validar que la cantidad sea mayor que cero para productos sin colores
      if (quantity <= 0) {
        toast.error('Por favor selecciona una cantidad mayor a cero');
        return;
      }

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
    
    // Validar selección de talla si es necesario
    if (product.show_sizes && product.available_sizes?.length && !selectedSize) {
      toast.error('Por favor selecciona una talla');
      return;
    }

    // Add promotion data to product if available
    const productWithPromotion = product.promotion 
      ? { ...product, promotion: product.promotion } 
      : product;

    cartStore.clearCart();
    
    // Si estamos usando colores, añadir TODAS las variantes con cantidad > 0
    if (product.show_colors) {
      const colorsToAdd = Object.entries(colorQuantities).filter(([color, qty]) => qty > 0);
      
      if (colorsToAdd.length === 0) {
        toast.error('Por favor selecciona al menos una cantidad mayor a cero para cualquier color');
        return;
      }

      // Añadir cada color con su cantidad al carrito
      colorsToAdd.forEach(([color, qty]) => {
        cartStore.addItem(productWithPromotion, qty, color, selectedSize);
      });
    } else {
      // Validar que la cantidad sea mayor que cero para productos sin colores
      if (quantity <= 0) {
        toast.error('Por favor selecciona una cantidad mayor a cero');
        return;
      }
      
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
      const currentQty = product.show_colors 
        ? Object.values(colorQuantities).reduce((sum, qty) => sum + qty, 0)
        : quantity;
      
      if (currentQty >= product.promotion.buy_quantity) {
        const fullPriceSets = Math.floor(currentQty / product.promotion.buy_quantity);
        const remainder = currentQty % product.promotion.buy_quantity;
        
        const paidItems = (fullPriceSets * product.promotion.get_quantity) + remainder;
        
        return (paidItems * product.price).toFixed(2);
      }
    }
    
    const currentQty = product.show_colors 
      ? Object.values(colorQuantities).reduce((sum, qty) => sum + qty, 0)
      : quantity;
    return (currentQty * product.price).toFixed(2);
  };
  
  const getRegularPrice = () => {
    if (!product) return null;
    const currentQty = product.show_colors 
      ? Object.values(colorQuantities).reduce((sum, qty) => sum + qty, 0)
      : quantity;
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
    if (product?.show_colors) {
      return Object.values(colorQuantities).reduce((sum, qty) => sum + qty, 0);
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

            {/* Color selection - MOBILE-OPTIMIZED COMPACT DESIGN */}
            {product.show_colors && product.available_colors && product.available_colors.length > 0 && (
              <div className="mt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Colores disponibles</h3>
                  <p className="text-sm text-gray-600">Toca un color para ver la imagen y seleccionar cantidad</p>
                </div>
                
                <div className="space-y-3">
                  {product.available_colors.map((color, index) => {
                    const colorStock = getColorStock(color);
                    const isDisabled = colorStock <= 0;
                    const currentQuantity = colorQuantities[color] || 0;
                    const isSelected = currentQuantity > 0;
                    
                    // Buscar imagen específica para este color
                    const colorImage = product.color_images?.find(ci => ci.color === color);
                    
                    return (
                      <div 
                        key={color} 
                        className={`relative overflow-hidden rounded-lg border-2 transition-all duration-300 cursor-pointer ${
                          isDisabled 
                            ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' 
                            : isSelected
                              ? 'border-indigo-400 bg-indigo-50 shadow-md'
                              : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                        }`}
                        onClick={() => {
                          if (!isDisabled) {
                            handleColorChange(color);
                          }
                        }}
                      >
                        <div className="flex items-center p-3">
                          {/* Miniatura de imagen */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden mr-3 flex-shrink-0 border border-gray-200">
                            {colorImage?.image ? (
                              <img 
                                src={colorImage.image} 
                                alt={`${product.name} - ${color}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div 
                                className="w-full h-full flex items-center justify-center"
                                style={{ backgroundColor: color.toLowerCase() }}
                              >
                                <span className="text-white text-xs font-medium">
                                  {color[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Información del color */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className={`font-medium capitalize ${
                                  isDisabled ? 'text-gray-400' : isSelected ? 'text-indigo-900' : 'text-gray-900'
                                }`}>
                                  {color}
                                </h4>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    colorStock > 10 
                                      ? 'bg-green-100 text-green-700' 
                                      : colorStock > 0 
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                  }`}>
                                    {colorStock > 0 ? `${colorStock} disponibles` : 'Agotado'}
                                  </span>
                                  {isSelected && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                                      ✓ {currentQuantity} seleccionada{currentQuantity > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Controles de cantidad compactos */}
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (currentQuantity > 0) {
                                      const newQuantity = Math.max(0, currentQuantity - 1);
                                      setColorQuantities(prev => ({
                                        ...prev,
                                        [color]: newQuantity
                                      }));
                                    }
                                  }}
                                  disabled={currentQuantity <= 0}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                                    currentQuantity <= 0 
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                      : 'bg-red-500 text-white hover:bg-red-600'
                                  }`}
                                >
                                  −
                                </button>
                                
                                <div className={`w-10 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                                  currentQuantity > 0 ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500 border border-dashed border-gray-300'
                                }`}>
                                  {currentQuantity}
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (currentQuantity < colorStock) {
                                      const newQuantity = Math.min(colorStock, currentQuantity + 1);
                                      setColorQuantities(prev => ({
                                        ...prev,
                                        [color]: newQuantity
                                      }));
                                    }
                                  }}
                                  disabled={currentQuantity >= colorStock}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                                    currentQuantity >= colorStock 
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                      : 'bg-green-500 text-white hover:bg-green-600'
                                  }`}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Resumen compacto */}
                {Object.values(colorQuantities).reduce((sum, qty) => sum + qty, 0) > 0 && (
                  <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-indigo-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-bold">∑</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">Total seleccionado</span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-indigo-600">
                          {Object.values(colorQuantities).reduce((sum, qty) => sum + qty, 0)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {Object.values(colorQuantities).reduce((sum, qty) => sum + qty, 0) === 1 ? 'unidad' : 'unidades'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
              <div className="inline-flex items-center px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  product.stock > 10 
                    ? 'bg-green-500 animate-pulse' 
                    : product.stock > 0 
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`} />
                <span className="text-sm font-medium text-gray-700">
                  Stock disponible: 
                  <span className={`ml-1 font-bold ${
                    product.stock > 10 
                      ? 'text-green-600' 
                      : product.stock > 0 
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}>
                    {product.stock} unidades
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-10 flex flex-col space-y-4">
              {/* Solo mostrar selector de cantidad si NO hay colores - MODERN DESIGN */}
              {!product.show_colors && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona la cantidad</h3>
                    <p className="text-sm text-gray-600">¿Cuántas unidades deseas agregar?</p>
                  </div>
                  
                  <div className="w-full flex items-center justify-center gap-5 py-3">
                    {/* Minus button - Always rendered */}
                    <button
                      type="button"
                      style={{
                        width: '56px',
                        height: '56px',
                        backgroundColor: getCurrentQuantity() <= 0 ? '#f3f4f6' : '#ef4444',
                        color: getCurrentQuantity() <= 0 ? '#9ca3af' : '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        cursor: getCurrentQuantity() <= 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        touchAction: 'manipulation',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        position: 'relative',
                        zIndex: 10
                      }}
                      onClick={() => {
                        if (getCurrentQuantity() > 0) {
                          handleQuantityChange(getCurrentQuantity() - 1);
                        }
                      }}
                      disabled={getCurrentQuantity() <= 0}
                    >
                      −
                    </button>
                    
                    {/* Quantity input */}
                    <input
                      type="number"
                      min="0"
                      max={product.stock}
                      value={getCurrentQuantity()}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
                      style={{
                        width: '80px',
                        height: '56px',
                        backgroundColor: getCurrentQuantity() > 0 ? '#6366f1' : '#f3f4f6',
                        color: getCurrentQuantity() > 0 ? '#ffffff' : '#6b7280',
                        border: getCurrentQuantity() > 0 ? 'none' : '2px dashed #d1d5db',
                        borderRadius: '12px',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        touchAction: 'manipulation',
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                      }}
                    />
                    
                    {/* Plus button - ALWAYS VISIBLE - Never hidden */}
                    <button
                      type="button"
                      style={{
                        width: '56px',
                        height: '56px',
                        backgroundColor: getCurrentQuantity() >= product.stock ? '#f3f4f6' : '#10b981',
                        color: getCurrentQuantity() >= product.stock ? '#9ca3af' : '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        cursor: getCurrentQuantity() >= product.stock ? 'not-allowed' : 'pointer',
                        display: 'flex !important',
                        alignItems: 'center',
                        justifyContent: 'center',
                        touchAction: 'manipulation',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        position: 'relative',
                        zIndex: 10,
                        visibility: 'visible !important',
                        opacity: '1 !important'
                      }}
                      onClick={() => {
                        if (getCurrentQuantity() < product.stock) {
                          handleQuantityChange(Math.min(product.stock, getCurrentQuantity() + 1));
                        }
                      }}
                      disabled={getCurrentQuantity() >= product.stock}
                    >
                      +
                    </button>
                  </div>
                  
                  {/* Stock indicator */}
                  <div className="mt-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                      product.stock > 10 
                        ? 'bg-green-100 text-green-800' 
                        : product.stock > 0 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {product.stock} unidades disponibles
                    </span>
                  </div>
                  
                  {/* Quantity summary */}
                  {getCurrentQuantity() > 0 && (
                    <div className="mt-4 p-3 bg-white rounded-xl border border-indigo-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Has seleccionado:</span>
                        <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          {getCurrentQuantity()} {getCurrentQuantity() === 1 ? 'unidad' : 'unidades'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
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