import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Order } from '../types/index';
import { format } from 'date-fns';
import { 
  Package, 
  ChevronRight, 
  ArrowLeft, 
  Clock, 
  RefreshCw,
  CreditCard,
  AlertTriangle,
  ExternalLink,
  X,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PendingPaymentsPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  useEffect(() => {
    loadPendingOrders();
  }, [user]);

  const loadPendingOrders = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Load orders with payment_pending or mercadopago pending without payment URL
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            price_at_time,
            selected_color,
            products (
              name,
              images,
              shipping_days
            )
          )
        `)
        .eq('user_id', user.id)
        .or('payment_status.eq.payment_pending,and(payment_method.eq.mercadopago,payment_status.eq.pending)')
        .neq('status', 'cancelled') // Exclude cancelled orders
        .neq('status', 'completed') // Exclude completed orders
        .neq('payment_status', 'paid') // Exclude paid orders
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading pending orders:', error);
        setError('Error al cargar los pedidos pendientes');
        return;
      }

      setOrders(data || []);
    } catch (error) {
      console.error('Error loading pending orders:', error);
      setError('Error al cargar los pedidos pendientes');
    } finally {
      setLoading(false);
    }
  };

  const retryPayment = async (order: Order) => {
    setProcessingOrder(order.id);

    try {
      // Recreate MercadoPago payment preference
      const { data: payment, error: paymentError } = await supabase.functions.invoke('create-payment', {
        body: {
          orderId: order.id,
          items: order.order_items?.map(item => ({
            product: {
              name: item.products.name,
              price: Number(item.price_at_time)
            },
            quantity: item.quantity
          })) || [],
          total: order.total
        }
      });

      if (paymentError || !payment?.init_point) {
        throw new Error(paymentError?.message || 'Error al crear preferencia de pago');
      }

      await supabase
        .from('orders')
        .update({ 
          payment_url: payment.init_point,
          payment_status: 'pending'
        })
        .eq('id', order.id);

      window.open(payment.init_point, '_blank');
      toast.success('Redirigiendo a MercadoPago...');

      setTimeout(loadPendingOrders, 2000);
    } catch (error) {
      console.error('Error retrying payment:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setProcessingOrder(null);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('¿Estás seguro de que quieres cancelar este pedido?')) {
      return;
    }

    try {
      setCancellingOrder(orderId);
      
      console.log('Cancelando pedido:', orderId);
      
      // Update order status to cancelled
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          payment_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('user_id', user?.id); // Ensure only the owner can cancel

      if (error) {
        console.error('Error cancelling order:', error);
        toast.error('Error al cancelar el pedido: ' + error.message);
        return;
      }
      
      console.log('Pedido cancelado exitosamente en la base de datos');
      
      // Remove the order from the local list immediately
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.filter(order => order.id !== orderId);
        console.log('Pedidos actualizados:', updatedOrders.length);
        return updatedOrders;
      });
      
      toast.success('Pedido cancelado exitosamente');
      
      // Reload the list to ensure synchronization
      setTimeout(() => {
        loadPendingOrders();
      }, 1000);
      
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Error al cancelar el pedido');
    } finally {
      setCancellingOrder(null);
    }
  };

  const getStatusDisplay = (order: Order) => {
    if (order.payment_status === 'payment_pending') {
      return {
        text: 'Pago Pendiente',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        icon: <Clock className="w-4 h-4" />
      };
    }
    return {
      text: 'Esperando Pago',
      color: 'text-yellow-600', 
      bgColor: 'bg-yellow-100',
      icon: <AlertTriangle className="w-4 h-4" />
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={loadPendingOrders}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            to="/my-orders" 
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Volver a Pedidos Completados
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm mb-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Pagos Pendientes</h1>
                <p className="text-gray-600">
                  Completa estos pagos para procesar tus pedidos
                </p>
              </div>
            </div>
            
            {/* Navigation to Completed Orders */}
            <Link
              to="/my-orders"
              className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="text-left">
                  <div className="font-medium text-green-800">
                    Pedidos Completados
                  </div>
                  <div className="text-sm text-green-700">
                    Ver pedidos exitosos
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-green-600" />
            </Link>
          </div>
        </div>

        {/* Pending Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes pagos pendientes
            </h3>
            <p className="text-gray-500 mb-6">
              Todos tus pedidos han sido procesados correctamente
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/my-orders"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Ver Pedidos Completados
              </Link>
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Seguir Comprando
                <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const status = getStatusDisplay(order);

              return (
                <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-gray-900">
                            Pedido #{order.id.slice(-8).toUpperCase()}
                          </h3>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                            {status.icon}
                            {status.text}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-4">
                        <p>Fecha: {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</p>
                        <p>Total: ${order.total.toLocaleString()}</p>
                        <p>Dirección: {order.shipping_address.address}, {order.shipping_address.city}</p>
                      </div>

                      {/* Products */}
                      <div className="space-y-2">
                        {order.order_items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                            {item.products.images?.[0] && (
                              <img 
                                src={item.products.images[0]} 
                                alt={item.products.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.products.name}</p>
                              <p className="text-xs text-gray-600">
                                Cantidad: {item.quantity} × ${item.price_at_time.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 lg:w-48">
                      <button
                        onClick={() => retryPayment(order)}
                        disabled={processingOrder === order.id || cancellingOrder === order.id}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {processingOrder === order.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                        Completar Pago
                      </button>

                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={processingOrder === order.id || cancellingOrder === order.id}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {cancellingOrder === order.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        {cancellingOrder === order.id ? 'Cancelando...' : 'Cancelar Pedido'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}