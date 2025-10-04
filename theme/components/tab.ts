import { colorTheme } from "@/lib/constants/color";
import { Components, Theme } from "@mui/material/styles";

const tabTheme: Components<Theme>['MuiTab'] = {
    styleOverrides: {
        root: {
            fontFamily: 'KanitCustom, Arial, sans-serif',
            fontSize: '15px',
            fontWeight: 300,
            textTransform: 'none',
            minHeight: 'auto',
            padding: '6px 16px',
            marginRight: 8,
            borderRadius: 20,
            transition: 'background-color 0.3s',
            backgroundColor: colorTheme.gray[150], 
            color: colorTheme.gray[300],   
            '&:last-child': {
                marginRight: 0,
            },
            '&:hover': {
                backgroundColor: '#f5f5f5', 
            },
            '&.Mui-selected': {
                backgroundColor: colorTheme.green[400], 
                color: '#fff',
            },
        }
    }
}

const tabsTheme: Components<Theme>['MuiTabs'] = {
    styleOverrides: {
        root: {
            minHeight: 'auto',
        },
        indicator: {
            display: 'none',
        },
    }
}

export  { tabTheme, tabsTheme }