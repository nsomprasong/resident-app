import { colorTheme } from '@/lib/constants/color'
import { Box, Typography } from '@mui/material'
import React from 'react'
import RemoveCircleRoundedIcon from '@mui/icons-material/RemoveCircleRounded';

interface BillDetailProps {
    title: string;
    price: number;
    isEdit: boolean
    summarize?: boolean;
}

const BillDetail: React.FC<BillDetailProps> = ({ title, price, isEdit, summarize }) => {
  return (
    <Box className="w-full flex justify-between items-center">
        <Typography sx={{color: colorTheme.textSecondary}}>{title}</Typography>
        <Box className="flex items-center gap-2">
            <Typography>{price.toString()} ฿</Typography>
            {!summarize && isEdit &&
              <Box className="text-red-500 cursor-pointer flex items-center">
                <RemoveCircleRoundedIcon sx={{ fontSize:20 }} />
              </Box>
            }
        </Box>
    </Box>
  )
}

export default BillDetail