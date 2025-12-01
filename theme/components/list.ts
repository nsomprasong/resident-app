import { colorTheme } from "@/lib/constants/color";
import { Components, Theme } from "@mui/material/styles";

const listItemButtonTheme: Components<Theme>['MuiListItemButton'] = {
    styleOverrides: {
        root: {
            paddingLeft: 0,
            borderRadius: 8,
            "&.Mui-selected": {
                backgroundColor: colorTheme.fourth,
                color: colorTheme.primary,
                "& .MuiListItemIcon-root": {
                color: colorTheme.primary,
                },
                "&:hover": {
                backgroundColor: colorTheme.background
                },
            },
        }
    }
}

export default listItemButtonTheme;