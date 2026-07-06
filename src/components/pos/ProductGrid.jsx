import React from 'react';
import { cn } from '@/lib/utils';
import { Star, Package } from 'lucide-react';

export default function ProductGrid({ products, categories, selectedCategory, onSelectCategory, onAddProduct, searchTerm }) {
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const filtered = products
    .filter(p => {
      const matchesCategory = !selectedCategory || selectedCategory === 'all' || p.category_id === selectedCategory;
      const matchesFavorite = selectedCategory === 'favorites' ? p.is_favorite : true;
      const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesFavorite && matchesSearch && p.is_active !== false;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs */}
      <div className="flex gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 overflow-x-auto shrink-0 border-b bg-card scrollbar-hide">
        <button
          onClick={() => onSelectCategory('all')}
          className={cn(
            "px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all",
            (!selectedCategory || selectedCategory === 'all')
              ? "bg-primary text-primary-foreground shadow-md" 
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Todos
        </button>
        <button
          onClick={() => onSelectCategory('favorites')}
          className={cn(
            "px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1",
            selectedCategory === 'favorites'
              ? "bg-amber-500 text-white shadow-md" 
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          <Star className="w-3.5 h-3.5" /> Favoritos
        </button>
        {sortedCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={cn(
              "px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all",
              selectedCategory === cat.id
                ? "bg-secondary text-secondary-foreground shadow-md" 
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4">
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {filtered.map(product => (
            <button
              key={product.id}
              onClick={() => onAddProduct(product)}
              className="bg-card border rounded-xl p-2 sm:p-3 text-left hover:shadow-lg hover:border-primary/30 transition-all active:scale-95 group"
            >
              {product.image_url ? (
                <div className="aspect-square rounded-lg overflow-hidden mb-1.5 bg-muted">
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-square rounded-lg mb-1.5 bg-muted/50 flex items-center justify-center">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground/30" />
                </div>
              )}
              {product.sku && (
                <p className="text-muted-foreground text-[10px] sm:text-xs font-mono mb-0.5">{product.sku}</p>
              )}
              <p className="font-medium text-xs sm:text-sm line-clamp-2 group-hover:text-primary transition-colors">
                {product.name}
              </p>
              <p className="text-primary font-heading font-bold text-xs sm:text-sm mt-0.5">
                C${(product.price || 0).toFixed(2)}
              </p>
              {product.is_favorite && (
                <Star className="w-3 h-3 text-amber-500 fill-amber-500 mt-0.5" />
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No se encontraron productos
            </div>
          )}
        </div>
      </div>
    </div>
  );
}