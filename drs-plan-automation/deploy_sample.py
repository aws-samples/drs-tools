#!/usr/bin/env python3
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import click
import logging
import helper
import shutil
import subprocess

log_level = os.getenv("LOGLEVEL", "INFO")
level = logging.getLevelName(log_level)

logger = logging.getLogger("deploy")
logger.setLevel(level)

ch = logging.StreamHandler()
ch.setLevel(logging.INFO)

formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
ch.setFormatter(formatter)

logger.addHandler(ch)

aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID", False)
aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY", False)
aws_session_token = os.getenv("AWS_SESSION_TOKEN", False)

creds = {
    'AccessKeyId': aws_access_key_id,
    'SecretAccessKey': aws_secret_access_key,
    'SessionToken': aws_session_token
}

hard_stop = False

if not aws_access_key_id:
    logger.error("The environment variable \"{}\" must be set to your account credentials".format(
        "AWS_ACCESS_KEY_ID"))
    hard_stop = True
if not aws_secret_access_key:
    logger.error("The environment variable \"{}\" must be set to your account credentials".format(
        "AWS_SECRET_ACCESS_KEY"))
    hard_stop = True
if not aws_session_token:
    logger.warning("The environment variable \"{}\" is not set for your account credentials".format(
        "AWS_SESSION_TOKEN"))
    hard_stop = True

if hard_stop:
    exit(1)

solution_prefix = "drs-plan-automation"

deploy_config_file_path = os.path.join("./", 'deploy_sample.json')
previous_deploy_params = helper.read_json_file(deploy_config_file_path)

@click.command()
@click.option("--source-region", required=True, default=previous_deploy_params.get('source_region', None),
              help="The region where the sample EC2 environment should be deployed, this should be different from the DRS target DR region")
@click.option("--solution-region", required=True, default=previous_deploy_params.get('solution_region', None),
              help="The region where the plan automation solution is deployed.  This should be the same as the target DRS region")
@click.option("--prefix", required=False, default=None,
              help="The prefix to preprend in front of each stack name, eg prefix 'myco' results in stack name 'myco-drs-plan-automation-sample-drs-environment'")
@click.option("--environment", required=False, default=previous_deploy_params.get('environment', "dev"),
              help="The environment name to append to the end of each stack name, eg environment 'dev' results in stack name 'drs-plan-automation-sample-drs-environment-dev'")
@click.option('--cleanup', required=False, is_flag=True,
              help="Cleanup the deployed stacks and AWS resources.  If you deployed with the --prefix or --environment option, then you must cleanup with the same option parameters")
@click.option('--prompt', required=False, is_flag=True,
              help="Whether to prompt and require you to press enter after each stack is deployed.")
def deploy(source_region, solution_region, prefix, environment, prompt, cleanup):
    if not cleanup:
        logger.info("Writing deployment options to deploy_sample.json")
        deployment_options = {
            'source_region': source_region,
            'solution_region': solution_region,
            'prefix': prefix,
            'environment': environment
        }
        deploy_sample_config_file_path = os.path.join("./", 'deploy_sample.json')
        helper.update_json_file(deploy_sample_config_file_path, deployment_options)
    else:
        previous_deploy_params = helper.read_json_file(deploy_config_file_path)
        if previous_deploy_params:
            logger.info("Previous deployment parameters found:\n{}\n".format(previous_deploy_params))
            cleanup_response = input("Do you want to use your previous deployment parameters to cleanup? (type `yes` to proceed): ")
            if cleanup_response == "yes":
                source_region = previous_deploy_params['source_region']
                solution_region = previous_deploy_params['solution_region']
                prefix = previous_deploy_params['prefix']
                environment = previous_deploy_params['environment']

    try:
        account_number, user_id = helper.get_credential_info(creds, solution_region)
        if account_number and user_id:
            logger.info("Using environment credentials for account {} and user id: {}".format(account_number, user_id))
        else:
            logger.error("Unable to retrieve identity for set credentials, exiting...")
            exit(1)
    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure getting account number: {}'.format(e))
        raise

    sample_ssm_automation_opsitem_stack_name = helper.get_name(solution_prefix, "sample-ssm-automation-opsitem", prefix,
                                                               environment)
    sample_ssm_automation_opsitem_stack_template = "ssm/createopsitem.yaml"

    sample_environment_stack_name = helper.get_name(solution_prefix, "sample-drs-environment", prefix, environment)
    sample_environment_stack_template = "../samples/sample_environment/source.yaml"

    if cleanup:
        response = input(
            "Are you sure you want to delete the sample resources from account {} in solution region {} and source environment region {}? (type `yes` to proceed): ".format(
                account_number, solution_region, source_region))
        if 'yes' in response:
            logger.info("Deleting sample SSM automation documents for PreWave / PostWave actions")
            helper.cleanup_stack(sample_ssm_automation_opsitem_stack_name, creds, solution_region)
            logger.info("Deleting sample environment with VPC, subnets, and EC2 instances with DRS agent installed.")
            helper.cleanup_stack(sample_environment_stack_name, creds, source_region)
            logger.info("Deleting sample application data from DynamoDB table")
            helper.delete_item('drs-plan-automation-applications', {'AppId': '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'}, creds, solution_region)
            logger.info("Deleting sample result object from DynamoDB table")
            helper.delete_item('drs-plan-automation-results', {'AppId_PlanId': '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6a', 'ExecutionId': 'arn:aws:states:us-west-2:123456789012:execution:DRSPlanAutomationStateMachine-CT5o7CiTLdGG:86f4e81d-e7a8-4319-9ae2-e66916006f9b'}, creds, solution_region)
        else:
            logger.info("Invalid response: {}, exiting...".format(response))
            exit(1)
        logger.info("Cleanup Completed")
        exit(0)

    logger.info(
        "\nOptions:\nPrefix: {}\nEnvironment Specified: {}\nPrompted Deployment: {}\n".format(
            prefix,
            environment,
            prompt
        )
    )

    input("Press enter to proceed with deployment to account: {}\nSample Source Environment Region: {}\nSolution Region: {}\n: ".format(
        account_number, source_region, solution_region))

    logger.info("Deploying sample SSM automation documents for PreWave / PostWave actions")
    helper.process_stack(prompt, sample_ssm_automation_opsitem_stack_name, sample_ssm_automation_opsitem_stack_template,
                         None, creds, solution_region)
    logger.info("Deploying sample environment with VPC, subnets, and EC2 instances with DRS agent installed.")
    helper.process_stack(prompt, sample_environment_stack_name, sample_environment_stack_template, None, creds, source_region)
    account_record = {
        'AccountId': account_number,
        'Region': solution_region
    }

    logger.info("Inserting sample application data into DynamoDB table")

    file_path = os.path.join("./", 'samples/sample_data/sample_application.json')
    helper.update_json_file(file_path, account_record)

    helper.put_item_file('drs-plan-automation-applications-{}'.format(environment), 'samples/sample_data/sample_application.json', creds, solution_region)
    logger.info("Inserting sample result object into DynamoDB table")
    helper.put_item_file('drs-plan-automation-results-{}'.format(environment), 'samples/sample_data/sample_result.json', creds, solution_region)
    logger.info("Inserting solution account object into DynamoDB table")
    helper.ddb_put_item(creds,account_record,solution_region, 'drs-plan-automation-accounts-{}'.format(environment))


    logger.info(
        "Sample Deployment Completed.\n"
        "The source environment EC2 instances will take approximately 20 minutes to complete their initial synch to DRS before they are ready to be used in a drill / recovery.  You may need to stop / restart the instances in order to initiate the initial synch.\n"        
        "NOTE:  The links in the plan results will not work since the result wasn't actually produced in your environment.  Run a  drill / failover in your environment to produce a real, actual result.\n")
if __name__ == "__main__":
    deploy()
