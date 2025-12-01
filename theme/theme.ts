"use client";

import { createTheme } from "@mui/material/styles";
import typographyTheme from "./components/typography";
import listItemButtonTheme from "./components/list";
import buttonTheme from "./components/button";
import dialogTheme from "./components/dialog";
import textFieldTheme from "./components/textField";
import {tabTheme, tabsTheme} from "./components/tab";

const theme = createTheme({
  palette: {
    primary: {
      main: "#6366F1", 
      light: "#818CF8",              
      dark: "#4F46E5",        
      contrastText: "#FFFFFF" 
    },
    success: {
      main: "#22c55e",   // emerald green
      light: "#4ade80",
      dark: "#15803d",
      contrastText: "#fff",
    },
  },
  components: {
    MuiTypography: typographyTheme,
    MuiListItemButton: listItemButtonTheme,
    MuiButton: buttonTheme,
    MuiDialog: dialogTheme,
    MuiTextField: textFieldTheme,
    MuiTab: tabTheme,
    MuiTabs: tabsTheme
  }
});

export default theme;
