// La plataforma entrega created_date en UTC sin indicador 'Z'.
// new Date(str) interpretaría esa cadena como hora local, desplazando
// las fechas ~6h (Nicaragua, UTC-6) y moviendo ventas nocturnas al día siguiente.
// Por eso se debe forzar la interpretación UTC.

export const parseUTC = (iso) => {
  if (!iso) return new Date(NaN);
  const s = String(iso);
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s + 'Z');
};

// Devuelve la fecha local (YYYY-MM-DD) de un timestamp UTC, para filtrado por día.
export const toLocalDateString = (iso) => {
  const d = parseUTC(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};