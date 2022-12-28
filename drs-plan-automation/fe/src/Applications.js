//Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//SPDX-License-Identifier: Apache-2.0


import {Controller, useForm, ErrorMessage} from "react-hook-form";

import React, {useEffect, useState} from 'react'
import './App.css';
import UserAppBar from "./UserAppBar";
import '@aws-amplify/ui-react/styles.css';
import {API} from 'aws-amplify';
import empty_application from "./data/application"
import ApplicationAlert from "./ApplicationAlert";

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
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';

import ListItemButton from '@mui/material/ListItemButton';

import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import DeleteIcon from '@mui/icons-material/Delete';
import Plans from "./Plans";
import Grow from '@mui/material/Grow';
import Drawer from '@mui/material/Drawer';
import Grid from "@mui/material/Grid";
import Badge from "@mui/material/Badge";
import Checkbox from "@mui/material/Checkbox";
import Stack from "@mui/material/Stack";

import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Skeleton from "@mui/material/Skeleton";
import awsExports from "./aws-exports";
import Accounts from "./Accounts";
import {FormHelperText} from "@mui/material";


const apiName = 'drsplangui';
const applications_path = '/applications';
const accounts_path = '/accounts';
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
                               setChecked,
                               setApplicationEditIndex
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
                                setChecked([]);
                                setApplicationEditIndex(0);
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

function fetchAccounts(cb) {
    try {
        API.get(apiName, accounts_path, myInit).then((results) => {
            console.log("get accounts response is: " + JSON.stringify(results));
            cb(results);
        })
    } catch (err) {
        console.log('error fetching accounts: ' + err)
    }
}


