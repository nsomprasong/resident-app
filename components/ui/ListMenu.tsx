"use client"

import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton, Collapse } from '@mui/material'
import Link from 'next/link'
import React, { useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { usePathname } from "next/navigation";

interface MenuItems {
  text: string
  icon: React.ReactNode
  path: string
}

interface MenuItemsProps {
  menuItems: MenuItems[]
  title: string
}

const ListMenu: React.FC<MenuItemsProps> = ({ menuItems, title }) => {

    const [open, setOpen] = useState(true);

    const pathname = usePathname();

    const handleToggle = () => {
        setOpen((prev) => !prev);
    };

  return (
    <Box className="w-64 px-4">
        <Box className="flex justify-between items-center text-gray-500">
            <Typography sx={{fontSize: 15}}>{title}</Typography>
            <IconButton onClick={handleToggle}>
                {open ? <AddRoundedIcon /> : <RemoveRoundedIcon />}
            </IconButton>
        </Box>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box>
            <List>
                {menuItems.map((item) => (
                <ListItem key={item.text} disablePadding>
                    <ListItemButton 
                      component={Link} 
                      href={item.path} 
                      selected={pathname === item.path}
                    >
                      <ListItemIcon sx={{ minWidth:0, paddingX: 2 }}>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItemButton>
                </ListItem>
                ))}
            </List>
          </Box>
        </Collapse>
    </Box>
  )
}

export default ListMenu