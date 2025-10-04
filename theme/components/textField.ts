import { Components, Theme } from "@mui/material/styles";

const textFieldTheme: Components<Theme>['MuiTextField'] = {
    styleOverrides: {
        root: {
            '& .MuiOutlinedInput-root': {
                fontFamily: 'KanitCustom, Arial, sans-serif',
                fontSize: 16,
                fontWeight: 300,
                '& fieldset': {
                    borderColor: '#D1D5DB',
                    borderRadius: 4,
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                },
                '& :hover fieldset': {
                    borderColor: '#93c5fd',
                    boxShadow: '0 10px 15px -3px rgba(0 0 0 / 0.1), 0 4px 6px -4px rgba(0 0 0 / 0.1)'
                },
                '& .Mui-focused fieldset': {
                    borderColor: '#93c5fd'
                },
                '& .MuiInputBase-input': {
                    padding: '8px 16px',
                    fontSize: 16,
                    background: 'white',
                    borderRadius: 12,
                },
                '& .MuiInputBase-multiline': {
                    padding: 0,
                    fontSize: 16,
                    background: 'white'
                }
            }
        }
    }
}

export default textFieldTheme;