import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

// 1 libra = 16 onzas
export default function LibraInput({ quantity, onChange }) {
  const [lbs, setLbs] = useState(Math.floor(quantity));
  const [oz, setOz] = useState(0);

  const update = (newLbs, newOz) => {
    const total = Math.max(0, newLbs) + Math.max(0, newOz) / 16;
    onChange(parseFloat(total.toFixed(4)) || 0.0625);
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-muted-foreground mb-0.5">Lbs</span>
        <div className="flex items-center border rounded-lg bg-card">
          <button onClick={() => { const v = Math.max(0, parseFloat((lbs - 0.5).toFixed(1))); setLbs(v); update(v, oz); }} className="p-1 hover:bg-muted rounded-l-lg"><Minus className="w-3 h-3" /></button>
          <input
            type="number" value={lbs} min={0} step={0.5}
            onChange={(e) => { const v = parseFloat(e.target.value) || 0; setLbs(v); update(v, oz); }}
            className="w-14 text-center text-sm bg-transparent border-x py-1"
          />
          <button onClick={() => { const v = parseFloat((lbs + 0.5).toFixed(1)); setLbs(v); update(v, oz); }} className="p-1 hover:bg-muted rounded-r-lg"><Plus className="w-3 h-3" /></button>
        </div>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-muted-foreground mb-0.5">Ozs</span>
        <div className="flex items-center border rounded-lg bg-card">
          <button onClick={() => { const v = Math.max(0, oz - 1); setOz(v); update(lbs, v); }} className="p-1 hover:bg-muted rounded-l-lg"><Minus className="w-3 h-3" /></button>
          <input
            type="number" value={oz} min={0} max={15}
            onChange={(e) => { const v = parseInt(e.target.value) || 0; setOz(v); update(lbs, v); }}
            className="w-10 text-center text-sm bg-transparent border-x py-1"
          />
          <button onClick={() => { const v = oz + 1; setOz(v); update(lbs, v); }} className="p-1 hover:bg-muted rounded-r-lg"><Plus className="w-3 h-3" /></button>
        </div>
      </div>
    </div>
  );
}