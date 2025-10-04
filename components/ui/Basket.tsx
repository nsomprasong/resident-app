import React from 'react'
import LocalMallRoundedIcon from '@mui/icons-material/LocalMallRounded';
import { Tooltip, Badge } from '@mui/material';


const Basket = () => {
  return (
    <>
      <Tooltip title="ตระกร้า">
          <Badge color="warning" badgeContent={1}>
              <LocalMallRoundedIcon sx={{color: 'white'}} />
          </Badge>
      </Tooltip>
    </>
  )
}

export default Basket