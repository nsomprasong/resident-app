import { colorTheme } from '@/lib/constants/color'
import { Tooltip, IconButton } from '@mui/material'
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import React from 'react'

interface ButtonProps {
  classProps: string
}

const BackButton: React.FC<ButtonProps> = ({ classProps }) => {
  return (
    <Tooltip title="ย้อนกลับ">
        <IconButton 
          className={classProps}
          size='small' 
          sx={{
              backgroundColor: 'white',  
              '&:hover': { backgroundColor: colorTheme.gray[100] },       
          }} 
          onClick={() => window.history.back()}
        >
          <ArrowBackIosRoundedIcon color='success' />
        </IconButton>
    </Tooltip>
  )
}

export default BackButton