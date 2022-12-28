import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import React, {useEffect} from "react";


const UserAppBar = ({
                        signOut,
                        user,
                        setOpenAccounts,
                        title
                    }) => {

    return (
        <Box sx={{flexGrow: 1}}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{flexGrow: 1}}>
                        {title}
                    </Typography>
                    <Button color="inherit" onClick={() => setOpenAccounts(true)}>Accounts</Button>
                    <Button color="inherit" onClick={signOut}>SignOut {user.attributes.email}</Button>
                </Toolbar>
            </AppBar>
        </Box>
    );
}

export default UserAppBar;