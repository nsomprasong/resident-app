'use client'

import { colorTheme } from '@/lib/constants/color'
import { kanitMedium } from '@/lib/constants/font'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import dayjs, { Dayjs } from "dayjs";
import React, { useState } from 'react'
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import DateSelector from '@/components/ui/DateSelector';
import RoomItem from '@/components/ui/RoomItem';
import AddBookingDialog from '@/components/ui/AddBookingDialog';

const roomList = [
  { id: 1, name: "Room 1", status: "รอดำเนินการ", image: "/images/room/room1.jpg" },
  { id: 2, name: "Room 2", status: "ยืนยันแล้ว", image: "/images/room/room2.jpg" },
  { id: 3, name: "Room 3", status: "เช็คอิน", image: "/images/room/room3.jpg" },
  { id: 4, name: "Room 4", status: "เช็คเอาท์", image: "/images/room/room4.jpg" },
];

const page = () => {

  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <Box className="p-4">
        <Box className="flex justify-between items-center">
          <Typography sx={{ ...kanitMedium, fontSize:18 }}>รายการจองห้องพัก</Typography>
          <Tooltip title="เพิ่มรายการจองห้องพัก">
            <IconButton color='success' size='small' onClick={() => setOpen(true)}>
              <AddCircleRoundedIcon sx={{ color:colorTheme.green[300] ,fontSize: 30 }} />
            </IconButton>
          </Tooltip>
        </Box> 
        <DateSelector date={date} setDate={setDate} />
        <Box className="flex flex-col gap-2">
          {roomList.map((room, index) => (
            <RoomItem key={index} id={room.id} name={room.name} status={room.status} image={room.image} />
          ))}
        </Box>
      </Box>

      <AddBookingDialog open={open} setOpen={setOpen} />
    </>
  )
}

export default page