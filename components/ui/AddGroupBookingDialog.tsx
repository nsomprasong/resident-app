import { kanitMedium } from '@/lib/constants/font'
import { Dialog, DialogTitle, Typography, DialogContent, TextField, Box, IconButton, Tooltip, Button, Select, MenuItem } from '@mui/material'
import React, { useState } from 'react'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddHomeWorkRoundedIcon from '@mui/icons-material/AddHomeWorkRounded';
import ZoneRoomSelect from './ZoneRoomSelect';

interface AddBookingProps {
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const AddGroupBookingDialog: React.FC<AddBookingProps> = ({ open, setOpen }) => {
    
    const [openZone, setOpenZone] = useState<boolean>(false);

  return (
    <>
        <Dialog open={open} fullWidth maxWidth="xs">
            <DialogTitle className='w-full flex justify-between'>
                <Box className='flex items-center gap-2'>
                    <Box className='text-green-700'>
                        <AddHomeWorkRoundedIcon sx={{ fontSize:28 }} />
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
                <Box className="flex flex-col gap-3">
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <Box className="text-gray-500">
                            <Typography>วันที่เช็คอิน</Typography>
                            <DatePicker
                                slotProps={{ textField: { size: 'small', fullWidth: true }}}
                            />
                        </Box>
                        <Box className="text-gray-500">
                            <Typography>วันที่เช็คเอาท์</Typography>
                            <DatePicker
                                slotProps={{ textField: { size: 'small', fullWidth: true }}}
                            />
                        </Box>
                    </LocalizationProvider>
                    <Box className="text-gray-500">
                        <Typography>โซน</Typography>
                        <Select fullWidth size='small' defaultValue={10}>
                            <MenuItem value={10}>A</MenuItem>
                            <MenuItem value={20}>B</MenuItem>
                        </Select>
                    </Box>
                    <Box className="text-gray-500">
                        <Typography>ห้อง</Typography>
                        <Button sx={{ borderRadius: 1 }} color='success' variant='contained' fullWidth onClick={() => setOpenZone(true)}>
                            <Typography>123</Typography>
                        </Button>
                    </Box>
                    <Box className="text-gray-500">
                        <Typography>จำนวนผู้เข้าพัก</Typography>
                        <TextField fullWidth placeholder='0' />
                    </Box>
                    <Button sx={{ mt:1 }} variant='contained' onClick={() => setOpen(false)}>จองห้องพัก</Button>
                </Box>
            </DialogContent>
        </Dialog>
        <ZoneRoomSelect open={openZone} setOpen={setOpenZone} />
    </>
  )
}

export default AddGroupBookingDialog