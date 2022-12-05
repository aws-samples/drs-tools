# AWS Elastic Disaster Recovery Plan Automation

## Overview
This solution provides an automated, sequential approach for AWS DRS drills and recoveries.  The solution enables you to plan multiple application recoveries, each with their own recovery order and wait times.  The solution provides a protected, React based user interface to accelerate and simplify use.

The solution enables you to organize collections of servers by tags in ordered waves so you can recovery architectural components as groups.  Each wave can also have a sequenced set of PreWave and PostWave automation actions.  Automation actions are defined as SSM Automation runbooks providing broad flexibility for sequenced recovery.  For example, you can perform managed services recovery and automation for AWS services such as RDS, Lambda, Route 53, S3, etc either before or after a server recovery completed by DRS.  

## Application Architecture
The solution provides a React based UI requiring authorized login provided by Amazon Cognito.  The solution also uses AWS WAF to limit access to the defined IP addresses / CIDRs that you specify.  The solution uses API Gateway and AWS Lambda to interface with Step Functions for orchestration and DynamoDB for data capture / retrieval.

![](diagrams/DRSPlanAutomationBaselineArchitecture.png)

## State Machine and control logic
The solution uses AWS Step Functions to orchestrate recovery based on your plans defined sequence set of Waves and PreWave / PostWave actions. AWS Lambda is used to drive recovery / automation execution logic.    

The following state machine is implemented to coordinate the execution of PreWave Actions, DRS Jobs, and PostWave Actions for DR plan automation.  The state machine is supported by an AWS Lambda function that implements the control logic for the plan automation.  The state machine and lambda function are deployed via CodePipeline using the [drs-automation-plan.yaml](drs-automation-plan/cfn/lambda/drs-automation-plan/drs-automation-plan.yaml) CloudFormation template.

![](diagrams/StepMachineWorkflow.png)

## CI / CD Architecture

The solution deploys a complete CI/CD management solution using CodeCommit, CodePipeline, CodeBuild, and CloudFormation.  You can use this solution to iteratively develop and enhance your DRS deployment automation plan solution as needed.

![](diagrams/DRSPlanAutomationPipeline.png)

## Deployment

### Prerequisites

* [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html):  The SAM CLI is used to build and deploy the lambda functions used in the solution.  These lambda functions are deployed via CodePipeline.  You should install the SAM CLI to enable you to locally test and invoke the deployed lambda functions.  Install the SAM CLI following the instructions in the documentation.
* Python 3:  The deployment script is written in Python and automates the deployment of cloudformation stacks and AWS resource lookups.  With Python3 installed, install the required Python packages in [requirements.txt](./requirements.txt) with the command:
```shell
python3 -m pip install -r requirements.txt --user
```
* Set the environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` to the AWS account credentials that you want to use to deploy the solution.  You will need sufficient credentials to deploy all the AWS resources used in the solution.
* Set the environment variable `AWS_DEFAULT_REGION` to the AWS region where you want to deploy the solution.

## Deployment Script

A python [deploy.py](./deploy.py) script is provided to automate the deployment of CloudFormation stacks for the solution.

This script deploys all the blue colored stacks in the [CI / CD Architecture diagram](#ci--cd-architecture).  The script concludes by deploying a CodePipeline that deploys the remaining stacks for the solution and defines the basis for future updates.

The following parameter options are supported:
* **```--help```**:  Display and describe valid parameter options
* **```--prefix <prefix name>```**:  The prefix to preprend in front of each stack name, eg prefix ```myco``` results in stack name ```myco-drs-plan-automation-s3```.
* **```--environment <environment name>```**:  The environment name to append to the end of each stack name, eg environment ```dev``` results in stack name ```drs-plan-automation-dev-s3eiifccugtdlhleijhckbijbeikffrhcdnjejfdegfhhd
* **```--cleanup```**:  Cleanup the deployed stacks and AWS resources.  If you deployed with the --prefix or --environment option, then you must cleanup with the same option parameters
* **```--prompt```**:  Whether to prompt and require you to press enter after each stack is deployed.

## Data Architecture

There are two tables used by the solution:

* **drs-plan-automation-applications**:  This is the primary table used the the solution and defines your Applications and their related Plans, Waves, and PreWave / PostWave Actions.
* **drs-plan-automation-results**:  This table is used to store drill / recovery execution results.

### drs-plan-automation-applications
 
* **Key**:  `AppId`:  The AppId key is a uuidv4 hash generated by the REST API whenever a new application is created.

#### Sample Data
```json
{
  "AppId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "AppName": "Sample Application",
  "Description": "Sample Application Description",
  "KeyName": "Application",
  "KeyValue": "sample",
  "Owner": "myemail@example.com",
  "Plans": [
    {
      "PlanId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6a",
      "PlanName": "Default",
      "Description": "Sample plan for sample application",
      "Owner": "myemail@example.com",
      "RPO": "60",
      "RTO": "1200",
      "CreationDate": "1200",
      "LastModifiedDate": "1200",
      "LastExecutedDate": "1200",
      "Waves": [
        {
          "Name": "Sample Databases Wave",
          "Description": "Start database servers",
          "KeyName": "Role",
          "KeyValue": "DBServer",
          "MaxWaitTime": 900,
          "UpdateTime": 30,
          "PostWaveActions": [
            {
              "Name": "Sample PostWave Action - Database Wave: Create PostWave SSM OpsItem",
              "Description": "Create an SSM Ops Item after DRS wave completes",
              "MaxWaitTime": 90,
              "UpdateTime": 30
              "StartAutomationExecution": {
                "DocumentName": "CreateOpsItem",
                "Parameters": {
                  "Category": [
                    "Recovery"
                  ],
                  "Description": [
                    "This is a test OpsItem created from a PostWaveAction from the DRS PLan Automation solution Database wave"
                  ],
                  "Priority": [
                    "1"
                  ],
                  "Title": [
                    "DRS Plan Automation PostWaveAction"
                  ]
                }
              }
            }
          ],
          "PreWaveActions": [
            {
              "Name": "Sample PreWave Action - Database Wave: Create PreWave SSM OpsItem",
              "Description": "Create an SSM OpsItem before DRS wave starts",
              "MaxWaitTime": 90,
              "UpdateTime": 30,
              "StartAutomationExecution": {
                "DocumentName": "CreateOpsItem",
                "Parameters": {
                  "Category": [
                    "Recovery"
                  ],
                  "Description": [
                    "This is a test OpsItem created from a PreWaveAction from the DRS PLan Automation solution Database Wave"
                  ],
                  "Priority": [
                    "1"
                  ],
                  "Title": [
                    "DRS Plan Automation PreWaveAction"
                  ]
                }
              }
            }
          ]
        },
        {
          "KeyName": "Role",
          "KeyValue": "AppServer",
          "Name": "Sample App Server Wave",
          "Description": "Start App Servers",
          "MaxWaitTime": 900,
          "UpdateTime": 30,
          "PostWaveActions": [
            {
              "Name": "Sample PostWave Action - AppServer Wave: Create PostWave OpsItem",
              "Description": "Create an SSM Ops Item after the AppServer wave completes",
              "MaxWaitTime": 90,
              "UpdateTime": 30
              "StartAutomationExecution": {
                "DocumentName": "CreateOpsItem",
                "Parameters": {
                  "Category": [
                    "Recovery"
                  ],
                  "Description": [
                    "This is a test OpsItem created from a PostWave Action from the DRS PLan Automation solution AppServer Wave"
                  ],
                  "Priority": [
                    "1"
                  ],
                  "Title": [
                    "DRS Plan Automation PostWaveAction"
                  ]
                }
              }
            }
          ],
          "PreWaveActions": [
            {
              "Name": "Sample PreWave Action - AppServer Wave: Create PreWave SSM OpsItem",
              "Description": "Create an SSM Ops Item before the AppServer wave starts",
              "MaxWaitTime": 90,
              "UpdateTime": 30,
              "StartAutomationExecution": {
                "DocumentName": "CreateOpsItem",
                "Parameters": {
                  "Category": [
                    "Recovery"
                  ],
                  "Description": [
                    "This is a test OpsItem created from a PreWave action from the DRS PLan Automation solution AppServer Wave"
                  ],
                  "Priority": [
                    "1"
                  ],
                  "Title": [
                    "DRS Plan Automation PreWaveAction"
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```
* **AppId** _(string)_ --
  A system generated uuid that uniquely identifies each application.
