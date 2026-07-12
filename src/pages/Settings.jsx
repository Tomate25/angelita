import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, Plus, Edit, Package, Truck, RefreshCw, Upload, Download, Users, Trash } from 'lucide-react';
import PriceScheduleManager from '@/components/settings/PriceScheduleManager';
import MarginAudit from '@/components/settings/MarginAudit';
import { toast } from 'sonner';
import { useRef } from 'react';

function BranchesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '', is_warehouse: false });

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => base44.entities.Branch.list() });

  const save = useMutation({
    mutationFn: (d) => editing ? base44.entities.Branch.update(editing.id, d) : base44.entities.Branch.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); setShowForm(false); toast.success('Sucursal guardada'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-semibold text-lg">Sucursales</h2>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ name: '', code: '', address: '', phone: '', is_warehouse: false }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Agregar
        </Button>
      </div>
      {branches.map(b => (
        <Card key={b.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Store className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="font-medium">{b.name} <span className="text-muted-foreground text-xs">({b.code})</span></p>
                {b.is_warehouse && <Badge variant="outline" className="text-xs">Bodega Central</Badge>}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setEditing(b); setForm({ name: b.name, code: b.code, address: b.address || '', phone: b.phone || '', is_warehouse: b.is_warehouse || false }); setShowForm(true); }}>
              <Edit className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{editing ? 'Editar' : 'Nueva'} Sucursal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>Código</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
            </div>
            <div><Label>Dirección</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_warehouse} onCheckedChange={v => setForm({...form, is_warehouse: v})} /><Label>Es Bodega Central</Label></div>
            <Button className="w-full" onClick={() => save.mutate(form)}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoriesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#f97316' });

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => base44.entities.Category.list() });

  const save = useMutation({
    mutationFn: (d) => base44.entities.Category.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setShowForm(false); toast.success('Categoría creada'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-semibold text-lg">Categorías</h2>
        <Button size="sm" onClick={() => { setForm({ name: '', color: '#f97316' }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Agregar
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {categories.map(c => (
          <Card key={c.id}>
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color || '#f97316' }} />
              <span className="font-medium text-sm">{c.name}</span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Nueva Categoría</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><Label>Color</Label><Input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-10" /></div>
            <Button className="w-full" onClick={() => save.mutate(form)}>Crear</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);


  const emptyForm = {
    name: '', sku: '', category_id: '', unit: 'unidad', cost: '', price: '',
    wholesale_price: '', special_price: '', min_stock: '',
    is_active: true, is_favorite: false, tax_rate: '', image_url: '',
    can_transform: false, transform_to_product_id: '', transform_quantity: ''
  };
  const [form, setForm] = useState(emptyForm);

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const filteredProducts = nameFilter.trim() ? products.filter(p => p.name?.toLowerCase().includes(nameFilter.toLowerCase()) || p.sku?.toLowerCase().includes(nameFilter.toLowerCase())) : products;
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => base44.entities.Category.list() });

  const save = useMutation({
    mutationFn: (d) => {
      const parsed = {
        ...d,
        cost: parseFloat(d.cost) || 0,
        price: parseFloat(d.price) || 0,
        wholesale_price: parseFloat(d.wholesale_price) || 0,
        special_price: parseFloat(d.special_price) || 0,
        min_stock: parseFloat(d.min_stock) || 0,
        tax_rate: parseFloat(d.tax_rate) || 0,
        transform_quantity: parseFloat(d.transform_quantity) || 0,
      };
      return editing ? base44.entities.Product.update(editing.id, parsed) : base44.entities.Product.create(parsed);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); setShowForm(false); toast.success('Producto guardado'); },
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name || '', sku: p.sku || '', category_id: p.category_id || '',
      unit: p.unit || 'unidad', cost: p.cost != null ? String(p.cost) : '', price: p.price != null ? String(p.price) : '',
      wholesale_price: p.wholesale_price != null ? String(p.wholesale_price) : '', special_price: p.special_price != null ? String(p.special_price) : '',
      min_stock: p.min_stock != null ? String(p.min_stock) : '', is_active: p.is_active !== false,
      is_favorite: p.is_favorite || false, tax_rate: p.tax_rate != null ? String(p.tax_rate) : '',
      image_url: p.image_url || '',
      can_transform: p.can_transform || false,
      transform_to_product_id: p.transform_to_product_id || '',
      transform_quantity: p.transform_quantity != null ? String(p.transform_quantity) : '',
    });
    setShowForm(true);
  };

  const otherProducts = products.filter(p => p.id !== editing?.id);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, image_url: file_url }));
      toast.success('Imagen cargada');
    } catch {
      toast.error('Error al cargar imagen');
    }
    setUploadingImage(false);
    e.target.value = '';
  };



  const downloadTemplate = () => {
    const rows = [
      ['nombre', 'sku', 'categoria', 'unidad', 'costo', 'precio_venta', 'precio_mayorista', 'precio_especial', 'stock_minimo', 'impuesto_pct'],
      ['Coca Cola 500ml', 'CC-500', 'Bebidas', 'botella', 18.00, 25.00, 22.00, 20.00, 10, 0],
      ['Pan Simple', 'PAN-001', 'Panadería', 'unidad', 3.50, 5.00, 4.50, 4.00, 20, 0],
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_productos.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Plantilla descargada');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: 'string' },
                  sku: { type: 'string' },
                  categoria: { type: 'string' },
                  unidad: { type: 'string' },
                  costo: { type: 'number' },
                  precio_venta: { type: 'number' },
                  precio_mayorista: { type: 'number' },
                  precio_especial: { type: 'number' },
                  stock_minimo: { type: 'number' },
                  impuesto_pct: { type: 'number' },
                }
              }
            }
          }
        }
      });

      const rows = result?.output?.products || (Array.isArray(result?.output) ? result.output : []);
      if (!rows.length) { toast.error('No se encontraron datos en el archivo'); setImporting(false); return; }

      let created = 0;
      for (const row of rows) {
        if (!row.nombre) continue;
        const cat = categories.find(c => c.name?.toLowerCase() === (row.categoria || '').toLowerCase());
        const validUnits = ['unidad','paquete','caja','botella','libra','kilogramo','litro','vaso','porcion'];
        const unit = validUnits.includes((row.unidad || '').toLowerCase()) ? row.unidad.toLowerCase() : 'unidad';
        await base44.entities.Product.create({
          name: row.nombre,
          sku: row.sku || '',
          category_id: cat?.id || '',
          unit,
          cost: parseFloat(row.costo) || 0,
          price: parseFloat(row.precio_venta) || 0,
          wholesale_price: parseFloat(row.precio_mayorista) || 0,
          special_price: parseFloat(row.precio_especial) || 0,
          min_stock: parseFloat(row.stock_minimo) || 0,
          tax_rate: parseFloat(row.impuesto_pct) || 0,
          is_active: true,
          is_favorite: false,
        });
        created++;
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${created} producto(s) importados correctamente`);
    } catch (err) {
      toast.error('Error al importar: ' + err.message);
    }
    setImporting(false);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="font-heading font-semibold text-lg">Productos ({filteredProducts.length}/{products.length})</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="text-xs gap-1">
            <Download className="w-3.5 h-3.5" />Plantilla
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing} className="text-xs gap-1">
            <Upload className="w-3.5 h-3.5" />{importing ? 'Importando...' : 'Importar Excel'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
        </div>
      </div>
      <div className="mb-3">
        <Input
          placeholder="Buscar por nombre o SKU..."
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="space-y-2">
        {filteredProducts.map(p => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(p)}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><Package className="w-4 h-4 text-muted-foreground" /></div>
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    {p.name}
                    {p.can_transform && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300"><RefreshCw className="w-3 h-3 mr-1" />Transformable</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.sku} · {p.unit}</p>
                </div>
              </div>
              <p className="font-heading font-bold text-primary">C${(p.price || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">{editing ? 'Editar' : 'Nuevo'} Producto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Imagen */}
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
                {form.image_url
                  ? <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                  : <Package className="w-7 h-7 text-muted-foreground/40" />}
              </div>
              <div className="flex-1">
                <Label className="text-xs">Imagen del Producto</Label>
                <Button type="button" variant="outline" size="sm" className="w-full mt-1 text-xs gap-1 h-8"
                  onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
                  <Upload className="w-3.5 h-3.5" />{uploadingImage ? 'Subiendo...' : 'Cargar imagen'}
                </Button>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {form.image_url && (
                  <button type="button" className="text-xs text-destructive mt-1 hover:underline"
                    onClick={() => setForm(f => ({ ...f, image_url: '' }))}>Quitar imagen</button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría</Label>
                <Select value={form.category_id} onValueChange={v => setForm({...form, category_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidad</Label>
                <Select value={form.unit} onValueChange={v => setForm({...form, unit: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['unidad','paquete','caja','botella','libra','kilogramo','litro','vaso','porcion'].map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Costo</Label><Input type="number" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} /></div>
              <div><Label>Precio Venta</Label><Input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Precio Mayorista</Label><Input type="number" value={form.wholesale_price} onChange={e => setForm({...form, wholesale_price: e.target.value})} /></div>
              <div><Label>Precio Especial</Label><Input type="number" value={form.special_price} onChange={e => setForm({...form, special_price: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Stock Mínimo</Label><Input type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: e.target.value})} /></div>
              <div><Label>Impuesto (%)</Label><Input type="number" value={form.tax_rate} onChange={e => setForm({...form, tax_rate: e.target.value})} /></div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({...form, is_active: v})} /><Label>Activo</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_favorite} onCheckedChange={v => setForm({...form, is_favorite: v})} /><Label>Favorito</Label></div>
            </div>

            {/* Sección de Transformación */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.can_transform}
                  onCheckedChange={v => setForm({...form, can_transform: v, transform_to_product_id: '', transform_quantity: 0})}
                />
                <Label className="font-medium flex items-center gap-1"><RefreshCw className="w-4 h-4 text-teal-500" />Puede Transformarse</Label>
              </div>
              {form.can_transform && (
                <>
                  <p className="text-xs text-muted-foreground">Ej: 1 Cartón → 20 Cigarrillos</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Se convierte en</Label>
                      <Select value={form.transform_to_product_id} onValueChange={v => setForm({...form, transform_to_product_id: v})}>
                        <SelectTrigger><SelectValue placeholder="Producto destino" /></SelectTrigger>
                        <SelectContent>
                          {otherProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cantidad resultante</Label>
                      <Input
                      type="number"
                      min={1}
                      value={form.transform_quantity}
                      onChange={e => setForm({...form, transform_quantity: e.target.value})}
                      placeholder="Ej: 20"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <Button className="w-full" onClick={() => save.mutate(form)} disabled={!form.name}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SuppliersTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '' });

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });

  const save = useMutation({
    mutationFn: (d) => base44.entities.Supplier.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); setShowForm(false); toast.success('Proveedor creado'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-semibold text-lg">Proveedores</h2>
        <Button size="sm" onClick={() => { setForm({ name: '', contact_name: '', phone: '', email: '' }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Agregar
        </Button>
      </div>
      {suppliers.map(s => (
        <Card key={s.id}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10"><Truck className="w-5 h-5 text-secondary" /></div>
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.contact_name} · {s.phone}</p>
            </div>
          </CardContent>
        </Card>
      ))}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Nuevo Proveedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><Label>Contacto</Label><Input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            </div>
            <Button className="w-full" onClick={() => save.mutate(form)}>Crear</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'vendedor',
    branch_id: '',
    branch_name: '',
    permissions: []
  });

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.list() });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => base44.entities.Branch.list() });

  const save = useMutation({
    mutationFn: (d) => {
      const br = branches.find(b => b.id === d.branch_id);
      const payload = {
        ...d,
        branch_name: br ? br.name : '',
      };
      if (editing && !payload.password) {
        delete payload.password;
      }
      return editing ? base44.entities.User.update(editing.id, payload) : base44.entities.User.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      toast.success('Usuario guardado');
    },
    onError: (err) => {
      toast.error('Error al guardar usuario: ' + err.message);
    }
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario eliminado');
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ username: '', full_name: '', password: '', role: 'vendedor', branch_id: '', branch_name: '', permissions: [] });
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      username: u.username || '',
      full_name: u.full_name || '',
      password: '',
      role: u.role || 'vendedor',
      branch_id: u.branch_id || '',
      branch_name: u.branch_name || '',
      permissions: Array.isArray(u.permissions) ? u.permissions : []
    });
    setShowForm(true);
  };

  const togglePermission = (perm) => {
    setForm(f => {
      const perms = [...f.permissions];
      const idx = perms.indexOf(perm);
      if (idx > -1) {
        perms.splice(idx, 1);
      } else {
        perms.push(perm);
      }
      return { ...f, permissions: perms };
    });
  };

  const availablePermissions = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pos', label: 'Punto de Venta (POS)' },
    { id: 'orders', label: 'Pedidos' },
    { id: 'customers', label: 'Clientes' },
    { id: 'ar', label: 'Cuentas por Cobrar' },
    { id: 'inventory', label: 'Inventario' },
    { id: 'purchases', label: 'Compras' },
    { id: 'ap', label: 'Cuentas por Pagar' },
    { id: 'cash_register', label: 'Caja' },
    { id: 'reports', label: 'Reportes' },
    { id: 'settings', label: 'Configuración' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-semibold text-lg">Usuarios y Permisos</h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" />Agregar Usuario
        </Button>
      </div>

      <div className="space-y-2">
        {users.map(u => (
          <Card key={u.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {u.full_name || u.username}{' '}
                    <span className="text-muted-foreground text-xs">(@{u.username})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Rol: <Badge variant="secondary" className="text-[10px] px-1 py-0 capitalize">{u.role}</Badge>
                    {u.branch_name && ` · Sucursal: ${u.branch_name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                  <Edit className="w-4 h-4" />
                </Button>
                {u.username !== 'admin' && (
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { if(confirm('¿Seguro que deseas eliminar este usuario?')) remove.mutate(u.id); }}>
                    <Trash className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? 'Editar' : 'Nuevo'} Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Ej: Juan Pérez" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nombre de Usuario *</Label>
                <Input value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="Ej: juan.perez" disabled={editing && editing.username === 'admin'} />
              </div>
              <div className="space-y-2">
                <Label>{editing ? 'Nueva Contraseña' : 'Contraseña *'}</Label>
                <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={editing ? 'Dejar en blanco para no cambiar' : '123456'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="cajero">Cajero</SelectItem>
                    <SelectItem value="sucursal">Usuario de Sucursal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sucursal asignada</Label>
                <Select value={form.branch_id} onValueChange={v => setForm({...form, branch_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Ninguna (Admin)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ninguna</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <Label className="font-heading font-medium block text-sm">Permisos del Sistema</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {availablePermissions.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-1.5 border rounded bg-background">
                    <span className="text-xs font-medium">{p.label}</span>
                    <Switch
                      checked={form.role === 'admin' ? true : form.permissions.includes(p.id)}
                      onCheckedChange={() => togglePermission(p.id)}
                      disabled={form.role === 'admin'}
                    />
                  </div>
                ))}
              </div>
              {form.role === 'admin' && (
                <p className="text-[10px] text-muted-foreground italic">El administrador tiene todos los permisos asignados por defecto.</p>
              )}
            </div>

            <Button className="w-full font-heading" onClick={() => save.mutate(form)} disabled={!form.username || (!editing && !form.password)}>Guardar Usuario</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Settings() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-heading font-bold mb-6">Configuración</h1>
      <Tabs defaultValue="branches">
        <TabsList className="w-full flex flex-wrap">
          <TabsTrigger value="branches">Sucursales</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="prices">Precios</TabsTrigger>
          <TabsTrigger value="margin">Auditoría de Margen</TabsTrigger>
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
          <TabsTrigger value="users">Usuarios y Permisos</TabsTrigger>
        </TabsList>
        <TabsContent value="branches" className="mt-6"><BranchesTab /></TabsContent>
        <TabsContent value="categories" className="mt-6"><CategoriesTab /></TabsContent>
        <TabsContent value="products" className="mt-6"><ProductsTab /></TabsContent>
        <TabsContent value="prices" className="mt-6"><PriceScheduleManager /></TabsContent>
        <TabsContent value="margin" className="mt-6"><MarginAudit /></TabsContent>
        <TabsContent value="suppliers" className="mt-6"><SuppliersTab /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}