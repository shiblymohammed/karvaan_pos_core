import { useKdsStore } from '../store/useKdsStore';
import React from 'react';
import { CheckCircle2, Utensils } from 'lucide-react';

/** Returns a JSX badge for the overall kitchen status of a table/order-type. */
export function useKitchenStatusBadge(tableName: string | null, orderType?: string): React.ReactElement | null {
  const kdsTickets = useKdsStore(state => state.tickets);

  let tableToMatch: string;
  if (orderType === 'PARCEL') tableToMatch = '📦 Parcel';
  else if (orderType === 'DELIVERY') tableToMatch = '🛵 Delivery';
  else tableToMatch = tableName || 'Takeaway';

  const tickets = kdsTickets.filter(t => t.tableNumber === tableToMatch);
  if (tickets.length === 0) return null;

  if (tickets.some(t => t.status === 'SERVED')) {
    return (
      <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
        <CheckCircle2 className="h-3 w-3" /> Served
      </span>
    );
  }

  if (tickets.some(t => t.status === 'READY')) {
    return (
      <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm animate-pulse">
        <CheckCircle2 className="h-3 w-3" /> Prepared
      </span>
    );
  }

  return (
    <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-sm">
      <Utensils className="h-3 w-3" /> Preparing
    </span>
  );
}

/** Returns a JSX badge for the kitchen status of a specific item within an order. */
export function useItemKdsStatus(itemName: string, tableName: string | null): React.ReactElement {
  const kdsTickets = useKdsStore(state => state.tickets);

  const tableToMatch = tableName || 'Takeaway';
  const tickets = kdsTickets.filter(t => t.tableNumber === tableToMatch);
  const ticketsWithItem = tickets.filter(t => t.items.some(i => i.name === itemName));

  if (ticketsWithItem.length === 0) {
    return <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">SENT TO KITCHEN</span>;
  }

  if (ticketsWithItem.some(t => t.status === 'SERVED')) {
    return (
      <span className="text-[9px] font-black uppercase text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
        <CheckCircle2 className="h-3 w-3" /> Served
      </span>
    );
  }

  if (ticketsWithItem.some(t => t.status === 'READY')) {
    return (
      <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
        <CheckCircle2 className="h-3 w-3" /> Prepared
      </span>
    );
  }

  return (
    <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-sm">
      <Utensils className="h-3 w-3" /> Preparing
    </span>
  );
}
