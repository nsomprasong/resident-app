import React, { useState } from 'react'
import { Box, Collapse, IconButton, Typography } from '@mui/material'
import ContactEmergencyRoundedIcon from '@mui/icons-material/ContactEmergencyRounded';
import { colorTheme } from '@/lib/constants/color';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import Status from './Status';
import { BookingDetail } from '@/interface/BookingDetailModel';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import RoomItem from './RoomItem';
import { useRouter } from 'next/navigation';

interface OrderGroupItemProps {
    id: number;
    customerName: string;
}

const OrderGroupItem: React.FC<OrderGroupItemProps> = ({ id, customerName }) => {

    const router = useRouter();

    const goToOrder = () => {
        router.push(`/foodOrder/${id}/food`);
    };

  return (
    <Box className="border-[1px] border-gray-100 bg-surface rounded-xl p-2 shadow-sm hover:shadow-md cursor-pointer" onClick={goToOrder}>
      <Box className="flex items-center justify-between">
        <Box className="flex items-center gap-4">
          <Box className="w-14 h-14 rounded-lg bg-white text-primary flex items-center justify-center border-[1px] border-gray-200"> 
            <ContactEmergencyRoundedIcon sx={{fontSize:34}} />
          </Box>
          <Box>
            <Typography>{customerName}</Typography>
          </Box>
        </Box>
        <IconButton color="primary">
          <KeyboardArrowRightRoundedIcon />
        </IconButton>
      </Box>
    </Box>
  )
}

export default OrderGroupItem