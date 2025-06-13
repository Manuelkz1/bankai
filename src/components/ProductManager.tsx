import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Product, ColorImage } from '../types/index';
import { toast } from 'react-hot-toast';
import { 
  Pencil, 
  Trash2, 
  Plus, 
  X, 
  Truck, 
  Upload, 
  FileText, 
  Image as ImageIcon,
  Paintbrush,
  Ruler,
  ToggleLeft,
  ToggleRight,
  Save,
  Clock
} from 'lucide-react';

export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
  const [uploading, setUploading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedManual, setSelectedManual] = useState<File | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [colorImages, setColorImages] = useState<{color: string, file: File | null, preview: string, existingUrl?: string}[]>([]);
  const [newColor, setNewColor] = useState('');
  const [newSize, setNewSize] = useState('');
  const [activeTab, setActiveTab] = useState<'basic' | 'colors' | 'sizes' | 'shipping'>('basic');
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const colorImageInputRef = useRef<HTMLInputElement>(null);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentProduct({ ...currentProduct, [name]: value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setCurrentProduct({ ...currentProduct, [name]: checked });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validar archivos
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name}: Formato no válido. Use JPG, PNG, GIF o WebP`);
        return false;
      }
      
      if (file.size > maxSize) {
        toast.error(`${file.name}: Archivo muy grande. Máximo 5MB`);
        return false;
      }
      
      return true;
    });

    setSelectedImages(prev => [...prev, ...validFiles]);
    
    // Crear previsualizaciones
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImages(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleColorImageSelect = (e: React.ChangeEvent<HTMLInputElement>, colorIndex: number) => {
    const file = e.target.files?.[0];
    
    if (file) {
      // Validar archivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name}: Formato no válido. Use JPG, PNG, GIF o WebP`);
        return;
      }
      
      if (file.size > maxSize) {
        toast.error(`${file.name}: Archivo muy grande. Máximo 5MB`);
        return;
      }
      
      // Crear previsualización
      const reader = new FileReader();
      reader.onload = (e) => {
        setColorImages(prev => {
          const updated = [...prev];
          updated[colorIndex] = {
            ...updated[colorIndex],
            file,
            preview: e.target?.result as string
          };
          return updated;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file) {
      // Validar archivo
      if (file.type !== 'application/pdf') {
        toast.error('Solo se permiten archivos PDF para manuales');
        return;
      }
      
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error('El archivo PDF es muy grande. Máximo 10MB');
        return;
      }
      
      setSelectedManual(file);
    }
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    const currentImages = currentProduct.images || [];
    const newImages = currentImages.filter((_, i) => i !== index);
    setCurrentProduct({ ...currentProduct, images: newImages });
  };

  const addColor = () => {
    if (!newColor.trim()) {
      toast.error('Por favor ingresa un nombre de color');
      return;
    }
    
    // Verificar si el color ya existe
    const existingColors = currentProduct.available_colors || [];
    if (existingColors.includes(newColor.trim())) {
      toast.error('Este color ya existe');
      return;
    }
    
    // Añadir el nuevo color
    setCurrentProduct({
      ...currentProduct,
      available_colors: [...existingColors, newColor.trim()],
      show_colors: true
    });
    
    // Añadir a la lista de imágenes de color
    setColorImages(prev => [
      ...prev,
      { color: newColor.trim(), file: null, preview: '', existingUrl: '' }
    ]);
    
    setNewColor('');
  };

  const removeColor = (colorToRemove: string) => {
    // Eliminar de la lista de colores disponibles
    const existingColors = currentProduct.available_colors || [];
    const updatedColors = existingColors.filter(color => color !== colorToRemove);
    
    // Actualizar el producto
    setCurrentProduct({
      ...currentProduct,
      available_colors: updatedColors,
      show_colors: updatedColors.length > 0
    });
    
    // Eliminar de la lista de imágenes de color
    setColorImages(prev => prev.filter(item => item.color !== colorToRemove));
    
    // Si hay color_images en el producto actual, actualizar también
    if (currentProduct.color_images) {
      const updatedColorImages = currentProduct.color_images.filter(
        item => item.color !== colorToRemove
      );
      setCurrentProduct({
        ...currentProduct,
        color_images: updatedColorImages
      });
    }
  };

  const addSize = () => {
    if (!newSize.trim()) {
      toast.error('Por favor ingresa una talla');
      return;
    }
    
    // Verificar si la talla ya existe
    const existingSizes = currentProduct.available_sizes || [];
    if (existingSizes.includes(newSize.trim())) {
      toast.error('Esta talla ya existe');
      return;
    }
    
    // Añadir la nueva talla
    setCurrentProduct({
      ...currentProduct,
      available_sizes: [...existingSizes, newSize.trim()],
      show_sizes: true
    });
    
    setNewSize('');
  };

  const removeSize = (sizeToRemove: string) => {
    const existingSizes = currentProduct.available_sizes || [];
    const updatedSizes = existingSizes.filter(size => size !== sizeToRemove);
    
    setCurrentProduct({
      ...currentProduct,
      available_sizes: updatedSizes,
      show_sizes: updatedSizes.length > 0
    });
  };

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrl;
  };

  const handleAddProduct = () => {
    setFormMode('add');
    setCurrentProduct({
      show_colors: false,
      show_sizes: false,
      available_colors: [],
      available_sizes: [],
      color_images: []
    });
    setSelectedImages([]);
    setSelectedManual(null);
    setPreviewImages([]);
    setColorImages([]);
    setActiveTab('basic');
    setShowForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setFormMode('edit');
    
    // Preparar las imágenes de color para la edición
    const colorImagesForEdit = (product.available_colors || []).map(color => {
      const colorImageObj = product.color_images?.find(ci => ci.color === color);
      return {
        color,
        file: null,
        preview: '',
        existingUrl: colorImageObj?.image || ''
      };
    });
    
    setCurrentProduct(product);
    setSelectedImages([]);
    setSelectedManual(null);
    setPreviewImages([]);
    setColorImages(colorImagesForEdit);
    setActiveTab('basic');
    setShowForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este producto?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Producto eliminado correctamente');
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar el producto');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setUploading(true);
      
      let imageUrls = currentProduct.images || [];
      let manualUrl = currentProduct.instructions_file;
      let colorImagesData: ColorImage[] = currentProduct.color_images || [];

      // Subir nuevas imágenes
      if (selectedImages.length > 0) {
        const uploadPromises = selectedImages.map(async (file, index) => {
          const fileName = `${Date.now()}-${index}-${file.name}`;
          const filePath = `products/${fileName}`;
          return uploadFile(file, 'products', filePath);
        });

        const newImageUrls = await Promise.all(uploadPromises);
        imageUrls = [...imageUrls, ...newImageUrls];
      }

      // Subir nuevo manual
      if (selectedManual) {
        const fileName = `${Date.now()}-${selectedManual.name}`;
        const filePath = `instructions/${fileName}`;
        manualUrl = await uploadFile(selectedManual, 'instructions', filePath);
      }

      // Procesar imágenes de color
      for (let i = 0; i < colorImages.length; i++) {
        const colorImage = colorImages[i];
        
        // Si hay un archivo nuevo para este color, subirlo
        if (colorImage.file) {
          const fileName = `${Date.now()}-color-${colorImage.color}-${colorImage.file.name}`;
          const filePath = `products/${fileName}`;
          const colorImageUrl = await uploadFile(colorImage.file, 'products', filePath);
          
          // Actualizar o añadir a colorImagesData
          const existingIndex = colorImagesData.findIndex(ci => ci.color === colorImage.color);
          if (existingIndex >= 0) {
            colorImagesData[existingIndex].image = colorImageUrl;
          } else {
            colorImagesData.push({
              color: colorImage.color,
              image: colorImageUrl
            });
          }
        } 
        // Si no hay un archivo nuevo pero hay una URL existente, mantenerla
        else if (colorImage.existingUrl) {
          const existingIndex = colorImagesData.findIndex(ci => ci.color === colorImage.color);
          if (existingIndex === -1) {
            colorImagesData.push({
              color: colorImage.color,
              image: colorImage.existingUrl
            });
          }
        }
      }

      // Preparar datos del producto
      const productData = {
        ...currentProduct,
        images: imageUrls,
        instructions_file: manualUrl,
        price: parseFloat(currentProduct.price as string) || 0,
        stock: parseInt(currentProduct.stock as string) || 0,
        color_images: colorImagesData,
        show_colors: currentProduct.show_colors && (currentProduct.available_colors?.length || 0) > 0,
        show_sizes: currentProduct.show_sizes && (currentProduct.available_sizes?.length || 0) > 0
      };

      if (formMode === 'add') {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        toast.success('Producto añadido correctamente');
      } else {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', currentProduct.id);

        if (error) throw error;
        toast.success('Producto actualizado correctamente');
      }

      setShowForm(false);
      setSelectedImages([]);
      setSelectedManual(null);
      setPreviewImages([]);
      setColorImages([]);
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error al guardar el producto');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Gestión de Productos</h2>
        <button
          onClick={handleAddProduct}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Añadir Producto
        </button>
      </div>

      {showForm ? (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">
              {formMode === 'add' ? 'Añadir Producto' : 'Editar Producto'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Tabs de navegación */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('basic')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'basic'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Información Básica
              </button>
              <button
                onClick={() => setActiveTab('colors')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'colors'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Paintbrush className="h-4 w-4 mr-2" />
                Colores
              </button>
              <button
                onClick={() => setActiveTab('sizes')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'sizes'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Ruler className="h-4 w-4 mr-2" />
                Tallas
              </button>
              <button
                onClick={() => setActiveTab('shipping')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'shipping'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Truck className="h-4 w-4 mr-2" />
                Envío
              </button>
            </nav>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tab: Información Básica */}
            {activeTab === 'basic' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={currentProduct.name || ''}
                      onChange={handleInputChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                      Precio
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      id="price"
                      name="price"
                      value={currentProduct.price || ''}
                      onChange={handleInputChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="stock" className="block text-sm font-medium text-gray-700 mb-1">
                      Stock
                    </label>
                    <input
                      type="number"
                      id="stock"
                      name="stock"
                      value={currentProduct.stock || ''}
                      onChange={handleInputChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría
                    </label>
                    <input
                      type="text"
                      id="category"
                      name="category"
                      value={currentProduct.category || ''}
                      onChange={handleInputChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={currentProduct.description || ''}
                    onChange={handleInputChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                {/* Sección de Imágenes */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imágenes del Producto
                  </label>
                  
                  {/* Imágenes existentes */}
                  {currentProduct.images && currentProduct.images.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Imágenes actuales:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {currentProduct.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <img 
                              src={image} 
                              alt={`Producto ${index + 1}`} 
                              className="h-24 w-24 object-cover rounded-md border border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Previsualización de nuevas imágenes */}
                  {previewImages.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Nuevas imágenes:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {previewImages.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img 
                              src={preview} 
                              alt={`Nueva imagen ${index + 1}`} 
                              className="h-24 w-24 object-cover rounded-md border border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={() => removeSelectedImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Botón para seleccionar imágenes */}
                  <div className="mt-2">
                    <input
                      type="file"
                      ref={imageInputRef}
                      onChange={handleImageSelect}
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <ImageIcon className="h-5 w-5 mr-2 text-gray-500" />
                      Seleccionar imágenes
                    </button>
                    <p className="mt-1 text-xs text-gray-500">
                      Formatos: JPG, PNG, GIF, WebP. Máximo 5MB por imagen.
                    </p>
                  </div>
                </div>

                {/* Sección de Manual/Instrucciones */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manual de Instrucciones (PDF)
                  </label>
                  
                  {/* Manual existente */}
                  {currentProduct.instructions_file && (
                    <div className="mb-4 flex items-center">
                      <a 
                        href={currentProduct.instructions_file} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 flex items-center"
                      >
                        <FileText className="h-5 w-5 mr-2" />
                        Manual actual
                      </a>
                      <button
                        type="button"
                        onClick={() => setCurrentProduct({...currentProduct, instructions_file: undefined})}
                        className="ml-4 text-red-600 hover:text-red-800"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                  
                  {/* Nuevo manual seleccionado */}
                  {selectedManual && (
                    <div className="mb-4 flex items-center p-2 bg-gray-50 rounded-md">
                      <FileText className="h-5 w-5 mr-2 text-gray-600" />
                      <span className="text-sm text-gray-700">{selectedManual.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedManual(null)}
                        className="ml-auto text-red-600 hover:text-red-800"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                  
                  {/* Botón para seleccionar manual */}
                  <div className="mt-2">
                    <input
                      type="file"
                      ref={manualInputRef}
                      onChange={handleManualSelect}
                      accept="application/pdf"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => manualInputRef.current?.click()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <FileText className="h-5 w-5 mr-2 text-gray-500" />
                      Seleccionar archivo PDF
                    </button>
                    <p className="mt-1 text-xs text-gray-500">
                      Solo archivos PDF. Máximo 10MB.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Colores */}
            {activeTab === 'colors' && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="flex items-center">
                    <label htmlFor="show_colors" className="mr-2 text-sm font-medium text-gray-700">
                      Activar selección de colores
                    </label>
                    <button
                      type="button"
                      onClick={() => setCurrentProduct({
                        ...currentProduct,
                        show_colors: !currentProduct.show_colors
                      })}
                      className="focus:outline-none"
                    >
                      {currentProduct.show_colors ? (
                        <ToggleRight className="h-6 w-6 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {currentProduct.show_colors && (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={newColor}
                          onChange={(e) => setNewColor(e.target.value)}
                          placeholder="Nombre del color (ej: Rojo, Azul, etc.)"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={addColor}
                          className="ml-2 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Añadir
                        </button>
                      </div>
                    </div>

                    {/* Lista de colores */}
                    {(currentProduct.available_colors?.length || 0) > 0 ? (
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">Colores disponibles</h4>
                        {colorImages.map((colorItem, index) => (
                          <div key={index} className="border rounded-lg p-4 bg-gray-50">
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center">
                                <div 
                                  className="w-6 h-6 rounded-full mr-2" 
                                  style={{ backgroundColor: colorItem.color.toLowerCase() }}
                                ></div>
                                <span className="font-medium">{colorItem.color}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeColor(colorItem.color)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                            
                            <div className="mt-2">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Imagen para este color
                              </label>
                              
                              {/* Mostrar imagen existente o previsualización */}
                              {(colorItem.existingUrl || colorItem.preview) && (
                                <div className="mb-3">
                                  <img 
                                    src={colorItem.preview || colorItem.existingUrl} 
                                    alt={`Color ${colorItem.color}`} 
                                    className="h-32 w-32 object-cover rounded-md border border-gray-300"
                                  />
                                </div>
                              )}
                              
                              <input
                                type="file"
                                onChange={(e) => handleColorImageSelect(e, index)}
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                className="block w-full text-sm text-gray-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-md file:border-0
                                  file:text-sm file:font-medium
                                  file:bg-indigo-50 file:text-indigo-700
                                  hover:file:bg-indigo-100"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Selecciona una imagen que represente este color.
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No hay colores definidos. Añade colores para que los clientes puedan seleccionarlos.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tab: Tallas */}
            {activeTab === 'sizes' && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="flex items-center">
                    <label htmlFor="show_sizes" className="mr-2 text-sm font-medium text-gray-700">
                      Activar selección de tallas
                    </label>
                    <button
                      type="button"
                      onClick={() => setCurrentProduct({
                        ...currentProduct,
                        show_sizes: !currentProduct.show_sizes
                      })}
                      className="focus:outline-none"
                    >
                      {currentProduct.show_sizes ? (
                        <ToggleRight className="h-6 w-6 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {currentProduct.show_sizes && (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={newSize}
                          onChange={(e) => setNewSize(e.target.value)}
                          placeholder="Talla (ej: S, M, L, XL, 38, 40, etc.)"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={addSize}
                          className="ml-2 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Añadir
                        </button>
                      </div>
                    </div>

                    {/* Lista de tallas */}
                    {(currentProduct.available_sizes?.length || 0) > 0 ? (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Tallas disponibles</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentProduct.available_sizes?.map((size, index) => (
                            <div key={index} className="bg-gray-100 rounded-lg px-3 py-2 flex items-center">
                              <span className="text-gray-800">{size}</span>
                              <button
                                type="button"
                                onClick={() => removeSize(size)}
                                className="ml-2 text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No hay tallas definidas. Añade tallas para que los clientes puedan seleccionarlas.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tab: Envío */}
            {activeTab === 'shipping' && (
              <div>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="shipping_days" className="block text-sm font-medium text-gray-700">
                      Días Hábiles de Envío
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="text"
                      id="shipping_days"
                      name="shipping_days"
                      value={currentProduct.shipping_days || ''}
                      onChange={handleInputChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Ej: 3-5, 7-10, 15"
                    />
                    <Truck className="h-5 w-5 ml-2 text-indigo-600" />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Tiempo estimado de entrega en días hábiles. Puedes usar un rango (ej: "3-5") o un número exacto.
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-center mb-2">
                    <div className="flex items-center">
                      <label htmlFor="show_delivery_time" className="mr-2 text-sm font-medium text-gray-700">
                        Mostrar tiempo de entrega
                      </label>
                      <button
                        type="button"
                        onClick={() => setCurrentProduct({
                          ...currentProduct,
                          show_delivery_time: !currentProduct.show_delivery_time
                        })}
                        className="focus:outline-none"
                      >
                        {currentProduct.show_delivery_time ? (
                          <ToggleRight className="h-6 w-6 text-indigo-600" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {currentProduct.show_delivery_time && (
                    <div>
                      <label htmlFor="delivery_time" className="block text-sm font-medium text-gray-700 mb-1">
                        Texto personalizado de tiempo de entrega
                      </label>
                      <div className="flex items-center">
                        <input
                          type="text"
                          id="delivery_time"
                          name="delivery_time"
                          value={currentProduct.delivery_time || ''}
                          onChange={handleInputChange}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="Ej: Entrega en 3-5 días hábiles"
                        />
                        <Clock className="h-5 w-5 ml-2 text-indigo-600" />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Este texto se mostrará en la página del producto. Si lo dejas vacío, se usará el valor de "Días Hábiles de Envío".
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    {formMode === 'add' ? 'Añadir' : 'Guardar'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Atributos
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {product.images && product.images.length > 0 && (
                        <div className="flex-shrink-0 h-10 w-10">
                          <img className="h-10 w-10 rounded-full object-cover" src={product.images[0]} alt="" />
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">${product.price}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.stock}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.category}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      {product.show_colors && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Paintbrush className="h-3 w-3 mr-1" />
                          {product.available_colors?.length || 0} colores
                        </span>
                      )}
                      {product.show_sizes && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <Ruler className="h-3 w-3 mr-1" />
                          {product.available_sizes?.length || 0} tallas
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ProductManager;