//Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//SPDX-License-Identifier: Apache-2.0

import React, {useEffect, useState} from 'react'

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import ListItemText from "@mui/material/ListItemText";
import AddIcon from '@mui/icons-material/Add';
import Divider from '@mui/material/Divider';

import Chip from '@mui/material/Chip';
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Grid from '@mui/material/Grid';

import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import empty_action from "./data/action.js"
import ListItemButton from "@mui/material/ListItemButton";

const CreateUpdateAction = ({
                                setCreateUpdateDialogVisible,
                                createUpdateDialogVisible,
                                actions,
                                setActions,
                                isNewAction,
                                newAction,
                                isPreWave,
                                setNewAction,
                                actionIndex
                            }) => {
    const [name, setName] = useState(empty_action.Name);
    const [description, setDescription] = useState(empty_action.Description);
    const [maxWaitTime, setMaxWaitTime] = useState(empty_action.MaxWaitTime);
    const [updateTime, setUpdateTime] = useState(empty_action.UpdateTime);

    const [documentName, setDocumentName] = useState(empty_action.StartAutomationExecution.DocumentName);
    const [parameters, setParameters] = useState({});

    const [newParameterName, setNewParameterName] = useState('');
    const [newParameterValue, setNewParameterValue] = useState('');


    useEffect(() => {
        setName(newAction.Name);
        setDescription(newAction.Description);
        setMaxWaitTime(newAction.MaxWaitTime);
        setUpdateTime(newAction.UpdateTime);
        setDocumentName(newAction.StartAutomationExecution.DocumentName);
        setParameters(newAction.StartAutomationExecution.Parameters);
        console.log("useEffect newAction: " + JSON.stringify(newAction))
    }, [JSON.stringify(newAction), isPreWave]);


    function closeDialog() {
        setCreateUpdateDialogVisible(false);
        setParameters(empty_action.StartAutomationExecution.Parameters)
        setNewParameterName("");
        setNewParameterValue("")
    }

    const getUpdatedAction = () => {
        let new_action = JSON.parse(JSON.stringify(newAction));
        new_action.Name = name;
        new_action.Description = description;
        new_action.MaxWaitTime = parseInt(maxWaitTime);
        new_action.UpdateTime = parseInt(updateTime);
        new_action.StartAutomationExecution.DocumentName = documentName;
        new_action.StartAutomationExecution.Parameters = parameters;
        return new_action;

    }

    const handleCreateAction = () => {

        let created_action = getUpdatedAction();
        console.log("creating and adding new action.")
        let new_actions = JSON.parse(JSON.stringify(actions))
        if (isNewAction) {
            new_actions.push(created_action);
        } else {
            new_actions[actionIndex] = created_action;
        }
        setActions(new_actions)
        // console.log("Updated Plan is: " + JSON.stringify(new_plan))
        closeDialog();
    }


    return (
        <Dialog
            open={createUpdateDialogVisible}
            fullWidth
            maxWidth="xl"
            scroll="paper"
            // style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <DialogTitle>{isNewAction ? "Create" : "Update"} {isPreWave ? "PreWave" : "PostWave"}</DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={1} direction="row" align="center" alignItems="center">
                    <Grid item xs={12}>
                        <TextField fullWidth id="action-Name" margin="normal" label="Action Name"
                                   helperText="Action Name"
                                   value={name}
                                   onChange={(e) => {
                                       setName(e.target.value);
                                   }}
                                   required/>
                    </Grid>
                    <Grid item xs={12}>

                        <TextField fullWidth id="action-Description"
                                   margin="normal"
                                   label="Action Description"
                                   rows={4}
                                   multiline
                                   helperText="Describe your action."
                                   value={description}
                                   onChange={(e) => {
                                       setDescription(e.target.value)
                                   }}/>
                    </Grid>
                    <Grid item xs={6}>
                        <TextField fullWidth id="action-MaxWaitTime"
                                   margin="normal"
                                   label="Action Maximum Wait Time"
                                   helperText="Enter the maximum time to wait for action completion before proceeding."
                                   value={maxWaitTime}
                                   onChange={(e) => {
                                       setMaxWaitTime(e.target.value)
                                   }}
                                   required
                        />
                    </Grid>
                    <Grid item xs={6}>

                        <TextField fullWidth id="action-UpdateTime"
                                   margin="normal"
                                   label="Action Update Time"
                                   helperText="Enter the time to wait between action status updates"
                                   value={updateTime}
                                   onChange={(e) => {
                                       setUpdateTime(e.target.value)
                                   }}
                                   required
                        />
                    </Grid>
                    <Grid item xs={12}>

                        <TextField fullWidth id="action-DocumentName"
                                   margin="normal"
                                   label="Action Document Name or ARN"
                                   helperText="Enter the SSM document name or ARN to execute"
                                   value={documentName}
                                   onChange={(e) => {
                                       setDocumentName(e.target.value)
                                   }}
                                   required
                        />
                    </Grid>
                </Grid>
                <Grid container padding={1} direction="row" align="center" sx={{width: '100%', bgcolor: '#f1f6f6'}}>
                    <Grid item xs={12}>
                        <Divider>
                            <Typography>{`${Object.keys(parameters).length} Parameters`}</Typography>
                        </Divider>
                    </Grid>
                    <Grid item xs={12}>
                        <List dense sx={{width: '100%', bgcolor: 'background.paper'}}>
                            {
                                Object.keys(parameters).map((param, idx) => {
                                    return (
                                        <ListItem key={param + '|' + idx}>
                                            <Grid container direction="row" align="center" alignItems="center">
                                                <Grid item xs={1}>
                                                    <Chip label={idx + 1} size="small" sx={{marginRight: 2}}/>
                                                </Grid>
                                                <Grid item xs={5}>
                                                    <TextField fullWidth id={`"${param + idx}-ParameterKey"`}
                                                               margin="normal"
                                                               label="Parameter Name"
                                                               defaultValue={param}
                                                               disabled
                                                    />
                                                </Grid>
                                                <Grid item xs={5}>
                                                    <TextField fullWidth id={`"${param + idx}-ParameterValue"`}
                                                               margin="normal"
                                                               label="Parameter Value"
                                                               defaultValue={parameters[param][0]}
                                                               disabled
                                                    />
                                                </Grid>
                                                <Grid item xs={1}>
                                                    <IconButton edge="end" aria-label="delete" onClick={() => {
                                                        let new_parameters = JSON.parse(JSON.stringify(parameters));
                                                        delete new_parameters[param];
                                                        setParameters(new_parameters);
                                                    }}>
                                                        <DeleteIcon/>
                                                    </IconButton>
                                                </Grid>
                                            </Grid>
                                        </ListItem>

                                    )
                                })
                            }
                        </List>
                    </Grid>
                </Grid>
                <Grid container padding={1} direction="row" align="center" alignItems="center"
                      sx={{width: '100%', bgcolor: '#f1f6f6'}}>
                    <Grid item xs={12}>
                        <Divider><Typography>Add Parameters</Typography></Divider>
                    </Grid>
                    <Grid item xs={5}>
                        <TextField fullWidth id="ParameterName-new"
                                   margin="normal"
                                   label="Parameter Name"
                                   helperText="Enter the Parameter Name (case sensitive)"
                                   value={newParameterName}
                                   onChange={(e) => {
                                       setNewParameterName(e.target.value)
                                   }}

                        />
                    </Grid>
                    <Grid item xs={1}>
                        <Typography>=</Typography>
                    </Grid>
                    <Grid item xs={5}>
                        <TextField fullWidth id="ParameterValue-new"
                                   margin="normal"
                                   label="Parameter Value"
                                   helperText="Enter the Parameter Value (case sensitive)"
                                   value={newParameterValue}
                                   onChange={(e) => {
                                       setNewParameterValue(e.target.value)
                                   }}
                        />
                    </Grid>
                    <Grid item xs={1}>
                        <Button variant="outlined" onClick={() => {
                            let new_action = getUpdatedAction();
                            new_action.StartAutomationExecution.Parameters[newParameterName] = [newParameterValue];
                            setNewParameterName("")
                            setNewParameterValue("")
                            setNewAction(new_action)
                        }}>Add</Button>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button variant="contained" autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={
                    () => {
                        handleCreateAction();
                    }
                }>Save</Button>
            </DialogActions>
        </Dialog>
    )
}


