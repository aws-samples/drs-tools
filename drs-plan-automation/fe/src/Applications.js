//Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//SPDX-License-Identifier: Apache-2.0

import React, {useEffect, useState} from 'react'
import './App.css';
import UserAppBar from "./UserAppBar";
import {withAuthenticator} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import {API} from 'aws-amplify';
import Link from '@mui/material/Link';
import empty_application from "./data/application"
import ApplicationAlert from "./ApplicationAlert";

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';

import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';

import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import DeleteIcon from '@mui/icons-material/Delete';
import Plans from "./Plans";
import Grow from '@mui/material/Grow';
import Drawer from '@mui/material/Drawer';
import Grid from "@mui/material/Grid";
import Badge from "@mui/material/Badge";
import WavesIcon from "@mui/icons-material/Waves";
import Checkbox from "@mui/material/Checkbox";
import Stack from "@mui/material/Stack";

import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Alert from '@mui/material/Alert';
import Skeleton from "@mui/material/Skeleton";
import awsExports from "./aws-exports";

const apiName = 'drsplangui';
const path = '/applications';
const myInit = { // OPTIONAL
    // response: true
};

const execute_plans_path = '/applications/execute';
API.configure(awsExports);


const DeleteApplication = ({
                               deleteDialogVisible,
                               setDeleteDialogVisible,
                               application,
                               setApplications,
                               setTitle,
                               setChecked
                           }) => {

    function closeDialog() {
        setDeleteDialogVisible(false);
    }

    function handleDeleteApplication() {
        console.log("Create application details are: " + JSON.stringify(application))
        deleteApplication(application,
            (results) => {
                if ("success" in results) {
                    fetchApplications(
                        (fetch_results) => {
                            if ("success" in fetch_results) {
                                setChecked([])
                                setApplications(fetch_results.data);
                                setTitle(fetch_results.data.length + " Applications")
                                closeDialog();
                            } else if ("error" in fetch_results) {
                                console.log("an error occurred retrieving application list: " + fetch_results.error)
                            }
                        }
                    )
                } else if ("error" in results) {
                    console.log("error deleting record: " + results.error)
                }
            })
    }


    return (
        <Dialog
            sx={{'& .MuiDialog-paper': {width: '80%', maxHeight: 435}}}
            maxWidth="xs"
            open={deleteDialogVisible}
            // style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <DialogTitle>Delete Application: {application.AppName}?</DialogTitle>
            <DialogContent dividers>
                <Typography>You are about to delete Application: {application.AppName}. This process can't be
                    undone.
                    Are you sure
                    you want to proceed?</Typography>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button onClick={handleDeleteApplication}>Delete</Button>
            </DialogActions>
        </Dialog>
    )
}

function fetchApplications(cb) {
    try {
        API.get(apiName, path, myInit).then((results) => {
            console.log("get applications response is: " + JSON.stringify(results));
            cb(results);
        })
    } catch (err) {
        console.log('error fetching applications' + err)
    }
}

function deleteApplication(application, cb) {
    try {
        const deleteData = {
            body: {  // OPTIONAL
                AppId: application.AppId
            }
        }
        console.log("application to delete: " + JSON.stringify(application));

        API.del(apiName, path, deleteData).then((results) => {
            console.log("results from delete: " + JSON.stringify(results));
            cb(results);

        });
    } catch (e) {
        console.log('Delete failed: ' + e);
    }
}


function putApplication(application, cb) {
    try {
        const putData = {
            body: {
                application: application
            }
        }
        API.put(apiName, path, putData).then((results) => {
                console.log("results from put: " + JSON.stringify(results));
                cb(results);
            }
        );
    } catch (e) {
        console.log('Create or update failed: ' + e);
    }
}

function executePlans(executeData, cb) {
    try {

        const postData = {
            body: executeData
        }

        API.post(apiName, execute_plans_path, postData).then((results) => {
                console.log("results from execute post: " + JSON.stringify(results));
                cb(results);
            }
        );
    } catch (e) {
        console.log('Create or update failed: ' + e);
    }
}


