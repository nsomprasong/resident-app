'use client';

import BackButton from '@/components/ui/BackButton';
import { colorTheme } from '@/lib/constants/color';
import { kanitMedium } from '@/lib/constants/font';
import { Badge, Box, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useParams, useRouter } from 'next/navigation';
import React, { useState } from 'react'
import FastfoodRoundedIcon from '@mui/icons-material/FastfoodRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import ReorderRoundedIcon from '@mui/icons-material/ReorderRounded';
import { MenuModel } from '@/interface/MenuModel';
import CardMenu from '@/components/ui/CardMenu';
import Basket from '@/components/ui/Basket';
import { MenuShowModel } from '@/interface/MenuShowModel';


const page = () => {

    const router = useRouter();
    const params = useParams<{ bookingId: string }>();

    const [tab, setTab] = useState<number>(0);

    const [foodMenu, setFoodMenu] = useState<MenuShowModel[]>([
      {
        image: '/images/food/frychicken.jpg',
        alt: 'frychicken',
        title: 'ไก่ทอด',
        price: 80
      },
      {
        image: '/images/food/fryfish.jpg',
        alt: 'fryfish',
        title: 'ปลาทอด',
        price: 350
      },
      {
        image: '/images/food/mootod.jpg',
        alt: 'mootod',
        title: 'หมูทอด',
        price: 120
      },
      {
        image: '/images/food/roti.jpg',
        alt: 'roti',
        title: 'โรตี',
        price: 60
      },
      {
        image: '/images/food/somtum.jpg',
        alt: 'somtum',
        title: 'ส้มตำ',
        price: 50
      },
      {
        image: '/images/food/toomyum.jpg',
        alt: 'toomyum',
        title: 'ต้มยำกุ้ง',
        price: 150
      },
    ]);

    const [minibarMenu, setMinibar] = useState<MenuShowModel[]>([
      {
        image: '/images/minibar/beer.jpg',
        alt: 'beer',
        title: 'เบียร์ช้าง',
        price: 65
      },
      {
        image: '/images/minibar/chocolate.jpg',
        alt: 'chocolate',
        title: 'ช็อคโกแลต',
        price: 35
      },
      {
        image: '/images/minibar/lay.jpg',
        alt: 'lay',
        title: 'เลย์',
        price: 30
      },
      {
        image: '/images/minibar/icecream.jpg',
        alt: 'icecream',
        title: 'ไอติม',
        price: 45
      },
      {
        image: '/images/minibar/milk.jpg',
        alt: 'milk',
        title: 'นมโฟโมต',
        price: 15
      }
    ]);

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
      setTab(newValue);
    };

  return (
    <Box className="h-full rounded-2xl bg-gray-50">
      <Box className="flex items-center justify-between p-4 rounded-t-2xl bg-green-600">
        <Box className="flex items-center gap-2">
          <Box className="flex items-center gap-4">
            <BackButton classProps='' route={`/booking/${params.bookingId}/room`} />
            <Typography sx={{...kanitMedium, fontSize:18, color:'white'}}>สั่งอาหาร</Typography>
          </Box>
          <Box className="flex items-center gap-2 bg-white text-green-600 px-3 rounded-2xl">
            <Typography>ห้อง</Typography>
            <Typography>{params.bookingId}</Typography>
          </Box>
        </Box>
        <Basket id={params.bookingId} />
      </Box>
      <Box className="w-full mt-2">
          <Tabs
            value={tab}
            onChange={handleChange}
            variant="scrollable"
            scrollButtons
            allowScrollButtonsMobile
            aria-label="scrollable force tabs example"
          >
            <Tab icon={<RestaurantRoundedIcon />} iconPosition="start"  label="อาหาร" />
            <Tab icon={<FastfoodRoundedIcon />} iconPosition="start" label="มินิบาร์" />
            <Tab icon={<ReorderRoundedIcon />} iconPosition="start" label="อื่นๆ" />
          </Tabs>
        </Box>
        <Grid container spacing={2} className="mt-2 p-4">
          {tab === 0 &&
            <>
              {foodMenu.map((item, index) =>
                <CardMenu key={index} image={item.image} alt={item.alt} title={item.title} price={item.price} />
              )}
            </>
          }
          {tab === 1 &&
            <>
              {minibarMenu.map((item, index) =>
                <CardMenu key={index} image={item.image} alt={item.alt} title={item.title} price={item.price} />
              )}
            </>
          }
          
        </Grid>
    </Box>
  )
}

export default page