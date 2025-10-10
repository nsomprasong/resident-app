'use client'

import BackButton from '@/components/ui/BackButton';
import { useBasketList } from '@/hooks/useBasketList';
import { colorTheme } from '@/lib/constants/color';
import { kanitMedium } from '@/lib/constants/font';
import { Box, Tooltip, Typography } from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import React from 'react'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

const page = () => {

    const router = useRouter();
    const params = useParams<{ bookingId: string }>();
    
    const { basketList, removeFromBasket } = useBasketList();

    const goAddOrder = () => {
        router.push(`/booking/${params.bookingId}/food`);
    };

  return (
    <Box className="h-full rounded-2xl">
        <Box className="flex items-center justify-between p-4 rounded-t-2xl bg-green-600">
            <Box className="flex items-center gap-2">
            <Box className="flex items-center gap-4">
                <BackButton classProps='' route={`/booking/${params.bookingId}/food`} />
                <Typography sx={{...kanitMedium, fontSize:18, color:'white'}}>ตะกร้า</Typography>
            </Box>
            <Box className="flex items-center gap-2 bg-white text-green-600 px-3 rounded-2xl">
                <Typography>ห้อง</Typography>
                <Typography>{params.bookingId}</Typography>
            </Box>
            </Box>
        </Box>
        <Box className="p-4">
            <Box className="flex justify-between items-end">
                <Typography sx={kanitMedium}>สรุปคำสั่งซื้อ</Typography>
                <Typography sx={{ fontSize:14, color:colorTheme.blue, cursor:'pointer' }} onClick={goAddOrder}>เพิ่มรายการ</Typography>
            </Box>
            <Box className="flex flex-col gap-2 mt-4">
                {basketList.length > 0 ?
                    <>
                        {basketList.map((item, index) => 
                            <Box key={index} className="flex justify-between bg-white rounded-xl shadow-sm p-4">
                                <Box className="flex items-start gap-4">
                                    <img className='w-16 h-16 rounded-lg' src={item.image} alt={item.alt} />
                                    <Box className="h-full flex flex-col justify-between">
                                        <Typography sx={kanitMedium}>{item.title}</Typography>
                                        <Typography sx={{ fontSize: 14, color:colorTheme.gray[300] }}>{item.reason}</Typography>
                                        <Typography sx={{ fontSize:14, color:colorTheme.blue, cursor:'pointer' }}>แก้ไข</Typography>
                                    </Box>
                                </Box>
                                <Box className="flex flex-col justify-between items-end">
                                    <Typography>{item.price} ฿</Typography>
                                    <Tooltip title="ลบรายการ">
                                        <Box className="text-gray-500 hover:text-gray-600 cursor-pointer" onClick={() => removeFromBasket(item.id)}>
                                            <DeleteRoundedIcon />
                                        </Box>
                                    </Tooltip>
                                </Box>
                            </Box>
                        )}
                    </>
                    :
                    <Box className="w-full text-center">
                        <Typography>ไม่มีรายการอาหารที่สั่ง</Typography>
                    </Box>
                }
            </Box>
            
        </Box>
    </Box>
  )
}

export default page