const CreateApplication = ({createDialogVisible, setCreateDialogVisible, setApplications, setTitle}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [keyName, setKeyName] = useState('');
    const [keyValue, setKeyValue] = useState('');
    const [owner, setOwner] = useState('');
    const [snsTopic, setSnsTopic] = useState('');

    function closeDialog() {
        setCreateDialogVisible(false);
        setName('');
        setDescription('');
        setKeyName('');
        setKeyValue('');
        setOwner('');
        setSnsTopic('');
    }

    function handleCreateApplication() {
        let application = JSON.parse(JSON.stringify(empty_application));
        application.AppName = name;
        application.Description = description;
        application.KeyName = keyName;
        application.KeyValue = keyValue;
        application.Owner = owner;
        application.SnsTopic = snsTopic;

        console.log("Create application details are: " + JSON.stringify(application))

        putApplication(application,
            (results) => {
                if ("success" in results) {
                    fetchApplications(
                        (fetch_results) => {
                            if ("success" in fetch_results) {
                                setApplications(fetch_results.data);
                                closeDialog();
                            } else if ("error" in fetch_results) {
                                console.log("an error occurred retrieving application list: " + fetch_results.error)
                            }
                        }
                    )
                } else if ("error" in results) {
                    console.log("error creating record: " + results.error)
                }
            })
    }


    return (
        <Dialog
            fullWidth
            maxWidth="xl"
            scroll="paper"
            open={createDialogVisible}
            // style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <DialogTitle>Create Application</DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={1}>
                    <Grid item xs={12}>

                        <TextField fullWidth id="application-appName" margin="normal" label="Application Name"
                                   helperText="Application name, must be unique." value={name} onChange={(e) => {
                            setName(e.target.value);
                        }} required/>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth id="application-description" margin="normal" label="Description"
                                   rows={4}
                                   multiline
                                   helperText="Describe your application." value={description} onChange={(e) => {
                            setDescription(e.target.value)
                        }}/>
                    </Grid>
                    <Grid item xs={6}>
                        <TextField fullWidth id="application-keyName" margin="normal" label="Key Name"
                                   helperText="The AWS Tag key name identifying the application. (e.g. Role)"
                                   value={keyName}
                                   onChange={(e) => {
                                       setKeyName(e.target.value)
                                   }} required/>
                    </Grid>
                    <Grid item xs={6}>
                        <TextField fullWidth id="application-keyValue" margin="normal" label="Key Value"
                                   helperText="The AWS tag key value identifying the application. (e.g. DB)"
                                   value={keyValue}
                                   onChange={(e) => {
                                       setKeyValue(e.target.value)
                                   }} required/>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth id="application-owner" margin="normal"
                                   label="Application Owner Email Address"
                                   helperText="The email address for the owner of this application." value={owner}
                                   onChange={(e) => {
                                       setOwner(e.target.value)
                                   }} required/>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth id="application-sns-topic" margin="normal"
                                   label="Application SNS Topic for Notification"
                                   helperText="Enter the SNS topic that should be notified when a drill or recovery is execute.  Leave blank for no notifications." value={snsTopic}
                                   onChange={(e) => {
                                       setSnsTopic(e.target.value)
                                   }} required/>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button onClick={handleCreateApplication}>Create</Button>
            </DialogActions>
        </Dialog>
    )
}

