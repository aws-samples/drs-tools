#!/usr/bin/env python3
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import json
import logging

log_level = os.getenv("LOGLEVEL", "INFO")
level = logging.getLevelName(log_level)

logger = logging.getLogger("deploy")
logger.setLevel(level)

ch = logging.StreamHandler()
ch.setLevel(logging.INFO)

formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
ch.setFormatter(formatter)

logger.addHandler(ch)

src_dir = os.getenv("CODEBUILD_SRC_DIR")

auth_stack_outputs_filename = "cognito.json"
auth_stack_outputs_file = os.path.join(os.getenv("CODEBUILD_SRC_DIR_DeployDRSPlanAuth"), auth_stack_outputs_filename)

distribution_stack_outputs_filename = "distribution.json"
distribution_stack_outputs_file = os.path.join(os.getenv("CODEBUILD_SRC_DIR_DeployDRSPlanDistribution"), distribution_stack_outputs_filename)

apigateway_stack_outputs_filename = "apigateway.json"
apigateway_stack_outputs_file = os.path.join(os.getenv("CODEBUILD_SRC_DIR_DeployDRSPlanAPI"), apigateway_stack_outputs_filename)

with open(apigateway_stack_outputs_file, 'r') as apigateway_stack_outputs_doc:
    apigateway_stack_outputs_string = apigateway_stack_outputs_doc.read()
    logger.info("API Gateway outputs are: {}".format(apigateway_stack_outputs_string))
apigateway_output_dict = json.loads(apigateway_stack_outputs_string)

with open(distribution_stack_outputs_file, 'r') as distribution_stack_outputs_doc:
    distribution_stack_outputs_string = distribution_stack_outputs_doc.read()
    logger.info("Distribution outputs are: {}".format(distribution_stack_outputs_string))
distribution_output_dict = json.loads(distribution_stack_outputs_string)

cognito_output_key_mappings_filename = "cfn/codebuild/BuildAndDeployFrontEnd/cognito_output_key_mappings.json"
cognito_output_key_mappings_file = os.path.join(src_dir, cognito_output_key_mappings_filename)
auth_stack_outputs_string = None
with open(cognito_output_key_mappings_file, 'r') as cognito_output_key_mappings_doc:
    cognito_output_key_mappings_string = cognito_output_key_mappings_doc.read()
    logger.info("Output to key mappings file contents are: {}".format(cognito_output_key_mappings_string))
cognito_output_key_mappings_dict = json.loads(cognito_output_key_mappings_string)

with open(auth_stack_outputs_file, 'r') as auth_stack_outputs_doc:
    auth_stack_outputs_string = auth_stack_outputs_doc.read()
    logger.info("Auth Stack Outputs file contents are: {}".format(auth_stack_outputs_string))
auth_stack_outputs_dict = json.loads(auth_stack_outputs_string)

auth_config = 'fe/src/aws-exports.js'
auth_file_config_path = os.path.join(src_dir, auth_config)
auth_doc_string = None
with open(auth_file_config_path, 'r') as param_read_doc:
    auth_doc_string = param_read_doc.read()
    logger.info("Auth Config parameter file contents are: {}".format(auth_doc_string))
auth_declaration_string = "const awsmobile ="
auth_export_string = "export default awsmobile;"

auth_config_object = auth_doc_string.replace(auth_declaration_string, "")
auth_config_object = auth_config_object.replace(auth_export_string, "")
auth_config_object = auth_config_object.replace(';', "")

logger.info("cleaned auth config object is: {}".format(auth_config_object))
auth_config_dict = json.loads(auth_config_object)

auth_config_dict['aws_cognito_region'] = os.getenv("AWS_DEFAULT_REGION")
auth_config_dict['aws_project_region'] = os.getenv("AWS_DEFAULT_REGION")

logger.info("Updating cognito settings")
for key in cognito_output_key_mappings_dict.keys():
    if key in auth_stack_outputs_dict:
        auth_config_key = cognito_output_key_mappings_dict[key]
        auth_config_value = auth_stack_outputs_dict[key]
        if auth_config_key in auth_config_dict:
            logger.info("Setting {} to {} in aws-exports.js".format(auth_config_key, auth_config_value))
            auth_config_dict[auth_config_key] = auth_config_value
        else:
            logger.error("Key {} not found in auth config".format(auth_config_key))
    else:
        logger.error("Key {} not found in outputs".format(key))

logger.info("Updating API endpoints")
if 'aws_cloud_logic_custom' in auth_config_dict:
    for idx, function in enumerate(auth_config_dict['aws_cloud_logic_custom']):
        for outputkey in apigateway_output_dict:
            if outputkey == function['name']:
                auth_config_dict['aws_cloud_logic_custom'][idx]['endpoint'] = apigateway_output_dict[outputkey]
                auth_config_dict['aws_cloud_logic_custom'][idx]['region'] = os.getenv("AWS_DEFAULT_REGION")


updated_auth_config = auth_declaration_string
updated_auth_config += '\n{};'.format(json.dumps(auth_config_dict))
updated_auth_config += '\n{}'.format(auth_export_string)
logger.info("updated auth config js file is: {}".format(updated_auth_config))

with open(auth_file_config_path, 'w') as write_js_auth_config_file:
    write_js_auth_config_file.write(updated_auth_config)

logger.info("Wrote file {} with content: {}".format(auth_file_config_path, updated_auth_config))


gui_dir = os.path.join(src_dir, "fe")
os.chdir(gui_dir)

npm_install_stream = os.popen('npm install')
output = npm_install_stream.read()
logger.info("npm install returned:\n{}".format(output))

npm_build_stream = os.popen('npm run build')
output = npm_build_stream.read()
logger.info("npm build returned:\n{}".format(output))

distribution_s3_bucket_name = distribution_output_dict.get("DRSDistributionS3BucketName", None)

if distribution_s3_bucket_name:
    # # gui_build_dir = os.path.join(src_dir, "fe/build")
    # os.chdir(gui_build_dir)

    logger.info("Synchronizing to S3 bucket: {}".format(distribution_s3_bucket_name))
    s3_sync_stream = os.popen('aws s3 sync . s3://{}/live --delete'.format(distribution_s3_bucket_name))
    output = s3_sync_stream.read()
    logger.info("S3 sync returned:\n{}".format(output))
