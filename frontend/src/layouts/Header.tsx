import React from "react";
import { AppBar, Toolbar, Typography, Button } from "@mui/material";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";

interface HeaderProps {
  isHome?: boolean;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({
  isHome = false,
  title = "Player Rush",
}) => {
  return (
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {!isHome && title}
        </Typography>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button color="inherit">Sign In</Button>
          </SignInButton>
        </SignedOut>
      </Toolbar>
    </AppBar>
  );
};
