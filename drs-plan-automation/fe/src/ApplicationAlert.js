import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import React from "react";


const ApplicationAlert = (
    {
        setShowAlert, alertMessage, alertType
    }
) => {
    return (
        <Box sx={{flexGrow: 1}}>
            <Alert severity={alertType} onClose={() => {
                setShowAlert(false)
            }}>{alertMessage}</Alert>
        </Box>
    )
};

export default ApplicationAlert;
