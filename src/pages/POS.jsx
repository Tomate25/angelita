import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LockOpen, Lock, ShoppingCart, ChevronUp, Store } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import ProductGrid from '@/components/pos/ProductGrid';
import Cart from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import OrderTabs from '@/components/pos/OrderTabs';
import { useUserRole } from '@/hooks/useUserRole';

let orderTabCounter = 1;

function createNewOrder() {
  return {
    id: `tab-${Date.now()}-${orderTabCounter++}`,
    label: `Mesa ${orderTabCounter - 1}`,
    customer_id: '',
    customer_name: '',
    items: [],
  };
}

export default function POS() {
  const queryClient = useQueryClient();

  const [orders, setOrders] = useState([createNewOrder()]);
  const [activeOrderId, setActiveOrderId] = useState(() => orders[0]?.id);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);

  const { isAdmin, isBranchUser, userBranchId: userBranchIdFromProfile, userRole, loading: roleLoading, user: authUser } = useUserRole();
  // Use authUser from context directly (no extra fetch needed)
  const currentUser = authUser;

  const { data: orderSequences = [] } = useQuery({
    queryKey: ['order-sequences'],
    queryFn: () => base44.entities.OrderSequence.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: cashRegisters = [] } = useQuery({
    queryKey: ['cash-registers'],
    queryFn: () => base44.entities.CashRegister.list('-created_date', 100),
    refetchInterval: 30000,
  });

  const { data: inventories = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => base44.entities.Inventory.list(),
  });

  const createOrder = useMutation({
    mutationFn: (data) => base44.entities.Order.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-dashboard'] });
    },
  });

  const createAR = useMutation({
    mutationFn: (data) => base44.entities.AccountReceivable.create(data),
  });

  // Resolver branch del usuario: por branch_id guardado o por rol (nombre de sucursal en lowercase)
  const userBranchId = useMemo(() => {
    if (userBranchIdFromProfile) return userBranchIdFromProfile;
    if (isBranchUser && userRole && branches.length > 0) {
      const match = branches.find(b => b.name.toLowerCase() === userRole.toLowerCase() || b.code.toLowerCase() === userRole.toLowerCase());
      return match?.id || null;
    }
    return null;
  }, [userBranchIdFromProfile, isBranchUser, userRole, branches]);

  // Catálogo de clientes filtrado para vendedores: sucursal + sin asignar
  const scopedCustomers = isBranchUser && userBranchId
    ? customers.filter(c => !c.branch_id || c.branch_id === userBranchId)
    : customers;

  // Cajas disponibles:
  // 1. Para usuario de sucursal: solo cajas abiertas de su sucursal
  // 2. Para admin: todas las cajas abiertas
  // Primero intenta filtrar por email del cajero; si no hay coincidencia (cajas antiguas sin email),
  // cae al filtrado solo por sucursal.
  const availableRegisters = useMemo(() => {
    const openRegs = cashRegisters.filter(r => r.status === 'open');
    if (isBranchUser && userBranchId) {
      // Usuario de sucursal: solo ve su sucursal
      return openRegs.filter(r => r.branch_id === userBranchId);
    }
    // Admin: ve todas las cajas abiertas
    // Prioriza las del mismo cajero si hay email o username
    const myIdentifier = currentUser?.email || currentUser?.username;
    if (myIdentifier) {
      const mine = openRegs.filter(r => r.cashier_email === myIdentifier || r.cashier_email === currentUser?.username);
      if (mine.length > 0) return mine;
    }
    return openRegs;
  }, [cashRegisters, currentUser, isBranchUser, userBranchId]);

  const [selectedRegisterId, setSelectedRegisterId] = useState(() => localStorage.getItem('pos_selected_register_id') || '');
  useEffect(() => {
    if (selectedRegisterId) localStorage.setItem('pos_selected_register_id', selectedRegisterId);
  }, [selectedRegisterId]);
  // Auto-seleccionar la caja si no hay una válida guardada (o si la guardada se cerró)
  useEffect(() => {
    if (availableRegisters.length && !availableRegisters.find(r => r.id === selectedRegisterId)) {
      setSelectedRegisterId(availableRegisters[0].id);
    }
    // Si la caja seleccionada se cerró, limpiar
    if (selectedRegisterId && cashRegisters.length > 0 && !cashRegisters.find(r => r.id === selectedRegisterId && r.status === 'open')) {
      setSelectedRegisterId('');
    }
  }, [availableRegisters, selectedRegisterId, cashRegisters]);

  const openRegister = availableRegisters.find(r => r.id === selectedRegisterId) || availableRegisters[0] || null;

  // La sucursal activa se deriva SIEMPRE de la caja abierta (no de branches[0])
  const activeBranchId = openRegister?.branch_id || (isBranchUser && userBranchId ? userBranchId : branches[0]?.id);

  // Session key única por caja abierta para evitar mezcla entre sucursales
  const SESSION_KEY = openRegister ? `pos_orders_${openRegister.id}` : 'pos_orders_default';
  const SESSION_ACTIVE_KEY = openRegister ? `pos_active_${openRegister.id}` : 'pos_active_default';

  // Cargar órdenes desde sessionStorage cuando ya tenemos la caja resuelta
  useEffect(() => {
    if (!openRegister || sessionLoaded) return;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      const savedActive = sessionStorage.getItem(SESSION_ACTIVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed);
          if (savedActive && parsed.find(o => o.id === savedActive)) {
            setActiveOrderId(savedActive);
          } else {
            setActiveOrderId(parsed[0].id);
          }
        }
      }
    } catch (_) {}
    setSessionLoaded(true);
  }, [openRegister?.id]);

  // Persistir órdenes en sessionStorage con clave única por caja
  useEffect(() => {
    if (!openRegister || !sessionLoaded) return;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(orders)); } catch (_) {}
  }, [orders, SESSION_KEY, sessionLoaded]);

  useEffect(() => {
    if (!openRegister || !sessionLoaded) return;
    try { sessionStorage.setItem(SESSION_ACTIVE_KEY, activeOrderId); } catch (_) {}
  }, [activeOrderId, SESSION_ACTIVE_KEY, sessionLoaded]);

  // Get active order
  const activeOrder = orders.find(o => o.id === activeOrderId) || orders[0];

  const updateActiveOrder = useCallback((updater) => {
    setOrders(prev => prev.map(o => o.id === activeOrderId ? updater(o) : o));
  }, [activeOrderId]);

  const addToCart = (product) => {
    updateActiveOrder(order => {
      const existing = order.items.findIndex(i => i.product_id === product.id);
      if (existing >= 0) {
        const updated = [...order.items];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + 1,
          subtotal: (updated[existing].quantity + 1) * updated[existing].unit_price * (1 - (updated[existing].discount || 0) / 100),
        };
        return { ...order, items: updated };
      }
      return {
        ...order,
        items: [...order.items, {
          product_id: product.id,
          product_name: product.name,
          unit: product.unit,
          quantity: 1,
          unit_price: product.price,
          discount: 0,
          subtotal: product.price,
        }],
      };
    });
  };

  const updateQuantity = (idx, qty) => {
    updateActiveOrder(order => {
      const updated = [...order.items];
      updated[idx] = { ...updated[idx], quantity: qty, subtotal: qty * updated[idx].unit_price * (1 - (updated[idx].discount || 0) / 100) };
      return { ...order, items: updated };
    });
  };

  const updateDiscount = (idx, disc) => {
    updateActiveOrder(order => {
      const updated = [...order.items];
      updated[idx] = { ...updated[idx], discount: disc, subtotal: updated[idx].quantity * updated[idx].unit_price * (1 - disc / 100) };
      return { ...order, items: updated };
    });
  };

  const removeItem = (idx) => {
    updateActiveOrder(order => ({ ...order, items: order.items.filter((_, i) => i !== idx) }));
  };

  const setOrderCustomer = (customerId, customerName) => {
    updateActiveOrder(order => ({ ...order, customer_id: customerId, customer_name: customerName }));
  };

  const addNewTab = () => {
    const newOrder = createNewOrder();
    setOrders(prev => [...prev, newOrder]);
    setActiveOrderId(newOrder.id);
  };

  const closeTab = (tabId) => {
    setOrders(prev => {
      const remaining = prev.filter(o => o.id !== tabId);
      if (remaining.length === 0) {
        const fresh = createNewOrder();
        setActiveOrderId(fresh.id);
        return [fresh];
      }
      if (activeOrderId === tabId) {
        setActiveOrderId(remaining[remaining.length - 1].id);
      }
      return remaining;
    });
  };

  const items = activeOrder?.items || [];
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const discountTotal = items.reduce((sum, i) => sum + (i.quantity * i.unit_price * (i.discount || 0) / 100), 0);
  const total = subtotal - discountTotal;

  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const handlePayment = async (paymentData) => {
    if (isSubmittingPayment) return;
    setIsSubmittingPayment(true);
    try {
    // Capturar snapshot de items ANTES de cualquier mutación de estado
    const itemsSnapshot = [...items];
    const subtotalSnapshot = subtotal;
    const discountTotalSnapshot = discountTotal;
    const totalSnapshot = total;

    const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];
    const branchId = openRegister?.branch_id || activeBranch?.id || '';
    const branchName = openRegister?.branch_name || activeBranch?.name || '';
    const cashierEmail = currentUser?.email || currentUser?.username || '';

    // Generar número de orden secuencial vía función backend (seguro para varios puntos simultáneos)
    const branchObj = branches.find(b => b.id === branchId);
    const branchCode = branchObj?.code?.toUpperCase() || 'ORD';
    const seqResponse = await base44.functions.invoke('generateOrderNumber', { branch_id: branchId, branch_code: branchCode });
    const orderNum = seqResponse.data?.order_number;
    if (!orderNum) {
      throw new Error(seqResponse.data?.error || 'No se pudo generar el número de orden');
    }
    queryClient.invalidateQueries({ queryKey: ['order-sequences'] });

    const orderData = {
      order_number: orderNum,
      branch_id: branchId,
      branch_name: branchName,
      cashier_email: cashierEmail,
      customer_id: paymentData.customer_id === 'none' ? '' : paymentData.customer_id,
      customer_name: paymentData.customer_name,
      status: 'paid',
      items: itemsSnapshot,
      subtotal: subtotalSnapshot,
      discount_total: discountTotalSnapshot,
      total: totalSnapshot,
      payment_method: paymentData.payment_method,
      amount_paid: paymentData.amount_paid,
      change_amount: paymentData.change_amount,
      notes: paymentData.notes,
      opened_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
    };

    const order = await createOrder.mutateAsync(orderData);

    // Descontar inventario por cada producto vendido
    // Para Granada: solo descontar si la orden es del 08/06/2026 en adelante
    const GRANADA_BRANCH_ID = '6a086afef0507f6250c95879';
    const GRANADA_CUTOFF = new Date('2026-06-08T00:00:00');
    const isGranada = branchId === GRANADA_BRANCH_ID;
    const orderDate = new Date();
    // Para Cofradía siempre descuenta, para Granada solo si es posterior al cutoff
    const shouldDeductInventory = !isGranada || orderDate >= GRANADA_CUTOFF;

    for (const item of itemsSnapshot) {
      const inv = inventories.find(i => i.product_id === item.product_id && i.branch_id === branchId);
      const prevQty = inv?.quantity || 0;
      const newQty = prevQty - item.quantity;
      
      // Actualizar inventario (siempre para Cofradía, para Granada solo post-cutoff)
      if (inv && shouldDeductInventory) {
        await base44.entities.Inventory.update(inv.id, {
          quantity: newQty,
          total_value: newQty * (inv.avg_cost || 0),
        });
      }
      
      // Crear movimiento siempre (para historial)
      await base44.entities.InventoryMovement.create({
        product_id: item.product_id,
        product_name: item.product_name,
        branch_id: branchId,
        branch_name: openRegister?.branch_name || activeBranch?.name || '',
        movement_type: 'sale',
        quantity: -item.quantity,
        unit_cost: inv?.avg_cost || 0,
        reference_id: order.id,
        reference_type: 'order',
        notes: `Venta ${orderNum}`,
        previous_stock: prevQty,
        new_stock: newQty,
        movement_date: orderDate.toISOString(),
      });
    }

    // Actualizar totales de caja — leer registro fresco para evitar race condition
    if (openRegister) {
      const pm = paymentData.payment_method;
      const freshRegisters = await base44.entities.CashRegister.list('-created_date', 20);
      const freshReg = freshRegisters.find(r => r.id === openRegister.id);
      const base = freshReg || openRegister;
      await base44.entities.CashRegister.update(openRegister.id, {
        cash_sales: (base.cash_sales || 0) + (pm === 'efectivo' ? totalSnapshot : 0),
        card_sales: (base.card_sales || 0) + (pm === 'tarjeta' ? totalSnapshot : 0),
        transfer_sales: (base.transfer_sales || 0) + (pm === 'transferencia' ? totalSnapshot : 0),
        credit_sales: (base.credit_sales || 0) + (pm === 'credito' ? totalSnapshot : 0),
        total_sales: (base.total_sales || 0) + totalSnapshot,
        total_orders: (base.total_orders || 0) + 1,
      });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
    }

    if (paymentData.payment_method === 'credito' && paymentData.customer_id && paymentData.customer_id !== 'none') {
      const customer = customers.find(c => c.id === paymentData.customer_id);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (customer?.credit_days || 30));
      await createAR.mutateAsync({
        customer_id: paymentData.customer_id,
        customer_name: paymentData.customer_name,
        order_id: order.id,
        order_number: orderNum,
        branch_id: branchId,
        original_amount: totalSnapshot,
        balance: totalSnapshot,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
      });
    }

    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    toast.success(`Venta ${orderNum} completada!`, { description: `Total: C$${totalSnapshot.toFixed(2)}` });
    closeTab(activeOrderId);
    // Retornar datos completos para el ticket — usando snapshot para garantizar integridad
    return { ...orderData, id: order.id, items: itemsSnapshot };
    } catch (error) {
      toast.error('Error al procesar el pago', { description: error?.message || 'Intenta de nuevo' });
    } finally {
      setIsSubmittingPayment(false);
    }
  };


  // Bloquear POS si no hay caja abierta
  if (roleLoading || !currentUser) {
    // Aún cargando rol o usuario
    return null;
  }
  if (!openRegister) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-6 text-center p-8">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-10 h-10 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-heading font-bold mb-2">Caja Cerrada</h2>
          <p className="text-muted-foreground max-w-sm">Debes abrir una caja antes de realizar ventas. Ve a la sección de Caja y abre un turno.</p>
        </div>
        <Link to="/cash-register">
          <Button size="lg" className="gap-2">
            <LockOpen className="w-5 h-5" />
            Ir a Abrir Caja
          </Button>
        </Link>
      </div>
    );
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col sm:flex-row overflow-hidden">
      {/* Left: Product Selection */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-3 pb-0 space-y-2">
          {/* Indicador de caja activa — siempre visible */}
          <div className="flex items-center gap-2 text-xs bg-green-500/10 border border-green-500/20 rounded-md px-3 py-1.5">
            <Store className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <span className="text-green-700 dark:text-green-400 font-medium">
              {openRegister.branch_name} · Caja abierta {openRegister.opened_at ? format(new Date(openRegister.opened_at), 'HH:mm') : ''}
            </span>
            {availableRegisters.length > 1 && (
              <Select value={openRegister?.id || ''} onValueChange={setSelectedRegisterId}>
                <SelectTrigger className="h-6 text-xs ml-auto border-green-400/30 bg-transparent w-auto min-w-[120px]">
                  <SelectValue placeholder="Cambiar caja" />
                </SelectTrigger>
                <SelectContent>
                  {availableRegisters.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.branch_name} · {format(new Date(r.opened_at), 'HH:mm')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
        </div>
        <ProductGrid
          products={products}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onAddProduct={(p) => { addToCart(p); }}
          searchTerm={searchTerm}
        />
      </div>

      {/* Mobile Cart Drawer */}
      <div className={`sm:hidden fixed inset-x-0 bottom-0 z-30 flex flex-col bg-card border-t shadow-2xl transition-all duration-300 ${showCartMobile ? 'h-[80vh]' : 'h-0'}`}>
        {showCartMobile && (
          <div className="flex flex-row h-full">
            <OrderTabs
              orders={orders}
              activeOrderId={activeOrderId}
              onSelectOrder={setActiveOrderId}
              onAddOrder={addNewTab}
              onCloseOrder={closeTab}
              customers={scopedCustomers}
            />
            <Cart
              order={activeOrder}
              items={items}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              onUpdateDiscount={updateDiscount}
              subtotal={subtotal}
              discountTotal={discountTotal}
              total={total}
              onCheckout={() => { setShowPayment(true); setShowCartMobile(false); }}
              customers={scopedCustomers}
              onSetCustomer={setOrderCustomer}
            />
          </div>
        )}
      </div>

      {/* Mobile FAB - Cart button */}
      <div className="sm:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setShowCartMobile(v => !v)}
          className="w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl flex items-center justify-center relative"
        >
          {showCartMobile ? <ChevronUp className="w-6 h-6" /> : <ShoppingCart className="w-6 h-6" />}
          {totalItems > 0 && !showCartMobile && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-xs font-bold rounded-full flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      {/* Desktop Cart Panel */}
      <div className="hidden sm:flex w-[20rem] lg:w-[24rem] shrink-0 flex-row border-l bg-card h-full">
        <OrderTabs
          orders={orders}
          activeOrderId={activeOrderId}
          onSelectOrder={setActiveOrderId}
          onAddOrder={addNewTab}
          onCloseOrder={closeTab}
          customers={scopedCustomers}
        />
        <Cart
          order={activeOrder}
          items={items}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onUpdateDiscount={updateDiscount}
          subtotal={subtotal}
          discountTotal={discountTotal}
          total={total}
          onCheckout={() => setShowPayment(true)}
          customers={scopedCustomers}
          onSetCustomer={setOrderCustomer}
        />
      </div>

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        customers={scopedCustomers}
        onConfirm={handlePayment}
        preselectedCustomerId={activeOrder?.customer_id}
        preselectedCustomerName={activeOrder?.customer_name}
      />
    </div>
  );
}