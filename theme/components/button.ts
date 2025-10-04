import { Components, Theme } from "@mui/material/styles";

const buttonTheme: Components<Theme>['MuiButton'] = {
    styleOverrides: {
        root: {
            borderRadius: 20,
            fontFamily: 'KanitCustom, Arial, sans-serif',
            fontSize: '18px',
            fontWeight: 500,
        }
    }
}

export default buttonTheme;