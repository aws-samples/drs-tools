//Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//SPDX-License-Identifier: Apache-2.0

import React, {useEffect, useState} from 'react'

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import {API} from "aws-amplify";
import theme from './theme';
import Grid from "@mui/material/Grid";
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import Result from './Result'
import ApplicationAlert from "./ApplicationAlert";


const apiName = 'drsplangui';
const path = '/results';


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


(function () {
    if (typeof Object.defineProperty === 'function') {
        try {
            Object.defineProperty(Array.prototype, 'sortBy', {value: sb});
        } catch (e) {
        }
    }
    if (!Array.prototype.sortBy) Array.prototype.sortBy = sb;

    function sb(f) {
        for (var i = this.length; i;) {
            var o = this[--i];
            this[i] = [].concat(f.call(o, o, i), o);
        }
        this.sort(function (a, b) {
            for (var i = 0, len = a.length; i < len; ++i) {
                if (a[i] != b[i]) return a[i] < b[i] ? -1 : 1;
            }
            return 0;
        });
        for (var i = this.length; i;) {
            this[--i] = this[i][this[i].length - 1];
        }
        return this;
    }
})();


function toHoursAndMinutes(totalMinutes) {
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}`;
}

function padTo2Digits(num) {
    return num.toString().padStart(2, '0');
}

function fetchResults(appId, planId, cb) {
    try {
        let params = {
            'queryStringParameters': {
                'appId': appId,
                'planId': planId
            }
        }

        API.get(apiName, path, params).then((results) => {
            if ('error' in results) {
                console.log(`Error geting result for application ${appId} and plan ${planId}: ${JSON.stringify(results.error)}`);
                cb({error: results.error})
            } else {
                console.log(`get result for application ${appId} and plan ${planId} is: ${JSON.stringify(results.data)}`);
                cb({data: results.data})
            }
        })
    } catch (err) {
        console.log('error fetching applications:' + err)
    }
}

const PlanResultsList = ({
                             planResults,
                             setPlanResults,
                             setPlanResult,
                             setPlanResultDialogVisible,
                             setResultColor
                         }) => {

    const [sortBySelection, setSortBySelection] = useState("ExecutionStartTimeDescending");

    let successIndicationColor = theme.palette.success.light;
    let inProgressIndicationColor = theme.palette.info.light;
    let failureIndicationColor = theme.palette.error.light;

    let failureIcon = <HighlightOffIcon fontSize="small"/>
    let successIcon = <CheckCircleOutlineIcon fontSize="small"/>
    let inProgressIcon = <CircularProgress fontSize="small"/>

    const handleSortSelection = (
        event,
        newSortBySelection
    ) => {
        if (newSortBySelection !== null) {
            setSortBySelection(newSortBySelection);
        }
    };

    const handleOpenResult = () => {
        setPlanResultDialogVisible(true);
    };

    const sortResults = (data) => {
        if (data && data.length) {
            if (sortBySelection === "ExecutionStartTimeDescending") {
                data.sortBy(function (o) {
                    return -(Date.parse(o.ExecutionStartTime))
                });
            } else if (sortBySelection === "ExecutionStartTimeAscending") {
                data.sortBy(function (o) {
                    return (Date.parse(o.ExecutionStartTime))
                });
            }
            return data;
        }
    }

    useEffect(() => {
        try {
            console.log(JSON.stringify(planResults))
            if (planResults && planResults.length) {
                let results_copy = JSON.parse(JSON.stringify(planResults))
                sortResults(results_copy)
                setPlanResults(results_copy)
            }
        } catch (err) {
            console.log('error sorting results' + err)
        }
    }, [sortBySelection]);


    const ResultHeader = () => {
        return (
            <ListItem key="resultsHeader"
                      sx={{flexGrow: 1}}>
                <Grid container direction="row" align="left">
                    <Grid item xs={1}>
                        <Typography variant="h6">Status</Typography>
                    </Grid>
                    <Grid item xs={2}>
                        <Typography variant="h6">Type</Typography>
                    </Grid>
                    <Grid item xs={3}>
                        <Typography variant="h6">Duration</Typography>
                    </Grid>
                    <Grid item xs={3}>
                        <Typography variant="h6">Initiated By</Typography>
                    </Grid>
                    <Grid item xs={3}>
                        <Grid container direction="row" alignItems="center">
                            <Typography sx={{pr: 1}} variant="h6">Start Time</Typography>
                            <ToggleButtonGroup
                                value={sortBySelection}
                                exclusive
                                onChange={handleSortSelection}
                                aria-label="sort selection"
                                size="small"
                            >
                                <ToggleButton value="ExecutionStartTimeDescending"
                                              aria-label="start time descending">
                                    <KeyboardArrowDownIcon/>
                                </ToggleButton>
                                <ToggleButton value="ExecutionStartTimeAscending" aria-label="start time ascending">
                                    <KeyboardArrowUpIcon/>
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Grid>
                    </Grid>
                </Grid>
            </ListItem>
        )
    }

    return (
        <Box sx={{flexGrow: 1}}>
            <List dense sx={{width: '100%', bgcolor: 'background.paper'}}>
                <ResultHeader/>
                {
                    planResults.map((result_item, idx) => {
                            let resultItemColor = inProgressIndicationColor;
                            let resultIcon = inProgressIcon;

                            if (result_item.status === "completed") {
                                resultItemColor = successIndicationColor;
                                resultIcon = successIcon;

                            } else if (result_item.status === "failed") {
                                resultItemColor = failureIndicationColor;
                                resultIcon = failureIcon;
                            }

                            return (
                                <ListItem key={`result${idx}`}
                                          sx={{m: 1, border: 1, borderColor: resultItemColor, flexGrow: 1}}>
                                    <ListItemButton role={undefined} edge="start"
                                                    onClick={() => {
                                                        setPlanResult(result_item)
                                                        setResultColor(resultItemColor)
                                                        handleOpenResult();
                                                    }}
                                                    sx={{pl: 0, pr: 0}}
                                                    dense>
                                        <Grid container direction="row" align="left">
                                            <Grid item xs={1}>
                                                {resultIcon}
                                            </Grid>
                                            <Grid item xs={2}>
                                                <Chip label={result_item.isDrill ? "Drill" : "Failover"}
                                                      color="primary"
                                                />
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Typography>{result_item.duration}</Typography>
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Typography>{result_item.user}</Typography>
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Typography>{readableDate(result_item.ExecutionStartTime)}</Typography>
                                            </Grid>
                                        </Grid>
                                    </ListItemButton>
                                </ListItem>
                            )
                        }
                    )
                }
            </List>
        </Box>
    );
};

function PlanResults({appId, planId}) {
    const [planResults, setPlanResults] = useState(null);
    const [planResult, setPlanResult] = useState({});
    const [resultColor, setResultColor] = useState(theme.palette.info.light);
    const [planResultDialogVisible, setPlanResultDialogVisible] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [alertType, setAlertType] = useState("success")
    const [alertMessage, setAlertMessage] = useState('');

    console.log(`Application ${appId} and Plan ${planId}`)

    useEffect(() => {
        try {
            fetchResults(appId, planId, (results) => {
                if ('error' in results) {
                    setAlertMessage('An error occurred refreshing the result');
                    setShowAlert(true);
                } else {
                    setPlanResults(results.data)
                }
            })
        } catch (err) {
            console.log('error fetching results' + err)
        }
    }, [appId, planId]);

    return (
        <Box sx={{flexGrow: 1}}>
            <Box sx={{flexGrow: 1}}>
                {showAlert &&
                    <ApplicationAlert
                        setShowAlert={setShowAlert}
                        alertMessage={alertMessage}
                        alertType={alertType}
                    />
                }
                {
                    planResults == null && <Skeleton animation="wave"/>
                }

                {
                    planResults != null && (planResults.length === 0 ?
                        <Typography variant="h5" align="center" sx={{m: 2}}>There are no results for this
                            plan.</Typography> :

                        <PlanResultsList
                            planResults={planResults}
                            setPlanResults={setPlanResults}
                            setPlanResult={setPlanResult}
                            setPlanResultDialogVisible={setPlanResultDialogVisible}
                            setResultColor={setResultColor}
                        />)
                }

                {
                    planResultDialogVisible &&
                    <Result
                        planResult={planResult}
                        setPlanResult={setPlanResult}
                        setPlanResultDialogVisible={setPlanResultDialogVisible}
                        planResultDialogVisible={planResultDialogVisible}
                        resultColor={resultColor}
                    />
                }
            </Box>
        </Box>
    );

}

export default PlanResults;
