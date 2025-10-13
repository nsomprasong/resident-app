'use client'

import { colorTheme } from '@/lib/constants/color'
import { Box, IconButton, Typography } from '@mui/material'
import React, { useState } from 'react'
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import { useRouter } from "next/navigation";
import { useBookingDetail } from '../../hooks/useBookingDetail';
import Status from './Status';

interface RoomItemProps {
    id: number;
    name: string;
    status: string;
    image: string;
}

const RoomItem: React.FC<RoomItemProps> = ({ id, name, status, image }) => {

    const router = useRouter();

    const { setBookingDetail } = useBookingDetail();

    const handleClick = () => {
        setBookingDetail({ id, name, status, image });
        router.push(`/booking/${id}/room`);
    };

  return (
    <Box className="border-[1px] border-gray-100 rounded-xl p-2 shadow-sm hover:shadow-md cursor-pointer" onClick={handleClick}>
        <Box className="flex items-center justify-between gap-4">
            <Box className="flex items-center gap-4">
                <img src={image} alt="room 1" className="w-14 h-14 rounded-lg" />
                <Box>
                    <Typography sx={{fontSize: 16}}>{name}</Typography>
                    <Status status={status} />
                </Box>
            </Box>
            <IconButton color="primary">
                <KeyboardArrowRightRoundedIcon />
            </IconButton>
        </Box>
    </Box>
  )
}

export default RoomItem
