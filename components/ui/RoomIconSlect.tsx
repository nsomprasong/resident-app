import { Box, Typography } from '@mui/material'
import KingBedRoundedIcon from '@mui/icons-material/KingBedRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import React from 'react'

interface RoomIconSelectProps {
    roomNo: number
    booked: boolean
}

const RoomIconSlect: React.FC<RoomIconSelectProps> = ({ roomNo, booked}) => {

    const [selected, setSelected] = React.useState<boolean>(false);

    const colorSelect = selected ? 'text-green-700 hover:text-green-500 cursor-pointer' : 'text-blue-700 hover:text-blue-500 cursor-pointer';

    const colorBooked = booked ? 'text-gray-300' : colorSelect;

    const handleSelect = () => {
        if(!booked) {
            setSelected(!selected);
        } 
    }

  return (
    <Box className={`flex flex-col items-center p-1 ${colorBooked}`} onClick={handleSelect}>
        {selected ? <CheckCircleRoundedIcon /> : <KingBedRoundedIcon />}
        <Typography sx={{ fontSize: 12 }}>{roomNo}</Typography>
    </Box>
  )
}

export default RoomIconSlect