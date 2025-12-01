import { colorTheme } from '@/lib/constants/color';
import { kanitMedium } from '@/lib/constants/font';
import { Box, Tooltip, IconButton, Typography, Popover } from '@mui/material';
import { LocalizationProvider, StaticDatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import React, { useState } from 'react'
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import dayjs, { Dayjs } from "dayjs";

interface DateSelectorProps {
  date: any;
  setDate: React.Dispatch<React.SetStateAction<Dayjs | null>>;
}

const DateSelector: React.FC<DateSelectorProps> = ({ date, setDate }) => {

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

  return (
    <Box>
      <Box className="flex items-center gap-1 bg-surface py-2 px-4 rounded-full cursor-pointer" onClick={handleOpen}>
        <Tooltip title="แสดงวันที่">
          <EventNoteRoundedIcon sx={{ color:colorTheme.primary ,fontSize: 24 }} />
        </Tooltip>
        <Typography sx={{ ...kanitMedium, fontSize:14, color:colorTheme.textPrimary }}>{date?.format("DD-MM-YYYY")}</Typography>
      </Box>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <StaticDatePicker
            value={date}
            onChange={(newDate) => {
              setDate(newDate);
              handleClose();
            }}
            displayStaticWrapperAs="desktop"
            slotProps={{
              actionBar: { actions: [] }, // hides buttons
            }}
          />
        </LocalizationProvider>
      </Popover>
    </Box>
  )
}

export default DateSelector