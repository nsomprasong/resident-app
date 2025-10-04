import { Box, Divider, Typography } from '@mui/material'
import React from 'react'

interface UserNavProps {
    image: string
    name: string
    role: string
}

const UserNav: React.FC<UserNavProps> = ({ image, name, role }) => {
  return (
    <Box className="flex flex-col gap-2 p-4">
        <Divider />
        <Box className="flex items-center gap-2 py-2">
            <img className="w-12 h-12 rounded-full" src={image} alt="person icon" />
            <Box className="text-gray-400">
                <Typography sx={{fontWeight: 700, color:'#101828'}}>{name}</Typography>
                <Typography>{role}</Typography>
            </Box>
        </Box>
    </Box>
  )
}

export default UserNav