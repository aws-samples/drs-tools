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

import empty_wave from "./data/wave.js"
import ListItemButton from "@mui/material/ListItemButton";
import Actions from "./Actions";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import PlanResults from "./PlanResults";


function TabPanel(props) {
    const {children, value, index, ...other} = props;
    if (value === index) {
        return (
            <div
                role="tabpanel"
                hidden={value !== index}
                id={`wave-tabpanel-${index}`}
                aria-labelledby={`wave-tab-${index}`}
                {...other}
            >
                <Box sx={{p: 3}}>
                    {children}
                </Box>
            </div>
        );

    }
}

const CreateUpdateWave = ({
                              setCreateUpdateDialogVisible,
                              createUpdateDialogVisible,
                              waves,
                              setWaves,
                              newWave,
                              setNewWave,
                              isNewWave,
                              waveIndex,
                              nav,
                              setNav
                          }) => {
    const [name, setName] = useState(empty_wave.Name);
    const [description, setDescription] = useState(empty_wave.Description);
    const [keyName, setKeyName] = useState(empty_wave.KeyName);
    const [keyValue, setKeyValue] = useState(empty_wave.KeyValue);
    const [maxWaitTime, setMaxWaitTime] = useState(empty_wave.MaxWaitTime);
    const [updateTime, setUpdateTime] = useState(empty_wave.UpdateTime);

    const [preWaveActions, setPreWaveActions] = useState(empty_wave.PreWaveActions);
    const [postWaveActions, setPostWaveActions] = useState(empty_wave.PreWaveActions);

    //console.log('plan is: ' + JSON.stringify(currentPlan) + " index is: " + waveIndex)

    useEffect(() => {
        try {
            setName(newWave.Name);
            setDescription(newWave.Description);
            setKeyName(newWave.KeyName);
            setKeyValue(newWave.KeyValue);
            setMaxWaitTime(newWave.MaxWaitTime);
            setUpdateTime(newWave.UpdateTime);
            setPreWaveActions(newWave.PreWaveActions);
            setPostWaveActions(newWave.PostWaveActions);
            console.log("newWave is: " + JSON.stringify(newWave))
        } catch (err) {
            console.log('error setting new wave' + err)
        }
    }, [JSON.stringify(newWave)]);

    function closeDialog() {
        setCreateUpdateDialogVisible(false);
    }


    const handleCreateUpdateWave = () => {
        let updated_wave = {
            Name: name,
            Description: description,
            KeyName: keyName,
            KeyValue: keyValue,
            MaxWaitTime: parseInt(maxWaitTime),
            UpdateTime: parseInt(updateTime),
            PreWaveActions: preWaveActions,
            PostWaveActions: postWaveActions
        }
        let new_waves = JSON.parse(JSON.stringify(waves))
        if (isNewWave) {
            new_waves.push(updated_wave)
        } else {
            new_waves.splice(waveIndex, 1, updated_wave)
        }
        setWaves(new_waves);
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
            <DialogTitle>{isNewWave ? "Create Wave" : `Update Wave ${waveIndex + 1} : ${newWave.Name}`}</DialogTitle>
            <DialogContent dividers>
                <Tabs
                    value={nav}
                    onChange={(event, newValue) => {
                        // if (nav === 0) {
                        //     updateOverview();
                        // }
                        console.log("wave nav value is: " + nav)
                        setNav(newValue);
                    }}
                    centered
                    indicatorColor="primary"
                    variant="fullWidth"
                >
                    <Tab label="PreWave Actions" id="wave-tab-0" aria-controls="wave-tabpanel-0" />
                    <Tab label="Wave Details" id="wave-tab-1" aria-controls="wave-tabpanel-1" />
                    <Tab label="PostWave Actions" id="wave-tab-2" aria-controls="wave-tabpanel-2" />
                </Tabs>
                <TabPanel value={nav} index={0}>
                    <Actions
                        actions={preWaveActions}
                        setActions={setPreWaveActions}
                        isPreWave={true}
                    />
                </TabPanel>
                <TabPanel value={nav} index={1}>
                    <Grid container spacing={1}>
                        <Grid item xs={12}>
                            <TextField fullWidth id="wave-Name" margin="normal" label="Wave Name"
                                       helperText="Wave Name"
                                       value={name}
                                       onChange={(e) => {
                                           setName(e.target.value);
                                           return;
                                       }}
                                       required/>
                        </Grid>
                        <Grid item xs={12}>

                            <TextField fullWidth id="wave-Description"
                                       margin="normal"
                                       label="Wave Description"
                                       rows={4}
                                       multiline
                                       helperText="Describe your wave."
                                       value={description}
                                       onChange={(e) => {
                                           setDescription(e.target.value)
                                       }}/>
                        </Grid>
                        <Grid item xs={6}>

                            <TextField fullWidth id="wave-KeyName"
                                       margin="normal"
                                       label="Wave Key Name"
                                       helperText="Enter the AWS Tag Key Name to identify servers for this wave."
                                       value={keyName}
                                       onChange={(e) => {
                                           setKeyName(e.target.value)
                                       }}
                                       required
                            />
                        </Grid>
                        <Grid item xs={6}>

                            <TextField fullWidth id="wave-KeyValue"
                                       margin="normal"
                                       label="Wave Key Value"
                                       helperText="Enter the AWS Tag Key Value to identify servers for this wave."
                                       value={keyValue}
                                       onChange={(e) => {
                                           setKeyValue(e.target.value)
                                       }}
                                       required
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField fullWidth id="wave-MaxWaitTime"
                                       margin="normal"
                                       label="Wave Maximum Wait Time"
                                       helperText="Enter the maximum time to wait for wave completion before proceeding."
                                       type="number"
                                       value={maxWaitTime}
                                       onChange={(e) => {
                                           setMaxWaitTime(e.target.value)
                                       }}
                                       required
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField fullWidth id="wave-UpdateTime"
                                       margin="normal"
                                       label="Wave Update Time"
                                       helperText="Enter the time to wait between wave status updates"
                                       type="number"
                                       value={updateTime}
                                       onChange={(e) => {
                                           setUpdateTime(e.target.value)
                                       }}
                                       required
                            />
                        </Grid>
                    </Grid>
                </TabPanel>
                <TabPanel value={nav} index={2}>
                    <Actions
                        actions={postWaveActions}
                        setActions={setPostWaveActions}
                        isPreWave={false}
                    />
                </TabPanel>
            </DialogContent>
            <DialogActions>
                <Button variant="contained" autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={
                    () => {
                        handleCreateUpdateWave();
                    }
                }>{isNewWave ? "Create Wave" : "Update Wave"}</Button>
            </DialogActions>
        </Dialog>
    )
}

