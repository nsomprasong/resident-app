'use client'

import { colorTheme } from '@/lib/constants/color'
import { Box, IconButton, Typography } from '@mui/material'
import React, { useState } from 'react'
import CircleRoundedIcon from '@mui/icons-material/CircleRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import { useRouter } from "next/navigation";
import { useBookingDetail } from '../../hooks/useBookingDetail';

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

    const colorStatus = () => {
        switch (status) {
            case "รอดำเนินการ":
                return "text-orange-300";
            case "ยืนยันแล้ว":
                return "text-green-500";
            case "เช็คอิน":
                return "text-blue-500";
            case "เช็คเอาท์":
                return "text-gray-300";
            default:
                return "text-gray-300";
        }
    }

  return (
    <Box className="border-[1px] border-gray-100 rounded-xl p-4 shadow-sm">
        <Box className="flex items-center justify-between gap-4">
            <Box className="flex items-center gap-4">
                <img src={image} alt="room 1" className="w-16 h-16 rounded-lg" />
                <Box>
                    <Typography sx={{fontSize: 18}}>{name}</Typography>
                    <Box className={`flex items-center gap-2 ${colorStatus()}`}>
                        <CircleRoundedIcon sx={{ fontSize: 12 }} />
                        <Typography sx={{fontSize: 14, color: colorTheme.gray[200]}}>{status}</Typography>
                    </Box>
                </Box>
            </Box>
            <IconButton color="primary" onClick={handleClick}>
                <KeyboardArrowRightRoundedIcon />
            </IconButton>
        </Box>
    </Box>
  )
}

export default RoomItem