function Actions({
                     actions,
                     setActions,
                     isPreWave
                 }) {
    const [createUpdateDialogVisible, setCreateUpdateDialogVisible] = useState(false);
    const [newAction, setNewAction] = useState(empty_action);
    const [isNewAction, setIsNewAction] = useState(false);
    const [actionIndex, setActionIndex] = useState(-1);


    function copyAction(idx) {
        console.log("Copy action clicked..")
        let new_actions = JSON.parse(JSON.stringify(actions))
        let copy_action = JSON.parse(JSON.stringify(actions[idx]))
        copy_action.Name = "Copy of " + copy_action.Name
        new_actions.splice(idx + 1, 0, copy_action)
        setActions(new_actions)
        setActionIndex(-1)
    }

    function deleteAction(idx) {
        console.log("Delete action clicked..")
        let new_actions = JSON.parse(JSON.stringify(actions))
        new_actions.splice(idx, 1);
        setActions(new_actions)
        setActionIndex(-1)
    }

    function moveActionUp(idx) {
        console.log("Move action up clicked..");
        let new_actions = JSON.parse(JSON.stringify(actions));
        let toIndex = idx - 1;
        let move_action = new_actions.splice(idx, 1)[0];
        console.log("moving up action: " + JSON.stringify(move_action));
        new_actions.splice(toIndex, 0, move_action);
        setActions(new_actions)
        setActionIndex(-1)
    }

    function moveActionDown(idx) {
        console.log("Move action down clicked..");
        let new_actions = JSON.parse(JSON.stringify(actions));
        let toIndex = idx + 1;
        const move_wave = new_actions.splice(idx, 1)[0];
        new_actions.splice(toIndex, 0, move_wave);
        setActions(new_actions)
        setActionIndex(-1)
    }

    return (
        <Box sx={{flexGrow: 1}}>
            <Divider>
                <Chip icon={<AddIcon/>}
                      label={isPreWave ? `${actions.length} PreWave Actions` : `${actions.length} PostWave Actions`}
                      color="primary"
                      onClick={() => {
                          let newAction = JSON.parse(JSON.stringify(empty_action))
                          newAction.StartAutomationExecution.Parameters = {};
                          setNewAction(newAction);
                          setIsNewAction(true);
                          setActionIndex(-1);
                          setCreateUpdateDialogVisible(true);
                      }}
                />
            </Divider>
            <List>
                {
                    actions.map((action, idx) => {
                            return (
                                <ListItem key={action.Name + '|' + idx}
                                          secondaryAction={
                                              <IconButton edge="end" aria-label="delete" onClick={() => {
                                                  deleteAction(idx);
                                              }}>
                                                  <DeleteIcon/>
                                              </IconButton>
                                          }
                                >
                                    <Chip label={idx + 1} size="small" sx={{marginRight: 2}}/>
                                    <ListItemButton role={undefined} edge="start"
                                                    onClick={() => {
                                                        console.log("update action: " + JSON.stringify(action))
                                                        setActionIndex(idx);
                                                        setNewAction(action);
                                                        setIsNewAction(false);
                                                        setCreateUpdateDialogVisible(true);
                                                    }}
                                                    dense>
                                        <ListItemText
                                            primary={`${action.Name}`}
                                            secondary={`${action.Description}`}
                                        />
                                    </ListItemButton>
                                    <IconButton aria-label="Move Up"
                                                onClick={() => {
                                                    moveActionUp(idx)
                                                }}
                                                disabled={idx === 0}
                                    >
                                        <ArrowCircleUpIcon/>
                                    </IconButton>
                                    <IconButton aria-label="Move Down"
                                                onClick={() => {
                                                    moveActionDown(idx)
                                                }}
                                                disabled={idx === (actions.length - 1)}
                                    >
                                        <ArrowCircleDownIcon/>
                                    </IconButton>

                                    <IconButton edge="end" aria-label="copy"
                                                onClick={() => {
                                                    copyAction(idx)
                                                }}
                                    >
                                        <ContentCopyIcon/>
                                    </IconButton>


                                </ListItem>
                            )
                        }
                    )
                }
            </List>
            <CreateUpdateAction
                createUpdateDialogVisible={createUpdateDialogVisible}
                setCreateUpdateDialogVisible={setCreateUpdateDialogVisible}
                actions={actions}
                setActions={setActions}
                isNewAction={isNewAction}
                newAction={newAction}
                setNewAction={setNewAction}
                isPreWave={isPreWave}
                actionIndex={actionIndex}
            />
        </Box>
    );

}

export default Actions;
