//Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//SPDX-License-Identifier: Apache-2.0

const uuid = require('uuid');

/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_DRSSOLUTIONDRSAUTOMATIONPLANSTEPFUNCTIONDRSAUTOMATIONPLANAPPLICATIONSTABLE1I3QB1SB8D6F7_ARN
	STORAGE_DRSSOLUTIONDRSAUTOMATIONPLANSTEPFUNCTIONDRSAUTOMATIONPLANAPPLICATIONSTABLE1I3QB1SB8D6F7_NAME
	STORAGE_DRSSOLUTIONDRSAUTOMATIONPLANSTEPFUNCTIONDRSAUTOMATIONPLANAPPLICATIONSTABLE1I3QB1SB8D6F7_STREAMARN
	STORAGE_DRSSOLUTIONDRSAUTOMATIONPLANSTEPFUNCTIONDRSAUTOMATIONPLANPLANSTABLEASQ23GRQCMK2_ARN
	STORAGE_DRSSOLUTIONDRSAUTOMATIONPLANSTEPFUNCTIONDRSAUTOMATIONPLANPLANSTABLEASQ23GRQCMK2_NAME
	STORAGE_DRSSOLUTIONDRSAUTOMATIONPLANSTEPFUNCTIONDRSAUTOMATIONPLANPLANSTABLEASQ23GRQCMK2_STREAMARN
	STORAGE_DRS_ARN
	STORAGE_DRS_NAME
	STORAGE_DRS_STREAMARN
Amplify Params - DO NOT EDIT */
const AWS = require('aws-sdk')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const bodyParser = require('body-parser')
const express = require('express')

// AWS.config.update({region: process.env.TABLE_REGION});

const dynamodb = new AWS.DynamoDB.DocumentClient();

const stepfunctions = new AWS.StepFunctions();

const applicationTableName = process.env.DRS_TABLE_NAME;
const executionTableName = process.env.DRS_EXECUTION_TABLE_NAME;
const accountsTableName = process.env.DRS_ACCOUNTS_TABLE_NAME;
const resultsTableName = process.env.DRS_RESULTS_TABLE_NAME;
// if (process.env.ENV && process.env.ENV !== "NONE") {
//   tableName = tableName + '-' + process.env.ENV;
// }

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "AppName";
const partitionKeyType = "S";
const sortKeyName = "";
const sortKeyType = "";
const hasSortKey = sortKeyName !== "";
const path = "/applications";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;
const sortKeyPath = hasSortKey ? '/:' + sortKeyName : '';

const stateMachineArn = process.env.DRS_STATE_MACHINE_ARN

// declare a new express app
const app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "*")
    next()
});

// convert url string param to expected Type
const convertUrlType = (param, type) => {
    switch (type) {
        case "N":
            return Number.parseInt(param);
        default:
            return param;
    }
}

/*************************************
 * HTTP Get method for list accounts *
 *************************************/

app.get("/accounts", function (req, res) {

    let queryParams = {
        TableName: accountsTableName
    }

    dynamodb.scan(queryParams, (err, data) => {
        if (err) {
            console.log("ERROR: " + JSON.stringify(err))
            res.statusCode = 500;
            res.json({error: 'Could not load accounts: ' + err});
        } else {
            console.log("SUCCESS: " + JSON.stringify(data))
            res.json({success: 'account list succeeded', data: data.Items});
        }
    });
});


/************************************
 * HTTP put method for insert account *
 *************************************/

app.put("/accounts", function (req, res) {

    console.log("put data received: " + JSON.stringify(req.body));
    try {
        if ("account" in req.body) {
            let account = JSON.parse(JSON.stringify(req.body.account));

            let putItemParams = {
                TableName: accountsTableName,
                Item: account
            }
            dynamodb.put(putItemParams, (err, data) => {
                if (err) {
                    res.statusCode = 500;
                    res.json({error: err});
                } else {
                    res.json({success: `new account added, AccountId: ${account.AccountId}`, data: account})
                }
            });
        } else {
            res.json({error: "account to create or update not received"});
        }
    } catch (e) {
        console.log("An exception occurred trying to add new account record: " + e);
    }
});


/**************************************
 * HTTP remove method to delete account *
 ***************************************/

app.delete("/accounts", function (req, res) {

    console.log("delete data query params received: " + JSON.stringify(req.body));

    if ("AccountId" in req.body) {
        let removeItemParams = {
            TableName: accountsTableName,
            Key: {'AccountId': req.body.AccountId}
        }
        console.log("delete ddb params: " + removeItemParams)
        dynamodb.delete(removeItemParams, (err, data) => {
            if (err) {
                res.statusCode = 500;
                res.json({error: err});
            } else {
                res.json({success: "deleted account with id:" + req.body.AccountId});
            }
        });

    } else {
        res.json({error: "error no AccountId specified in request"});
    }
});


/********************************
 * HTTP Get method for results  *
 ********************************/

app.get("/results", function (req, res) {

    // console.log("request apiGateway is: " + JSON.stringify(req.apiGateway))
    // console.log("request parameters is: " + JSON.stringify(req.params))

    const query = req.query;

    const key = query.appId + '_' + query.planId;

    let queryParams = {
        TableName: resultsTableName,
        ExpressionAttributeValues: {
            ":v1": key
        },
        KeyConditionExpression: "AppId_PlanId = :v1"
    }

    console.log("ddb call params: " + JSON.stringify(queryParams))

    dynamodb.query(queryParams, (err, data) => {
        if (err) {
            console.log("ERROR: " + JSON.stringify(err))
            res.statusCode = 500;
            res.json({error: `Could not retrieve results for application: ${query.AppName} and plan: ${query.PlanName}: ${err}`});
        } else {
            console.log("SUCCESS: " + JSON.stringify(data))
            res.json({success: 'retrieved results', data: data.Items});
        }
    });
});