const UpdateApplication = ({
                               updateDialogVisible,
                               setUpdateDialogVisible,
                               application,
                               setApplications
                           }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [keyName, setKeyName] = useState('');
    const [keyValue, setKeyValue] = useState('');
    const [owner, setOwner] = useState('');
    const [snsTopic, setSnsTopic] = useState('');

    function closeDialog() {
        setUpdateDialogVisible(false);
        setName('')
        setDescription('')
        setKeyName('')
        setKeyValue('')
        setOwner('')
        setSnsTopic('')
    }

    function handleUpdateApplication() {
        let application_update = JSON.parse(JSON.stringify(application));
        application_update.AppName = name === '' ? application.AppName : name;
        application_update.Description = description === '' ? application.Description : description;
        application_update.KeyName = keyName === '' ? application.KeyName : keyName;
        application_update.KeyValue = keyValue === '' ? application.KeyValue : keyValue;
        application_update.Owner = owner === '' ? application.Owner : owner;
        application_update.SnsTopic = snsTopic === '' ? application.SnsTopic : snsTopic;

        console.log("Update application details are: " + JSON.stringify(application_update))
        putApplication(application_update,
            (results) => {
                if ("success" in results) {
                    fetchApplications(
                        (fetch_results) => {
                            if ("success" in fetch_results) {
                                console.log(fetch_results.success)
                                setApplications(fetch_results.data);
                                closeDialog();
                            } else if ("error" in fetch_results) {
                                console.log("an error occurred retrieving application list: " + fetch_results.error)
                            }
                        }
                    );
                } else if ("error" in results) {
                    console.log("error updating record: " + results.error)
                }
            }
        )
    }

    return (
        <Dialog
            fullWidth
            maxWidth="xl"
            scroll="paper"
            open={updateDialogVisible}
            // style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <DialogTitle>Update Application {application.AppName}</DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={1}>
                    <Grid item xs={12}>

                        <TextField fullWidth id="application-appName" margin="normal" label="Application Name"
                                   helperText="Application name, must be unique." defaultValue={application.AppName}
                                   onChange={(e) => {
                                       setName(e.target.value);
                                   }} required/>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth id="application-description" margin="normal" label="Description"
                                   rows={4}
                                   multiline
                                   helperText="Describe your application." defaultValue={application.Description}
                                   onChange={(e) => {
                                       setDescription(e.target.value)
                                   }}/>
                    </Grid>
                    <Grid item xs={6}>
                        <TextField fullWidth id="application-keyName" margin="normal" label="Key Name"
                                   helperText="The AWS Tag key name identifying the application. (e.g. Role)"
                                   defaultValue={application.KeyName}
                                   onChange={(e) => {
                                       setKeyName(e.target.value)
                                   }} required/>
                    </Grid>
                    <Grid item xs={6}>
                        <TextField fullWidth id="application-keyValue" margin="normal" label="Key Value"
                                   helperText="The AWS tag key value identifying the application. (e.g. DB)"
                                   defaultValue={application.KeyValue}
                                   onChange={(e) => {
                                       setKeyValue(e.target.value)
                                   }} required/>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth id="application-owner" margin="normal"
                                   label="Application Owner Email Address"
                                   helperText="The email address for the owner of this application."
                                   defaultValue={application.Owner}
                                   onChange={(e) => {
                                       setOwner(e.target.value)
                                   }} required/>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth id="application-sns-topic" margin="normal"
                                   label="Application SNS Topic for Notification"
                                   helperText="Enter the SNS topic that should be notified when a drill or recovery is execute.  Leave blank for no notifications."
                                   defaultValue={application.SnsTopic}
                                   onChange={(e) => {
                                       setSnsTopic(e.target.value)
                                   }} required/>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button onClick={handleUpdateApplication}>Update</Button>
            </DialogActions>
        </Dialog>
    )
}

