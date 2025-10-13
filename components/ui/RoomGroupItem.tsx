import React, { useState } from 'react'
import { Box, Collapse, IconButton, Typography } from '@mui/material'
import ContactEmergencyRoundedIcon from '@mui/icons-material/ContactEmergencyRounded';
import { colorTheme } from '@/lib/constants/color';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import Status from './Status';
import { BookingDetail } from '@/interface/BookingDetailModel';
import RoomItem from './RoomItem';

interface RoomItemProps {
    id: number;
    customerName: string;
    status: string;
    roomInGroupList: BookingDetail[]
}

const RoomGroupItem: React.FC<RoomItemProps> = ({ id, customerName, status, roomInGroupList }) => {

  const [open, setOpen] = useState<boolean>(false)

  const roomList = roomInGroupList.filter((e) => e.id === id)
  const amount = roomList.length

  return (
    <Box className="border-[1px] border-gray-100 rounded-xl p-2 shadow-sm hover:shadow-md cursor-pointer" onClick={() => setOpen(!open)}>
      <Box className="flex items-center justify-between">
        <Box className="flex items-center gap-4">
          <Box className="w-14 h-14 rounded-lg bg-green-500 text-white flex items-center justify-center"> 
            <ContactEmergencyRoundedIcon sx={{fontSize:34}} />
          </Box>
          <Box>
            <Typography>{customerName}</Typography>
            <Box className="flex gap-2">
              <Typography sx={{fontSize:14, color:colorTheme.gray[200]}}>{amount} ห้อง</Typography>
              <Status status={status} />
            </Box>
          </Box>
        </Box>
        <IconButton color="primary">
          {open ? <KeyboardArrowUpRoundedIcon /> : <KeyboardArrowDownRoundedIcon />}
        </IconButton>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box className="flex flex-col gap-2 mt-2">
          {roomList.map((room, index) => 
            <RoomItem key={index} id={room.id} name={room.name} status={room.status} image={room.image} />
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

export default RoomGroupItem