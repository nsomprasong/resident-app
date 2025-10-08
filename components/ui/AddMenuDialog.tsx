import { Box, Button, Dialog, Divider, IconButton, TextField, Tooltip, Typography } from '@mui/material'
import React, { ChangeEvent, useState } from 'react'
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { kanitMedium } from '@/lib/constants/font';
import { colorTheme } from '@/lib/constants/color';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { buttonIconStyle } from '@/lib/constants/buttonIconStyle';
import { useBasketList } from '@/hooks/useBasketList';

interface MenuDetail {
    image: string
    alt: string
    title: string
    price: number
}

interface AddMenuProps {
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
    menu: MenuDetail
}

const AddMenuDialog: React.FC<AddMenuProps> = ({ open, setOpen, menu }) => {

    const [amount, setAmount] = useState<number>(1);
    const [reason, setReason] = useState<string>('');

    const { basketList ,addToBasket } = useBasketList();

    const handleAddBasket = () => {
        for(let i=0; i < amount; i++) {
            addToBasket({
                id: basketList.length + 1,
                image: menu.image,
                alt: menu.alt,
                title: menu.title,
                price: menu.price,
                reason: reason
            })
        }
        setOpen(!open)
    }

    const handleDecrease = () => {
        if(amount >= 0) {
            setAmount(amount - 1)
        }
    }

    const handleReason = (event: ChangeEvent<HTMLInputElement>) => {
        setReason(event.target.value)
    }

  return (
    <Dialog open={open} fullWidth maxWidth="xs">
        <Box className="relative w-full h-56 aspect-[16/10] overflow-hidden rounded-t-xl">
            <Tooltip title="ปิด">
                <Box 
                    className='absolute top-2 right-2 z-20 p-1 bg-white hover:bg-gray-100 rounded-full text-gray-500 cursor-pointer' 
                    onClick={() => setOpen(false)}
                >
                    <ClearRoundedIcon sx={{ fontSize: 30 }} />
                </Box>
            </Tooltip>
            <img
                className="absolute top-0 z-10 w-full h-full object-cover"
                src={menu.image}
                alt={menu.alt}
            />
        </Box>
        <Box className="w-full flex flex-col gap-2 p-4">
            <Box className="w-full flex justify-between">
                <Typography sx={kanitMedium}>{menu.title}</Typography>
                <Typography sx={kanitMedium}>฿{menu.price.toString()}</Typography>
            </Box>
            <Divider sx={{borderColor: colorTheme.gray[100]}} />
            <Box className="w-full">
                <Typography sx={{fontSize: 14}}>รายละเอียดเพิ่มเติม</Typography>
                <TextField fullWidth placeholder='ระบุสิ่งที่ไม่ต้องการ หรือ สิ่งที่แพ้' onChange={handleReason} />
            </Box>
            <Divider sx={{ borderColor: colorTheme.gray[100], mt:2 }} />
            <Box className="flex gap-4">
                <Box className="flex items-center gap-4">
                    <Tooltip title="ลดจำนวน">
                        <IconButton
                            sx={buttonIconStyle}
                            size='small'
                            disabled={amount <= 0}
                            onClick={handleDecrease}
                        >
                            <RemoveRoundedIcon sx={{ fontSize: 30 }} />
                        </IconButton>
                    </Tooltip>
                    <Box className="w-3 flex justify-center items-center">
                        <Typography>{amount}</Typography>
                    </Box>
                    <Tooltip title="เพิ่มจำนวน">
                        <IconButton
                            sx={buttonIconStyle}
                            size='small'
                            onClick={() => setAmount(amount + 1)}
                        >
                            <AddRoundedIcon sx={{ fontSize: 30 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
                <Button 
                    variant='contained' 
                    color='success' 
                    fullWidth 
                    disabled={amount <= 0}
                    onClick={handleAddBasket}
                >
                    <Typography>ใส่ตระกร้า</Typography>
                </Button>
            </Box>
        </Box>
    </Dialog>
  )
}

export default AddMenuDialog