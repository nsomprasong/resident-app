'use client'

import React, { useState } from 'react'
import LocalMallRoundedIcon from '@mui/icons-material/LocalMallRounded';
import { Tooltip, Badge, Dialog, Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useBasketList } from '@/hooks/useBasketList';

interface BasketProps {
  id: string
}

const Basket: React.FC<BasketProps> = ({ id }) => {

  const router = useRouter();

  const goBasket = () => {
      router.push(`/booking/${id}/basket`);
  };

  const { basketList } = useBasketList();

  return (
    <Box className="flex items-center cursor-pointer" onClick={goBasket}>
      <Tooltip title="ตระกร้า">
          <Badge color="warning" badgeContent={basketList.length}>
              <LocalMallRoundedIcon sx={{color: 'white'}} />
          </Badge>
      </Tooltip>
    </Box>
  )
}

export default Basket