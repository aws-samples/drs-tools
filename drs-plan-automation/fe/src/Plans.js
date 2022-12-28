//Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//SPDX-License-Identifier: Apache-2.0

import React, {useEffect, useState} from 'react'
import './App.css';
import UserAppBar from "./UserAppBar";

import '@aws-amplify/ui-react/styles.css';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';


import DeleteIcon from '@mui/icons-material/Delete';
import ListItemButton from "@mui/material/ListItemButton";
import Plan from "./Plan";
import Grow from '@mui/material/Grow';
import Drawer from "@mui/material/Drawer";
import WavesIcon from '@mui/icons-material/Waves';
import Badge from '@mui/material/Badge';

import empty_plan from "./data/plan.js"
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";


const DeletePlan = ({
                        deleteDialogVisible,
                        setDeleteDialogVisible,
                        application,
                        putApplication,
                        setApplication,
                        setCurrentPlanIndex,
                        currentPlanIndex,
    setApplications,
    fetchApplications
                    }) => {

    function closeDialog() {
        setDeleteDialogVisible(false);
    }

    async function handleDeletePlan() {
        let copy_application = JSON.parse(JSON.stringify(application));
        let delete_plan = copy_application.Plans.splice(currentPlanIndex, 1)[0]
        console.log("Delete plan is: " + JSON.stringify(delete_plan))
        putApplication(copy_application,
            (results) => {
                if ("success" in results) {
                    console.log(results.success)
                    setCurrentPlanIndex(currentPlanIndex > 0 ? (currentPlanIndex - 1) : 0)
                    setApplication(results.data);
                    fetchApplications(
                        (fetch_results) => {
                            if ("success" in fetch_results) {
                                setApplications(fetch_results.data);
                            } else if ("error" in fetch_results) {
                                console.log("an error occurred retrieving application list: " + fetch_results.error)
                            }
                        }
                    )
                    closeDialog();

                } else if ("error" in results) {
                    console.log("an error occurred adding application: " + results.error)
                }
            }
        );

    }


    return (
        <Dialog
            sx={{'& .MuiDialog-paper': {width: '80%', maxHeight: 435}}}
            maxWidth="xs"
            open={deleteDialogVisible}
            // style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <DialogTitle>Delete Plan: {application.Plans[currentPlanIndex].PlanName}?</DialogTitle>
            <DialogContent dividers>
                <Typography>You are about to delete the Plan: <b>{application.Plans[currentPlanIndex].PlanName}</b>.
                    This process
                    can't be undone.
                    Are you sure
                    you want to proceed?</Typography>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button onClick={handleDeletePlan}>Delete</Button>
            </DialogActions>
        </Dialog>
    )
}


// async function fetchApplication(appName) {
//     try {
//         let plan_path = path + appName;
//         console.log("path is: " + plan_path)
//         API.get(apiName, plan_path, myInit).then(new_plans => {
//             console.log("ddb api response is: " + JSON.stringify(new_plans));
//             setPlans(new_plans)
//             if (setTitle) {
//                 setTitle(new_plans.length + " Plans")
//             }
//         })
//     } catch (err) {
//         console.log('error fetching plans' + err)
//     }
// }