function fetchApplications(cb) {
    try {
        API.get(apiName, applications_path, myInit).then((results) => {
            console.log("get applications response is: " + JSON.stringify(results));
            cb(results);
        })
    } catch (err) {
        console.log('error fetching applications: ' + err)
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

        API.del(apiName, applications_path, deleteData).then((results) => {
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
        API.put(apiName, applications_path, putData).then((results) => {
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


const CreateUpdateApplication = ({
                                     createUpdateDialogVisible,
                                     setCreateUpdateDialogVisible,
                                     setApplications,
                                     applications,
                                     applicationEditIndex,
                                     accounts,
                                     setTitle,
                                     isUpdate,
                                     setCreateUpdateApplicationsFlag
                                 }) => {
    const {register, handleSubmit, watch, reset, control, formState: {errors}} = useForm(
        {
            defaultValues: {
                applicationName: '',
                applicationDescription: '',
                keyName: '',
                keyValue: '',
                applicationOwner: '',
                snsTopic: '',
                accountId: '-1'
            }
        }
    );

    useEffect(() => {
        console.log("CreateUpdate useEffect, isUpdate is: " + isUpdate)
        if (isUpdate) {
            let application = applications[applicationEditIndex];
            let accountIndex = accounts.findIndex((account) => account.AccountId === application.AccountId)

            reset({
                applicationName: application.AppName,
                applicationDescription: application.Description,
                keyName: application.KeyName,
                keyValue: application.KeyValue,
                applicationOwner: application.Owner,
                snsTopic: application.SnsTopic,
                accountIndex: accountIndex
            });
        } else {
            reset({
                applicationName: '',
                applicationDescription: '',
                keyName: '',
                keyValue: '',
                applicationOwner: '',
                snsTopic: '',
                accountIndex: '-1'
            });
        }

    }, [isUpdate, JSON.stringify(applications[applicationEditIndex])]);


    const isValidEmail = email =>
        // eslint-disable-next-line no-useless-escape
        /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
            email
        );


    function closeDialog() {
        reset();
        setCreateUpdateDialogVisible(false);
    }

    function handleCreateUpdateApplication(formData) {
        console.log("formData: " + JSON.stringify(formData))
        console.log("errors: " + JSON.stringify(errors))

        let new_application = {};
        if (isUpdate) {
            new_application = JSON.parse(JSON.stringify(applications[applicationEditIndex]));
        } else {
            new_application = JSON.parse(JSON.stringify(empty_application));
        }
        new_application.AppName = formData.applicationName;
        new_application.Description = formData.applicationDescription;
        new_application.KeyName = formData.keyName;
        new_application.KeyValue = formData.keyValue;
        new_application.Owner = formData.applicationOwner;
        new_application.SnsTopic = formData.snsTopic;
        new_application.AccountId = accounts[formData.accountIndex].AccountId;
        new_application.Region = accounts[formData.accountIndex].Region;
        console.log("Create application details are: " + JSON.stringify(new_application))
        putApplication(new_application,
            (results) => {
                if ("success" in results) {
                    fetchApplications(
                        (fetch_results) => {
                            if ("success" in fetch_results) {
                                setApplications(fetch_results.data);
                                setTitle(fetch_results.data.length + " Applications")
                                closeDialog();
                            } else if ("error" in fetch_results) {
                                console.log("an error occurred retrieving application list: " + fetch_results.error)
                            }
                        }
                    )
                    closeDialog();
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
            open={createUpdateDialogVisible}
            // style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <DialogTitle>{isUpdate ? "Update" : "Create"} Application</DialogTitle>
            <DialogContent dividers>
                <form>
                    <Grid container spacing={1}>
                        <Grid item xs={12}>
                            <Controller
                                name={"applicationName"}
                                control={control}
                                rules={{required: true}}
                                render={({field}) => (
                                    <TextField fullWidth
                                               error={"applicationName" in errors}
                                               id="application-appName"
                                               margin="normal"
                                               label="Application Name"
                                               helperText={("applicationName" in errors) ? "Application name is required" : "Enter a name for your application"}
                                               {...field}
                                               required
                                    />
                                )}
                            />

                        </Grid>
                        <Grid item xs={12}>
                            <Controller
                                name={"applicationDescription"}
                                control={control}
                                render={({field: {onChange, value}}) => (
                                    <TextField fullWidth
                                               id="application-description"
                                               margin="normal"
                                               label="Description"
                                               rows={4}
                                               multiline
                                               helperText="Describe your application."
                                               onChange={onChange}
                                               value={value}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <Controller
                                name={"keyName"}
                                control={control}
                                rules={{required: true}}
                                render={({field: {onChange, value}}) => (
                                    <TextField
                                        error={"keyName" in errors}
                                        fullWidth
                                        id="application-keyName"
                                        margin="normal"
                                        label="Key Name"
                                        helperText={("keyName" in errors) ? "Key Name is required" : "The AWS Tag key name identifying the application. (e.g. Role)"}
                                        onChange={onChange}
                                        value={value}
                                        required
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <Controller
                                name={"keyValue"}
                                control={control}
                                rules={{required: true}}
                                render={({field: {onChange, value}}) => (
                                    <TextField
                                        error={"keyValue" in errors}
                                        fullWidth
                                        id="application-keyValue"
                                        margin="normal"
                                        label="Key Value"
                                        helperText={("keyValue" in errors) ? "Key Value is required" : "The AWS tag key value identifying the application. (e.g. DB)"}
                                        onChange={onChange}
                                        value={value}
                                        required
                                    />
                                )}
                            />

                        </Grid>
                        <Grid item xs={12}>
                            <Controller
                                name={"applicationOwner"}
                                control={control}
                                rules={{required: true, validate: isValidEmail}}
                                render={({field: {onChange, value}}) => (
                                    <TextField
                                        error={"applicationOwner" in errors}
                                        fullWidth
                                        id="application-owner"
                                        margin="normal"
                                        label="Application Owner Email Address"
                                        helperText={("applicationOwner" in errors) ? "A valid email is required" : "The email address for the owner of this application."}
                                        onChange={onChange}
                                        value={value}
                                        required
                                    />

                                )}
                            />

                        </Grid>
                        <Grid item xs={12}>
                            <Controller
                                name={"snsTopic"}
                                control={control}
                                render={({field: {onChange, value}}) => (
                                    <TextField
                                        fullWidth
                                        id="application-sns-topic"
                                        margin="normal"
                                        label="Application SNS Topic for Notification"
                                        helperText="Enter the SNS topic that should be notified when a drill or recovery is execute.  Leave blank for no notifications."
                                        onChange={onChange}
                                        value={value}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel id={"select-account-input"}>Select Account:</InputLabel>
                                <Controller
                                    name={"accountIndex"}
                                    control={control}
                                    rules={{required: true, min: 0}}
                                    render={({field: {onChange, value}}) => (
                                        <Select
                                            error={"accountIndex" in errors}
                                            labelId={"select-account-label"}
                                            id={"select-account"}
                                            defaultValue='-1'
                                            label="Select Account"
                                            onChange={onChange}
                                            value={value}
                                        >
                                            <MenuItem key={`account-menu-item`} disabled value="-1">
                                                <em>Select from your AWS Account definitions</em>
                                            </MenuItem>
                                            {
                                                accounts.length === 0 ?
                                                    <MenuItem
                                                        key={`no-account-menu-item`}
                                                        value="0" disabled>No Accounts - create one first
                                                    </MenuItem> :
                                                    accounts.map((account, idx) => {
                                                        return (
                                                            <MenuItem
                                                                key={`account-${idx}-menu-item`}
                                                                value={idx}>{account.AccountId} - {account.Region}</MenuItem>
                                                        )
                                                    })};
                                        </Select>

                                    )}
                                />
                                <FormHelperText>{("accountId" in errors) ? "Select a valid account.  Define accounts in Account menu" : "Select the account where this application is replicating to DRS"}</FormHelperText>
                            </FormControl>
                        </Grid>
                    </Grid>
                </form>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit(handleCreateUpdateApplication)}>{isUpdate ? "Update" : "Create"}</Button>
            </DialogActions>
        </Dialog>
    )
}


const ApplicationList = ({
                             setCreateUpdateDialogVisible,
                             setDeleteDialogVisible,
                             setIsUpdate,
                             applications,
                             setApplication,
                             setTitle,
                             checked,
                             setChecked,
                             setOpenPlans,
                             setApplicationEditIndex
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
                                    setApplicationEditIndex(idx);
                                    setIsUpdate(true);
                                    setCreateUpdateDialogVisible(true);
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
                          setAlertMessage,
                          setShowAlert,
                          setAlertType,
                          user
                      }) => {

    const [selectedPlans, setSelectedPlans] = React.useState({});
    const [topicARN, setTopicARN] = React.useState('');
    const [isDrill, setIsDrill] = React.useState(true);


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
                <Grid container spacing={1}>
                    <Grid item xs={12}>
                        <FormControl fullWidth>
                            <InputLabel id={"select-execution-input"}>Select Execution Type:</InputLabel>
                            <Select
                                labelId={"select-execution-label"}
                                id={"select-execution-id"}
                                value={isDrill}
                                label="Select Account"
                                onChange={(e) => {
                                    console.log("changed drill value is: " + e.target.value)
                                    setIsDrill(e.target.value)
                                }}
                            >
                                <MenuItem
                                    key={`execution-drill-menu-item`}
                                    value={true}>Drill</MenuItem>
                                <MenuItem
                                    key={`execution-drill-menu-item`}
                                    value={false}>Failover</MenuItem>

                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                        <Box sx={{flexGrow: 1}}>
                            <List dense sx={{width: '100%', bgcolor: 'background.paper'}}>
                                {
                                    checked.map((checked_application) => {
                                        const labelId = `label-${applications[checked_application].AppName}`;
                                        return (
                                            <ListItem
                                                key={`${applications[checked_application].AppName}-execute-plans`}>
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
                                                            <InputLabel id={labelId + "-input"}>Select
                                                                Plan:</InputLabel>
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
                                                                <MenuItem key={`${labelId}-menu-item`} disabled
                                                                          value="-1">
                                                                    <em>Select a plan</em>
                                                                </MenuItem>
                                                                {
                                                                    applications[checked_application].Plans.length === 0 ?
                                                                        <MenuItem
                                                                            key={`${labelId}-menu-item`}
                                                                            value="0" disabled>No plans - create one
                                                                            first
                                                                            one </MenuItem> :
                                                                        applications[checked_application].Plans.map((plan, idx) => {
                                                                            console.log("Plan is: " + JSON.stringify(plan.PlanName) + "\n and index is: " + idx);
                                                                            return (
                                                                                plan.Waves.length === 0 ? <MenuItem
                                                                                        key={`${labelId}-${plan.PlanName}-menu-item`}
                                                                                        value={idx} disabled>Plan
                                                                                        "{plan.PlanName}"
                                                                                        has
                                                                                        no waves - create one
                                                                                        first</MenuItem> :
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
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button onClick={executeSelectedPlans}
                        disabled={Object.keys(selectedPlans).length <= 0}>Execute</Button>
            </DialogActions>
        </Dialog>
    )
        ;
};


function Applications(
    {
        user, signOut
    }
) {
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [createUpdateDialogVisible, setCreateUpdateDialogVisible] = useState(false);
    const [executeDialogVisible, setExecuteDialogVisible] = useState(false);
    const [application, setApplication] = useState({});
    const [applications, setApplications] = useState(null);
    const [applicationEditIndex, setApplicationEditIndex] = useState(0);
    const [accounts, setAccounts] = useState(null);
    const [openAccounts, setOpenAccounts] = useState(false)
    const [openPlans, setOpenPlans] = useState(false)
    const [title, setTitle] = useState("DRS Accelerator")
    const [checked, setChecked] = useState([]);
    const [showAlert, setShowAlert] = useState(false);
    const [alertType, setAlertType] = useState("success");
    const [alertMessage, setAlertMessage] = useState('');
    const [isUpdate, setIsUpdate] = useState(false);


    const handleClose = () => setOpenPlans(false);
    const handleCloseAccounts = () => setOpenAccounts(false);

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
    }, []);

    useEffect(() => {
        try {
            fetchAccounts(
                (fetch_results) => {
                    if ("success" in fetch_results) {
                        setAccounts(fetch_results.data)
                    } else if ("error" in fetch_results) {
                        console.log("an error occurred retrieving accounts list: " + fetch_results.error)
                    }
                }
            )
        } catch (err) {
            console.log('error fetching accounts' + err)
        }
    }, []);


    return (
        <Box sx={{flexGrow: 1}}>
            <UserAppBar
                signOut={signOut}
                user={user}
                title={title}
                setOpenAccounts={setOpenAccounts}
            />
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
                                    setCreateUpdateDialogVisible={setCreateUpdateDialogVisible}
                                    setDeleteDialogVisible={setDeleteDialogVisible}
                                    setApplication={setApplication}
                                    setApplications={setApplications}
                                    applications={applications}
                                    setTitle={setTitle}
                                    setOpenPlans={setOpenPlans}
                                    checked={checked}
                                    setChecked={setChecked}
                                    setIsUpdate={setIsUpdate}
                                    setApplicationEditIndex={setApplicationEditIndex}

                                />)
                        }

                        <DeleteApplication deleteDialogVisible={deleteDialogVisible}
                                           setDeleteDialogVisible={setDeleteDialogVisible}
                                           application={application}
                                           setApplications={setApplications}
                                           setTitle={setTitle}
                                           setChecked={setChecked}
                                           setApplicationEditIndex={setApplicationEditIndex}
                        />

                        {
                            applications != null && accounts != null &&
                            <CreateUpdateApplication
                                createUpdateDialogVisible={createUpdateDialogVisible}
                                setCreateUpdateDialogVisible={setCreateUpdateDialogVisible}
                                setApplications={setApplications}
                                setTitle={setTitle}
                                accounts={accounts}
                                applications={applications}
                                applicationEditIndex={applicationEditIndex}
                                isUpdate={isUpdate}
                            />
                        }
                        <ExecutePlans executeDialogVisible={executeDialogVisible}
                                      setExecuteDialogVisible={setExecuteDialogVisible}
                                      checked={checked}
                                      setTitle={setTitle}
                                      applications={applications}
                                      setAlertMessage={setAlertMessage}
                                      setShowAlert={setShowAlert}
                                      setAlertType={setAlertType}
                                      user={user}
                        />

                    </Box>
                    <Stack spacing={4} direction="row" justifyContent="center"
                           alignItems="center">

                        {
                            accounts != null && <Button variant="contained" onClick={() => {
                                setIsUpdate(false);
                                setCreateUpdateDialogVisible(true);
                            }}>Create New Application</Button>
                        }
                        <Button variant="contained" onClick={() => {
                            console.log("execute plans clicked.")
                            console.log("checked are: " + JSON.stringify(checked))
                            setExecuteDialogVisible(true);
                        }}
                                disabled={checked.length === 0}
                        >
                            {checked.length > 0 ? "Drill / Failover " + checked.length + " Applications" : "Check applications to drill / failover"}
                        </Button>
                    </Stack>
                    <Drawer anchor="right" open={openPlans} onClose={handleClose}
                            PaperProps={{
                                sx: {width: "90%"},
                            }}>
                        <Plans
                            application={application}
                            setApplication={setApplication}
                            putApplication={putApplication}
                            setApplications={setApplications}
                            fetchApplications={fetchApplications}
                        />
                    </Drawer>
                    <Drawer anchor="right" open={openAccounts} onClose={handleCloseAccounts}
                            PaperProps={{
                                sx: {width: "90%"},
                            }}>
                        <Accounts
                            fetchAccounts={fetchAccounts}
                            accounts={accounts}
                            setAccounts={setAccounts}
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
