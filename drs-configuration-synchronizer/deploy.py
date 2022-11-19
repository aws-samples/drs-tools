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
region = os.getenv("AWS_DEFAULT_REGION", False)

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
if not region:
    logger.warning("The environment variable \"{}\" is not set".format(
        "AWS_DEFAULT_REGION"))
    hard_stop = True

if hard_stop:
    exit(1)

solution_prefix = "drs-configuration-synchronizer"


@click.command()
@click.option("--solution-account", required=True, default=None, help="The AWS Account ID where the drs-configuration-synchronizer is deployed.")
@click.option("--prefix", required=False, default=None, help="The prefix to preprend in front of each stack name, eg prefix 'myco' results in stack name 'myco-drs-configuration-synchronizer-lambda'")
@click.option("--environment", required=False, default=None, help="The environment name to append to the end of each stack name, eg environment 'dev' results in stack name 'drs-configuration-synchronizer-dev'")
@click.option('--account-role-only', required=False, is_flag=True, help="Deploy only the IAM role assumed by the synchronizer.  You need to deploy account roles to each DRS account you want the synchronizer to update in addition to deploying the solution.")
@click.option('--cleanup', required=False, is_flag=True, help="Cleanup the deployed stacks and AWS resources.  If you deployed with the --prefix or --environment option, then you must cleanup with the same option parameters")
@click.option('--prompt', required=False, is_flag=True, help="Whether to prompt and require you to press enter after each stack is deployed.")
def deploy(prefix, environment, prompt, cleanup, account_role_only, solution_account):
    try:
        account_number, user_id = helper.get_credential_info(creds, region)
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

    iam_stack_name = helper.get_name(solution_prefix, "account-role", prefix, environment)
    iam_stack_template = "iam/drs-configuration-synchronizer-account-role.yaml"

    lambda_stack_name = helper.get_name(solution_prefix, "lambda", prefix, environment)
    lambda_stack_template = "drs-configuration-synchronizer.yaml"

    sns_stack_name = helper.get_name(solution_prefix, "sns-notifications", prefix, environment)
    sns_stack_template = "sns/drs-configuration-synchronizer-sns.yaml"

    s3_stack_name = helper.get_name(solution_prefix, "s3", prefix, environment)
    s3_stack_template = "s3/drs-configuration-synchronizer-s3.yaml"

    s3_bucket_name_export = 'drs-configuration-sychronizer-bucket-name'

    sns_topic_name_export = "drs-configuration-synchronizer-sns-topic-arn"

    if cleanup:
        response = input(
            "Are you sure you want to delete all solution resources from account {} in region {}? (type `yes` to proceed): ".format(
                account_number, region))

        if 'yes' in response:
            helper.cleanup_stack(iam_stack_name, creds, region)
            if account_role_only:
                logger.info("Cleanup Completed")
                exit(0)

            sam_cmd = shutil.which("sam")
            s3_bucket_name = helper.get_stack_export(s3_stack_name, s3_bucket_name_export, creds, region)

            if sam_cmd:
                subprocess.run(
                    [
                        sam_cmd,
                        "delete",
                        "--s3-bucket",
                        s3_bucket_name,
                        "--s3-prefix",
                        "sam-deployments",
                        "--stack-name",
                        lambda_stack_name,
                        "--no-prompts",
                        "--region",
                        os.getenv("AWS_DEFAULT_REGION")
                    ]
                )

            helper.cleanup_stack(sns_stack_name, creds, region)

            s3_bucket_name = helper.get_stack_export(s3_stack_name, s3_bucket_name_export, creds, region)
            if s3_bucket_name:
                helper.empty_s3_bucket(s3_bucket_name, creds, region)
                helper.cleanup_stack(s3_stack_name, creds, region)

        else:
            logger.info("Invalid response: {}, exiting...".format(response))
            exit(1)
        logger.info("Cleanup Completed")
        exit(0)

    logger.info(
        "\nOptions:\nPrefix: {}\nEnvironment Specified: {}\nPrompted Deployment: {}\nSolution Account: {}\n".format(
            prefix,
            environment,
            prompt,
            solution_account
        )
    )

    input("Press enter to proceed with deployment to account {} in region {}: ".format(
        account_number, region))

    params = [
        {
            'ParameterKey': 'DRAutomationAccountId',
            'ParameterValue': solution_account
        }
    ]

    helper.process_stack(prompt, iam_stack_name, iam_stack_template, params, creds, region)

    if account_role_only:
        logger.info("Deployment Completed")
        exit(0)

    helper.process_stack(prompt, sns_stack_name, sns_stack_template, None, creds, region)

    helper.process_stack(prompt, s3_stack_name, s3_stack_template, None, creds, region)

    s3_bucket_name = helper.get_stack_export(s3_stack_name, s3_bucket_name_export, creds, region)
    sns_topic_arn = helper.get_stack_export(sns_stack_name, sns_topic_name_export, creds, region)


    current_path = os.getcwd()
    drs_configuration_synchronizer_path = os.path.join(current_path, "cfn/lambda/drs-configuration-synchronizer")
    os.chdir(drs_configuration_synchronizer_path)
    sam_cmd = shutil.which("sam")

    if sam_cmd:
        subprocess.run(
            [
                sam_cmd,
                "build",
                "--template-file",
                lambda_stack_template,
                "--use-container"
            ]
        )

        subprocess.run(
            [
                sam_cmd,
                "deploy",
                # "--template-file",
                # lambda_stack_template,
                "--s3-bucket",
                s3_bucket_name,
                "--s3-prefix",
                "sam-deployments",
                "--stack-name",
                lambda_stack_name,
                "--no-disable-rollback",
                "--no-confirm-changeset",
                # "--on-failure",
                # "DELETE",
                "--capabilities",
                "CAPABILITY_NAMED_IAM",
                "--parameter-overrides",
                "ParameterKey={},ParameterValue={}".format("DRAutomationBucketName", s3_bucket_name),
                "ParameterKey={},ParameterValue={}".format("SnsTopicArn", sns_topic_arn)
            ]
        )
    #     sam_deploy_stream = os.popen('sam deploy --s3-bucket {} \
    #                                  --s3-prefix sam-deployments \
    #                                  --stack-name {} \
    #                                  --no-disable-rollback \
    #                                  --no-confirm-changeset \
    #                                  --capabilities CAPABILITY_NAMED_IAM \
    #                                  --parameter-overrides "ParameterKey={},ParameterValue={} ParameterKey={},ParameterValue={}"'.format(
    #         s3_bucket_name_export,
    #         lambda_stack_name,
    #     )
    #     output = sam_deploy_stream.read()
    #     logger.info("pip3 install returned:\n{}".format(output))
    #
    # params = [
    #     {
    #         'ParameterKey': 'DRAutomationBucketName',
    #         'ParameterValue': s3_bucket_name
    #     },
    #     {
    #         'ParameterKey': 'LambdaFunctionCodeS3Key',
    #         'ParameterValue': deploy_key
    #     },
    #     {
    #         'ParameterKey': 'SnsTopicArn',
    #         'ParameterValue': sns_topic_arn
    #     }
    # ]
    # helper.process_stack(prompt, lambda_stack_name,
    #                      lambda_stack_template, params, creds, region)
    logger.info("Deployment Completed")


if __name__ == "__main__":
    deploy()
