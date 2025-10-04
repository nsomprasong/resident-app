import { colorTheme } from "@/lib/constants/color";
import { Components, Theme } from "@mui/material/styles";

const listItemButtonTheme: Components<Theme>['MuiListItemButton'] = {
    styleOverrides: {
        root: {
            paddingLeft: 0,
            borderRadius: 8,
            "&.Mui-selected": {
                backgroundColor: colorTheme.green[100],
                color: colorTheme.green[300],
                "& .MuiListItemIcon-root": {
                color: colorTheme.green[300],
                },
                "&:hover": {
                backgroundColor: colorTheme.green[200]
                },
            },
        }
    }
}

export default listItemButtonTheme;