/********************************
 * HTTP Get method for one result  *
 ********************************/

app.get("/result", function (req, res) {

    // console.log("request apiGateway is: " + JSON.stringify(req.apiGateway))
    // console.log("request parameters is: " + JSON.stringify(req.params))

    const query = req.query;

    const key = query.AppId_PlanId;
    const sort = query.ExecutionId;

    let queryParams = {
        TableName: resultsTableName,
        ExpressionAttributeValues: {
            ":key": key,
            ":sort": sort
        },
        KeyConditionExpression: "AppId_PlanId = :key and ExecutionId = :sort"
    }

    console.log("ddb call params: " + JSON.stringify(queryParams))

    dynamodb.query(queryParams, (err, data) => {
        if (err) {
            console.log("ERROR: " + JSON.stringify(err))
            res.statusCode = 500;
            res.json({error: `Could not retrieve result for AppName__PlanName: ${query.AppName__PlanName} and execution id: ${query.ExecutionId}: ${err}`});
        } else {
            console.log("SUCCESS: " + JSON.stringify(data))
            res.json({success: 'result retrieved', data: data.Items[0]});
        }
    });
});

/********************************
 * HTTP Get method for list objects *
 ********************************/

app.get("/applications", function (req, res) {

    // console.log("request apiGateway is: " + JSON.stringify(req.apiGateway))
    // console.log("request parameters is: " + JSON.stringify(req.params))

    let queryParams = {
        TableName: applicationTableName
    }

    console.log("ddb call params: " + JSON.stringify(queryParams))

    dynamodb.scan(queryParams, (err, data) => {
        if (err) {
            console.log("ERROR: " + JSON.stringify(err))
            res.statusCode = 500;
            res.json({error: 'Could not load items: ' + err});
        } else {
            console.log("SUCCESS: " + JSON.stringify(data))
            res.json({success: 'application list succeeded', data: data.Items});
        }
    });
});


/************************************
 * HTTP post method for executing state machine *
 *************************************/

app.post("/applications/execute", function (req, res) {

    console.log("post data received: " + JSON.stringify(req.body));

    if ("Applications" in req.body && req.body.Applications.length > 0) {
        var params = {
            stateMachineArn: stateMachineArn, /* required */
            input: JSON.stringify(req.body)
            // name: 'STRING_VALUE',
            // traceHeader: 'STRING_VALUE'
        };
        stepfunctions.startExecution(params, function (err, executionData) {
            if (err) {
                console.log(err, err.stack); // an error occurred
                res.json({
                    error: "error occurred initiating execution " + JSON.stringify(err)
                });
            } else {
                console.log(`Start State Machine execution succeeded: ${JSON.stringify(executionData)}`);           // successful response
                let item = {
                    'ExecutionId': executionData.executionArn,
                    'StartDate': String(executionData.startDate),
                    'params': params
                }

                let putItemParams = {
                    TableName: executionTableName,
                    Item: item
                }
                dynamodb.put(putItemParams, (err, data) => {
                    if (err) {
                        console.log(`ERROR:  Error putting execution result into dynamodb, params: ${JSON.stringify(putItemParams)}, error: ${JSON.stringify(err)}`)
                        res.json({
                            error: "error occurred recording execution: " + JSON.stringify(executionData.executionArn)
                        });
                    } else {
                        res.json({
                            success: 'Execution succeeded, executionId: ' + executionData.executionArn,
                            data: executionData
                        })
                        console.log(`Successfully recorded execution to execution table with params ${JSON.stringify(putItemParams)}: ${JSON.stringify(data)}`)
                    }
                });
            }
        });

    } else {
        res.json({error: "execution request without required data received"});
    }
});


/************************************
 * HTTP put method for insert object *
 *************************************/

app.put("/applications", function (req, res) {

    console.log("put data received: " + JSON.stringify(req.body));
    try {
        if ("application" in req.body) {
            let application = JSON.parse(JSON.stringify(req.body.application));
            // new application
            if (!("AppId" in application)) {
                application.AppId = uuid.v4();
            }
            // new plan added, generate uuid for it...
            else if (application.Plans.length && !("PlanId" in application.Plans[(application.Plans.length-1)])) {
                application.Plans[(application.Plans.length-1)].PlanId = uuid.v4();
            }
            let putItemParams = {
                TableName: applicationTableName,
                Item: application
            }
            dynamodb.put(putItemParams, (err, data) => {
                if (err) {
                    res.statusCode = 500;
                    res.json({error: err});
                } else {
                    res.json({success: 'new application added, AppId: ' + application.AppId, data: application})
                }
            });
        } else {
            res.json({error: "application to create or update not received"});
        }
    } catch (e) {
        console.log("An exception occurred trying to add new application record: " + e);
    }
});


/**************************************
 * HTTP remove method to delete object *
 ***************************************/

app.delete("/applications", function (req, res) {

    console.log("delete data query params received: " + JSON.stringify(req.body));

    if ("AppId" in req.body) {
        let removeItemParams = {
            TableName: applicationTableName,
            Key: {'AppId': req.body.AppId}
        }
        console.log("delete ddb params: " + removeItemParams)
        dynamodb.delete(removeItemParams, (err, data) => {
            if (err) {
                res.statusCode = 500;
                res.json({error: err});
            } else {
                res.json({success: "deleted application with id:" + req.body.AppId});
            }
        });

    } else {
        res.json({error: "error no AppId specified in request"});
    }
});

app.listen(3000, function () {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
