# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json

import boto3
from botocore.exceptions import ClientError, WaiterError
from botocore.config import Config
import logging
import os
import zipfile

log_level = os.getenv("LOGLEVEL", "INFO")
level = logging.getLevelName(log_level)

logger = logging.getLogger("helper")
logger.setLevel(level)

ch = logging.StreamHandler()
ch.setLevel(logging.INFO)

formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
ch.setFormatter(formatter)

logger.addHandler(ch)

CFN_FILE_DIR = "./cfn"


def get_credential_info(creds, region):
    try:
        sts_client = boto3_client('sts', creds)
        response = sts_client.get_caller_identity()
        if 'Account' in response and 'UserId' in response:
            return response['Account'], response['UserId']
        else:
            return None

    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure getting credentials: {}'.format(e))
        raise


def get_name(solution_prefix, name, prefix=None, environment=None):
    stack_name = "{}-{}".format(solution_prefix, name)
    if prefix:
        stack_name = "{}-{}".format(prefix, stack_name)
    if environment:
        stack_name += environment
    return stack_name


def process_stack(prompt, stack_name, template, params, creds, region):
    if prompt:
        default_prompt()

    if does_stack_exist(stack_name, creds, region):
        logger.info("Stack {} exists, skipping".format(stack_name))
    else:
        logger.info("Deploying {}".format(stack_name))
        if prompt:
            default_prompt()
        deploy_cfn(stack_name, template, params, None, creds, region)


def default_prompt():
    input("Press enter to proceed")


def deploy_cfn(name, cfn, params, tags, creds, region):
    try:
        cfn_file_path = os.path.join(CFN_FILE_DIR, cfn)
        logger.debug("cfn file path is: ".format(cfn_file_path))
        cfn_file_path = os.path.join(CFN_FILE_DIR, cfn)
        with open(cfn_file_path, 'r') as cfn_file:
            cfn_contents = cfn_file.read()
            # logger.info("cfn content is: {}".format(cfn_contents))
            stack_name = name
            create_stack(stack_name, cfn_contents, params, tags, creds, region)
            return stack_name
    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure deploying cloudformation: {} for {}: {}'.format(cfn, name, e))
        raise


def put_item_file(table, file, assumed_credentials, region):
    try:
        with open(file, 'r') as json_doc:
            json_doc_string = json_doc.read()
            logger.debug("JSON file contents are: {}".format(json_doc_string))
            json_doc_object = json.loads(json_doc_string)
            logger.debug("Loaded JSON from file: {}".format(json_doc_object))

    except Exception as e:
        logger.error('Failure opening file {} and reading json object: {}'.format(file, e))
        raise

    ddb_put_item(assumed_credentials, json_doc_object, region, table)


def ddb_put_item(assumed_credentials, json_doc_object, region, table):
    try:
        dynamodb = boto3_resource('dynamodb', assumed_credentials, region)
        dynamodb_table = dynamodb.Table(table)
        dynamodb_table.put_item(
            Item=json_doc_object
        )
        logger.info("inserted sample application item into DynamoDB table: {}".format(table))
    except Exception as e:
        logger.error('Failure putting object {} into table {}: {}'.format(json_doc_object, table, e))
        raise


def delete_item(table, item_key, assumed_credentials, region):
    try:
        dynamodb = boto3_resource('dynamodb', assumed_credentials, region)
        dynamodb_table = dynamodb.Table(table)
        dynamodb_table.delete_item(
            Key=item_key
        )
        logger.info("Deleted sample application item from DynamoDB table: {}".format(table))
    except Exception as e:
        logger.error('Failure deleting object with key {} in table {}: {}'.format(item_key, table, e))
        raise


def create_stack(stack, template, parameters, tags, assumed_credentials, region):
    """Starts a new CloudFormation stack creation

    Args:
        stack: The stack to be created
        template: The template for the stack to be created with
        parameter: The parameters for the stack to be created with
        assumed_credentials:

    Throws:
        Exception: Any exception thrown by .create_stack()
    """
    try:
        cf = boto3_client('cloudformation', assumed_credentials, region)
        logger.info('initiating call to create stack')
        kwargs = {
            'StackName': stack,
            'TemplateBody': template,
            'Capabilities': ['CAPABILITY_NAMED_IAM'],
            'OnFailure': 'DELETE'
        }
        if parameters:
            kwargs['Parameters'] = parameters

        if tags:
            kwargs['Tags'] = tags

        result = cf.create_stack(**kwargs)

        if 'StackId' in result:
            logger.info(
                "Stack creation initiated: https://{}.console.aws.amazon.com/cloudformation/home?region={}#/stacks/stackinfo?stackId={}".format(
                    region, region, result['StackId']))
        logger.debug('completed call to create stack: {}'.format(result))

    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure creating stack {}: {}'.format(stack, e))
        raise

    try:
        waiter = cf.get_waiter('stack_create_complete')
        logger.info("Waiting for {} to complete".format(stack))
        waiter.wait(
            StackName=stack,
            WaiterConfig={
                'Delay': 10,
                'MaxAttempts': 60
            }
        )

    except WaiterError as e:
        logger.error('Failure creating stack {}: {}\nCheck the AWS console for details.  Exiting...'.format(stack, e))
        exit(1)