function PlanWaves({waves, setWaves}) {
    const [createUpdateDialogVisible, setCreateUpdateDialogVisible] = useState(false);
    const [waveIndex, setWaveIndex] = useState(0);
    const [isPreWave, setIsPreWave] = useState(false);
    const [newWave, setNewWave] = useState(empty_wave);
    const [isNewWave, setIsNewWave] = useState(false);
    const [nav, setNav] = useState(0);

    useEffect(() => {
        try {
            console.log("Waves are: " + JSON.stringify(waves))
            setWaves(waves)
        } catch (err) {
            console.log('error fetching waves' + err)
        }
    }, [JSON.stringify(waves)]);

    function copyWave(idx) {
        console.log("Copy wave clicked for idx: " + idx)
        let new_waves = JSON.parse(JSON.stringify(waves))
        let copy_wave = JSON.parse(JSON.stringify(new_waves[idx]))
        copy_wave.Name = "Copy of " + copy_wave.Name
        new_waves.splice(idx + 1, 0, copy_wave)
        setWaves(new_waves)
        setWaveIndex(0)
    }

    function deleteWave(idx) {
        console.log("Delete wave clicked..")
        let new_waves = JSON.parse(JSON.stringify(waves))
        new_waves.splice(idx, 1);
        setWaves(new_waves);
        setWaveIndex(0)
        return;
    }

    function moveWaveUp(idx) {
        console.log("Move wave up clicked..")
        let new_waves = JSON.parse(JSON.stringify(waves))
        let toIndex = idx - 1;
        let move_wave = new_waves.splice(idx, 1)[0]
        console.log("moving up wave: " + JSON.stringify(move_wave))
        new_waves.splice(toIndex, 0, move_wave)
        setWaves(new_waves)
        setWaveIndex(0)
        return;
    }

    function moveWaveDown(idx) {
        let new_waves = JSON.parse(JSON.stringify(waves))
        let toIndex = idx + 1;
        const move_wave = new_waves.splice(idx, 1)[0]
        new_waves.splice(toIndex, 0, move_wave)
        setWaves(new_waves)
        setWaveIndex(0)
        return;
    }

    return (
        <Box sx={{flexGrow: 1}}>
            <Divider>
                <Chip icon={<AddIcon/>} label={`${waves.length} Waves`} color="primary"
                      onClick={() => {
                          let newWave = JSON.parse(JSON.stringify(empty_wave));
                          setNewWave(newWave);
                          setIsNewWave(true);
                          setNav(1);
                          // setWaveIndex(-1);
                          setCreateUpdateDialogVisible(true);
                      }}/>
            </Divider>
            <List dense sx={{width: '100%', bgcolor: 'background.paper'}}>
                {
                    waves.map((wave_item, idx) => {
                        return (
                            <ListItem key={wave_item.Name + '|' + idx}
                                      secondaryAction={
                                          <IconButton edge="end" aria-label="delete" onClick={() => {
                                              deleteWave(idx);
                                          }}>
                                              <DeleteIcon/>
                                          </IconButton>
                                      }
                            >
                                <Chip label={idx + 1} size="small" sx={{marginRight: 2}}/>
                                <Divider>
                                    <Button variant="outlined" onClick={() => {
                                        setWaveIndex(idx);
                                        setNewWave(wave_item);
                                        setIsNewWave(false);
                                        setNav(0);
                                        setCreateUpdateDialogVisible(true);
                                        console.log("Prewave Actions clicked");
                                    }}>{`${wave_item.PreWaveActions.length} PreWave Actions`}</Button>
                                </Divider>
                                <ListItemButton role={undefined} edge="start"
                                                onClick={() => {
                                                    setWaveIndex(idx);
                                                    setNewWave(wave_item);
                                                    setIsNewWave(false);
                                                    setNav(1);
                                                    setCreateUpdateDialogVisible(true);
                                                }}
                                                dense>
                                    <ListItemText
                                        primary={`${wave_item.Name}`}
                                        secondary={`${wave_item.Description}`}
                                    />
                                </ListItemButton>
                                <Divider>
                                    <Button variant="outlined" onClick={() => {
                                        setWaveIndex(idx);
                                        setNewWave(wave_item);
                                        setIsNewWave(false);
                                        setNav(2);
                                        setCreateUpdateDialogVisible(true);
                                        console.log("PostWave Actions clicked");
                                    }}>{`${wave_item.PostWaveActions.length} PostWave Actions`}</Button>
                                </Divider>

                                <IconButton aria-label="Move Up"
                                            onClick={() => {
                                                moveWaveUp(idx)
                                                return;
                                            }}
                                            disabled={idx === 0 ? true : false}
                                >
                                    <ArrowCircleUpIcon/>
                                </IconButton>
                                <IconButton aria-label="Move Down"
                                            onClick={() => {
                                                moveWaveDown(idx)
                                                return;
                                            }}
                                            disabled={idx === (waves.length - 1) ? true : false}
                                >
                                    <ArrowCircleDownIcon/>
                                </IconButton>

                                <IconButton edge="end" aria-label="copy"
                                            onClick={() => {
                                                copyWave(idx)
                                            }}
                                >
                                    <ContentCopyIcon/>
                                </IconButton>
                            </ListItem>
                        )
                    })}
            </List>

            {
                waves.length === 0 &&
                <Typography variant="h5" align="center" sx={{m: 2}}>No waves exist, please create
                    one.</Typography>
            }
            <CreateUpdateWave
                createUpdateDialogVisible={createUpdateDialogVisible}
                setCreateUpdateDialogVisible={setCreateUpdateDialogVisible}
                setWaves={setWaves}
                waves={waves}
                waveIndex={waveIndex}
                isNewWave={isNewWave}
                newWave={newWave}
                setNewWave={setNewWave}
                nav={nav}
                setNav={setNav}
            />

        </Box>
    );

}

export default PlanWaves;
