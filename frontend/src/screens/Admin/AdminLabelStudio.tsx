import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Plus, Trash2, Type, AlignLeft, AlignCenter, AlignRight, Barcode, ListOrdered, Image } from 'lucide-react';

export type BlockType = 'TEXT' | 'DIVIDER' | 'DYNAMIC_ITEMS' | 'DYNAMIC_HEADER' | 'BARCODE' | 'IMAGE';

export interface LabelBlock {
  id: string;
  type: BlockType;
  content?: string;
  align?: 'left' | 'center' | 'right';
  size?: 'normal' | 'large' | 'title';
}

export const AdminLabelStudio: React.FC = () => {
  const [activeTemplate, setActiveTemplate] = useState<'CUP' | 'BAG' | 'KOT'>('CUP');
  
  const [templates, setTemplates] = useState<Record<string, LabelBlock[]>>({
    CUP: [
      { id: 'c1', type: 'TEXT', content: 'KARVAAN CAFE', align: 'center', size: 'title' },
      { id: 'c2', type: 'DYNAMIC_HEADER' },
      { id: 'c3', type: 'DIVIDER' },
      { id: 'c4', type: 'DYNAMIC_ITEMS' },
      { id: 'c5', type: 'BARCODE', align: 'center' }
    ],
    BAG: [
      { id: 'b1', type: 'TEXT', content: 'KARVAAN CAFE', align: 'center', size: 'title' },
      { id: 'b2', type: 'TEXT', content: 'DELIVERY ORDER', align: 'center', size: 'large' },
      { id: 'b3', type: 'DIVIDER' },
      { id: 'b4', type: 'DYNAMIC_HEADER' },
      { id: 'b5', type: 'DYNAMIC_ITEMS' },
      { id: 'b6', type: 'DIVIDER' },
      { id: 'b7', type: 'BARCODE', align: 'center' }
    ],
    KOT: [
      { id: 'k1', type: 'TEXT', content: 'KITCHEN TICKET', align: 'center', size: 'title' },
      { id: 'k2', type: 'DYNAMIC_HEADER' },
      { id: 'k3', type: 'DIVIDER' },
      { id: 'k4', type: 'DYNAMIC_ITEMS' }
    ]
  });

  const blocks = templates[activeTemplate];

  const setBlocks = (newBlocks: LabelBlock[]) => {
    setTemplates({
      ...templates,
      [activeTemplate]: newBlocks
    });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const newBlocks = [...blocks];
    if (index + direction < 0 || index + direction >= newBlocks.length) return;
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    setBlocks(newBlocks);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const addBlock = (type: BlockType) => {
    setBlocks([...blocks, { id: Date.now().toString(), type, content: type === 'TEXT' ? 'Custom Text' : '', align: 'center', size: 'normal' }]);
  };

  const updateBlock = (id: string, updates: Partial<LabelBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Template Selector */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTemplate('CUP')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${activeTemplate === 'CUP' ? 'bg-white shadow-md text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Cup / Item Label
        </button>
        <button 
          onClick={() => setActiveTemplate('BAG')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${activeTemplate === 'BAG' ? 'bg-white shadow-md text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Delivery Bag Label
        </button>
        <button 
          onClick={() => setActiveTemplate('KOT')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${activeTemplate === 'KOT' ? 'bg-white shadow-md text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Adhesive KOT
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-200 p-6">
        
        {/* LEFT: Block Editor */}
        <div className="flex-1 space-y-4">
          <h3 className="font-black text-slate-800 text-lg mb-4">
            {activeTemplate === 'CUP' && 'Cup / Item Layout'}
            {activeTemplate === 'BAG' && 'Delivery Bag Layout'}
            {activeTemplate === 'KOT' && 'Kitchen Ticket Layout'}
          </h3>
        
        <div className="space-y-3">
          <AnimatePresence>
            {blocks.map((block, index) => (
              <motion.div 
                key={block.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center gap-3 shadow-sm group"
              >
                <div className="flex flex-col gap-1 opacity-20 hover:opacity-100 transition-opacity">
                  <button onClick={() => moveBlock(index, -1)} disabled={index === 0} className="hover:text-amber-500 disabled:opacity-0">▲</button>
                  <button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="hover:text-amber-500 disabled:opacity-0">▼</button>
                </div>
                
                <div className="bg-slate-100 p-2 rounded-xl text-slate-500">
                  {block.type === 'TEXT' && <Type className="h-4 w-4" />}
                  {block.type === 'DIVIDER' && <span className="font-black text-xs">---</span>}
                  {block.type === 'DYNAMIC_ITEMS' && <ListOrdered className="h-4 w-4" />}
                  {block.type === 'DYNAMIC_HEADER' && <AlignLeft className="h-4 w-4" />}
                  {block.type === 'BARCODE' && <Barcode className="h-4 w-4" />}
                  {block.type === 'IMAGE' && <Image className="h-4 w-4" />}
                </div>

                <div className="flex-1">
                  {block.type === 'TEXT' ? (
                    <input 
                      type="text" 
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                      className="w-full bg-transparent font-bold text-slate-700 focus:outline-none focus:border-b-2 focus:border-amber-400"
                    />
                  ) : (
                    <span className="font-bold text-slate-700 text-sm">
                      {block.type === 'DYNAMIC_HEADER' && 'Order Info (Order #, Time, Customer)'}
                      {block.type === 'DYNAMIC_ITEMS' && 'Order Items & Add-ons'}
                      {block.type === 'DIVIDER' && 'Dashed Divider'}
                      {block.type === 'BARCODE' && 'Scannable Barcode'}
                      {block.type === 'IMAGE' && 'Restaurant Logo / Icon'}
                    </span>
                  )}
                </div>

                {block.type === 'TEXT' && (
                  <select 
                    value={block.size} 
                    onChange={(e) => updateBlock(block.id, { size: e.target.value as any })}
                    className="text-xs font-bold text-slate-500 bg-slate-50 rounded-lg px-2 py-1 outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                    <option value="title">Title</option>
                  </select>
                )}

                <button onClick={() => removeBlock(block.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Add Blocks Toolbar */}
        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Add Block</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => addBlock('TEXT')} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg shadow-sm hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center gap-1">
              <Type className="h-3 w-3" /> Text
            </button>
            <button onClick={() => addBlock('DIVIDER')} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg shadow-sm hover:border-amber-400 hover:text-amber-600 transition-colors">
              Divider
            </button>
            <button onClick={() => addBlock('DYNAMIC_HEADER')} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg shadow-sm hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center gap-1">
              <AlignLeft className="h-3 w-3" /> Header Info
            </button>
            <button onClick={() => addBlock('DYNAMIC_ITEMS')} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg shadow-sm hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center gap-1">
              <ListOrdered className="h-3 w-3" /> Items List
            </button>
            <button onClick={() => addBlock('BARCODE')} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg shadow-sm hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center gap-1">
              <Barcode className="h-3 w-3" /> Barcode
            </button>
            <button onClick={() => addBlock('IMAGE')} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg shadow-sm hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center gap-1">
              <Image className="h-3 w-3" /> Logo
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Live Preview Canvas */}
      <div className="w-full lg:w-[350px] shrink-0 flex flex-col items-center justify-start relative">
        <h3 className="font-black text-slate-800 text-lg mb-4 absolute -top-12 lg:top-0">Live Canvas</h3>
        
        <div className="w-[300px] bg-white border-2 border-dashed border-slate-300 rounded-xl p-5 shadow-lg relative min-h-[400px] lg:mt-12">
          
          <div className="flex flex-col gap-1.5">
            {blocks.map((block) => {
              
              if (block.type === 'TEXT') {
                const textSize = block.size === 'title' ? 'text-2xl border-b-2 border-slate-800 pb-1' : block.size === 'large' ? 'text-lg' : 'text-sm';
                return (
                  <div key={block.id} className={`font-black text-slate-800 text-${block.align || 'center'} ${textSize}`}>
                    {block.content || ' '}
                  </div>
                );
              }
              
              if (block.type === 'DIVIDER') {
                return <div key={block.id} className="border-b-2 border-dashed border-slate-300 my-1 w-full" />;
              }

              if (block.type === 'DYNAMIC_HEADER') {
                return (
                  <div key={block.id} className="w-full mt-2 mb-1">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Order: #KOT-124</span>
                      <span>12:45 PM</span>
                    </div>
                    <div className="text-xs font-bold text-slate-500 mt-0.5">For: John Doe</div>
                  </div>
                );
              }

              if (block.type === 'DYNAMIC_ITEMS') {
                return (
                  <div key={block.id} className="w-full my-1">
                    <div className="text-sm font-black text-slate-800">1x Hazelnut Cold Coffee</div>
                    <div className="text-xs font-bold text-slate-500 italic ml-2">- Less Ice</div>
                    <div className="text-xs font-bold text-slate-500 italic ml-2">- Extra Shot</div>
                    <div className="text-sm font-black text-slate-800 mt-2">2x Garlic Bread</div>
                  </div>
                );
              }

              if (block.type === 'BARCODE') {
                return (
                  <div key={block.id} className={`w-full mt-4 flex justify-${block.align === 'left' ? 'start' : block.align === 'right' ? 'end' : 'center'}`}>
                    <div className="h-10 w-4/5 bg-[repeating-linear-gradient(90deg,#000,#000_2px,transparent_2px,transparent_4px,#000_4px,#000_5px,transparent_5px,transparent_7px)]"></div>
                  </div>
                );
              }

              if (block.type === 'IMAGE') {
                return (
                  <div key={block.id} className="w-full my-2 flex justify-center">
                    <div className="w-16 h-16 border-2 border-slate-800 rounded-full flex items-center justify-center bg-slate-100/50">
                      <Image className="h-6 w-6 text-slate-800" />
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Jagged bottom edge effect for receipt paper */}
          <div className="absolute -bottom-2 left-0 right-0 h-4 bg-[radial-gradient(circle,transparent,transparent_50%,#fff_50%,#fff)] bg-[length:10px_10px]" style={{ maskImage: 'linear-gradient(to top, white, transparent)' }}></div>
        </div>
      </div>

      </div>
    </div>
  );
};