const ApplicationList = ({
                             setUpdateDialogVisible,
                             setDeleteDialogVisible,
                             setApplications,
                             applications,
                             setApplication,
                             setTitle,
                             checked,
                             setChecked,
                             setOpenPlans
                         }) => {


    const handleOpen = () => setOpenPlans(true);

    const handleToggle = (value) => () => {
        const currentIndex = checked.indexOf(value);
        const newChecked = [...checked];

        if (currentIndex === -1) {
            newChecked.push(value);
        } else {
            newChecked.splice(currentIndex, 1);
        }

        setChecked(newChecked);
    };


    return (
        <Box sx={{flexGrow: 1}}>
            <List dense sx={{width: '100%', bgcolor: 'background.paper'}}>
                {
                    applications.map((application_item, idx) => {
                        const labelId = `checkbox-list-secondary-label-${application_item.AppName}`;
                        return (
                            <ListItem key={application_item.AppId}
                                      secondaryAction={
                                          <IconButton edge="end" aria-label="delete" onClick={() => {
                                              setApplication(application_item)
                                              setDeleteDialogVisible(true);
                                          }}>
                                              <DeleteIcon/>
                                          </IconButton>
                                      }
                            >
                                <Checkbox
                                    edge="start"
                                    onChange={handleToggle(idx)}
                                    checked={checked.indexOf(idx) !== -1}
                                    inputProps={{'aria-labelledby': labelId}}
                                />

                                <IconButton edge="start" aria-label="edit" onClick={() => {
                                    setApplication(application_item)
                                    setUpdateDialogVisible(true)
                                }}>
                                    <EditIcon/>
                                </IconButton>

                                <ListItemButton role={undefined} edge="start"
                                                onClick={() => {
                                                    setApplication(application_item);
                                                    handleOpen();
                                                }}
                                                dense>
                                    <ListItemText
                                        primary={application_item.AppName}
                                        secondary={`Description: ${application_item.Description}  Owner: ${application_item.Owner}`}
                                        edge="start"
                                    />
                                    <Badge badgeContent={application_item.Plans.length} color="primary">
                                        <FormatListNumberedIcon/>
                                    </Badge>
                                </ListItemButton>

                            </ListItem>

                        )
                    })}
            </List>
        </Box>
    );
};