* **AppName** _(string)_ --
  The user provided name for the application.
* **Description** _(string)_ --
  The user provided description for the application.
* **KeyName** _(string)_ --
  The Tag Key name that uniquely identifies DRS source servers that are a part of this application.
* **KeyValue** _(string)_ --
  The Tag Key value that uniquely identifies DRS source servers that are a part of this application.
* **Owner** _(string)_ --
  The email address for the owner of this application.
* **Plans** _(array)_ --
  An array of 0 or more plans for the application
  * 
    **PlanId** _(string)_ --
    A system generated uuid that uniquely identifies each plan.

    **Name** _(string)_ --
    The user provided name for the plan

    **Description** _(string)_ --
    The user provided description for the plan.

    **KeyName** _(string)_ --
    The Tag Key name that uniquely identifies DRS source servers that are a part of this plan.

    **KeyValue** _(string)_ --
    The Tag Key value that uniquely identifies DRS source servers that are a part of this plan.

    **Owner** _(string)_ --
    The email address for the owner of this application.

    **Waves** _(array)_ --
    An array of 0 or more waves for the plan
    * 
      **Name** _(string)_ --
      The user provided name for the wave.

      **Description** _(string)_ --
      The user provided description for the wave.

      **KeyName** _(string)_ --
      The Tag Key name that uniquely identifies DRS source servers that are a part of this wave.

      **KeyValue** _(string)_ --
      The Tag Key value that uniquely identifies DRS source servers that are a part of this wave.

      **MaxWaitTime** _(number)_ --
      The maximum amount of time to wait for this wave to complete before it is considered a failure.

      **PreWaveActions** _(array)_ --
      An array of 0 or more PreWave Actions to execute before initiating the DRS job for the wave.
      * 
        **Name** _(string)_ --
        The user provided name for the PreWave action.

        **Description** _(string)_ --
        The user provided description for the PreWave action.

        **MaxWaitTime** _(number)_ --
        The maximum amount of time to wait for this wave to complete before it is considered a failure.

        **UpdateTime** _(number)_ --
        The amount of time to wait before updating the results for this action.

        **StartAutomationExecution** _(object)_ --
        The SSM Automation Runbook parameters as defined in the [boto3 start_automation_execution function](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ssm.html#SSM.Client.start_automation_execution).

      **PostWaveActions** _(array)_ --
      An array of 0 or more PostWave Actions to execute after completing the DRS job for the wave.
      *
        **Name** _(string)_ --
        The user provided name for the PostWave action.

        **Description** _(string)_ --
        The user provided description for the PostWave action.

        **MaxWaitTime** _(number)_ --
        The maximum amount of time to wait for this wave to complete before it is considered a failure.

        **UpdateTime** _(number)_ --
        The amount of time to wait before updating the results for this action.

        **StartAutomationExecution** _(object)_ --
        The SSM Automation Runbook parameters as defined in the [boto3 start_automation_execution function](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ssm.html#SSM.Client.start_automation_execution).

### drs-plan-automation-results
This table stores the results from a plan automation execution.  

* **Key**:  `AppId_PlanId`:  The key for an execution result is a combination of 

## Concepts

The primary entities in the solution are Applications, Plans, Waves, PreWave / PostWave Actions, and Plan Results.  The solution uses DynamoDB as the data store for these entities and the entities are defined using JSON.


### Applications

```

{
  "AppName": "App1",
  "Description": "Application 1 Description",
  "KeyName": "Application",
  "KeyValue": "App1",
  "OwnerEmail": "myemail@example.com"
}

```

* AppName _(string)_ (REQUIRED):  
  The name of the application.  Use a meaningful name to describe your application.  Application names must be unique.
* KeyName _(string)_ (REQUIRED):  The tag key name to identify the AWS DRS source servers.  Your AWS DRS source servers for this application should have this tag key name defined.
* KeyValue _(string)_ (REQUIRED):  The tag key value to identify the AWS DRS source servers.  Your AWS DRS source servers for this application should have this tag key value defined.
* Description _(string)_:
  A description of your application.   This should describe the business purpose of the application and primary users.
* OwnerEmail _(string)_:  The email address of the owner of the application or the owner of the disaster recovery plan for the application.


### Plans
The plans entity is the primary entity in the DRS solution and defines the recovery plans for an application.  An application can have multiple plans.

The JSON object representing a plan is defined using the following structure:

```
{
  "AppName": "string",
  "PlanName": "string",
  "Waves": [
    {
      "KeyName": "string",
      "KeyValue": "string",
      "UpdateTime": integer,
      "MaxWaitTime": integer,
      "PreWaveActions": [
        {
          "StartAutomationExecution": {
            "DocumentName": "string"
          },
          "UpdateTime": 60,
          "MaxWaitTime": 600
        }
      ],
      "PostWaveActions": [
        {
          "StartAutomationExecution": {
            "DocumentName": "string"
          },
          "UpdateTime": 60,
          "MaxWaitTime": 600
        }      
      ]
    }
  ]
}
```

* AppName _(string)_ (REQUIRED):  
  The name of the application.  This must correspond to the same name used in the Applications table.  
* PlanName _(string)_ (REQUIRED):  
  The name of the plan.  This must be unique for a specific application.  Define a meaningful name for your plan.
* Waves _(array of objects)_ (REQUIRED):
  An array defining the waves for the plan.  The solution will perform drills or recoveries one wave at a time and in order defined within the array.  This allows you to restore servers in a specified order, such as restoring databases first followed by applications that use databases in the next wave.
  * KeyName _(string)_ (REQUIRED):
    The tag key name to identify the AWS DRS source servers for the wave.  The tag key name should be defined for the source servers that should be recovered in this wave.
  * KeyValue _(string)_ (REQUIRED):
    The tag key value to identify the AWS DRS source servers for the wave.  The tag key value should be defined for the source servers that should be recovered in this wave.
  * UpdateTime _(integer)_ (REQUIRED):
    The amount of time to wait before querying the status of the current wave.  
  * MaxWaitTime _(integer)_ (REQUIRED):
    The maximum amount of time to wait before proceeding to the next wave.
  * PreWaveActions _(array of objects)_ (REQUIRED):
    An array defining the actions that should be executed before starting the drill / recovery of DRS source servers for this wave. Each action is executed sequentially, in order. If you don't have any actions that you want to execute before the wave starts, then provide an empty array: "[]"

       * UpdateTime _(integer)_ (REQUIRED):
         The amount of time to wait before querying the status of the current action.
       * MaxWaitTime _(integer)_ (REQUIRED):
         The maximum amount of time to wait before proceeding to the next action.
       * StartAutomationExecution _(object)_
         An SSM Automation Runbook to execute.  All the parameters for the [StartAutomationExecution AWS API](https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_StartAutomationExecution.html) are supported.  See the documentation for details.
            * DocumentName _(string)_ (REQUIRED):
              The name of the SSM document to execute.  

  * PostWaveActions _(array of objects)_ (REQUIRED):
    An array defining the actions that should be executed after the drill / recovery of DRS source servers for this wave. Each action is executed in order, sequentially. If you don't have any actions that you want to execute after the wave completes, then provide an empty array: "[]"

      * UpdateTime _(integer)_ (REQUIRED):
        The amount of time to wait before querying the status of the current action.
      * MaxWaitTime _(integer)_ (REQUIRED):
        The maximum amount of time to wait before proceeding to the next action.
      * StartAutomationExecution _(object)_
        An SSM Automation Runbook to execute.  All the parameters for the [StartAutomationExecution AWS API](https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_StartAutomationExecution.html) are supported.  See the documentation for details.
          * DocumentName _(string)_ (REQUIRED):
            The name of the SSM document to execute.  


### Plan Results

The plan results entity stores the results of a plan execution.  It includes the logs and details from the SSM automations run before and after the wave, the DRS jobs executed for each wave, the wave logs, total execution time, and the State Machine execution id.

The JSON object representing a plan result is defined using the following structure:

