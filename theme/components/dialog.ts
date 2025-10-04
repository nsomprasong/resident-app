import { Components, Theme } from "@mui/material/styles";

const dialogTheme: Components<Theme>['MuiDialog'] = {
    styleOverrides: {
        paper: {
            borderRadius: 16,
        }
    }
}

export default dialogTheme;