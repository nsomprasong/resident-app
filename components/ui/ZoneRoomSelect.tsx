import { kanitMedium } from '@/lib/constants/font'
import { Dialog, DialogTitle, Box, Typography, Tooltip, IconButton, DialogContent, Select, MenuItem, Button, TextField, Tabs, Tab, Divider } from '@mui/material'
import AddHomeRoundedIcon from '@mui/icons-material/AddHomeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import React, { useState } from 'react'
import RoomIconSlect from './RoomIconSlect';
import { colorTheme } from '@/lib/constants/color';

interface ZoneRoomProps {
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const rooms = [
    { roomNo: 1, booked: false },
    { roomNo: 2, booked: true },
    { roomNo: 3, booked: false },
    { roomNo: 4, booked: false },
    { roomNo: 5, booked: true },
    { roomNo: 6, booked: false },
    { roomNo: 7, booked: false },
    { roomNo: 8, booked: true },
    { roomNo: 9, booked: false },
    { roomNo: 10, booked: false },
    { roomNo: 11, booked: true },
    { roomNo: 12, booked: false },
    { roomNo: 13, booked: false },
    { roomNo: 14, booked: true },
    { roomNo: 15, booked: false },
    { roomNo: 16, booked: false },
    { roomNo: 17, booked: true },
    { roomNo: 18, booked: false },
    { roomNo: 19, booked: false },
    { roomNo: 20, booked: true },
];

const ZoneRoomSelect: React.FC<ZoneRoomProps> = ({ open, setOpen }) => {

    const [tab, setTab] = useState<number>(0);

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        setTab(newValue);
    };

  return (
    <Dialog open={open} fullWidth maxWidth="xs">
        <DialogTitle className='w-full flex justify-between'>
            <Box className='flex items-center gap-2'>
                <Box className='text-primary'>
                    <AddHomeRoundedIcon sx={{ fontSize:28 }} />
                </Box>
                <Typography sx={{ ...kanitMedium ,fontSize: 18}}>เพิ่มรายการจองห้องพัก</Typography>
            </Box>
            <Tooltip title='ปิด'>
                <IconButton onClick={() => setOpen(false)}>
                    <CloseRoundedIcon />
                </IconButton>
            </Tooltip>
        </DialogTitle>
        <DialogContent className="flex flex-col items-center gap-4">
           <Tabs
                value={tab}
                onChange={handleChange}
                scrollButtons
                allowScrollButtonsMobile
                aria-label="scrollable force tabs example"
            >
                <Tab label="A" />
                <Tab label="B" />
            </Tabs>
            <Box className="w-full flex flex-wrap items-center justify-center gap-1 p-2">
                {rooms.map((item, index) => 
                    <RoomIconSlect key={index} roomNo={item.roomNo} booked={item.booked} />   
                )}    
            </Box>
            <Box sx={{ width: '100%'}}>
                <Divider />
            </Box>
            <Box className="w-full flex flex-wrap">
                <Typography sx={{ ...kanitMedium, color: colorTheme.textPrimary }}>ห้องที่เลือก 1, 2, 3, 4, 5, 6</Typography>
            </Box>
            <Button fullWidth variant='contained' onClick={() => setOpen(false)}>ยืนยัน</Button>
        </DialogContent>
    </Dialog>
  )
}

export default ZoneRoomSelect