const ExecutePlans = ({
                          executeDialogVisible,
                          setExecuteDialogVisible,
                          checked,
                          applications,
                          isDrill,
                          setAlertMessage,
                          setShowAlert,
                          setAlertType,
                          user
                      }) => {
    const [selectedPlans, setSelectedPlans] = React.useState({});
    const [topicARN, setTopicARN] = React.useState('');


    function closeDialog() {
        setSelectedPlans({})
        setExecuteDialogVisible(false);
    }

    function executeSelectedPlans() {
        let application_list = [];
        console.log(JSON.stringify("selected plans are: " + JSON.stringify(selectedPlans)))
        console.log(JSON.stringify("user is: " + JSON.stringify(user)))

        checked.map((checked_application) => {
                console.log(`adding application ${applications[checked_application].AppName} with plan ${applications[checked_application].Plans[selectedPlans[checked_application]].PlanName}`);
                application_list.push({
                        'application': applications[checked_application],
                        'plan': selectedPlans[checked_application]
                    }
                )

            }
        )

        let executeData = {
            'IsDrill': isDrill,
            'TopicARN': topicARN,
            'Applications': application_list,
            'user': user.attributes.email
        }


        executePlans(executeData, (results) => {
                console.log("results from execute call: " + JSON.stringify(results))

                if ("success" in results && "data" in results) {
                    let executionType = isDrill ? "Test Drill" : "Failover"
                    let message = "Plan execution for " + executionType + " started with execution ARN: " + results.data.executionArn
                    setAlertType("success")
                    setAlertMessage(message)
                    setShowAlert(true)
                } else if ("error" in results) {
                    let executionType = isDrill ? "Test Drill" : "Failover"
                    let message = "Plan execution for " + executionType + " failed: " + results.error
                    setAlertType("error")
                    setAlertMessage(message)
                    setShowAlert(true)

                }
                closeDialog();
            }
        );


        console.log("execution data is: " + JSON.stringify(executeData));
    }


    return (
        <Dialog
            fullWidth
            maxWidth="xl"
            scroll="paper"
            open={executeDialogVisible}
            // style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <DialogTitle>Execute {isDrill ? "Test Drill" : "Failover"} for {checked.length} Selected
                Applications</DialogTitle>
            <DialogContent dividers>

                <Box sx={{flexGrow: 1}}>
                    <List dense sx={{width: '100%', bgcolor: 'background.paper'}}>
                        {
                            checked.map((checked_application) => {
                                const labelId = `label-${applications[checked_application].AppName}`;
                                return (
                                    <ListItem key={`${applications[checked_application].AppName}-execute-plans`}>
                                        <Grid container direction="row" alignItems="center">
                                            <Grid item xs={6}>

                                                <ListItemText
                                                    primary={applications[checked_application].AppName}
                                                    secondary={`Description: ${applications[checked_application].Description}  Owner: ${applications[checked_application].Owner}`}
                                                    edge="start"
                                                />
                                            </Grid>
                                            <Grid item xs={6}>
                                                <FormControl fullWidth>
                                                    <InputLabel id={labelId + "-input"}>Select Plan:</InputLabel>
                                                    <Select
                                                        labelId={labelId + "-select-label"}
                                                        id={labelId + "-select"}
                                                        defaultValue='-1'
                                                        label="Execute Plan"
                                                        onChange={(e) => {
                                                            console.log("changed plan value is: " + e.target.value)
                                                            let selected_plans = JSON.parse(JSON.stringify(selectedPlans));
                                                            selected_plans[checked_application] = e.target.value;
                                                            setSelectedPlans(selected_plans);
                                                        }}
                                                    >
                                                        <MenuItem key={`${labelId}-menu-item`} disabled value="-1">
                                                            <em>Select a plan</em>
                                                        </MenuItem>
                                                        {
                                                            applications[checked_application].Plans.length === 0 ?
                                                                <MenuItem
                                                                    key={`${labelId}-menu-item`}
                                                                    value="0" disabled>No plans - create one first
                                                                    one </MenuItem> :
                                                                applications[checked_application].Plans.map((plan, idx) => {
                                                                    console.log("Plan is: " + JSON.stringify(plan.PlanName) + "\n and index is: " + idx);
                                                                    return (
                                                                        plan.Waves.length === 0 ? <MenuItem
                                                                                key={`${labelId}-${plan.PlanName}-menu-item`}
                                                                                value={idx} disabled>Plan "{plan.PlanName}"
                                                                                has
                                                                                no waves - create one first</MenuItem> :
                                                                            <MenuItem
                                                                                key={`${labelId}-${plan.PlanName}-menu-item`}
                                                                                value={idx}>{plan.PlanName}</MenuItem>
                                                                    )
                                                                })};

                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                        </Grid>
                                    </ListItem>
                                )
                            })
                        }
                    </List>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button onClick={executeSelectedPlans}
                        disabled={Object.keys(selectedPlans).length <= 0}>Execute</Button>
            </DialogActions>
        </Dialog>
    );
};


