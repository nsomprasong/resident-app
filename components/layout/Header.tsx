import { Box, IconButton, Typography } from '@mui/material'
import { Menu } from "@mui/icons-material";
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';

const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
    return (
        <Box className="w-full h-14 flex items-center justify-between bg-white p-2">
            <Box className="flex items-center gap-2">
                <IconButton onClick={onMenuClick} className="md:hidden">
                    <Menu />
                </IconButton>
                <Typography className="text-lg font-semibold">Hotel Logo</Typography>
            </Box>
            <Box className="flex items-center gap-2">
                <Typography className="text-lg font-semibold">User Eiei</Typography>
                <img className="w-8 h-8 rounded-full" src="/images/person.svg" alt="person icon" />
            </Box>
        </Box>
    )
}

export default Header