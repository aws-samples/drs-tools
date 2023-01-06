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
deploy_config_file_path = os.path.join("./", 'deploy.json')
previous_deploy_params = helper.read_json_file(deploy_config_file_path)

@click.command()
@click.option("--allowed-cidrs", required=False, default="",
              help="The allowed IP address CIDRs that have access to the cloudfront hosted front end interface.  Login is still required even if you have network access. Specify 0.0.0.0/0 to allow all ip addresses with access to front end user interface.")
@click.option("--user-email", required=True, default=previous_deploy_params.get('user_email', None),
              help="The email address for the cognito user for the solution.  A new temporary password will be sent to this user to login to the solution")
@click.option("--solution-region", required=True, default=previous_deploy_params.get('solution_region', None),
              help="The region where the plan automation solution should be deployed.  This should be the same as the target DRS region")
@click.option("--prefix", required=False, default=previous_deploy_params.get('prefix', None),
              help="The prefix to preprend in front of each stack name, eg prefix 'myco' results in stack name 'myco-drs-configuration-synchronizer-lambda'")
@click.option("--environment", required=True, default=previous_deploy_params.get('environment', "dev"),
              help="The initial environment name to append to the end of each stack name, eg environment 'dev' results in stack name 'drs-configuration-synchronizer-dev.  This is also the first environment in the CodePipeline'")
@click.option('--cleanup', required=False, is_flag=True,
              help="Cleanup the deployed stacks and AWS resources.  If you deployed with the --prefix or --environment option, then you must cleanup with the same option parameters")
@click.option('--prompt', required=False, is_flag=True,
              help="Whether to prompt and require you to press enter after each stack is deployed.")
