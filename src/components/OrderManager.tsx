import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Order } from '../types/index';
import { 
  Trash2, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  TruckIcon, 
  CheckCircle, 
  XCircle, 
  CreditCard,
  RefreshCw,
  Filter,
  Search,
  MessageSquare,
  Package,
  Calendar,
  Phone,
  Mail,
  User,
  MapPin,
  DollarSign,
  Send
} from 'lucide-react';
import { format } from 'date-fns';

const ORDER_STATUS_MAP = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-4 w-4" /> },
  processing: { label: 'En Proceso', color: 'bg-blue-100 text-blue-800', icon: <Package className="h-4 w-4" /> },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800', icon: <TruckIcon className="h-4 w-4" /> },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> }
};

const PAYMENT_STATUS_MAP = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Fallido', color: 'bg-red-100 text-red-800' },
  pending_cod: { label: 'Contra Entrega', color: 'bg-blue-100 text-blue-800' }
};

const PAYMENT_METHOD_MAP = {
  cash_on_delivery: { label: 'Contra Entrega', color: 'bg-blue-100 text-blue-800' },
  mercadopago: { label: 'MercadoPago', color: 'bg-green-100 text-green-800' }
};

const OrderManager: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [orderNote, setOrderNote] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [orders, searchTerm, statusFilter, paymentFilter]);

  const applyFilters = () => {
    let result = [...orders];
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(order => 
        order.customer_name?.toLowerCase().includes(term) ||
        order.customer_email?.toLowerCase().includes(term) ||
        order.id?.toLowerCase().includes(term) ||
        order.shipping_address?.address?.toLowerCase().includes(term) ||
        order.shipping_address?.city?.toLowerCase().includes(term)
      );
    }
    
    // Filter by order status
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }
    
    // Filter by payment status
    if (paymentFilter !== 'all') {
      if (paymentFilter === 'cash_on_delivery') {
        result = result.filter(order => order.payment_method === 'cash_on_delivery');
      } else if (paymentFilter === 'mercadopago') {
        result = result.filter(order => order.payment_method === 'mercadopago');
      } else {
        result = result.filter(order => order.payment_status === paymentFilter);
      }
    }
    
    setFilteredOrders(result);
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get only confirmed orders (paid or cash on delivery)
      const { data, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            price_at_time,
            selected_color,
            selected_size,
            products (
              id,
              name,
              images
            )
          )
        `)
        .or('payment_status.eq.paid,payment_method.eq.cash_on_delivery')
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error loading orders:', ordersError);
        setError('Error loading orders: ' + ordersError.message);
        toast.error('Error al cargar los pedidos');
        setLoading(false);
        return;
      }
      
      if (!data || data.length === 0) {
        console.log('No confirmed orders found');
        setOrders([]);
        setFilteredOrders([]);
        setLoading(false);
        return;
      }
      
      // Process orders to add customer info
      const processedOrders = data.map(order => {
        // Extract customer info from shipping_address or guest_info
        const customerName = order.shipping_address?.full_name || order.guest_info?.full_name || 'N/A';
        const customerEmail = order.guest_info?.email || 'N/A';
        const customerPhone = order.shipping_address?.phone || order.guest_info?.phone || 'N/A';
        
        return {
          ...order,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          total_amount: order.total
        };
      });
      
      setOrders(processedOrders);
      setFilteredOrders(processedOrders);
      setSelectedOrders([]);
      setSelectAll(false);
      
    } catch (error: any) {
      console.error('General error loading orders:', error);
      setError('General error: ' + error.message);
      toast.error('Error al cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este pedido? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      // First delete order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // Then delete the order
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success('Pedido eliminado exitosamente');
      loadOrders();
      
      // If the deleted order was selected, close the modal
      if (selectedOrder?.id === orderId) {
        setShowOrderDetailModal(false);
        setSelectedOrder(null);
      }
    } catch (error: any) {
      console.error('Error deleting order:', error);
      toast.error('Error al eliminar el pedido');
    }
  };

  const handleDeleteSelectedOrders = async () => {
    setShowDeleteConfirmation(false);
    
    if (selectedOrders.length === 0) {
      toast.error('No hay pedidos seleccionados para eliminar');
      return;
    }

    try {
      setLoading(true);
      
      // First delete order items for all selected orders
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', selectedOrders);

      if (itemsError) throw itemsError;

      // Then delete the orders
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedOrders);

      if (error) throw error;
      
      toast.success(`${selectedOrders.length} pedidos eliminados exitosamente`);
      
      // Reload orders and clear selections
      await loadOrders();
      
    } catch (error: any) {
      console.error('Error deleting orders:', error);
      toast.error('Error al eliminar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status'], note?: string) => {
    try {
      setUpdatingStatus(true);
      
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      // Add note if provided
      if (note) {
        updateData.notes = note;
      }
      
      // Add custom message if enabled
      if (useCustomMessage && customMessage.trim()) {
        updateData.custom_message = customMessage.trim();
      }
      
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      // Update the order in the local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { 
            ...order, 
            status, 
            notes: note || order.notes,
            custom_message: useCustomMessage && customMessage.trim() ? customMessage.trim() : order.custom_message
          } : order
        )
      );
      
      // Also update in filtered orders
      setFilteredOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { 
            ...order, 
            status, 
            notes: note || order.notes,
            custom_message: useCustomMessage && customMessage.trim() ? customMessage.trim() : order.custom_message
          } : order
        )
      );
      
      // Update selected order if in modal
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status,
          notes: note || selectedOrder.notes,
          custom_message: useCustomMessage && customMessage.trim() ? customMessage.trim() : selectedOrder.custom_message
        });
      }
      
      toast.success(`Estado del pedido actualizado a "${ORDER_STATUS_MAP[status]?.label || status}"`);
      
      // Clear fields
      setOrderNote('');
      if (useCustomMessage && customMessage) {
        toast.success('Mensaje personalizado añadido al pedido');
        setCustomMessage('');
        setUseCustomMessage(false);
      }
    } catch (error: any) {
      console.error('Error updating order status:', error);
      toast.error('Error al actualizar el estado del pedido');
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  const handleViewOrderDetails = async (order: Order) => {
    console.log('Viewing order details:', order.id);
    setSelectedOrder(order);
    setShowOrderDetailModal(true);
    setOrderNote(order.notes || '');
    setCustomMessage(order.custom_message || '');
    setUseCustomMessage(!!order.custom_message);
  };

  const toggleOrderExpand = (orderId: string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
    }
  };

  const handleSelectOrder = (orderId: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
      setSelectAll(false);
    }
  };

  const handleSelectAll = (isChecked: boolean) => {
    setSelectAll(isChecked);
    if (isChecked) {
      setSelectedOrders(filteredOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const getTotalItems = (order: Order) => {
    return order.order_items?.reduce((total, item) => total + item.quantity, 0) || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Gestión de Pedidos
        </h2>
        
        <div className="flex space-x-4">
          <button
            onClick={loadOrders}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Actualizar
          </button>
          
          {selectedOrders.length > 0 && (
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Eliminar seleccionados ({selectedOrders.length})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente, email, ID..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="processing">En Proceso</option>
                <option value="shipped">Enviado</option>
                <option value="delivered">Entregado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            
            <div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="all">Todos los pagos</option>
                <option value="cash_on_delivery">Contra Entrega</option>
                <option value="mercadopago">MercadoPago</option>
                <option value="paid">Pagados</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay pedidos disponibles</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== 'all' || paymentFilter !== 'all' 
              ? 'No se encontraron pedidos con los filtros aplicados.' 
              : 'Aún no hay pedidos confirmados en el sistema.'}
          </p>
          {(searchTerm || statusFilter !== 'all' || paymentFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPaymentFilter('all');
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-2 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pago
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <React.Fragment key={order.id}>
                    <tr className={expandedOrderId === order.id ? 'bg-gray-50' : ''}>
                      <td className="px-2 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          #{order.id.substring(0, 8)}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Package className="h-4 w-4 mr-1" />
                          {getTotalItems(order)} productos
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">
                          {order.customer_name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.customer_email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ORDER_STATUS_MAP[order.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {ORDER_STATUS_MAP[order.status]?.icon}
                          <span className="ml-1">{ORDER_STATUS_MAP[order.status]?.label || order.status}</span>
                        </span>
                        {order.custom_message && (
                          <div className="mt-1 text-xs text-gray-600 flex items-center">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            <span className="truncate max-w-[150px]">{order.custom_message}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${PAYMENT_METHOD_MAP[order.payment_method]?.color || 'bg-gray-100 text-gray-800'}`}>
                            {PAYMENT_METHOD_MAP[order.payment_method]?.label || order.payment_method}
                          </span>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${PAYMENT_STATUS_MAP[order.payment_status]?.color || 'bg-gray-100 text-gray-800'}`}>
                            {PAYMENT_STATUS_MAP[order.payment_status]?.label || order.payment_status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <span>{order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy') : 'N/A'}</span>
                          <span className="text-xs">{order.created_at ? format(new Date(order.created_at), 'HH:mm') : ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleViewOrderDetails(order)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50"
                            title="Ver detalles"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => toggleOrderExpand(order.id)}
                            className="text-gray-600 hover:text-gray-900 p-1 rounded-full hover:bg-gray-50"
                            title={expandedOrderId === order.id ? "Ocultar opciones" : "Mostrar opciones"}
                          >
                            {expandedOrderId === order.id ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                            title="Eliminar pedido"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedOrderId === order.id && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <MapPin className="h-4 w-4 mr-1 text-gray-500" />
                                Dirección de envío
                              </h4>
                              <div className="text-sm text-gray-600 bg-white p-3 rounded-md shadow-sm">
                                <p><strong>{order.shipping_address?.full_name}</strong></p>
                                <p>{order.shipping_address?.address}</p>
                                <p>{order.shipping_address?.city}, {order.shipping_address?.postal_code}</p>
                                <p>{order.shipping_address?.country}</p>
                                <p className="mt-1 flex items-center">
                                  <Phone className="h-4 w-4 mr-1 text-gray-500" />
                                  WhatsApp: {order.shipping_address?.phone || 'No disponible'}
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <User className="h-4 w-4 mr-1 text-gray-500" />
                                Información del cliente
                              </h4>
                              <div className="text-sm text-gray-600 bg-white p-3 rounded-md shadow-sm">
                                <p><strong>Nombre:</strong> {order.customer_name || 'No disponible'}</p>
                                <p className="flex items-center">
                                  <Mail className="h-4 w-4 mr-1 text-gray-500" />
                                  {order.customer_email || 'No disponible'}
                                </p>
                                <p className="flex items-center">
                                  <Phone className="h-4 w-4 mr-1 text-gray-500" />
                                  WhatsApp: {order.customer_phone || 'No disponible'}
                                </p>
                                <p className="mt-1 flex items-center">
                                  <DollarSign className="h-4 w-4 mr-1 text-gray-500" />
                                  <strong>Total:</strong> ${order.total ? order.total.toFixed(2) : 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {order.notes && (
                            <div className="mb-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <MessageSquare className="h-4 w-4 mr-1 text-gray-500" />
                                Notas
                              </h4>
                              <div className="text-sm text-gray-600 bg-white p-3 rounded-md shadow-sm">
                                {order.notes}
                              </div>
                            </div>
                          )}
                          
                          {order.custom_message && (
                            <div className="mb-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <MessageSquare className="h-4 w-4 mr-1 text-green-500" />
                                Mensaje personalizado para el cliente
                              </h4>
                              <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-md shadow-sm border border-green-100">
                                {order.custom_message}
                              </div>
                            </div>
                          )}
                          
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Actualizar estado</h4>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'pending')}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                              >
                                <Clock className="h-4 w-4 mr-2" />
                                Pendiente
                              </button>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'processing')}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                <Package className="h-4 w-4 mr-2" />
                                En Proceso
                              </button>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                              >
                                <TruckIcon className="h-4 w-4 mr-2" />
                                Enviado
                              </button>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Entregado
                              </button>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelado
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {order.order_items && order.order_items.length > 0 && order.order_items.map((item, index) => (
                              <div key={index} className="flex bg-white rounded-lg shadow-sm overflow-hidden">
                                {item.products?.images && item.products.images[0] && (
                                  <div className="flex-shrink-0 w-20 h-20">
                                    <img
                                      className="w-full h-full object-cover"
                                      src={item.products.images[0]}
                                      alt={item.products?.name || 'Producto'}
                                    />
                                  </div>
                                )}
                                <div className="flex-1 p-3">
                                  <div className="text-sm font-medium text-gray-900">
                                    {item.products?.name || 'Producto desconocido'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Cantidad: {item.quantity}
                                  </div>
                                  {item.selected_color && (
                                    <div className="text-xs text-gray-500">
                                      Color: {item.selected_color}
                                    </div>
                                  )}
                                  {item.selected_size && (
                                    <div className="text-xs text-gray-500">
                                      Talla: {item.selected_size}
                                    </div>
                                  )}
                                  <div className="text-xs font-medium text-gray-900 mt-1">
                                    ${item.price_at_time.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for delete confirmation */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirmar eliminación
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              ¿Estás seguro de que quieres eliminar {selectedOrders.length} pedidos? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSelectedOrders}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 className="h-5 w-5 mr-2" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order details modal */}
      {showOrderDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Package className="h-5 w-5 mr-2 text-indigo-600" />
                Detalles del Pedido #{selectedOrder.id.substring(0, 8)}
              </h3>
              <button
                onClick={() => setShowOrderDetailModal(false)}
                className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  Información del Cliente
                </h4>
                <div className="space-y-2">
                  <p className="text-sm text-gray-900 flex items-center">
                    <span className="font-medium w-24">Nombre:</span> 
                    {selectedOrder.customer_name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-900 flex items-center">
                    <span className="font-medium w-24">Email:</span> 
                    {selectedOrder.customer_email || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-900 flex items-center">
                    <span className="font-medium w-24">WhatsApp:</span> 
                    {selectedOrder.customer_phone || 'N/A'}
                  </p>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                  Información del Pedido
                </h4>
                <div className="space-y-2">
                  <p className="text-sm text-gray-900 flex items-center">
                    <span className="font-medium w-24">Fecha:</span> 
                    {selectedOrder.created_at ? format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-900 flex items-center">
                    <span className="font-medium w-24">Estado:</span> 
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ORDER_STATUS_MAP[selectedOrder.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                      {ORDER_STATUS_MAP[selectedOrder.status]?.label || selectedOrder.status}
                    </span>
                  </p>
                  <p className="text-sm text-gray-900 flex items-center">
                    <span className="font-medium w-24">Pago:</span> 
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${PAYMENT_STATUS_MAP[selectedOrder.payment_status]?.color || 'bg-gray-100 text-gray-800'}`}>
                      {PAYMENT_STATUS_MAP[selectedOrder.payment_status]?.label || selectedOrder.payment_status}
                    </span>
                  </p>
                  <p className="text-sm text-gray-900 flex items-center">
                    <span className="font-medium w-24">Método:</span> 
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${PAYMENT_METHOD_MAP[selectedOrder.payment_method]?.color || 'bg-gray-100 text-gray-800'}`}>
                      {PAYMENT_METHOD_MAP[selectedOrder.payment_method]?.label || selectedOrder.payment_method}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                Dirección de Envío
              </h4>
              <p className="text-sm text-gray-900">
                {selectedOrder.shipping_address?.full_name}<br />
                {selectedOrder.shipping_address?.address}<br />
                {selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.postal_code}<br />
                {selectedOrder.shipping_address?.country}<br />
                <span className="flex items-center mt-1">
                  <Phone className="h-4 w-4 mr-1 text-gray-500" />
                  WhatsApp: {selectedOrder.shipping_address?.phone || 'No disponible'}
                </span>
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Package className="h-4 w-4 mr-2 text-gray-500" />
                Productos
              </h4>
              {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                <div className="space-y-3">
                  {selectedOrder.order_items.map((item, index) => (
                    <div key={index} className="flex bg-white p-3 rounded-md shadow-sm">
                      {item.products?.images && item.products.images[0] && (
                        <div className="flex-shrink-0 h-16 w-16 mr-4">
                          <img
                            className="h-16 w-16 rounded-md object-cover"
                            src={item.products.images[0]}
                            alt={item.products?.name || 'Producto'}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {item.products?.name || 'Producto desconocido'}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Cantidad: {item.quantity}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Precio: ${item.price_at_time.toFixed(2)}
                          </span>
                          {item.selected_color && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Color: {item.selected_color}
                            </span>
                          )}
                          {item.selected_size && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Talla: {item.selected_size}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          ${(item.price_at_time * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <div className="text-base font-medium text-gray-900">
                      Total: ${selectedOrder.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay productos disponibles para este pedido.</p>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <MessageSquare className="h-4 w-4 mr-2 text-gray-500" />
                Notas y Actualización de Estado
              </h4>
              <div className="mb-4">
                <label htmlFor="orderNote" className="block text-sm font-medium text-gray-700 mb-1">
                  Notas internas (solo visibles para administradores)
                </label>
                <textarea
                  id="orderNote"
                  rows={2}
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Añade notas o instrucciones internas para este pedido..."
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              
              <div className="mb-4">
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="useCustomMessage"
                    checked={useCustomMessage}
                    onChange={(e) => setUseCustomMessage(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="useCustomMessage" className="ml-2 block text-sm font-medium text-gray-700">
                    Añadir mensaje personalizado para el cliente
                  </label>
                </div>
                
                {useCustomMessage && (
                  <div className="mt-2">
                    <textarea
                      rows={3}
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Ej: Tu pedido está empacado y será enviado esta tarde por la transportadora Servientrega."
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Este mensaje será visible para el cliente en su sección de pedidos.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'pending', orderNote)}
                  disabled={updatingStatus}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Pendiente
                </button>
                <button
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'processing', orderNote)}
                  disabled={updatingStatus}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <Package className="h-4 w-4 mr-2" />
                  En Proceso
                </button>
                <button
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'shipped', orderNote)}
                  disabled={updatingStatus}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                >
                  <TruckIcon className="h-4 w-4 mr-2" />
                  Enviado
                </button>
                <button
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'delivered', orderNote)}
                  disabled={updatingStatus}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Entregado
                </button>
                <button
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'cancelled', orderNote)}
                  disabled={updatingStatus}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelado
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowOrderDetailModal(false)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManager;