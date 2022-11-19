# Overview

When using AWS Elastic Disaster Recovery Service (DRS) every source server has a corresponding launch template. Launch templates cannot be edited in a batch using the native DRS tooling. This solution will enable you to use a single file as a baseline template that can be replicated, edited, and used for each source server tagged with a corresponding key in the DRS console.

# Architecture

![template-updated drawio](https://user-images.githubusercontent.com/97046295/165619622-780e7448-4832-4a10-8696-938336314847.png)

This solution is composed of the following components:

- S3 bucket for storing launch templates in the form of json files.

- Lambda function that pulls down a json launch template from the bucket and then updates DRS servers that are tagged with the prefix of that json. This function will be called 'set-drs-templates'.

- Lambda function that runs on a schedule and scans for any new replicating servers that have a matching tag to one of the existing templates in the bucket. This allows new servers that are added to DRS to inherit the launch template that they are tagged for. In this example we are going to just set the scheduler to run once daily to capture new servers added throughout the day. This function will be called 'schedule-drs-templates'.

# Prerequisites

In order to use this solution, it is required to have active servers in DRS. For more information on getting started with DRS reference the [quick start guide](https://docs.aws.amazon.com/drs/latest/userguide/getting-started.html).

The provided deployment instructions utilize the [AWS CLI](https://aws.amazon.com/cli/)

Part of this solution is creating lambda functions which need to make API calls to  DRS, EC2, and S3. It is required to have a role with the proper permissions to access all three services. You can create a role with the provided 'policy.json' in order to give the solution the proper API access.

The policy has been created to only allow the minimum required permissions to ensure the solution is functional:

* "s3:PutObject"
* "s3:GetObject"
* "drs:DescribeSourceServers"
* "ec2:ModifyLaunchTemplate"
* "s3:ListBucket"
* "ec2:CreateLaunchTemplateVersion"
* "drs:GetLaunchConfiguration"

# Deployment

Deploying the solution is composed of two main steps. Create the lambda functions and Create the S3 bucket trigger.

Create the Lambda Functions:

* Clone the repo
```
git clone https://github.com/aws-samples/drs-template-manager.git
```

* Create the zip deployment package of the 'set-drs-templates' function.
```
cd drs-template-manager
cd cmd-template
zip template.zip drs-template-manager
```

* Create the zip deployment package of the 'schedule-drs-templates' function.
```
cd ../cmd-cron
zip cron.zip template-cron-automation
```

Make two new GO lambda functions in the same region as your DRS replicating servers and use the '.zip' files created above as the deployment packages. Under "Runtime Settings" Set the Handler to 'drs-template-manager' for the function that sets the templates and 'template-cron-automation' for the scheduler. The architecture should be x86 and the Runtime should be Go 1.x . :

* Create the 'schedule-drs-templates' function, replace '$INSERTROLEARN' with the arn of the role you created for the solution.
```
aws lambda create-function \            
--function-name schedule-drs-templates \
--role $INSERTROLEARN \
--runtime go1.x \
--handler template-cron-automation \
--package-type Zip \
--zip-file fileb://cron.zip
```

* Create the 'set-drs-templates' function, replace '$INSERTROLEARN' with the arn of the role you created for the solution.
```
cd ../cmd-template
aws lambda create-function \            
--function-name set-drs-templates \
--role $INSERTROLEARN \
--runtime go1.x \
--handler drs-template-manager \
--package-type Zip \
--zip-file fileb://template.zip
```

- Once the scheduler is created you need to determine how often you would like it to run and then create a CloudWatch cron event to trigger it. For this example we will create an event rule that triggers once per day at 12:00 PM UTC. Once we make the rule it needs to be added to the lambda function as a trigger.

* Create the rule
```
aws events put-rule \
--schedule-expression "cron(0 12 * * ? *)" \
--name template-cron-rule
```

* Add the 'schedule-drs-templates' function as a target for the rule. Replace $FunctionARN with the ARN of the 'schedule-drs-templates' lambda function.
```
aws events put-targets \
--rule template-cron-rule \
--targets "Id"="1","Arn"=$FunctionARN
```

* Create a resource-based policy to allow the template-cron-rule permission to call the scheduled-drs-templates function. $STATEMENTID is an identifier that differentiates the statement from others in the same policy and $TEMPLATE-CRON-RULE-ARN is the Rule ARN of the event rule: 
```
aws lambda add-permission \
--function-name schedule-drs-templates \
--action lambda:InvokeFunction \
--statement-id $STATEMEINTID \ 
--principal events.amazonaws.com \
--source-arn $TEMPLATE-CRON-RULE-ARN \
```

Create the S3 bucket trigger for the 'set-drs-templates' function:

- Create an S3 bucket in the same region as the lambda function.
```
aws s3api create-bucket \
--bucket $SOMEUNIQUEBUCKETNAME
```

- Create an Event Notification in the bucket you just created.

* Navigate to the bucket and select the *Properties* tab.

* Select *Create event notification* .

    - Event name: "DRS template Automation"
    - The suffix should be '.json'
    - Check the box for 'All object create events'
    - Set the destination as the previously created lambda function.

- Update the cron function to take in the bucket created earlier as an environment variable
```
aws lambda update-function-configuration \
--function-name schedule-drs-templates \
--environment Variables={BUCKET=$SOMEUNIQUEBUCKETNAME}
```
# Usage

To use the solution, you'll need to create a baseline template, replicate it one per source server, then edit at least two tags in the file.

Create a baseline template(s):

- The repo comes with an example [launch template](https://docs.aws.amazon.com/drs/latest/userguide/ec2-launch.html) called 'Name.json' in the 'cmd-template' directory. The prefix of the .json file indicates which tag will be updated.

Replicate the baseline template(s), one per source server, and then edit:

- Open the template, locate the **AWSElasticDisasterRecoverySourceServerID** and **Name** keys for both volume and instance ResourceTypes. Update these values to match those of the source server. 

- Be sure each source server has a tag that matches the JSON file prefix.

**Important Note: If a source server has tags that match two different templates, the server will take on the template that is last uploaded to the S3 bucket. Templates should have a 1:1 relationship with source servers, that is, one source server per template, so more than one tag per server is counterproductive.**

# Build Executables

1.  [Install the Go build tools](https://go.dev/doc/install) if not already installed for your platform.
2.  Build template-cron-automation
On Linux:
```shell
cd cmd-cron
GOOS=linux go build .
```

3. Build drs-template-manager
On Linux:
```shell
cd ../cmd-template
GOOS=linux go build .
```

# Troubleshooting

## Receiving ```dial tcp: lookup proxy.golang.org: i/o timeout```
Try setting ```export GOPROXY=direct``` to prevent go from using a proxy.