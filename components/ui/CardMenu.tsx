import { Grid, Box, Typography, Tooltip } from '@mui/material'
import React, { useState } from 'react'
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import AddMenuDialog from './AddMenuDialog';
import { useBasketList } from '@/hooks/useBasketList';

interface CardMenuProps {
    image: string
    alt: string
    title: string
    price: number
}

const CardMenu: React.FC<CardMenuProps> = ({ image, alt, title, price }) => {

    const { basketList } = useBasketList();

    const [open, setOpen] = useState<boolean>(false);

    const amountMenuInBasket = basketList.filter(item => item.title === title).length;

  return (
    <>
        <AddMenuDialog 
            open={open} 
            setOpen={setOpen}
            menu={{
                image: image,
                alt: alt,
                title: title,
                price: price
            }}
        />
        <Grid size={{ xs:6, md:4, lg:3, xl:2 }} className="relative bg-white rounded-xl shadow-sm">
            <Box className='relative w-full h-40 overflow-hidden rounded-t-xl'>
                {amountMenuInBasket > 0 &&
                    <Box className="w-7 h-7 absolute top-2 right-2 z-20 rounded-full bg-white p-1 flex justify-center items-center border border-gray-300">
                        <Typography sx={{fontSize: 14}}>{amountMenuInBasket.toString()}</Typography>
                    </Box>
                }
                <img className='absolute top-0 z-10 w-full h-40 aspect-[16/10] overflow-hidden rounded-t-xl' src={image} alt={alt} />
            </Box>
            <Box className='py-2 pl-4 pr-2'>
                <Typography>{title}</Typography>
                <Box className='flex justify-between items-end'>
                    <Typography>฿ {price.toString()}</Typography>
                    <Box className="flex items-center">
                        <Tooltip title="เพิ่มรายการ">                  
                            <Box className='text-primary hover:text-secondary cursor-pointer' onClick={() => setOpen(true)}>
                                <AddCircleRoundedIcon sx={{ fontSize: 30 }} />
                            </Box>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>
        </Grid>
    </>
  )
}

export default CardMenu