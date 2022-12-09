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


@click.command()
@click.option("--allowed-cidrs", required=False, default="",
              help="The allowed IP address CIDRs that have access to the cloudfront hosted front end interface.  Login is still required even if you have network access. Specify 0.0.0.0/0 to allow all ip addresses with access to front end user interface.")
@click.option("--user-email", required=True, default=None,
              help="The email address for the cognito user for the solution.  A new temporary password will be sent to this user to login to the solution")
@click.option("--solution-region", required=True, default=None,
              help="The region where the plan automation solution should be deployed.  This should be the same as the target DRS region")
@click.option("--prefix", required=False, default=None,
              help="The prefix to preprend in front of each stack name, eg prefix 'myco' results in stack name 'myco-drs-configuration-synchronizer-lambda'")
@click.option("--environment", required=False, default=None,
              help="The environment name to append to the end of each stack name, eg environment 'dev' results in stack name 'drs-configuration-synchronizer-dev'")
@click.option('--cleanup', required=False, is_flag=True,
              help="Cleanup the deployed stacks and AWS resources.  If you deployed with the --prefix or --environment option, then you must cleanup with the same option parameters")
@click.option('--prompt', required=False, is_flag=True,
              help="Whether to prompt and require you to press enter after each stack is deployed.")
def deploy(allowed_cidrs, user_email, prefix, environment, prompt, cleanup, solution_region):
    region = solution_region
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

    kms_stack_name = helper.get_name(solution_prefix, "kms", prefix, environment)
    kms_stack_template = "kms/kms.yaml"

    s3_stack_name = helper.get_name(solution_prefix, "s3", prefix, environment)
    s3_stack_template = "s3/bucket.yaml"

    codecommit_stack_name = helper.get_name(solution_prefix, "codecommit", prefix, environment)
    codecommit_stack_template = "codecommit/codecommit.yaml"

    planautomation_codebuild_validatetemplates_stack_name = helper.get_name(solution_prefix,
                                                                            "codebuild-validatetemplates", prefix,
                                                                            environment)
    planautomation_codebuild_validatetemplates_stack_template = "codebuild/ValidateTemplates/validatetemplates.yaml"

    planautomation_codebuild_buildanddeploylambda_stack_name = helper.get_name(solution_prefix,
                                                                               "codebuild-buildanddeploylambda", prefix,
                                                                               environment)
    planautomation_codebuild_buildanddeploylambda_stack_template = "codebuild/BuildAndDeployLambda/buildanddeploylambda.yaml"

    planautomation_codebuild_buildanddeploylambdaapi_stack_name = helper.get_name(solution_prefix,
                                                                                  "codebuild-buildanddeploylambdaapi",
                                                                                  prefix, environment)
    planautomation_codebuild_buildanddeploylambdaapi_stack_template = "codebuild/BuildAndDeployLambdaApi/buildanddeploylambda.yaml"

    planautomation_codebuild_buildanddeployfrontend_stack_name = helper.get_name(solution_prefix,
                                                                                 "codebuild-buildanddeployfrontend",
                                                                                 prefix, environment)

    planautomation_codebuild_buildanddeployfrontend_stack_template = "codebuild/BuildAndDeployFrontEnd/buildanddeployfrontend.yaml"

    planautomation_iam_cloudformationrole_stack_name = helper.get_name(solution_prefix,
                                                                       "iam-cloudformationrole")
    planautomation_iam_cloudformationrole_stack_template = "iam/cloudformationrole.yaml"

    planautomation_sns_stack_name = helper.get_name(solution_prefix, "sns-notifications")
    planautomation_sns_stack_template = "sns/notifications.yaml"

    planautomation_codepipeline_stack_name = helper.get_name(solution_prefix, "codepipeline")
    planautomation_codepipeline_stack_template = "codepipeline/codepipeline.yaml"

    planautomation_waf_stack_name = helper.get_name(solution_prefix, "distribution-waf")
    planautomation_distribution_stack_name = helper.get_name(solution_prefix, "distribution")
    planautomation_api_stack_name = helper.get_name(solution_prefix, "api")
    planautomation_auth_stack_name = helper.get_name(solution_prefix, "auth")
    planautomation_drsplangui_function_stack_name = helper.get_name(solution_prefix, "lambda-api")
    planautomation_stepfunction_stack_name = helper.get_name(solution_prefix, "lambda")
    planautomation_tables_stack_name = helper.get_name(solution_prefix, "tables")

    s3_bucket_name_export = 'drs-s3-bucket-name'
    s3_distribution_bucket_name_export = 'drs-distribution-s3-bucket-name'
    s3_distribution_logging_bucket_name_export = 'drs-distribution-s3-logging-bucket-name'

    if cleanup:
        response = input(
            "Are you sure you want to delete all solution resources from account {} in region {}? (type `yes` to proceed): ".format(
                account_number, region))
        if 'yes' in response:

            # Stacks created by codepipeline
            s3_distribution_bucket_name = helper.get_stack_export(planautomation_distribution_stack_name,
                                                                  s3_distribution_bucket_name_export, creds, region)
            logger.info("Distribution bucket is: {}".format(s3_distribution_bucket_name))
            s3_logging_bucket_name = helper.get_stack_export(planautomation_distribution_stack_name,
                                                             s3_distribution_logging_bucket_name_export, creds, region)
            logger.info("Distribution logging bucket is: {}".format(s3_logging_bucket_name))

            if s3_distribution_bucket_name:
                helper.empty_s3_bucket(s3_distribution_bucket_name, creds, region)
            if s3_logging_bucket_name:
                helper.empty_s3_bucket(s3_logging_bucket_name, creds, region)

            helper.cleanup_stack(planautomation_distribution_stack_name, creds, region)
            helper.cleanup_stack(planautomation_waf_stack_name, creds, region)
            helper.cleanup_stack(planautomation_auth_stack_name, creds, region)
            helper.cleanup_stack(planautomation_api_stack_name, creds, region)
            helper.cleanup_stack(planautomation_drsplangui_function_stack_name, creds, region)
            helper.cleanup_stack(planautomation_stepfunction_stack_name, creds, region)
            helper.cleanup_stack(planautomation_tables_stack_name, creds, region)

            # stacks created by deploy.py
            helper.cleanup_stack(planautomation_codepipeline_stack_name, creds, region)
            helper.cleanup_stack(planautomation_sns_stack_name, creds, region)
            helper.cleanup_stack(planautomation_codebuild_buildanddeploylambda_stack_name, creds, region)
            helper.cleanup_stack(planautomation_codebuild_buildanddeploylambdaapi_stack_name, creds, region)
            helper.cleanup_stack(planautomation_codebuild_validatetemplates_stack_name, creds, region)
            helper.cleanup_stack(planautomation_codebuild_buildanddeployfrontend_stack_name, creds, region)
            helper.cleanup_stack(codecommit_stack_name, creds, region)
            helper.cleanup_stack(planautomation_iam_cloudformationrole_stack_name, creds, region)

            s3_bucket_name = helper.get_stack_export(s3_stack_name, s3_bucket_name_export, creds, region)
            if s3_bucket_name:
                helper.empty_s3_bucket(s3_bucket_name, creds, region)
                helper.cleanup_stack(s3_stack_name, creds, region)

            helper.cleanup_stack(kms_stack_name, creds, region)

        else:
            logger.info("Invalid response: {}, exiting...".format(response))
            exit(1)
        logger.info("Cleanup Completed")
        exit(0)

    logger.info(
        "\nOptions:\nRegion: {}\nPrefix: {}\nEnvironment Specified: {}\nPrompted Deployment: {}\n".format(
            region,
            prefix,
            environment,
            prompt
        )
    )

    input("Press enter to proceed with deployment to account {} in region {}: ".format(
        account_number, region))

    helper.process_stack(prompt, kms_stack_name, kms_stack_template, None, creds, region)

    helper.process_stack(prompt, s3_stack_name, s3_stack_template, None, creds, region)

    helper.process_stack(prompt, planautomation_codebuild_validatetemplates_stack_name,
                         planautomation_codebuild_validatetemplates_stack_template, None, creds, region)

    helper.process_stack(prompt, planautomation_codebuild_buildanddeploylambda_stack_name,
                         planautomation_codebuild_buildanddeploylambda_stack_template, None, creds, region)

    helper.process_stack(prompt, planautomation_codebuild_buildanddeploylambdaapi_stack_name,
                         planautomation_codebuild_buildanddeploylambdaapi_stack_template, None, creds, region)

    helper.process_stack(prompt, planautomation_codebuild_buildanddeployfrontend_stack_name,
                         planautomation_codebuild_buildanddeployfrontend_stack_template, None, creds, region)

    helper.process_stack(prompt, planautomation_iam_cloudformationrole_stack_name,
                         planautomation_iam_cloudformationrole_stack_template, None, creds, region)

    helper.process_stack(prompt, planautomation_sns_stack_name,
                         planautomation_sns_stack_template, None, creds, region)

    codepipeline_params = {
        'CodePipelineStackName': planautomation_codepipeline_stack_name
    }
    helper.update_parameter_file('codepipeline/codepipeline.json', codepipeline_params)

    cognito_params = {
        'demoEmailAddress': user_email
    }
    helper.update_parameter_file('cognito/gui-auth.json', cognito_params)

    cf_params = {
        'AllowedCIDRs': allowed_cidrs
    }
    helper.update_parameter_file('cloudfront/gui-distribution.json', cf_params)

    logger.info("Zipping code for CodeCommit baseline")
    if prompt:
        helper.default_prompt()
    helper.zipdir(".", "baseline")
    # os.system('zip -r baseline.zip *')

    s3_bucket_name = helper.get_stack_export(s3_stack_name, s3_bucket_name_export, creds, region)

    if not s3_bucket_name:
        logger.error(
            "Unable to retrieve S3 bucket name from stack {}, export {}".format(s3_stack_name, s3_bucket_name_export))

    logger.info("Uploading baseline zip for CodeCommit to S3 bucket {}".format(s3_bucket_name))
    file_stats = os.stat('./baseline.zip')
    logger.info("Zip file is {} MB".format(round(file_stats.st_size / (1024 * 1024))))
    if prompt:
        helper.default_prompt()

    if prefix:
        deploy_key = '{}/baseline.zip'.format(prefix)
    else:
        deploy_key = 'baseline.zip'
    helper.s3_upload_file('./baseline.zip', s3_bucket_name, deploy_key, creds, region)

    params = [
        {
            'ParameterKey': 'S3Key',
            'ParameterValue': deploy_key
        }
    ]
    helper.process_stack(prompt, codecommit_stack_name, codecommit_stack_template, params, creds, region)

    params = [
        {
            'ParameterKey': 'CodePipelineStackName',
            'ParameterValue': planautomation_codepipeline_stack_name
        }
    ]

    helper.process_stack(prompt, planautomation_codepipeline_stack_name,
                         planautomation_codepipeline_stack_template, params, creds, region)

    logger.info("Deployment Completed\n."
                "A CodeCommit repository has been created with the solution configured based on your choices: https://{}.console.aws.amazon.com/codesuite/codecommit/repositories/drs-plan-automation/browse?region={}\n".format(region, region))

    logger.info("A CodePipeline has been created and linked to your CodeCommit repository:  https://{}.console.aws.amazon.com/codesuite/codepipeline/pipelines/drs-plan-automation/view?region={}\n".format(region, region))
    logger.info("Once CodePipeline completes execution, your solution will be ready for use.\n"
                "Your solution will be accessible from the CloudFront distribution deployed by CodePipeline.\n"
                "CloudFront Console: https://us-east-1.console.aws.amazon.com/cloudfront/v3/home?region={}#/distributions\n".format(region))


if __name__ == "__main__":
    deploy()
