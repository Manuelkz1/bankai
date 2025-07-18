import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Review } from '../types/index';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'react-hot-toast';

// Componente de estrella personalizado que garantiza el relleno visual
const StarIcon = ({ filled }: { filled: boolean }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill={filled ? "#FBBF24" : "none"} 
      stroke="#FBBF24" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
};

export function HomeReviews() {
  const { user } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          products (
            name,
            id,
            images
          )
        `)
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Log para depuración
      console.log('Reviews cargadas:', data);
      
      setReviews(data || []);
    } catch (error) {
      console.error('Error cargando reseñas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para normalizar el rating y asegurar que siempre sea un número válido
  const normalizeRating = (rating: any): number => {
    // Si es undefined o null, devolver 0
    if (rating === undefined || rating === null) return 0;
    
    // Si es un string, convertir a número
    const numRating = typeof rating === 'string' ? parseFloat(rating) : Number(rating);
    
    // Verificar si es un número válido
    if (isNaN(numRating)) return 0;
    
    // Limitar entre 0 y 5
    return Math.min(Math.max(numRating, 0), 5);
  };

  // Calcular el promedio de calificaciones
  const averageRating = reviews.length > 0
    ? reviews.reduce((acc, review) => acc + normalizeRating(review.rating), 0) / reviews.length
    : 0;

  // Renderizar estrellas basadas en la calificación
  const renderStars = (rating: any) => {
    const normalizedRating = normalizeRating(rating);
    
    // Log para depuración
    console.log('Rating original:', rating, 'Rating normalizado:', normalizedRating);
    
    // Aseguramos que el rating sea un número entre 0 y 5
    const safeRating = Math.min(Math.max(normalizedRating, 0), 5);
    
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon 
            key={star} 
            filled={star <= safeRating} 
          />
        ))}
      </div>
    );
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!user || user.role !== 'admin') {
      toast.error('No tienes permisos para eliminar reseñas');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres eliminar esta reseña?')) {
      return;
    }

    try {
      setDeletingId(reviewId);
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;

      // Actualizar la lista local de reseñas
      setReviews(prevReviews => prevReviews.filter(review => review.id !== reviewId));
      toast.success('Reseña eliminada exitosamente');
    } catch (error) {
      console.error('Error eliminando reseña:', error);
      toast.error('Error al eliminar la reseña');
    } finally {
      setDeletingId(null);
    }
  };

  const isAdmin = user && user.role === 'admin';

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

  if (reviews.length === 0) {
    return null; // No mostrar la sección si no hay reseñas
  }

  return (
    <div className="bg-white py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Lo que opinan nuestros clientes
          </h2>
          <div className="flex items-center justify-center mt-4">
            {renderStars(averageRating)}
            <span className="ml-2 text-sm text-gray-600">
              {normalizeRating(averageRating).toFixed(1)} de 5 ({reviews.length} opiniones)
            </span>
          </div>
        </div>

        <div className="mt-10">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-gray-50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 relative">
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    disabled={deletingId === review.id}
                    className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Eliminar reseña"
                  >
                    {deletingId === review.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    )}
                  </button>
                )}
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    {(review as any).products?.images && (review as any).products.images.length > 0 && (
                      <Link to={`/product/${(review as any).products.id}`} className="flex-shrink-0">
                        <img 
                          src={(review as any).products.images[0]} 
                          alt={(review as any).products.name} 
                          className="h-12 w-12 object-cover rounded-md"
                        />
                      </Link>
                    )}
                    <div className="ml-3">
                      <Link 
                        to={`/product/${(review as any).products.id}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 truncate"
                      >
                        {(review as any).products?.name || 'Producto'}
                      </Link>
                      <div className="mt-1">
                        {renderStars(review.rating)}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3 mb-2">{review.comment}</p>
                  <div className="flex justify-between items-center mt-4 text-xs text-gray-500">
                    <span>{review.Name || ''}</span>
                    <span>{format(new Date(review.created_at), 'dd/MM/yyyy')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
