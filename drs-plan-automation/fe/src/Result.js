import React, {useEffect, useState} from 'react'

import ErrorBoundary from './ErrorBoundary'
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link'

import Chip from '@mui/material/Chip';
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Grid from '@mui/material/Grid';

import ApplicationAlert from "./ApplicationAlert";
import Stack from "@mui/material/Stack";

import {Card, CardContent, CardActionArea, CardActions} from '@mui/material';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import theme from "./theme";
import {API} from "aws-amplify";
import awsExports from './aws-exports';

const apiName = 'drsplangui';
const path = '/result';


const Result = ({
                    planResult, setPlanResult, planResultDialogVisible, setPlanResultDialogVisible, resultColor
                }) => {
    const [showAlert, setShowAlert] = useState(false);
    const [alertType, setAlertType] = useState("success");
    const [alertMessage, setAlertMessage] = useState('');

    let successIndicationColor = theme.palette.success.main;
    let successIndicationHover = theme.palette.success.light;

    let inProgressIndicationColor = theme.palette.info.main;
    let inProgressIndicationHover = theme.palette.info.light;

    let failureIndicationColor = theme.palette.error.main;
    let failureIndicationHover = theme.palette.error.light;


    let timeoutIndicationColor = "#e2e5de";
    let timeoutIndicationHover = "#f5f5f5";

    function readableDate(date_input) {
        const date = new Date(date_input);
        let options = {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false,
            timeZone: 'UTC',
            timeZoneName: 'short'
        };
        return Intl.DateTimeFormat('en-US', options).format(date)
    }

    const ActionDuration = ({action}) => {
        console.log("action is: " + JSON.stringify(action))
        if (action.job?.duration) {
            console.log("duration found: " + action.job.duration)
            return (
                <Typography>Duration: {action.job.duration}</Typography>
            )
        } else if (action.job?.ExecutionStartTime) {
            console.log("duration not found, execution time found")
            return (
                <Typography>{`Start Time: ${readableDate(action.job.ExecutionStartTime)}`}</Typography>
            )
        }
    }
    const ActionResult = ({actions, actionDetails, actionType}) => {
        console.log("Actions are: " + JSON.stringify(actions))
        return (<Accordion sx={{width: '100%'}}>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon/>}
                aria-controls={`"${actionType}-header"`}
                id={`"${actionType}-header"`}
            >
                <Typography variant="h6">{`${actions.length} ${actionType} Actions`}</Typography>
            </AccordionSummary>
            <AccordionDetails align="left"
            >
                <Grid container spacing={1}>
                    {actions.map((action, action_idx) => {
                        return (<Grid item xs={12} key={`action-${action_idx}-summary`}>
                            <Accordion sx={{width: '100%', ...returnStatusColor(action.status)}}>
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon/>}
                                    aria-controls={`"${actionType}-content"`}
                                    id={`"${actionType}-content"`}
                                    sx={{alignItems: 'center'}}
                                >
                                    <Grid container spacing={2} columns={12}>
                                        <Grid item xs={4} align="left">
                                            <Chip label={action_idx + 1} size="small"/>
                                        </Grid>
                                        <Grid item xs={4} align="center">
                                            <Link
                                                variant="h6"
                                                href={buildSSMURL(action.id)}
                                                target="_blank">
                                                {`${actionDetails[action_idx].Name} ${capitalizeFirstLetter(action.status)}`}
                                            </Link>
                                        </Grid>
                                        <Grid item xs={4} align="right">
                                            <ActionDuration
                                                action={action}
                                            />
                                        </Grid>
                                    </Grid>

                                </AccordionSummary>s
                                <AccordionDetails align="left"
                                >
                                    <Grid>
                                        <Grid item xs={12} key={`action-${action_idx}-details`}>
                                            <TextField fullWidth id="action-DocumentName"
                                                       margin="normal"
                                                       label="Action Document Name or ARN"
                                                       value={actionDetails[action_idx].StartAutomationExecution.DocumentName}
                                                       disabled
                                            />
                                        </Grid>
                                    </Grid>
                                </AccordionDetails>
                            </Accordion>
                        </Grid>)
                    })}
                </Grid>
            </AccordionDetails>
        </Accordion>)


    }

    const ServerLogDetails = ({wave, sourceServerId}) => {
        const getServerJobDetails = (serverId) => {
            let logDetails = wave.drs.job?.detail?.filter((eventObject) => {
                if (eventObject.eventData?.sourceServerID === serverId) {
                    return true;
                }
            }) ?? [];
            return logDetails;
        }

        let jobDetails = getServerJobDetails(sourceServerId);

        return (
            <Grid>
                {
                    jobDetails.map((jobDetailItem) => {
                            return (
                                <Grid container spacing={2} columns={12}>
                                    <Grid item xs={8} align="left">
                                        <Typography>{`Event: ${jobDetailItem.event}`}</Typography>
                                    </Grid>
                                    <Grid item xs={4} align="right">
                                        <Typography>{`${readableDate(jobDetailItem.logDateTime)}`}</Typography>
                                    </Grid>
                                </Grid>
                            )
                        }
                    )
                }

            </Grid>)
    }

    const DrsResult = ({wave}) => {

        return (<Accordion sx={{width: '100%'}}>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon/>}
                aria-controls={`"${wave.drs?.job?.jobID}-header"`}
                id={`"${wave.drs?.job?.jobID}-header"`}
            >
                {
                    wave.drs?.job?.jobID !== undefined ? <Link
                            variant="h6"
                            href={buildDrsURL(wave.drs.job.jobID)}
                            target="_blank">
                            {`Elastic Disaster Recovery Job: ${wave.SourceServers.length} Source Servers ${capitalizeFirstLetter(wave.drs.status)}`}
                        </Link> :
                        <Typography variant="h6">{`Elastic Disaster Recovery Job: ${wave.SourceServers.length} Source Servers ${capitalizeFirstLetter(wave.drs.status)}`}</Typography>
                }
            </AccordionSummary>
            <AccordionDetails align="left"
            >
                <Grid container spacing={1}>
                    {wave.SourceServers.map((sourceServer) => {
                        return (<Grid item xs={12} key={sourceServer}>
                            <Accordion sx={{width: '100%'}}>
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon/>}
                                    aria-controls={`"${sourceServer}-content"`}
                                    id={`"${sourceServer}-content"`}
                                    sx={{alignItems: 'center'}}
                                >
                                    <Link
                                        variant="h6"
                                        href={buildSourceServerURL(sourceServer)}
                                        target="_blank">
                                        {sourceServer}
                                    </Link>
                                </AccordionSummary>
                                <AccordionDetails align="left"
                                >
                                    <ServerLogDetails
                                        wave={wave}
                                        sourceServerId={sourceServer}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        </Grid>)
                    })}
                </Grid>
            </AccordionDetails>
        </Accordion>)


    }

    const fetchExecution = (result, cb) => {
        try {
            let params = {
                'queryStringParameters': {
                    'AppId_PlanId': result['AppId_PlanId'], 'ExecutionId': result['ExecutionId']
                }
            }
            API.get(apiName, path, params).then((execution_result) => {
                if ('error' in execution_result) {
                    console.log(`Error get result for ${result['AppId_PlanId']} with execution id: ${result['ExecutionId']}: ${JSON.stringify(execution_result.error)}`);
                    cb({error: execution_result.error})
                } else {
                    // console.log(`get result for ${result['AppId_PlanId']} with execution id: ${result['ExecutionId']} is: ${JSON.stringify(execution_result.data)}`);
                    cb({data: execution_result.data})
                }
            })
        } catch (err) {
            console.log('error fetching applications:' + err)
        }
    }


    // useEffect(() => {
    //     try {
    //         // console.log("Result is: " + JSON.stringify(planResult))
    //     } catch (err) {
    //         console.log('error fetching result: ' + err)
    //     }
    // }, [JSON.stringify(planResult)]);


    function closeResult() {
        setPlanResultDialogVisible(false);
    }

    function returnStatusColor(status) {
        console.log('status is: ' + status);
        if (status === 'started') {
            return {
                border: 1, borderColor: inProgressIndicationColor, '&:hover': {
                    borderColor: inProgressIndicationHover, opacity: [0.9, 0.8, 0.7],
                }
            }
        } else if (status === 'failed') {
            return {
                border: 1, borderColor: failureIndicationColor, '&:hover': {
                    borderColor: failureIndicationHover, opacity: [0.9, 0.8, 0.7],
                }
            }
        } else if (status === 'completed') {
            return {
                border: 1, borderColor: successIndicationColor, '&:hover': {
                    borderColor: successIndicationHover, opacity: [0.9, 0.8, 0.7],
                }
            }
        } else if (status === 'timeout' || status === 'skipped') {
            return {
                border: 1, borderColor: timeoutIndicationColor, '&:hover': {
                    borderColor: timeoutIndicationHover, opacity: [0.9, 0.8, 0.7],
                }
            }
        }
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    const buildSSMURL = (executionId) => {
        return `https://${awsExports.aws_project_region}.console.aws.amazon.com/systems-manager/automation/execution/${executionId}?region=${awsExports.aws_project_region}`;
    }

    const buildSourceServerURL = (sourceServerId) => {
        return `https://${awsExports.aws_project_region}.console.aws.amazon.com/drs/home?region=${awsExports.aws_project_region}#/sourceServers/${sourceServerId}/recovery_dashboard`;
    }

    const buildDrsURL = (jobId) => {
        return `https://${awsExports.aws_project_region}.console.aws.amazon.com/drs/home?region=${awsExports.aws_project_region}#/launchHistory/${jobId}`;
    }

    const WaveStage = ({wave, idx}) => {
        return (<Card
            sx={returnStatusColor(wave.status)}
        >
            <CardContent>
                <Typography gutterBottom variant="h5" component="div">
                    {`Wave ${idx + 1}: ${planResult.planDetails.Waves[idx].Name} ${capitalizeFirstLetter(wave.status)}`}
                </Typography>
                <ActionResult
                    actions={wave.PreWaveActions}
                    actionType="PreWaveActions"
                    actionDetails={planResult.planDetails.Waves[idx].PreWaveActions}
                />
                <ErrorBoundary>
                    <DrsResult
                        wave={wave}
                    />
                </ErrorBoundary>
                <ActionResult
                    actions={wave.PostWaveActions}
                    actionType="PostWaveActions"
                    actionDetails={planResult.planDetails.Waves[idx].PostWaveActions}
                />

            </CardContent>
            <CardActions>
                {wave.log.length > 0 && <Accordion sx={{width: '100%'}}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon/>}
                        aria-controls="logspanel-content"
                        id="logspanel-header"
                    >
                        <Typography variant="h6">Log</Typography>
                    </AccordionSummary>
                    <AccordionDetails align="left"
                    >
                        {wave.log.map((log_item) => {
                            return (<Typography style={{whiteSpace: 'pre-line'}}>
                                {log_item}
                            </Typography>)
                        })}

                    </AccordionDetails>
                </Accordion>}
            </CardActions>
        </Card>)
    }

    const StartStage = () => {
        return (<Card variant="outlined"
                      sx={returnStatusColor(planResult.status)}
        >
            <CardContent>
                <Typography gutterBottom variant="h5" component="div">
                    Drill {capitalizeFirstLetter(planResult.status)}
                </Typography>
                <Accordion sx={{width: '100%'}}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon/>}
                        aria-controls="applicationDetails-content"
                        id="applicationDetails-header"
                    >
                        <Typography variant="h6">Application Details</Typography>
                    </AccordionSummary>
                    <AccordionDetails align="left"
                    >
                        <Grid container spacing={1}>
                            <Grid item xs={6}>
                                <TextField fullWidth id="application-keyName" margin="normal" label="Key Name"
                                           helperText="The AWS Tag key name identifying the application. (e.g. Role)"
                                           value={planResult.KeyName}
                                           disabled/>
                            </Grid>
                            <Grid item xs={6}>
                                <TextField fullWidth id="application-keyValue" margin="normal" label="Key Value"
                                           helperText="The AWS tag key value identifying the application. (e.g. DB)"
                                           defaultValue={planResult.KeyValue}
                                           disabled/>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField fullWidth id="application-owner" margin="normal"
                                           label="Application Owner Email Address"
                                           helperText="The email address for the owner of this application."
                                           defaultValue={planResult.Owner}
                                           disabled/>
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>


            </CardContent>
            <CardActions>
                {planResult.log.length > 0 &&

                    <Accordion raised="false" sx={{width: '100%'}}>
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon/>}
                            aria-controls="logspanel-content"
                            id="logspanel-header"
                        >
                            <Typography variant="h6">Log</Typography>
                        </AccordionSummary>
                        <AccordionDetails align="left"
                        >
                            {planResult.log.map((log_item) => {
                                return (<Typography style={{whiteSpace: 'pre-line'}}>
                                    {log_item}
                                </Typography>)
                            })}
                        </AccordionDetails>
                    </Accordion>}
            </CardActions>
        </Card>)
    }


    return (<Dialog
        open={planResultDialogVisible}
        fullWidth
        maxWidth="xl"
        scroll="paper"
    >
        <DialogTitle sx={{backgroundColor: resultColor}}>
            <Grid container spacing={2} columns={12}>
                <Grid item xs={4} align="left">
                    <Typography
                        variant="h6">{`Application: ${planResult.AppName}`}</Typography>
                </Grid>
                <Grid item xs={4} align="center">
                    <Typography variant="h6">{`Initiated By: ${planResult.user}`}</Typography>
                </Grid>
                <Grid item xs={4} align="right">
                    <Typography
                        variant="h6">{`Type: ${planResult.isDrill ? 'Drill' : 'Failover'}`}</Typography>
                </Grid>
            </Grid>
            {showAlert && <ApplicationAlert
                setShowAlert={setShowAlert}
                alertType={alertType}
                alertMessage={alertMessage}
            />}
            <Grid container spacing={2} columns={12}>
                <Grid item xs={4} align="left">
                    <Typography
                        variant="h6">{`Plan: ${planResult.planDetails.PlanName} `}</Typography>
                </Grid>
                <Grid item xs={4} align="center">
                    <Typography
                        variant="h6">{`Initiated At: ${readableDate(planResult.ExecutionStartTime)} `}</Typography>
                </Grid>
                <Grid item xs={4} align="right">
                    {
                        planResult?.duration !== undefined ?
                            <Typography variant="h6">{`Duration: ${planResult.duration}`}</Typography> :
                            <Typography variant="h6">{`Start Time: ${readableDate(planResult.ExecutionStartTime)}`}</Typography>
                    }

                </Grid>
            </Grid>

        </DialogTitle>
        <DialogContent dividers>
            <Box sx={{
                flexGrow: 1,
            }}>
                <Grid container spacing={2} columns={16} align="center">
                    <Grid item xs={16}>
                        <StartStage

                        />
                    </Grid>
                    {planResult.Waves.map((wave, idx) => {
                        return (wave.status !== "" && <Grid item xs={16}>
                            <Grid item xs={16}>
                                <ArrowDownwardIcon fontSize="large"/>
                            </Grid>
                            <Grid item xs={16}>
                                <WaveStage
                                    wave={wave}
                                    idx={idx}
                                />
                            </Grid>
                        </Grid>)
                    })}
                </Grid>
            </Box>
        </DialogContent>
        <DialogActions>
            <Stack spacing={4} direction="row" justifyContent="center" alignItems="center">
                <Button autoFocus onClick={() => {
                    fetchExecution(planResult, (result) => {
                        if ('error' in result) {
                            setAlertMessage('An error occurred refreshing the result');
                            setAlertType("error");
                            setShowAlert(true);
                        } else {
                            setPlanResult(result.data);
                        }
                    })
                }} variant="contained">
                    Refresh
                </Button>
                <Button autoFocus onClick={closeResult} variant="contained">
                    OK
                </Button>
            </Stack>
        </DialogActions>
    </Dialog>);

}

export default Result;
