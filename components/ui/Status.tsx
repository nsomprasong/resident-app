import { colorTheme } from '@/lib/constants/color';
import { Box, Typography } from '@mui/material';
import CircleRoundedIcon from '@mui/icons-material/CircleRounded';
import React from 'react'

interface StatusProps {
    status: string
}

const Status: React.FC<StatusProps> = ({ status }) => {

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
     <Box className={`flex items-center gap-2 ${colorStatus()}`}>
        <CircleRoundedIcon sx={{ fontSize: 12 }} />
        <Typography sx={{fontSize: 14, color: colorTheme.gray[200]}}>{status}</Typography>
    </Box>
  )
}

export default Status