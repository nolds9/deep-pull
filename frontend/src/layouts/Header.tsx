import React from "react";
import { AppBar, Toolbar, Typography } from "@mui/material";
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
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{
        backgroundColor: "rgba(0,0,0,0.1)",
        backdropFilter: "blur(10px)",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            color: "white",
            fontWeight: 600,
          }}
        >
          {!isHome && title}
        </Typography>
        <SignedIn>
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: "40px",
                  height: "40px",
                },
              },
            }}
          />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button
              style={{
                color: "white",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                padding: "8px 24px",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              }}
            >
              Sign In
            </button>
          </SignInButton>
        </SignedOut>
      </Toolbar>
    </AppBar>
  );
};
