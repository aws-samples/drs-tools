//Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//SPDX-License-Identifier: Apache-2.0

import React, {useEffect, useState} from 'react'

import empty_plan from "./data/plan"

import PlanWaves from "./PlanWaves";
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';


import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grow from "@mui/material/Grow";
import UserAppBar from "./UserAppBar";

import PlanResults from "./PlanResults";
import Grid from "@mui/material/Grid";

function TabPanel(props) {
    const {children, value, index, ...other} = props;
    if (value === index) {
        return (
            <div
                role="tabpanel"
                hidden={value !== index}
                id={`simple-tabpanel-${index}`}
                aria-labelledby={`simple-tab-${index}`}
                {...other}
            >
                <Box sx={{p: 3}}>
                    {children}
                </Box>
            </div>
        );

    }
}

function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

function Plan({
                  user,
                  signOut,
                  application,
                  setApplication,
                  putApplication,
                  setOpenPlan,
                  currentPlanIndex,
                  currentPlan,
                  setCurrentPlan
              }) {
    const [planName, setPlanName] = useState(empty_plan.PlanName);
    const [description, setDescription] = useState(empty_plan.Description);
    const [owner, setOwner] = useState(empty_plan.Owner);
    const [waves, setWaves] = useState(empty_plan.Waves)
    const [RTO, setRTO] = useState(empty_plan.RTO);
    const [RPO, setRPO] = useState(empty_plan.RPO);
    const [ownerError, setOwnerError] = useState(false);
    const [planNameError, setPlanNameError] = useState(false);
    const [errorDescription, setErrorDescription] = useState("")

    const [nav, setNav] = useState(0);

    useEffect(() => {
        setPlanName(currentPlan.PlanName);
        setDescription(currentPlan.Description);
        setOwner(currentPlan.Owner);
        setRTO(currentPlan.RTO);
        setRPO(currentPlan.RPO);
        setWaves(currentPlan.Waves)

        console.log("current plan is " + JSON.stringify(currentPlan))
        setCurrentPlan(currentPlan)
    }, [JSON.stringify(currentPlan)]);

    function closeDrawer() {
        setOpenPlan(false);
    }

    function validatePlanForm() {
        // validate form...
        let errorMessage = ""
        if (planNameError) {
            errorMessage += "You must enter a plan name<br/>"
        }
        if (ownerError) {
            errorMessage += "You must enter a valid email address for the Owner<br/>"
        }
        setErrorDescription(errorMessage)
    }

    function getCurrentState() {
        let new_plan = JSON.parse(JSON.stringify(currentPlan));
        new_plan.PlanName = planName;
        new_plan.Description = description;
        new_plan.Owner = owner;
        new_plan.RTO = RTO;
        new_plan.RPO = RPO;
        new_plan.Waves = waves;
        return new_plan;
    }

    function handleCreateUpdatePlan() {
        let new_application = JSON.parse(JSON.stringify(application));
        let new_plan = getCurrentState();

        if ("PlanId" in new_plan) {
            new_application.Plans[currentPlanIndex] = new_plan;
        } else {
            new_application.Plans.push(new_plan);
        }

        putApplication(new_application,
            (results) => {
                if ("success" in results) {
                    setApplication(results.data)
                    closeDrawer();
                } else if ("error" in results) {
                    console.log(`error creating / updating application ${new_application.AppName} with plan ${new_plan.PlanName}: ${results.error}`)
                }
            });
    }

    function updateOverview() {
        setCurrentPlan(getCurrentState());
    }

    const validateEmail = (email) => {
        return String(email)
            .toLowerCase()
            .match(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
    };


    return (
        <Grow in={true}>
            <Box sx={{flexGrow: 1}}>
                <UserAppBar signOut={signOut} user={user} title={`Plan: ${currentPlan.PlanName}`}/>
                <Tabs
                    value={nav}
                    onChange={(event, newValue) => {
                        if (nav === 0) {
                            updateOverview();
                        }
                        console.log("nav value is: " + nav)
                        setNav(newValue);
                    }}
                    centered
                    indicatorColor="primary"
                    variant="fullWidth"
                >
                    <Tab label="Overview" {...a11yProps(0)} />
                    <Tab label="Waves" {...a11yProps(1)} />
                    <Tab label="Plan Results" {...a11yProps(2)} />
                </Tabs>
                <TabPanel value={nav} index={0}>
                    <Box sx={{flexGrow: 1, p: 2}}>
                        <Grid container spacing={1}
                        >
                            <Grid item xs={12}>
                                <TextField fullWidth id="plan-planName" margin="normal" label="Plan Name"
                                           helperText="Enter a plan name"
                                           error={planNameError}
                                           value={planName}
                                           onChange={(e) => {
                                               if (e.target.value.length === 0) {
                                                   setPlanNameError(true);
                                               } else {
                                                   setPlanNameError(false);
                                               }
                                               setPlanName(e.target.value);
                                           }}
                                           required/>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField fullWidth id="plan-description" margin="normal" label="Description" rows={4}
                                           multiline
                                           helperText="Describe your plan."
                                           value={description}
                                           onChange={(e) => {
                                               setDescription(e.target.value)
                                           }}/>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField fullWidth id="plan-owner" margin="normal" label="Owner"
                                           error={ownerError}
                                           helperText="Enter Plan Owners email address"
                                           value={owner}
                                           onChange={(e) => {
                                               if (e.target.value.length === 0) {
                                                   setOwnerError(true);
                                               } else if (!validateEmail(e.target.value)) {
                                                   setOwnerError(true);
                                               } else {
                                                   setOwnerError(false);
                                               }
                                               setOwner(e.target.value);
                                           }} required/>
                            </Grid>
                            <Grid item xs={6}>
                                <TextField fullWidth id="plan-rto" margin="normal" label="RTO"
                                           helperText="Enter the Recovery Time Objective in seconds"
                                           value={RTO}
                                           onChange={(e) => {
                                               setRTO(e.target.value);
                                           }} required/>
                            </Grid>
                            <Grid item xs={6}>
                                <TextField fullWidth id="plan-rpo" margin="normal" label="RPO"
                                           helperText="Enter the Recovery Point Objective in seconds"
                                           value={RPO}
                                           onChange={(e) => {
                                               setRPO(e.target.value);
                                           }} required/>
                            </Grid>
                        </Grid>
                    </Box>
                </TabPanel>
                <TabPanel value={nav} index={1}>
                    <PlanWaves waves={waves} setWaves={setWaves}/>
                </TabPanel>
                <TabPanel value={nav} index={2}>
                    <PlanResults appId={application.AppId} planId={currentPlan.PlanId}/>
                </TabPanel>
                <Stack spacing={4} direction="row" justifyContent="center" alignItems="center">
                    {errorDescription.length > 0 &&
                        <Typography variant="h6" align="center" sx={{m: 2}}>{errorDescription}</Typography>}
                    <Button autoFocus onClick={closeDrawer} variant="contained">
                        Cancel
                    </Button>
                    <Button onClick={() => {
                        handleCreateUpdatePlan();
                    }
                    }
                            variant="contained">Save</Button>
                </Stack>
            </Box>
        </Grow>
    )

}

export default Plan;