const PlanList = ({
                      setDeleteDialogVisible,
                      application,
                      setApplication,
                      setCurrentPlanIndex,
                      setOpenPlan,
                      setCurrentPlan,
                      putApplication,
    fetchApplications,
    setApplications
                  }) => {

    const handleOpen = () => setOpenPlan(true);

    // useEffect(() => {
    //     try {
    //         let app_path = path + appName;
    //         console.log("Rerender of PlanList with plans: " + JSON.stringify(application.Plans))
    //         // API.get(apiName, app_path, myInit).then(application => {
    //         //     console.log("ddb api response is: " + JSON.stringify(application));
    //         //     setPlans(application.Plans)
    //         //     setTitle(appName + ": " + new_plans.length + " Plans")
    //         // })
    //         setPlans(application.Plans)
    //         setTitle(appName + ": " + application.Plans.length + " Plans")
    //     } catch (err) {
    //         console.log('error fetching plans' + err)
    //     }
    // }, [JSON.stringify(application.Plans)]);

    async function copyPlan(idx) {
        console.log("Copy plan clicked..")
        let copy_application = JSON.parse(JSON.stringify(application));
        let copy_plan = JSON.parse(JSON.stringify(application.Plans[idx]));
        copy_plan.PlanName = "Copy of " + copy_plan.PlanName;
        delete copy_plan['PlanId']
        copy_application.Plans.splice(idx + 1, 0, copy_plan);
        console.log("copy application is: " + JSON.stringify(copy_application))

        putApplication(copy_application,
            (results) => {
                if ("success" in results) {
                    console.log(results.success)
                    setApplication(results.data);
                    fetchApplications(
                        (fetch_results) => {
                            if ("success" in fetch_results) {
                                setApplications(fetch_results.data);
                            } else if ("error" in fetch_results) {
                                console.log("an error occurred retrieving application list: " + fetch_results.error)
                            }
                        }
                    )
                } else if ("error" in results) {
                    console.log("an error occurred adding application: " + results.error)
                }
            }
        );
        // navigate(`/applications/${appName}/${copy_plan.PlanName}`);
    }


    return (
        <Box sx={{flexGrow: 1}}>
            <List dense sx={{width: '100%', bgcolor: 'background.paper'}}>
                {
                    application.Plans.map((plan_item, idx) => {
                        return (
                            <ListItem key={plan_item.PlanId}
                            >
                                <Grid container direction="row" align="center">
                                    <Grid item xs={10}>
                                        <ListItemButton role={undefined}
                                                        onClick={
                                                            () => {
                                                                setCurrentPlanIndex(idx);
                                                                setCurrentPlan(application.Plans[idx]);
                                                                handleOpen();
                                                            }
                                                        }
                                                        dense>
                                            <ListItemText
                                                primary={`Plan Name:  ${plan_item.PlanName}`}
                                                secondary={`Description: ${plan_item.Description}`}
                                            />

                                            <Badge badgeContent={`${plan_item.Waves.length}`} color="primary">
                                                <WavesIcon/>
                                            </Badge>
                                        </ListItemButton>
                                    </Grid>
                                    <Grid item xs={1} align="center">
                                        <IconButton aria-label="copy"
                                                    onClick={() => {
                                                        copyPlan(idx);
                                                    }}
                                        >
                                            <ContentCopyIcon/>
                                        </IconButton>
                                    </Grid>
                                    <Grid item xs={1} align="center">
                                        <IconButton aria-label="delete"
                                                    onClick={() => {
                                                        setCurrentPlanIndex(idx)
                                                        setDeleteDialogVisible(true);
                                                    }}
                                        >
                                            <DeleteIcon/>
                                        </IconButton>
                                    </Grid>
                                </Grid>
                            </ListItem>
                        )
                    })}
            </List>
        </Box>
    );
};


function Plans({
                   application,
                   putApplication,
                   setApplication,
    fetchApplications,
    setApplications
               }) {
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
    const [title, setTitle] = useState("")
    const [openPlan, setOpenPlan] = useState(false)
    // const [isNewPlan, setIsNewPlan] = useState(false)
    const [currentPlan, setCurrentPlan] = useState({});

    const handleClose = () => {
        setOpenPlan(false);
    }
    const handleOpen = () => setOpenPlan(true);

    return (
        <Grow in={true}>
            <Box sx={{flexGrow: 1}}>
                <Box sx={{flexGrow: 1}}>
                    <AppBar position="static">
                        <Toolbar>
                            <Typography variant="h6" component="div" sx={{flexGrow: 1}}>
                                {`Application: ${application.AppName} - ${application.Plans.length} Plans`}
                            </Typography>
                        </Toolbar>
                    </AppBar>
                </Box>
                <Box sx={{flexGrow: 1}}>
                    {
                        application.Plans.length === 0 ?
                            <Typography variant="h5" align="center" sx={{m: 2}}>No plans exist, please create
                                one.</Typography> :
                            <PlanList
                                setDeleteDialogVisible={setDeleteDialogVisible}
                                setCurrentPlanIndex={setCurrentPlanIndex}
                                application={application}
                                setApplication={setApplication}
                                setTitle={setTitle}
                                setOpenPlan={setOpenPlan}
                                putApplication={putApplication}
                                setCurrentPlan={setCurrentPlan}
                                fetchApplications={fetchApplications}
                                setApplications={setApplications}
                            />
                    }

                    {
                        application.Plans.length !== 0 &&
                        <DeletePlan deleteDialogVisible={deleteDialogVisible}
                                    setDeleteDialogVisible={setDeleteDialogVisible}
                                    application={application}
                                    setCurrentPlanIndex={setCurrentPlanIndex}
                                    currentPlanIndex={currentPlanIndex}
                                    setTitle={setTitle}
                                    putApplication={putApplication}
                                    setApplication={setApplication}
                                    fetchApplications={fetchApplications}
                                    setApplications={setApplications}
                        />
                    }
                </Box>
                <Stack spacing={4} direction="row" justifyContent="center" alignItems="center">
                    <Button variant="contained"
                            onClick={() => {
                                let new_plan = JSON.parse(JSON.stringify(empty_plan))
                                setCurrentPlan(new_plan)
                                handleOpen();
                            }}
                    >
                        Create Plan
                    </Button>
                </Stack>
                <Drawer anchor="right" open={openPlan} onClose={handleClose} PaperProps={{
                    sx: {width: "80%"},
                }}>
                    <Plan application={application}
                          setApplication={setApplication}
                          putApplication={putApplication}
                          currentPlanIndex={currentPlanIndex}
                          setOpenPlan={setOpenPlan}
                          currentPlan={currentPlan}
                          setCurrentPlan={setCurrentPlan}
                          fetchApplications={fetchApplications}
                          setApplications={setApplications}
                    />
                </Drawer>
            </Box>
        </Grow>
    );
}

export default Plans;
