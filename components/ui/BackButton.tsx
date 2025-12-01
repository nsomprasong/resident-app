import { colorTheme } from '@/lib/constants/color'
import { Tooltip, IconButton } from '@mui/material'
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import React from 'react'
import { useRouter } from 'next/navigation';

interface ButtonProps {
  classProps: string
  route: string
}

const BackButton: React.FC<ButtonProps> = ({ classProps, route }) => {

  const router = useRouter();

  return (
    <Tooltip title="ย้อนกลับ">
        <IconButton 
          className={classProps}
          size='small' 
          sx={{
              backgroundColor: 'white',  
              '&:hover': { backgroundColor: colorTheme.textSecondary },       
          }} 
          onClick={() => router.push(route)}
        >
          <ArrowBackIosRoundedIcon color='primary' />
        </IconButton>
    </Tooltip>
  )
}

export default BackButton