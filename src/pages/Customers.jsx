import React, { useState, useRef } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, UserCircle, Phone, Mail, CreditCard, Edit, Upload, Download, MapPin, Archive, ArchiveRestore } from 'lucide-react';
import { toast } from 'sonner';

const EXCEL_TEMPLATE_HEADERS = ['nombre', 'telefono', 'email', 'direccion', 'limite_credito', 'dias_credito', 'lista_precio', 'punto_de_venta', 'notas'];

const emptyForm = { name: '', cedula: '', phone: '', email: '', address: '', credit_limit: 0, credit_days: 30, price_list: 'normal', branch_name: '', notes: '' };

export default function Customers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const { isAdmin, isBranchUser, userBranchId: userBranchIdFromProfile, userRole } = useUserRole();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Customer.update(editing.id, data) : base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? 'Cliente actualizado' : 'Cliente creado');
    },
  });

  const toggleArchiveMutation = useMutation({
    mutationFn: (c) => base44.entities.Customer.update(c.id, { status: c.status === 'archived' ? 'active' : 'archived' }),
    onSuccess: (_, c) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(c.status === 'archived' ? 'Cliente reactivado' : 'Cliente archivado');
    },
  });

  // Todos ven el catálogo completo de clientes
  const scopedCustomers = customers;

  const filtered = scopedCustomers.filter(c => {
    const matchesArchive = showArchived ? c.status === 'archived' : c.status !== 'archived';
    const matchesSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.cedula?.includes(search);
    return matchesArchive && matchesSearch;
  });

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || '', cedula: c.cedula || '', phone: c.phone || '', email: c.email || '',
      address: c.address || '', credit_limit: c.credit_limit || 0,
      credit_days: c.credit_days || 30, price_list: c.price_list || 'normal',
      branch_name: c.branch_name || '', notes: c.notes || '',
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const downloadTemplate = () => {
    const rows = [
      EXCEL_TEMPLATE_HEADERS,
      ['Juan Pérez', '8888-1234', 'juan@email.com', 'Km 5 carretera norte', 5000, 30, 'normal', 'Cofradía', ''],
      ['María López', '7777-5678', '', 'Granada centro', 10000, 15, 'mayorista', 'Granada', 'Cliente VIP'],
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla_clientes.csv'; a.click();
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
            customers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: 'string' },
                  telefono: { type: 'string' },
                  email: { type: 'string' },
                  direccion: { type: 'string' },
                  limite_credito: { type: 'number' },
                  dias_credito: { type: 'number' },
                  lista_precio: { type: 'string' },
                  punto_de_venta: { type: 'string' },
                  notas: { type: 'string' },
                }
              }
            }
          }
        }
      });

      const rows = result?.output?.customers || (Array.isArray(result?.output) ? result.output : []);
      if (!rows.length) { toast.error('No se encontraron datos en el archivo'); setImporting(false); return; }

      let created = 0;
      for (const row of rows) {
        if (!row.nombre) continue;
        const branch = branches.find(b => b.name?.toLowerCase().includes((row.punto_de_venta || '').toLowerCase()));
        await base44.entities.Customer.create({
          name: row.nombre,
          phone: String(row.telefono || ''),
          email: row.email || '',
          address: row.direccion || '',
          credit_limit: parseFloat(row.limite_credito) || 0,
          credit_days: parseInt(row.dias_credito) || 30,
          price_list: ['normal', 'mayorista', 'especial'].includes(row.lista_precio) ? row.lista_precio : 'normal',
          branch_id: branch?.id || '',
          branch_name: row.punto_de_venta || '',
          notes: row.notas || '',
          is_active: true,
          balance: 0,
        });
        created++;
      }

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`${created} cliente(s) importados correctamente`);
    } catch (err) {
      toast.error('Error al importar: ' + err.message);
    }
    setImporting(false);
    e.target.value = '';
  };

  const handleSave = () => {
    const branch = branches.find(b => b.name === form.branch_name);
    saveMutation.mutate({ ...form, branch_id: branch?.id || '' });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {showArchived ? `${filtered.length} archivados` : `${filtered.length} activos · ${customers.filter(c => c.status === 'archived').length} archivados`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 sm:w-48 min-w-[140px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="text-xs gap-1">
            <Download className="w-3.5 h-3.5" />Plantilla
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing} className="text-xs gap-1">
            <Upload className="w-3.5 h-3.5" />{importing ? 'Importando...' : 'Importar Excel'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)} className="text-xs gap-1">
            {showArchived ? <><ArchiveRestore className="w-3.5 h-3.5" />Ver Activos</> : <><Archive className="w-3.5 h-3.5" />Ver Archivados</>}
          </Button>
          <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" />Nuevo</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold">{c.name}</p>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className="text-xs capitalize">{c.price_list || 'normal'}</Badge>
                      {c.branch_name && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                          <MapPin className="w-2.5 h-2.5 mr-0.5" />{c.branch_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleArchiveMutation.mutate(c)}
                    title={c.status === 'archived' ? 'Reactivar cliente' : 'Archivar cliente'}>
                    {c.status === 'archived' ? <ArchiveRestore className="w-4 h-4 text-green-600" /> : <Archive className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              {c.cedula && <p className="text-sm text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" />{c.cedula}</p>}
              {c.phone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>}
              {c.email && <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</p>}
              <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                <div>
                  <p className="text-muted-foreground">Límite crédito</p>
                  <p className="font-heading font-semibold">C${(c.credit_limit || 0).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Saldo</p>
                  <p className={`font-heading font-semibold ${(c.balance || 0) > 0 ? 'text-destructive' : ''}`}>
                    C${(c.balance || 0).toLocaleString('es', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cédula / RUC</Label><Input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} placeholder="001-000000-0000X" /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Dirección</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div>
              <Label>Punto de Venta</Label>
              <Select value={form.branch_name || 'none'} onValueChange={v => setForm({ ...form, branch_name: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {branches.filter(b => !b.is_warehouse).map(b => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Límite Crédito</Label><Input type="number" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Días Crédito</Label><Input type="number" value={form.credit_days} onChange={e => setForm({ ...form, credit_days: parseInt(e.target.value) || 30 })} /></div>
              <div>
                <Label>Lista Precio</Label>
                <Select value={form.price_list} onValueChange={v => setForm({ ...form, price_list: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="mayorista">Mayorista</SelectItem>
                    <SelectItem value="especial">Especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notas</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={handleSave} disabled={!form.name || saveMutation.isPending}>
              {editing ? 'Guardar Cambios' : 'Crear Cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}