def deploy(allowed_cidrs, user_email, prefix, environment, prompt, cleanup, solution_region):
    if not cleanup:
        logger.info("Writing deployment options to deploy.json")
        deployment_options = {
            'allowed_cidrs': allowed_cidrs,
            'user_email': user_email,
            'solution_region': solution_region,
            'prefix': prefix,
            'environment': environment
        }
        helper.update_json_file(deploy_config_file_path, deployment_options)

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

    planautomation_iam_cloudformationrole_stack_name = helper.get_name(solution_prefix, "iam-cloudformationrole", prefix, environment)
    planautomation_iam_cloudformationrole_stack_template = "iam/cloudformationrole.yaml"

    planautomation_iam_accountrole_stack_name = helper.get_name(solution_prefix, "iam-account-role", prefix, environment)
    planautomation_iam_accountrole_stack_template = "iam/drs-plan-automation-account-role.yaml"

    planautomation_sns_stack_name = helper.get_name(solution_prefix, "sns-notifications", prefix, environment)
    planautomation_sns_stack_template = "sns/notifications.yaml"

    planautomation_codepipeline_stack_name = helper.get_name(solution_prefix, "codepipeline", prefix, environment)
    planautomation_codepipeline_stack_template = "codepipeline/codepipeline.yaml"

    planautomation_waf_stack_name = helper.get_name(solution_prefix, "distribution-waf", prefix, environment)
    planautomation_distribution_stack_name = helper.get_name(solution_prefix, "distribution", prefix, environment)
    planautomation_api_stack_name = helper.get_name(solution_prefix, "api", prefix, environment)
    planautomation_auth_stack_name = helper.get_name(solution_prefix, "auth", prefix, environment)
    planautomation_drsplangui_function_stack_name = helper.get_name(solution_prefix, "lambda-api", prefix, environment)
    planautomation_stepfunction_stack_name = helper.get_name(solution_prefix, "lambda", prefix, environment)
    planautomation_tables_stack_name = helper.get_name(solution_prefix, "tables", prefix, environment)

    s3_bucket_name_export = 'drs-s3-bucket-name'
    s3_distribution_bucket_name_export = 'drs-distribution-s3-bucket-name-{}'.format(environment)
    s3_distribution_logging_bucket_name_export = 'drs-distribution-s3-logging-bucket-name-{}'.format(environment)

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
                logger.info("Deleting objects from {}".format(s3_distribution_bucket_name))
                helper.empty_s3_bucket(s3_distribution_bucket_name, creds, region)
            if s3_logging_bucket_name:
                logger.info("Deleting objects from {}".format(s3_logging_bucket_name))
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
            helper.cleanup_stack(planautomation_iam_accountrole_stack_name, creds, region)

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
        "\nOptions:\nAllowed CIDRs: {}\nRegion: {}\nPrefix: {}\nEnvironment Specified: {}\nPrompted Deployment: {}\n".format(
            [allowed_cidrs if allowed_cidrs else "All"][0],
            region,
            prefix,
            environment,
            prompt
        )
    )

    input("Press enter to proceed with deployment to account {} in region {}: ".format(
        account_number, region))

    default_codebuild_buildspec = os.path.join(helper.CFN_FILE_DIR, 'codebuild/BuildAndDeployFrontEnd/buildspec-buildanddeployfrontend.yml')
    env_codebuild_buildspec = os.path.join(helper.CFN_FILE_DIR, 'codebuild/BuildAndDeployFrontEnd/buildspec-buildanddeployfrontend-{}.yml'.format(environment))
    shutil.copyfile(default_codebuild_buildspec, env_codebuild_buildspec)

    default_codebuild_buildspec = os.path.join(helper.CFN_FILE_DIR, 'codebuild/BuildAndDeployLambda/buildspec-buildanddeploy.yml')
    env_codebuild_buildspec = os.path.join(helper.CFN_FILE_DIR, 'codebuild/BuildAndDeployLambda/buildspec-buildanddeploy-{}.yml'.format(environment))
    shutil.copyfile(default_codebuild_buildspec, env_codebuild_buildspec)

    default_codebuild_buildspec = os.path.join(helper.CFN_FILE_DIR, 'codebuild/BuildAndDeployLambdaApi/buildspec-buildanddeploy.yml')
    env_codebuild_buildspec = os.path.join(helper.CFN_FILE_DIR, 'codebuild/BuildAndDeployLambdaApi/buildspec-buildanddeploy-{}.yml'.format(environment))
    shutil.copyfile(default_codebuild_buildspec, env_codebuild_buildspec)


    apigw_default_param_file = os.path.join(helper.CFN_FILE_DIR, 'apigateway/drs-plan-automation-api.json')
    apigw_env_param_file =  'apigateway/drs-plan-automation-api-{}.json'.format(environment)
    apigw_env_param_file_abs = os.path.join(helper.CFN_FILE_DIR, apigw_env_param_file)
    shutil.copyfile(apigw_default_param_file, apigw_env_param_file_abs)

    apigw_params = {
        'env': environment
    }
    helper.update_parameter_file(apigw_env_param_file, apigw_params)

    cognito_default_param_file = os.path.join(helper.CFN_FILE_DIR, 'cognito/gui-auth.json')
    cognito_env_param_file =  'cognito/gui-auth-{}.json'.format(environment)
    cognito_env_param_file_abs = os.path.join(helper.CFN_FILE_DIR, cognito_env_param_file)
    shutil.copyfile(cognito_default_param_file, cognito_env_param_file_abs)

    cognito_params = {
        'demoEmailAddress': user_email,
        'env': environment
    }
    helper.update_parameter_file(cognito_env_param_file, cognito_params)

    cf_default_param_file = os.path.join(helper.CFN_FILE_DIR, 'cloudfront/gui-distribution.json')
    cf_env_param_file = 'cloudfront/gui-distribution-{}.json'.format(environment)
    cf_env_param_file_abs = os.path.join(helper.CFN_FILE_DIR, cf_env_param_file)
    shutil.copyfile(cf_default_param_file, cf_env_param_file_abs)

    cf_params = {
        'AllowedCIDRs': allowed_cidrs,
        'env': environment
    }
    helper.update_parameter_file(cf_env_param_file, cf_params)


    ddb_default_param_file = os.path.join(helper.CFN_FILE_DIR, 'dynamodb/tables.json')
    ddb_env_param_file = 'dynamodb/tables-{}.json'.format(environment)
    ddb_env_param_file_abs = os.path.join(helper.CFN_FILE_DIR, ddb_env_param_file)
    shutil.copyfile(ddb_default_param_file, ddb_env_param_file_abs)

    ddb_params = {
        'env': environment
    }
    helper.update_parameter_file(ddb_env_param_file, ddb_params)


    helper.process_stack(prompt, kms_stack_name, kms_stack_template, None, creds, region)

    helper.process_stack(prompt, s3_stack_name, s3_stack_template, None, creds, region)

    helper.process_stack(prompt, planautomation_codebuild_validatetemplates_stack_name,
                         planautomation_codebuild_validatetemplates_stack_template, None, creds, region)

    codebuild_buildanddeploylambda_params = [
        {
            'ParameterKey': 'StackName',
            'ParameterValue': planautomation_stepfunction_stack_name
        },
        {
            'ParameterKey': 'env',
            'ParameterValue': environment
        }
    ]


    helper.process_stack(prompt, planautomation_codebuild_buildanddeploylambda_stack_name,
                         planautomation_codebuild_buildanddeploylambda_stack_template, codebuild_buildanddeploylambda_params, creds, region)

    codebuild_buildanddeploylambdaapi_params = [
        {
            'ParameterKey': 'StackName',
            'ParameterValue': planautomation_drsplangui_function_stack_name
        },
        {
            'ParameterKey': 'env',
            'ParameterValue': environment
        }
    ]

    helper.process_stack(prompt, planautomation_codebuild_buildanddeploylambdaapi_stack_name,
                         planautomation_codebuild_buildanddeploylambdaapi_stack_template, codebuild_buildanddeploylambdaapi_params, creds, region)

    codebuild_buildanddeployfrontend_params = [
        {
            'ParameterKey': 'env',
            'ParameterValue': environment
        }
    ]

    helper.process_stack(prompt, planautomation_codebuild_buildanddeployfrontend_stack_name,
                         planautomation_codebuild_buildanddeployfrontend_stack_template, codebuild_buildanddeployfrontend_params, creds, region)

    helper.process_stack(prompt, planautomation_iam_cloudformationrole_stack_name,
                         planautomation_iam_cloudformationrole_stack_template, None, creds, region)

    planautomation_iam_accountrole_stack_params = [
        {
            'ParameterKey': 'SourceAccountNumber',
            'ParameterValue': account_number
        },
        {
            'ParameterKey': 'env',
            'ParameterValue': environment
        }
    ]

    helper.process_stack(prompt, planautomation_iam_accountrole_stack_name,
                         planautomation_iam_accountrole_stack_template,
                         planautomation_iam_accountrole_stack_params, creds, region)

    planautomation_sns_params = [
        {
            'ParameterKey': 'env',
            'ParameterValue': environment
        }
    ]

    helper.process_stack(prompt, planautomation_sns_stack_name,
                         planautomation_sns_stack_template, planautomation_sns_params, creds, region)

    codepipeline_params = {
        'CodePipelineStackName': planautomation_codepipeline_stack_name,
        'AuthStackName': planautomation_auth_stack_name,
        'TablesDBStackName': planautomation_tables_stack_name,
        'ApiStackName': planautomation_api_stack_name,
        'DistributionStackName': planautomation_distribution_stack_name,
        'env': environment
    }
    helper.update_parameter_file('codepipeline/codepipeline.json', codepipeline_params)


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
        },
        {
            'ParameterKey': 'AuthStackName',
            'ParameterValue': planautomation_auth_stack_name
        },
        {
            'ParameterKey': 'TablesDBStackName',
            'ParameterValue': planautomation_tables_stack_name
        },
        {
            'ParameterKey': 'ApiStackName',
            'ParameterValue': planautomation_api_stack_name
        },
        {
            'ParameterKey': 'DistributionStackName',
            'ParameterValue': planautomation_distribution_stack_name
        },
        {
            'ParameterKey': 'env',
            'ParameterValue': environment
        }
    ]


    helper.process_stack(prompt, planautomation_codepipeline_stack_name,
                         planautomation_codepipeline_stack_template, params, creds, region)

    logger.info("Deployment Completed\n."
                "A CodeCommit repository has been created with the solution configured based on your choices: https://{}.console.aws.amazon.com/codesuite/codecommit/repositories/drs-plan-automation/browse?region={}\n".format(
        region, region))

    logger.info(
        "A CodePipeline has been created and linked to your CodeCommit repository:  https://{}.console.aws.amazon.com/codesuite/codepipeline/pipelines/drs-plan-automation/view?region={}\n".format(
            region, region))
    logger.info("Once CodePipeline completes execution, your solution will be ready for use.\n"
                "Your solution will be accessible from the CloudFront distribution deployed by CodePipeline.\n"
                "CloudFront Console: https://us-east-1.console.aws.amazon.com/cloudfront/v3/home?region={}#/distributions\n".format(
        region))


if __name__ == "__main__":
    if previous_deploy_params:
        logger.info("Previous deployment parameters found:\n{}\n".format(previous_deploy_params))
        cleanup_response = input("Do you want to use your previous deployment parameters? (type `yes` to proceed): ")
        if cleanup_response == "yes":
            allowed_cidrs = previous_deploy_params['allowed_cidrs']
            user_email = previous_deploy_params['user_email']
            solution_region = previous_deploy_params['solution_region']
            prefix = previous_deploy_params['prefix']
            environment = previous_deploy_params['environment']
    deploy()
