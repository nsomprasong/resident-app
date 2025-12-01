'use client'

import { colorTheme } from '@/lib/constants/color'
import { kanitMedium } from '@/lib/constants/font'
import { Box, IconButton, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import dayjs, { Dayjs } from "dayjs";
import React, { useState } from 'react'
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import DateSelector from '@/components/ui/DateSelector';
import RoomItem from '@/components/ui/RoomItem';
import AddSoloBookingDialog from '@/components/ui/AddSoloBookingDialog';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import RoomGroupItem from '@/components/ui/RoomGroupItem';
import AddGroupBookingDialog from '@/components/ui/AddGroupBookingDialog';
import { BookingDetail } from '@/interface/BookingDetailModel';
import OrderGroupItem from '@/components/ui/OrderGroupItem';
import OrderItem from '@/components/ui/OrderItem';

const roomSoloList = [
  { id: 1, name: "Room 1", status: "รอดำเนินการ", image: "/images/room/room1.jpg" },
  { id: 2, name: "Room 2", status: "ยืนยันแล้ว", image: "/images/room/room2.jpg" },
  { id: 3, name: "Room 3", status: "เช็คอิน", image: "/images/room/room3.jpg" },
  { id: 4, name: "Room 4", status: "เช็คเอาท์", image: "/images/room/room4.jpg" },
];

const groupList = [
  { id: 1, customerName: "Jhon Group", status: "รอดำเนินการ" },
  { id: 2, customerName: "Non Group", status: "ยืนยันแล้ว" },
  { id: 3, customerName: "Eiei Group", status: "เช็คอิน" },
  { id: 4, customerName: "Hello Group", status: "เช็คเอาท์" },
];

const roomInGroupList: BookingDetail[] = [
  { id: 1, name: "Room 1", status: "รอดำเนินการ", image: "/images/room/room1.jpg" },
  { id: 2, name: "Room 2", status: "ยืนยันแล้ว", image: "/images/room/room2.jpg" },
  { id: 3, name: "Room 3", status: "เช็คอิน", image: "/images/room/room3.jpg" },
  { id: 4, name: "Room 4", status: "เช็คเอาท์", image: "/images/room/room4.jpg" },
  { id: 1, name: "Room 1", status: "รอดำเนินการ", image: "/images/room/room1.jpg" },
  { id: 1, name: "Room 2", status: "ยืนยันแล้ว", image: "/images/room/room2.jpg" },
  { id: 1, name: "Room 3", status: "เช็คอิน", image: "/images/room/room3.jpg" },
  { id: 2, name: "Room 4", status: "เช็คเอาท์", image: "/images/room/room4.jpg" },
  { id: 2, name: "Room 1", status: "รอดำเนินการ", image: "/images/room/room1.jpg" },
  { id: 3, name: "Room 2", status: "ยืนยันแล้ว", image: "/images/room/room2.jpg" },
  { id: 3, name: "Room 3", status: "เช็คอิน", image: "/images/room/room3.jpg" },
  { id: 4, name: "Room 4", status: "เช็คเอาท์", image: "/images/room/room4.jpg" },
];

const page = () => {

  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [openSolo, setOpenSolo] = useState<boolean>(false);
  const [openGroup, setOpenGroup] = useState<boolean>(false);
  const [tab, setTab] = useState<number>(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
  };

  const handleOpenSoloOrGroup = () => {
    if(tab === 0){
      setOpenGroup(true);
    } else {
      setOpenSolo(true);
    }
  }

  return (
    <Box className="p-4">
      <Box className="flex justify-between items-center">
        <Typography sx={{ ...kanitMedium, fontSize:18 }}>สั่งอาหาร</Typography>
      </Box> 
      <Box className="flex items-center justify-between mt-1">
        <Tabs
          value={tab}
          onChange={handleChange}
          scrollButtons
          allowScrollButtonsMobile
          aria-label="scrollable force tabs example"
        >
          <Tab icon={<GroupsIcon />} iconPosition="start"  label="กลุ่ม" />
          <Tab icon={<PersonRoundedIcon />} iconPosition="start" label="เดี่ยว" />
        </Tabs>
        <DateSelector date={date} setDate={setDate} />
      </Box>
      {tab === 0 &&
        <Box className="mt-2">
          <Typography sx={{ ...kanitMedium, fontSize: 16, color: colorTheme.textPrimary }}>สั่งอาหารแบบกลุ่ม</Typography>
          <Box className="flex flex-col gap-2 mt-2">
            {groupList.map((cus, index) => 
              <OrderGroupItem key={index} id={cus.id} customerName={cus.customerName} />
            )}
          </Box>
        </Box>
      }
      {tab === 1 &&
        <Box className="mt-2">
          <Typography sx={{ ...kanitMedium, fontSize: 16, color: colorTheme.textPrimary }}>สั่งอาหารแบบเดี่ยว</Typography>
          <Box className="flex flex-col gap-2 mt-2">
            {roomSoloList.map((room, index) => (
              <OrderItem key={index} id={room.id} name={room.name} image={room.image} />
            ))}
          </Box>
        </Box>
      }
    </Box>
  )
}

export default page