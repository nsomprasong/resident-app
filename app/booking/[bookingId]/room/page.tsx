'use client';

import { Box, Button, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import { useParams, useRouter } from "next/navigation";
import React, { useState } from 'react'
import { colorTheme } from '@/lib/constants/color';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import { kanitMedium } from '@/lib/constants/font';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import BillDetail from '@/components/ui/BillDetail';
import FastfoodRoundedIcon from '@mui/icons-material/FastfoodRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import ReorderRoundedIcon from '@mui/icons-material/ReorderRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import BillItem from '@/components/ui/BillItem';
import PayButton from '@/components/ui/PayButton';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BackButton from '@/components/ui/BackButton';
import { useBookingDetail } from '@/hooks/useBookingDetail';

interface BillDetail {
    title: string;
    price: number;
}

const foodList: BillDetail[] = [
    { title: "ข้าวผัด", price: 50 },
    { title: "ต้มยำกุ้ง", price: 150 },
    { title: "ส้มตำ", price: 70 },
];

const minibarList: BillDetail[] = [
    { title: "เลย์ x 1", price: 20 },
    { title: "โค๊ก x 1", price: 15 },
]

const otherList: BillDetail[] = [
    { title: "ทำความสะอาด x 1", price: 100 },
]

const page = () => {

    const params = useParams<{ bookingId: string }>();
    const router = useRouter();

    const { bookingDetail } = useBookingDetail();
    const [isEdit, setIsEdit] = useState<boolean>(false);
    
    const colorConvert = () => {
        switch (bookingDetail.status) {
            case "รอดำเนินการ":
                return { bg:"bg-orange-100", color:"text-orange-400", icon:"bg-orange-300"};
            case "ยืนยันแล้ว":
                return { bg:"bg-emerald-100", color:"text-emerald-400", icon:"bg-emerald-400"};
            case "เช็คอิน":
                return { bg:"bg-blue-100", color:"text-blue-500", icon:"bg-blue-500"};
            case "เช็คเอาท์":
                return { bg:"bg-gray-100", color:"text-gray-500", icon:"bg-gray-400"};
            default:
                return { bg:"bg-gray-100", color:"text-gray-500", icon:"bg-gray-400"};
        }
    }

    const colorStatus = colorConvert();

    const goAddOrder = () => {
        router.push(`/booking/${params.bookingId}/food`);
    };

  return (
    <Box className="relative w-full h-full pb-4 flex flex-col gap-4 rounded-xl bg-gray-100">
      <Box className="relative w-full h-56 aspect-[16/10] overflow-hidden rounded-t-xl">
        <BackButton classProps="absolute top-4 left-4 z-20" />
        <img
          className="absolute top-0 z-10 w-full h-full object-cover"
          src={bookingDetail.image}
          alt="room image"
        />
      </Box>
      <Box className="w-full flex justify-center">
        <Box className="w-full flex flex-col gap-2 px-4 md:w-3/5"> 
            <Box className="flex justify-between items-center">
              <Typography sx={{ ...kanitMedium ,fontSize: 18}}>Room {params.bookingId}</Typography>
                <Button 
                  variant='contained'
                  color='success'
                  onClick={goAddOrder}
                >
                  <AddRoundedIcon />
                  <Typography>สั่งอาหาร</Typography>
                </Button>
            </Box>
            {/* Room price */}
            <Box className="w-full flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm">
              <Box className="flex justify-between items-center">
                <Box className="flex items-center gap-4">
                  <Box className={`w-12 h-12 rounded-full flex justify-center items-center ${colorStatus.icon} text-white`}>
                    <PersonRoundedIcon sx={{fontSize:30}} />
                  </Box>
                  <Box className="flex flex-col">
                    <Typography sx={{ ...kanitMedium ,fontSize:16}}>John Doe</Typography>
                    <Typography sx={{fontSize:14, color: colorTheme.gray[200]}}>081-123-4567</Typography>
                  </Box>
                </Box>
                <Box className={`flex flex-col items-end ${colorStatus.bg} ${colorStatus.color} px-3 py-1 rounded-2xl`}>
                  <Typography sx={{ ...kanitMedium ,fontSize:14}}>{bookingDetail.status}</Typography>
                </Box>
              </Box>
              <Divider /> 
              <BillDetail title="ค่าห้องพัก" price={1200} isEdit={isEdit} />
              <BillDetail title="ค่าแพ" price={1500} isEdit={isEdit} /> 
            </Box>
            {/* food price */}
            <BillItem title='ค่าอาหาร' icon={<RestaurantRoundedIcon sx={{ fontSize: 30 }} />} items={foodList} isEdit={isEdit} />
            {/* minibar price */}
            <BillItem title='ค่ามินิบาร์' icon={<FastfoodRoundedIcon sx={{ fontSize: 30 }} />} items={minibarList} isEdit={isEdit} />
            {/* other price */}
            <BillItem title='ค่าอื่นๆ' icon={<ReorderRoundedIcon sx={{ fontSize: 30 }} />} items={otherList} isEdit={isEdit} />
            {/* Summary Bill */}
            <Box className="w-full flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm">
              <Box className="flex justify-between items-center">
                <Box className="flex items-center gap-4">
                  <Box className={`w-12 h-12 rounded-full flex justify-center items-center bg-red-500 text-white`}>
                    <LocalOfferRoundedIcon sx={{fontSize:30}} />
                  </Box>
                  <Box>
                    <Typography sx={{ ...kanitMedium ,fontSize:16}}>สรุปรายการรวม</Typography>
                    <Box className={`flex text-red-500`}>
                      <Typography sx={{...kanitMedium, fontSize:12}}>ยังไม่ได้ชำระ</Typography>
                    </Box>
                  </Box>
                </Box>
                <Typography sx={{ ...kanitMedium ,fontSize:16}}>4,045 ฿</Typography>
              </Box>
            </Box>
            {isEdit ?
              <Button variant="contained" color="primary" sx={{ mt: 1 }} onClick={() => setIsEdit(!isEdit)}>
                ยืนยัน
              </Button>
              :
              <PayButton amount={4045} />
            }
        </Box>
      </Box>
    </Box>
  )
}

export default page