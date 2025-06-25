import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Product } from '../types/index';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  RefreshCw, 
  Save, 
  X, 
  Image as ImageIcon,
  FileText,
  Tag,
  Check,
  Paintbrush,
  Ruler
} from 'lucide-react';

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: '',
    shipping_days: '',
    show_colors: false,
    available_colors: [] as string[],
    color_images: [] as any[],
    show_sizes: false,
    available_sizes: [] as string[],
    show_delivery_time: false,
    delivery_time: '',
    allowed_payment_methods: ['cod', 'mercadopago'] as string[],
  });
  const [images, setImages] = useState<File[]>([]);
  const [instructionFile, setInstructionFile] = useState<File | null>(null);
  const [newColor, setNewColor] = useState('');
  const [newSize, setNewSize] = useState('');
  const [colorStocks, setColorStocks] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const instructionFileRef = useRef<HTMLInputElement>(null);
  const colorImageRefs = useRef<Record<string, HTMLInputElement>>({});

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      stock: 0,
      category: '',
      shipping_days: '',
      show_colors: false,
      available_colors: [],
      color_images: [],
      show_sizes: false,
      available_sizes: [],
      show_delivery_time: false,
      delivery_time: '',
      allowed_payment_methods: ['cod', 'mercadopago'],
    });
    setImages([]);
    setInstructionFile(null);
    setColorStocks({});
    setShowForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    
    // Initialize color stocks from color_images if available
    const initialColorStocks: Record<string, number> = {};
    if (product.color_images && Array.isArray(product.color_images)) {
      product.color_images.forEach((colorData: any) => {
        if (colorData.color && typeof colorData.stock === 'number') {
          initialColorStocks[colorData.color] = colorData.stock;
        }
      });
    }
    
    // If no color stocks are found in color_images, initialize with default stock
    if (product.available_colors && product.available_colors.length > 0) {
      product.available_colors.forEach(color => {
        if (!initialColorStocks[color]) {
          initialColorStocks[color] = product.stock || 0;
        }
      });
    }
    
    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price || 0,
      stock: product.stock || 0,
      category: product.category || '',
      shipping_days: product.shipping_days?.toString() || '',
      show_colors: product.show_colors || false,
      available_colors: product.available_colors || [],
      color_images: product.color_images || [],
      show_sizes: product.show_sizes || false,
      available_sizes: product.available_sizes || [],
      show_delivery_time: product.show_delivery_time || false,
      delivery_time: product.delivery_time || '',
      allowed_payment_methods: product.allowed_payment_methods || ['cod', 'mercadopago'],
    });
    setColorStocks(initialColorStocks);
    setImages([]);
    setInstructionFile(null);
    setShowForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Producto eliminado exitosamente');
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar el producto');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Validate required fields
      if (!formData.name.trim()) {
        toast.error('El nombre del producto es obligatorio');
        setLoading(false);
        return;
      }
      
      if (formData.price <= 0) {
        toast.error('El precio debe ser mayor que cero');
        setLoading(false);
        return;
      }

      // Prepare color_images data with stock information
      const colorImagesWithStock = formData.color_images.map(colorImage => {
        const color = colorImage.color;
        return {
          ...colorImage,
          stock: colorStocks[color] || 0
        };
      });
      
      // Upload product images if any
      let productImages = editingProduct?.images || [];
      if (images.length > 0) {
        const uploadPromises = images.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError, data } = await supabase.storage
            .from('products')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(filePath);

          return publicUrl;
        });

        const newImages = await Promise.all(uploadPromises);
        productImages = [...productImages, ...newImages];
      }

      // Upload instruction file if any
      let instructionFileUrl = editingProduct?.instructions_file || null;
      if (instructionFile) {
        const fileExt = instructionFile.name.split('.').pop();
        const fileName = `instruction_${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('instructions')
          .upload(filePath, instructionFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('instructions')
          .getPublicUrl(filePath);

        instructionFileUrl = publicUrl;
      }

      // Prepare product data
      const productData = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        stock: formData.stock,
        category: formData.category,
        images: productImages,
        instructions_file: instructionFileUrl,
        shipping_days: formData.shipping_days ? parseInt(formData.shipping_days) : null,
        show_colors: formData.show_colors,
        available_colors: formData.available_colors,
        color_images: colorImagesWithStock,
        show_sizes: formData.show_sizes,
        available_sizes: formData.available_sizes,
        show_delivery_time: formData.show_delivery_time,
        delivery_time: formData.delivery_time,
        allowed_payment_methods: formData.allowed_payment_methods,
      };

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('Producto actualizado exitosamente');
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        toast.success('Producto creado exitosamente');
      }

      // Reset form and reload products
      setShowForm(false);
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        stock: 0,
        category: '',
        shipping_days: '',
        show_colors: false,
        available_colors: [],
        color_images: [],
        show_sizes: false,
        available_sizes: [],
        show_delivery_time: false,
        delivery_time: '',
        allowed_payment_methods: ['cod', 'mercadopago'],
      });
      setImages([]);
      setInstructionFile(null);
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      setImages(prev => [...prev, ...fileList]);
    }
  };

  const handleInstructionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setInstructionFile(e.target.files[0]);
    }
  };

  const handleColorImageChange = async (e: React.ChangeEvent<HTMLInputElement>, color: string) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `color_${color}_${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('products')
          .getPublicUrl(filePath);

        // Update color_images array
        setFormData(prev => {
          const updatedColorImages = [...prev.color_images];
          const existingIndex = updatedColorImages.findIndex(ci => ci.color === color);
          
          if (existingIndex >= 0) {
            updatedColorImages[existingIndex] = {
              ...updatedColorImages[existingIndex],
              color,
              image: publicUrl
            };
          } else {
            updatedColorImages.push({
              color,
              image: publicUrl,
              stock: colorStocks[color] || 0
            });
          }
          
          return {
            ...prev,
            color_images: updatedColorImages
          };
        });

        toast.success(`Imagen para color ${color} subida exitosamente`);
      } catch (error) {
        console.error('Error uploading color image:', error);
        toast.error(`Error al subir imagen para color ${color}`);
      }
    }
  };

  const handleAddColor = () => {
    if (!newColor.trim()) {
      toast.error('Por favor ingresa un nombre de color');
      return;
    }

    if (formData.available_colors.includes(newColor)) {
      toast.error('Este color ya existe');
      return;
    }

    setFormData(prev => ({
      ...prev,
      available_colors: [...prev.available_colors, newColor]
    }));
    
    // Initialize stock for this color
    setColorStocks(prev => ({
      ...prev,
      [newColor]: formData.stock || 0
    }));
    
    setNewColor('');
  };

  const handleRemoveColor = (color: string) => {
    setFormData(prev => ({
      ...prev,
      available_colors: prev.available_colors.filter(c => c !== color),
      color_images: prev.color_images.filter(ci => ci.color !== color)
    }));
    
    // Remove stock for this color
    setColorStocks(prev => {
      const updated = { ...prev };
      delete updated[color];
      return updated;
    });
  };

  const handleAddSize = () => {
    if (!newSize.trim()) {
      toast.error('Por favor ingresa una talla');
      return;
    }

    if (formData.available_sizes.includes(newSize)) {
      toast.error('Esta talla ya existe');
      return;
    }

    setFormData(prev => ({
      ...prev,
      available_sizes: [...prev.available_sizes, newSize]
    }));
    setNewSize('');
  };

  const handleRemoveSize = (size: string) => {
    setFormData(prev => ({
      ...prev,
      available_sizes: prev.available_sizes.filter(s => s !== size)
    }));
  };

  const handleColorStockChange = (color: string, stock: number) => {
    setColorStocks(prev => ({
      ...prev,
      [color]: Math.max(0, stock)
    }));
  };

  const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      const allowed_payment_methods = checked
        ? [...prev.allowed_payment_methods, value]
        : prev.allowed_payment_methods.filter(method => method !== value);
      return { ...prev, allowed_payment_methods };
    });
  };

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestión de Productos</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleAddProduct}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Producto
          </button>
          <button
            onClick={loadProducts}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Actualizar
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar productos..."
          className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-indigo-500 focus:border-indigo-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Información Básica</h4>
                
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                    Precio
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      id="price"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      className="block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="stock" className="block text-sm font-medium text-gray-700">
                    Stock General
                  </label>
                  <input
                    type="number"
                    id="stock"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => {
                      const newStock = parseInt(e.target.value) || 0;
                      setFormData(prev => ({ ...prev, stock: newStock }));
                      
                      // Update stock for all colors if show_colors is enabled
                      if (formData.show_colors) {
                        const updatedColorStocks = { ...colorStocks };
                        formData.available_colors.forEach(color => {
                          updatedColorStocks[color] = newStock;
                        });
                        setColorStocks(updatedColorStocks);
                      }
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                    Categoría
                  </label>
                  <input
                    type="text"
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="shipping_days" className="block text-sm font-medium text-gray-700">
                    Días de Envío
                  </label>
                  <input
                    type="text"
                    id="shipping_days"
                    value={formData.shipping_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_days: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Ej: 3-5"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Ingresa los días hábiles de envío (ej: 3, 5-7, etc.)
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="show_delivery_time"
                    checked={formData.show_delivery_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, show_delivery_time: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="show_delivery_time" className="ml-2 block text-sm text-gray-900">
                    Mostrar tiempo de entrega
                  </label>
                </div>

                {formData.show_delivery_time && (
                  <div>
                    <label htmlFor="delivery_time" className="block text-sm font-medium text-gray-700">
                      Tiempo de entrega personalizado
                    </label>
                    <input
                      type="text"
                      id="delivery_time"
                      value={formData.delivery_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, delivery_time: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Ej: 24-48 horas"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Texto personalizado para el tiempo de entrega (tiene prioridad sobre los días de envío)
                    </p>
                  </div>
                )}

                {/* Payment Methods */}
                <div className="border-t pt-4">
                  <h5 className="font-medium text-gray-900 mb-3">Métodos de Pago Permitidos</h5>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="payment_cod"
                        value="cod"
                        checked={formData.allowed_payment_methods.includes('cod')}
                        onChange={handlePaymentMethodChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="payment_cod" className="ml-2 block text-sm text-gray-900">
                        Pago contra entrega
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="payment_mercadopago"
                        value="mercadopago"
                        checked={formData.allowed_payment_methods.includes('mercadopago')}
                        onChange={handlePaymentMethodChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="payment_mercadopago" className="ml-2 block text-sm text-gray-900">
                        Pago con Mercado Pago
                      </label>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Selecciona los métodos de pago disponibles para este producto. Los clientes solo verán las opciones seleccionadas.
                  </p>
                </div>
              </div>

              {/* Images and Files */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Imágenes y Archivos</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Imágenes del Producto
                  </label>
                  <div className="mt-1 flex items-center">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      className="hidden"
                      accept="image/*"
                      multiple
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <ImageIcon className="h-5 w-5 mr-2" />
                      Subir Imágenes
                    </button>
                  </div>
                  {images.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {images.length} {images.length === 1 ? 'imagen seleccionada' : 'imágenes seleccionadas'}
                      </p>
                      <ul className="mt-1 text-xs text-gray-500">
                        {images.map((file, index) => (
                          <li key={index}>{file.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {editingProduct?.images && editingProduct.images.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {editingProduct.images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image}
                            alt={`Producto ${index + 1}`}
                            className="h-20 w-20 object-cover rounded-md"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Archivo de Instrucciones (opcional)
                  </label>
                  <div className="mt-1 flex items-center">
                    <input
                      type="file"
                      ref={instructionFileRef}
                      onChange={handleInstructionFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                    />
                    <button
                      type="button"
                      onClick={() => instructionFileRef.current?.click()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <FileText className="h-5 w-5 mr-2" />
                      Subir Instrucciones
                    </button>
                  </div>
                  {instructionFile && (
                    <p className="mt-2 text-sm text-gray-500">
                      Archivo seleccionado: {instructionFile.name}
                    </p>
                  )}
                  {editingProduct?.instructions_file && !instructionFile && (
                    <div className="mt-2 flex items-center">
                      <FileText className="h-5 w-5 text-gray-400 mr-2" />
                      <a
                        href={editingProduct.instructions_file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        Ver archivo actual
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Colors Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900 flex items-center">
                  <Paintbrush className="h-5 w-5 mr-2 text-indigo-500" />
                  Colores
                </h4>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="show_colors"
                    checked={formData.show_colors}
                    onChange={(e) => setFormData(prev => ({ ...prev, show_colors: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="show_colors" className="ml-2 block text-sm text-gray-900">
                    Habilitar selección de colores
                  </label>
                </div>
              </div>

              {formData.show_colors && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      placeholder="Nombre del color"
                      className="block w-full sm:w-64 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddColor}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Añadir
                    </button>
                  </div>

                  {formData.available_colors.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">Colores disponibles:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.available_colors.map((color) => (
                          <div key={color} className="border border-gray-200 rounded-md p-4">
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center">
                                <span className="font-medium text-gray-900">{color}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveColor(color)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            
                            <div className="space-y-3">
                              {/* Stock por color */}
                              <div>
                                <label htmlFor={`stock-${color}`} className="block text-sm font-medium text-gray-700">
                                  Stock para {color}
                                </label>
                                <input
                                  type="number"
                                  id={`stock-${color}`}
                                  min="0"
                                  value={colorStocks[color] || 0}
                                  onChange={(e) => handleColorStockChange(color, parseInt(e.target.value) || 0)}
                                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                              </div>
                              
                              {/* Imagen por color */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  Imagen para {color}
                                </label>
                                <div className="mt-1 flex items-center">
                                  <input
                                    type="file"
                                    ref={(el) => {
                                      if (el) colorImageRefs.current[color] = el;
                                    }}
                                    onChange={(e) => handleColorImageChange(e, color)}
                                    className="hidden"
                                    accept="image/*"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => colorImageRefs.current[color]?.click()}
                                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                  >
                                    <ImageIcon className="h-4 w-4 mr-1" />
                                    Subir Imagen
                                  </button>
                                </div>
                                
                                {/* Preview de imagen por color */}
                                {formData.color_images.find(ci => ci.color === color)?.image && (
                                  <div className="mt-2">
                                    <img
                                      src={formData.color_images.find(ci => ci.color === color)?.image}
                                      alt={`Color ${color}`}
                                      className="h-16 w-16 object-cover rounded-md"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No hay colores disponibles</p>
                  )}
                </div>
              )}
            </div>

            {/* Sizes Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900 flex items-center">
                  <Ruler className="h-5 w-5 mr-2 text-indigo-500" />
                  Tallas
                </h4>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="show_sizes"
                    checked={formData.show_sizes}
                    onChange={(e) => setFormData(prev => ({ ...prev, show_sizes: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="show_sizes" className="ml-2 block text-sm text-gray-900">
                    Habilitar selección de tallas
                  </label>
                </div>
              </div>

              {formData.show_sizes && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newSize}
                      onChange={(e) => setNewSize(e.target.value)}
                      placeholder="Nombre de la talla"
                      className="block w-full sm:w-64 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddSize}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Añadir
                    </button>
                  </div>

                  {formData.available_sizes.length > 0 ? (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Tallas disponibles:</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.available_sizes.map((size) => (
                          <div key={size} className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1">
                            <span className="text-sm font-medium text-gray-900 mr-1">{size}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSize(size)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No hay tallas disponibles</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {loading && !showForm ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="animate-spin h-8 w-8 text-indigo-500" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No se encontraron productos</p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-gray-200">
            {filteredProducts.map((product) => (
              <li key={product.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-16 w-16 object-cover rounded-md mr-4"
                        />
                      ) : (
                        <div className="h-16 w-16 bg-gray-200 rounded-md mr-4 flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-indigo-600 truncate">{product.name}</h3>
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <Tag className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                          <p>${product.price.toFixed(2)}</p>
                          <span className="mx-2">•</span>
                          <p>Stock: {product.stock}</p>
                          {product.category && (
                            <>
                              <span className="mx-2">•</span>
                              <p>{product.category}</p>
                            </>
                          )}
                        </div>
                        
                        {/* Mostrar información de colores y tallas */}
                        {(product.show_colors || product.show_sizes) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {product.show_colors && product.available_colors && product.available_colors.length > 0 && (
                              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Paintbrush className="h-3 w-3 mr-1" />
                                {product.available_colors.length} colores
                              </div>
                            )}
                            
                            {product.show_sizes && product.available_sizes && product.available_sizes.length > 0 && (
                              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <Ruler className="h-3 w-3 mr-1" />
                                {product.available_sizes.length} tallas
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}