import { Drawer, Box, Typography, Divider } from "@mui/material";
import { Home, Settings } from "@mui/icons-material";
import { robotoBold } from "@/lib/constants/font";
import ListMenu from "../ui/ListMenu";
import UserNav from "../ui/UserNav";
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded';
import SoupKitchenRoundedIcon from '@mui/icons-material/SoupKitchenRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import PriceChangeRoundedIcon from '@mui/icons-material/PriceChangeRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  
  const menuItems = [
    { text: "รายการจอง", icon: <BookmarkRoundedIcon />, path: "/booking" },
    { text: "ครัว", icon: <SoupKitchenRoundedIcon />, path: "/kitchen" },
    { text: "ตารางพนักงาน", icon: <AssignmentIndRoundedIcon />, path: "/employeeSchedule" },
    { text: "แม่บ้าน & มินิบาร์", icon: <Groups2RoundedIcon />, path: "/houseKeeperMinibar" },
    { text: "บัญชี & รายงาน", icon: <DashboardRoundedIcon />, path: "/dashboard" },
    { text: "ค่าแรง", icon: <PriceChangeRoundedIcon />, path: "/wage" },
    { text: "รายงานรวม", icon: <ArticleRoundedIcon />, path: "/report" },
  ];

  return (
    <Box>
      {/* Mobile Drawer */}
      <Drawer anchor="left" variant="temporary" className="w-[256px]" open={open} onClose={onClose}>
        <Box>
          <Typography sx={{ ...robotoBold, fontSize:20}} className="p-4">Hotel Logo</Typography>
        </Box>
        <ListMenu menuItems={menuItems} onClose={onClose} title="DAILY OPERATION" />
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer anchor="left" variant="permanent" className="hidden md:block w-[256px]" 
        sx={{
          "& .MuiDrawer-paper": {
            borderRight: "none",
          },
        }}
      >
        <Box className="h-full w-full bg-gray-50">
          <Box>
            <Typography sx={{ ...robotoBold, fontSize:20}} className="p-4">Hotel Logo</Typography>
          </Box>
          <Box className="flex flex-col justify-between h-[calc(100vh-64px)]">
            <ListMenu menuItems={menuItems} onClose={onClose} title="DAILY OPERATION" />
            <UserNav image="/images/person.svg" name="John Doe" role="Admin" />
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}