import { Components, Theme } from "@mui/material/styles";

const typographyTheme: Components<Theme>['MuiTypography'] = {
    styleOverrides: {
        root: {
            fontFamily: 'KanitCustom, Arial, sans-serif',
            fontSize: '16px',
            fontWeight: 300,
        }
    }
}

export default typographyTheme;