'use client'

import BackButton from '@/components/ui/BackButton';
import { useBasketList } from '@/hooks/useBasketList';
import { colorTheme } from '@/lib/constants/color';
import { kanitMedium } from '@/lib/constants/font';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import React from 'react'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

const Page = () => {
  const router = useRouter();
  const params = useParams<{ bookingId: string }>();
  const { basketList, removeFromBasket } = useBasketList();

  const totalPrice = basketList.reduce((sum, item) => sum + item.price, 0);

  const goAddOrder = () => {
    router.push(`/booking/${params.bookingId}/food`);
  };

  const goRoom = () => {
    router.push(`/booking/${params.bookingId}/room`);
  };

  return (
    <Box className="flex flex-col h-[calc(100vh-32px)] rounded-xl">
      {/* Header */}
      <Box className="flex items-center justify-between p-4 rounded-t-2xl bg-green-600">
        <Box className="flex items-center gap-2">
          <Box className="flex items-center gap-4">
            <BackButton classProps='' route={`/booking/${params.bookingId}/food`} />
            <Typography sx={{ ...kanitMedium, fontSize: 18, color: 'white' }}>ตะกร้า</Typography>
          </Box>
          <Box className="flex items-center gap-2 bg-white text-green-600 px-3 rounded-2xl">
            <Typography>ห้อง</Typography>
            <Typography>{params.bookingId}</Typography>
          </Box>
        </Box>
      </Box>

      {/* Scrollable content */}
      <Box className="flex-1 overflow-y-auto p-4">
        <Box className="flex justify-between items-end">
          <Typography sx={kanitMedium}>สรุปคำสั่งซื้อ</Typography>
          <Typography
            sx={{ fontSize: 14, color: colorTheme.blue, cursor: 'pointer' }}
            onClick={goAddOrder}
          >
            เพิ่มรายการ
          </Typography>
        </Box>

        <Box className="flex flex-col gap-2 mt-4">
          {basketList.length > 0 ? (
            basketList.map((item, index) => (
              <Box key={index} className="flex justify-between bg-white rounded-xl shadow-sm p-4">
                <Box className="w-10/12 flex items-start gap-4">
                  <img className="w-16 h-16 rounded-lg" src={item.image} alt={item.alt} />
                  <Box className="w-full h-full flex flex-col justify-between">
                    <Typography sx={kanitMedium}>{item.title}</Typography>
                    <Typography
                      sx={{
                        fontSize: 14,
                        color: colorTheme.gray[300],
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.reason}
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: colorTheme.blue, cursor: 'pointer' }}>
                      แก้ไข
                    </Typography>
                  </Box>
                </Box>
                <Box className="w-2/12 flex flex-col justify-between items-end">
                  <Typography>{item.price} ฿</Typography>
                  <Tooltip title="ลบรายการ">
                    <Box
                      className="text-gray-500 hover:text-gray-600 cursor-pointer"
                      onClick={() => removeFromBasket(item.id)}
                    >
                      <DeleteRoundedIcon />
                    </Box>
                  </Tooltip>
                </Box>
              </Box>
            ))
          ) : (
            <Box className="w-full text-center">
              <Typography>ไม่มีรายการอาหารที่สั่ง</Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer */}
      {basketList.length > 0 && 
        <Box className="p-4 bg-white border-t border-gray-200 rounded-b-xl">
            <Box className="flex justify-between mb-4">
                <Typography sx={kanitMedium}>ราคารวม</Typography>
                <Typography sx={kanitMedium}>{totalPrice} ฿</Typography>
            </Box>
            <Button
            variant="contained"
            color="success"
            fullWidth
            onClick={goRoom}
            >
            <Typography>ยืนยันรายการอาหาร</Typography>
            </Button>
        </Box>
      }
    </Box>
  );
};

export default Page;