function Applications(
    {
        user, signOut
    }
) {
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [createDialogVisible, setCreateDialogVisible] = useState(false);
    const [executeDialogVisible, setExecuteDialogVisible] = useState(false);
    const [updateDialogVisible, setUpdateDialogVisible] = useState(false);
    const [application, setApplication] = useState({});
    const [applications, setApplications] = useState(null);
    const [openPlans, setOpenPlans] = useState(false)
    const [isDrill, setIsDrill] = useState(false)
    const [title, setTitle] = useState("DRS Accelerator")
    const [checked, setChecked] = useState([]);
    const [showAlert, setShowAlert] = useState(false);
    const [alertType, setAlertType] = useState("success");
    const [alertMessage, setAlertMessage] = useState('');

    const handleClose = () => setOpenPlans(false);

    useEffect(() => {
        try {
            fetchApplications(
                (fetch_results) => {
                    if ("success" in fetch_results) {
                        setApplications(fetch_results.data)
                        setTitle(fetch_results.data.length + " Applications")
                    } else if ("error" in fetch_results) {
                        console.log("an error occurred retrieving application list: " + fetch_results.error)
                    }
                }
            )
        } catch (err) {
            console.log('error fetching applications' + err)
        }
    }, [JSON.stringify(applications), JSON.stringify(application)]);


    return (
        <Box sx={{flexGrow: 1}}>
            <UserAppBar signOut={signOut} user={user} title={title}/>
            {showAlert &&
                <ApplicationAlert
                    setShowAlert={setShowAlert}
                    alertType={alertType}
                    alertMessage={alertMessage}
                />
            }
            <Grow in={true}>
                <Box sx={{flexGrow: 1}}>
                    <Box sx={{flexGrow: 1}}>
                        {
                            applications == null && <Skeleton animation="wave"/>
                        }
                        {
                            applications != null && (applications.length === 0 ?
                                <Typography variant="h5" align="center" sx={{m: 2}}>There are no applications defined,
                                    create one.</Typography> :
                                <ApplicationList
                                    setUpdateDialogVisible={setUpdateDialogVisible}
                                    setDeleteDialogVisible={setDeleteDialogVisible}
                                    setApplication={setApplication}
                                    setApplications={setApplications}
                                    applications={applications}
                                    setTitle={setTitle}
                                    setOpenPlans={setOpenPlans}
                                    checked={checked}
                                    setChecked={setChecked}

                                />)
                        }

                        <DeleteApplication deleteDialogVisible={deleteDialogVisible}
                                           setDeleteDialogVisible={setDeleteDialogVisible}
                                           application={application}
                                           setApplications={setApplications}
                                           setTitle={setTitle}
                                           setChecked={setChecked}
                        />
                        <UpdateApplication updateDialogVisible={updateDialogVisible}
                                           setUpdateDialogVisible={setUpdateDialogVisible}
                                           application={application}
                                           setApplications={setApplications}
                        />

                        <CreateApplication createDialogVisible={createDialogVisible}
                                           setCreateDialogVisible={setCreateDialogVisible}
                                           setApplications={setApplications}
                                           setTitle={setTitle}
                        />
                        <ExecutePlans executeDialogVisible={executeDialogVisible}
                                      setExecuteDialogVisible={setExecuteDialogVisible}
                                      checked={checked}
                                      setTitle={setTitle}
                                      applications={applications}
                                      isDrill={isDrill}
                                      setAlertMessage={setAlertMessage}
                                      setShowAlert={setShowAlert}
                                      setAlertType={setAlertType}
                                      user={user}
                        />

                    </Box>
                    <Stack spacing={4} direction="row" justifyContent="center"
                           alignItems="center">

                        <Button variant="contained" onClick={() => {
                            setCreateDialogVisible(true);
                        }}>Create New Application</Button>
                        <Button variant="contained" onClick={() => {
                            console.log("execute plans clicked.")
                            console.log("checked are: " + JSON.stringify(checked))
                            setIsDrill(true);
                            setExecuteDialogVisible(true);
                        }}>
                            {checked.length > 0 ? "Execute " + checked.length + " Drills" : "Select Applications For Drill"}
                        </Button>
                        <Button variant="contained" onClick={() => {
                            console.log("execute plans clicked.")
                            console.log("checked are: " + JSON.stringify(checked))
                            setIsDrill(false);
                            setExecuteDialogVisible(true);
                        }}>
                            {checked.length > 0 ? "Execute " + checked.length + " Failovers" : "Select Applications For Failover"}
                        </Button>

                    </Stack>
                    <Drawer anchor="right" open={openPlans} onClose={handleClose}
                            PaperProps={{
                                sx: {width: "90%"},
                            }}>
                        <Plans
                            application={application}
                            setApplication={setApplication}
                            setOpenPlans={setOpenPlans}
                            putApplication={putApplication}
                            signOut={signOut}
                            user={user}
                        />
                    </Drawer>

                </Box>
            </Grow>
        </Box>
    );
}

export default Applications;
