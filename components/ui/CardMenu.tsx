import { Grid, Box, Typography, Tooltip } from '@mui/material'
import React, { useState } from 'react'
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import AddMenuDialog from './AddMenuDialog';

interface CardMenuProps {
    image: string
    alt: string
    title: string
    price: number
}

const CardMenu: React.FC<CardMenuProps> = ({ image, alt, title, price }) => {

    const [open, setOpen] = useState<boolean>(false);

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
            <img className='w-full h-40 aspect-[16/10] overflow-hidden rounded-t-xl' src={image} alt={alt} />
            <Box className='py-2 pl-4 pr-2'>
                <Typography>{title}</Typography>
                <Box className='flex justify-between items-end'>
                    <Typography>฿ {price.toString()}</Typography>
                    <Box className="flex items-center">
                        <Tooltip title="เพิ่มรายการ">                  
                            <Box className='text-green-600 hover:text-green-700 cursor-pointer' onClick={() => setOpen(true)}>
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