def delete_stack(stack, assumed_credentials, region):
    """Starts a new CloudFormation stack creation

    Args:
        stack: The stack to be deleted
        assumed_credentials:

    Throws:
        Exception: Any exception thrown by .delete_stack()
    """
    try:
        cf = boto3_client('cloudformation', assumed_credentials, region)
        logger.info(
            'initiating call to delete stack, https://{}.console.aws.amazon.com/cloudformation/home?region={}#/stacks/stackinfo?stackId={}'.format(
                region, region, stack
            )
        )
        kwargs = {
            'StackName': stack,
        }
        result = cf.delete_stack(**kwargs)
        logger.debug('completed call to delete stack: {}'.format(result))

    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure deleting stack {}: {}'.format(stack, e))
        raise

    try:
        waiter = cf.get_waiter('stack_delete_complete')
        logger.info("Waiting for {} to complete deletion".format(stack))
        waiter.wait(
            StackName=stack,
            WaiterConfig={
                'Delay': 10,
                'MaxAttempts': 60
            }
        )
    except WaiterError as e:
        logger.error('Failure deleting stack {}: {}\nCheck the AWS console for details.  Exiting...'.format(stack, e))
        exit(1)


def zipdir(path, zip_name):
    zipf = zipfile.ZipFile('{}.zip'.format(zip_name), 'w', zipfile.ZIP_DEFLATED)
    # ziph is zipfile handle
    for dirname, subdirs, files in os.walk(path):
        logger.info("zipping {}".format(dirname))
        if '.git' in subdirs:
            subdirs.remove('.git')
        if '.idea' in subdirs:
            subdirs.remove('.idea')
        if '__pycache__' in subdirs:
            subdirs.remove('__pycache__')
        if '.cache' in subdirs:
            subdirs.remove('.cache')
        if 'node_modules' in subdirs:
            subdirs.remove('node_modules')

        # logger.info(subdirs)
        zipf.write(dirname)
        if '{}.zip'.format(zip_name) in files:
            logger.warning("Zip {}.zip exists in {}, removing from archive".format(zip_name, dirname))
            files.remove('{}.zip'.format(zip_name))
        for filename in files:
            logger.debug(filename)
            zipf.write(os.path.join(dirname, filename))
    zipf.close()


def replace_cfn_params(content, substitutions):
    for key, value in substitutions.items():
        content = content.replace(key, value)

    logger.debug("updated params is: {}".format(content))
    return content


def boto3_client(resource, assumed_credentials=None, region=None):
    try:
        if region:
            config = Config(
                retries=dict(
                    max_attempts=40
                ),
                region_name=region
            )
        else:
            config = Config(
                retries=dict(
                    max_attempts=40
                )
            )

        if assumed_credentials:
            client = boto3.client(
                resource,
                aws_access_key_id=assumed_credentials['AccessKeyId'],
                aws_secret_access_key=assumed_credentials['SecretAccessKey'],
                aws_session_token=assumed_credentials['SessionToken'],
                config=config
            )
        else:
            client = boto3.client(
                resource,
                config=config
            )
        return client
    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure getting client: {}'.format(e))
        raise


def boto3_resource(resource, assumed_credentials=None, region=None):
    try:

        if region:
            config = Config(
                retries=dict(
                    max_attempts=40
                ),
                region_name=region
            )
        else:
            config = Config(
                retries=dict(
                    max_attempts=40
                )
            )

        if assumed_credentials:
            client = boto3.resource(
                resource,
                aws_access_key_id=assumed_credentials['AccessKeyId'],
                aws_secret_access_key=assumed_credentials['SecretAccessKey'],
                aws_session_token=assumed_credentials['SessionToken'],
                config=config
            )
        else:
            client = boto3.client(
                resource,
                config=config
            )

        return client
    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure getting client: {}'.format(e))
        raise


def s3_upload_file(file, bucket, key, creds, region):
    s3 = boto3_resource('s3', creds)
    s3.meta.client.upload_file(file, bucket, key)


def empty_s3_bucket(bucket, creds, region):
    try:
        s3 = boto3_resource('s3', creds, region)
        bucket = s3.Bucket(bucket)
        response = bucket.object_versions.all().delete()
        if len(response):
            for item in response:
                if 'Deleted' in item:
                    logger.info("deleted {} object versions in bucket {}".format(len(item['Deleted']), bucket))
    except Exception as e:
        if 'NoSuchBucket' in str(e):
            logger.info("Bucket {} doesn't exist, skipping".format(bucket))
            return False
        # If any other exceptions which we didn't expect are raised
        # then fail and log the exception message.
        logger.error('Failure emptying bucket {}: {}'.format(bucket, e))
        raise


