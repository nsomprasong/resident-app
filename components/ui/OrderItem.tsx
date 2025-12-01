import { Box, IconButton, Typography } from '@mui/material'
import React, { useState } from 'react'
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import { usePathname, useRouter } from "next/navigation";

interface OrderItemProps {
    id: number;
    name: string;
    image: string;
}

const OrderItem: React.FC<OrderItemProps> = ({ id, name, image  }) => {

    const router = useRouter();
    
    const goToOrder = () => {
        router.push(`/foodOrder/${id}/food`);
    };

  return (
    <Box className="border-[1px] border-gray-100 bg-surface rounded-xl p-2 shadow-sm hover:shadow-md cursor-pointer" onClick={goToOrder}>
        <Box className="flex items-center justify-between gap-4">
            <Box className="flex items-center gap-4">
                <img src={image} alt="room 1" className="w-14 h-14 rounded-lg" />
                <Box>
                    <Typography sx={{fontSize: 16}}>{name}</Typography>
                </Box>
            </Box>
            <IconButton color="primary">
                <KeyboardArrowRightRoundedIcon />
            </IconButton>
        </Box>
    </Box>
  )
}

export default OrderItem
