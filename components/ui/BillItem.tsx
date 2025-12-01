import { kanitMedium } from '@/lib/constants/font'
import { Box, Typography, Divider, IconButton, Collapse } from '@mui/material'
import React, { useState } from 'react'
import BillDetail from './BillDetail'

interface BillItem {
  title: string;
  price: number;
}

interface BillListProps {
  icon?: React.ReactNode;
  title: string;
  items: BillItem[];
  isEdit: boolean;
}

const BillItem: React.FC<BillListProps> = ({ icon, title, items, isEdit }) => {

  const [open, setOpen] = useState(false);
  
  const handleToggle = () => {
      setOpen((prev) => !prev);
  };

  const calculateSummarizePrice = (items: BillItem[]) => {
    return items.reduce((sum, item) => sum + item.price, 0);
  }

  const summarizePrice = calculateSummarizePrice(items);

  return (
    <Box className="w-full flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm cursor-pointer" onClick={handleToggle}>
      <Box className="flex justify-between items-center">
        <Box className="flex items-center gap-4">
          <Box className="w-12 h-12 rounded-full flex justify-center items-center bg-slate-400 hover:bg-slate-500 transition-colors duration-300 text-white cursor-pointer">
            {icon}
          </Box>
          <Typography sx={{ ...kanitMedium }}>{title}</Typography>
        </Box>
        {!open && <Typography>{summarizePrice} ฿</Typography>}
      </Box>

       <Collapse in={open} timeout="auto" unmountOnExit>
        <Box className="flex flex-col gap-2 mt-2">
          {items.map((item, idx) => (
            <BillDetail key={idx} title={item.title} price={item.price} isEdit={isEdit} />
          ))}
          <Divider />
          <BillDetail title="รวมราคา" price={summarizePrice} isEdit={isEdit} summarize={true} />
        </Box>
      </Collapse>
    </Box>
  )
}

export default BillItem