def get_vpc_cidr(vpcid, assumed_credentials):
    try:
        client = boto3_client('ec2', assumed_credentials)

        response = client.describe_vpcs(
            VpcIds=[vpcid]
        )

        if 'Vpcs' in response and len(response['Vpcs']) > 0:
            return response['Vpcs'][0]['CidrBlock']
        else:
            return False
    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure getting vpc info {}: {}'.format(vpcid, e))
        raise


def get_stack_output(stack, output_key, assumed_credentials, region):
    try:
        cf = boto3_client('cloudformation', assumed_credentials, region)

        response = cf.describe_stacks(
            StackName=stack
        )

    except ClientError as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        if str(e).find("does not exist"):
            logger.debug('Stack {} does not exist..'.format(stack))
            return False

    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure getting stack {}: {}'.format(stack, e))
        raise

    for i in response['Stacks']:
        for j in i['Outputs']:
            if j['OutputKey'] == output_key:
                return j['OutputValue']
    else:
        return False


def does_stack_exist(stack, assumed_credentials=None, region=None):
    try:
        cf = boto3_client('cloudformation', assumed_credentials, region)

        response = cf.describe_stacks(
            StackName=stack
        )

        if response and 'Stacks' in response:
            return response['Stacks'][0]['StackId']
        else:
            return False
    except ClientError as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        if str(e).find("does not exist"):
            logger.debug('Stack does not exist..')
            return False


def get_stack_export(stack, export_name, assumed_credentials, region):
    try:
        cf = boto3_client('cloudformation', assumed_credentials, region)

        response = cf.describe_stacks(
            StackName=stack
        )
    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure getting stack {}: {}'.format(stack, e))
        return False

    for i in response['Stacks']:
        for j in i['Outputs']:
            if j['ExportName'] == export_name:
                logger.info("Found export {}, value: {}".format(export_name, j['OutputValue']))
                return j['OutputValue']

    return False


def update_parameter_file(filename, json_params):
    file_path = os.path.join(CFN_FILE_DIR, filename)
    param_doc_string = None
    with open(file_path, 'r') as param_read_doc:
        param_doc_string = param_read_doc.read()
        logger.debug("Parameter file contents are: {}".format(param_doc_string))

    param_doc_json = {}
    if param_doc_string:
        param_doc_json = json.loads(param_doc_string)

    logger.info("Loaded JSON from file: {}".format(param_doc_json))

    with open(file_path, 'w') as param_write_doc:
        for key in json_params.keys():
            param_doc_json['Parameters'][key] = json_params[key]
        param_write_doc.write(json.dumps(param_doc_json))
        logger.info("Wrote file {} with json: {}".format(filename, param_doc_json))


def update_json_file(filename, json_params):
    with open(filename, 'r') as param_read_doc:
        param_doc_string = param_read_doc.read()
        logger.debug("Parameter file contents are: {}".format(param_doc_string))

    param_doc_json = {}
    if param_doc_string:
        param_doc_json = json.loads(param_doc_string)

    logger.info("Loaded JSON from file: {}".format(param_doc_json))

    with open(filename, 'w') as param_write_doc:
        for key in json_params.keys():
            param_doc_json[key] = json_params[key]
        param_write_doc.write(json.dumps(param_doc_json))
        logger.info("Wrote file {} with json: {}".format(filename, param_doc_json))


def create_document(name, file, tags, assumed_credentials):
    try:
        ssm = boto3_client('ssm', assumed_credentials)
        with open(file, 'r') as ssm_doc:
            ssm_doc_string = ssm_doc.read()
            logger.debug("SSM Doc contents are: {}".format(ssm_doc_string))

            response = ssm.create_document(
                Content=ssm_doc_string,
                # Requires=[
                #     {
                #         'Name': 'string',
                #         'Version': 'string'
                #     },
                # ],
                # Attachments=[
                #     {
                #         'Key': 'SourceUrl'|'S3FileUrl'|'AttachmentReference',
                #         'Values': [
                #             'string',
                #         ],
                #         'Name': 'string'
                #     },
                # ],
                Name=name,
                # VersionName='string',
                DocumentType='Automation',
                DocumentFormat='YAML',
                # TargetType='string',
                # Tags=[
                #     {
                #         'Key': 'string',
                #         'Value': 'string'
                #     },
                # ]
            )
    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure creating document {}: {}'.format(name, e))
        raise


def cleanup_stack(stack_name, creds, region):
    stack_id = does_stack_exist(stack_name, creds, region)
    if stack_id:
        logger.info("Deleting Stack: {}".format(stack_id))
        delete_stack(stack_id, creds, region)
    else:
        logger.info("Stack {} doesn't exist, skipping".format(stack_name))
