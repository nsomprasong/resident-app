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
    
    const { basketList } = useBasketList();

    const goAddOrder = () => {
        router.push(`/booking/${params.bookingId}/food`);
    };

    // const [foodMenu, setFoodMenu] = useState<MenuModel[]>([
    //       {
    //         image: '/images/food/frychicken.jpg',
    //         alt: 'frychicken',
    //         title: 'ไก่ทอด',
    //         price: 80
    //       },
    //       {
    //         image: '/images/food/fryfish.jpg',
    //         alt: 'fryfish',
    //         title: 'ปลาทอด',
    //         price: 350
    //       },
    //       {
    //         image: '/images/food/mootod.jpg',
    //         alt: 'mootod',
    //         title: 'หมูทอด',
    //         price: 120
    //       },
    //       {
    //         image: '/images/food/roti.jpg',
    //         alt: 'roti',
    //         title: 'โรตี',
    //         price: 60
    //       },
    //       {
    //         image: '/images/food/somtum.jpg',
    //         alt: 'somtum',
    //         title: 'ส้มตำ',
    //         price: 50
    //       },
    //       {
    //         image: '/images/food/toomyum.jpg',
    //         alt: 'toomyum',
    //         title: 'ต้มยำกุ้ง',
    //         price: 150
    //       },
    //     ]);

  return (
    <Box className="h-full rounded-2xl">
        <Box className="flex items-center justify-between p-4 rounded-t-2xl bg-green-600">
            <Box className="flex items-center gap-2">
            <Box className="flex items-center gap-4">
                <BackButton classProps='' />
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
            {/* {basketList.map((item, index) => 
                <Box className="flex justify-between">
                    <Box className="flex items-start gap-4">
                        <img className='w-12 h-12' src={item.image} alt={item.alt} />
                        <Box>
                            <Typography>{item.title}</Typography>
                        </Box>
                    </Box>
                </Box>
            )} */}
            <Box className="flex flex-col gap-4 mt-4">
                {basketList.length > 0 ?
                    <>
                        {basketList.map((item, index) => 
                            <Box key={index} className="flex justify-between bg-white rounded-xl shadow-sm p-4">
                                <Box className="flex items-start gap-4">
                                    <img className='w-16 h-16 rounded-lg' src={item.image} alt={item.alt} />
                                    <Box>
                                        <Typography sx={kanitMedium}>{item.title}</Typography>
                                        <Typography sx={{ fontSize: 14, color:colorTheme.gray[300] }}>{item.reason}</Typography>
                                        <Typography sx={{ fontSize:14, color:colorTheme.blue, cursor:'pointer' }}>แก้ไข</Typography>
                                    </Box>
                                </Box>
                                <Box className="flex flex-col justify-between">
                                    <Typography>{item.price} ฿</Typography>
                                    <Tooltip title="ลบรายการ">
                                        <Box className="text-gray-500 hover:text-gray-600 cursor-pointer">
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
                {/* <Box className="flex justify-between bg-white rounded-xl shadow-sm p-4">
                    <Box className="flex items-start gap-4">
                        <img className='w-16 h-16 rounded-lg' src='/images/food/frychicken.jpg' alt='frychicken' />
                        <Box>
                            <Typography sx={kanitMedium}>ไก่ทอด</Typography>
                            <Typography sx={{ fontSize: 14, color:colorTheme.gray[300] }}>ไม่เอาหอมเจียว</Typography>
                            <Typography sx={{ fontSize:14, color:colorTheme.blue, cursor:'pointer' }}>แก้ไข</Typography>
                        </Box>
                    </Box>
                    <Box className="flex flex-col justify-between">
                        <Typography>80 ฿</Typography>
                        <Tooltip title="ลบรายการ">
                            <Box className="text-gray-500 hover:text-gray-600 cursor-pointer">
                                <DeleteRoundedIcon />
                            </Box>
                        </Tooltip>
                    </Box>
                </Box> */}
                
            </Box>
            
        </Box>
    </Box>
  )
}

export default page