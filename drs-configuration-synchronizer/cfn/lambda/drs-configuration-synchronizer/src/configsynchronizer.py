# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import copy
import csv
import datetime
import os
import re
import tempfile
import typing
import uuid
from ipaddress import ip_network
from logging import WARNING, Handler, LogRecord
from pathlib import Path
from typing import Optional

import boto3
import yaml
from aws_lambda_powertools import Logger
from botocore.config import Config
from botocore.exceptions import ClientError
from deepdiff import DeepDiff

logger = Logger(
    service="drs-configuration-synchronizer",
    log_record_order=["level", "message"])

CONFIGURATION_PATH = Path(__file__).parent.joinpath("configuration")
CONFIGURATION_PATH_EXCLUSIONS = "config-sync-exclusions.csv"
CONFIGURATION_PATH_EC2_LAUNCH_TEMPLATES = "ec2-launch-templates"
CONFIGURATION_PATH_DRS_LAUNCH_CONFIGURATIONS = "drs-launch-configurations"
CONFIGURATION_PATH_DRS_REPLICATION_CONFIGURATIONS = "drs-replication-configurations"
CONFIGURATION_ACCOUNT_DEFAULT_PATTERN = re.compile(r"defaults_for_account_(\d{12}).yml")
# Match DRS source servers with <TAG_KEY> and <TAG_VALUE> to their settings in override_for_tag__<TAG_KEY>__<TAG_VALUE>.yml
CONFIGURATION_OVERRIDE_PATTERN = re.compile(r"override_for_tag__([a-zA-Z0-9-]+)__([a-zA-Z0-9-]+).yml")
REPORT_S3_KEY = 'configuration-synchronizer-report.csv'

# See DRS update_launch_configuration section of boto3 SDK
# https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/drs.html#drs.Client.update_launch_configuration
LAUNCH_CONFIGURATION_KEYS = (
    'copyPrivateIp',
    'copyTags',
    'launchDisposition',
    'licensing',
    'targetInstanceTypeRightSizingMethod'
)

# See DRS update_replication_configuration section of boto3 SDK
#  https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/drs.html#drs.Client.update_replication_configuration
REPLICATION_CONFIGURATION_KEYS = (
    'associateDefaultSecurityGroup',
    'bandwidthThrottling',
    'createPublicIP',
    'dataPlaneRouting',
    'defaultLargeStagingDiskType',
    'ebsEncryption',
    'ebsEncryptionKeyArn',
    'replicationServerInstanceType',
    'replicationServersSecurityGroupsIDs',
    'stagingAreaSubnetId',
    'stagingAreaTags',
    'useDedicatedReplicationServer'
)

# See LaunchTemplateData in EC2 create_launch_template_version section of boto3 SDK
# https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ec2.html#EC2.Client.create_launch_template_version
EC2_LAUNCH_TEMPLATE_KEYS = (
    'IamInstanceProfile',
    'InstanceType',
    'Monitoring',
    'DisableApiTermination',
    'InstanceInitiatedShutdownBehavior',
    'TagSpecifications',
    'CreditSpecification',
    'CpuOptions',
    'CapacityReservationSpecification',
    'LicenseSpecifications',
    'MetadataOptions',
    'PrivateDnsNameOptions',
    'MaintenanceOptions',
    'DisableApiStop',
)

# These are dynamically processed by this lambda function, so they are disallowed in configuration files.
EC2_LAUNCH_TEMPLATE_KEYS_MANAGED = (
    'NetworkInterfaces',
    'BlockDeviceMappings'
)

EXCLUSION_ALL = 'ExcludeAll'
EXCLUSION_NETWORK_CONFIGURATION = 'ExcludeNetworkConfiguration'

EXCLUSIONS = (
    EXCLUSION_ALL,
    EXCLUSION_NETWORK_CONFIGURATION
)

execution_region = os.getenv("AWS_REGION")
logger.info("region is: {}".format(execution_region))

boto_client_config = Config(retries={"max_attempts": 10, "mode": "standard"})
sts = boto3.client("sts", config=boto_client_config)
sns = boto3.client("sns", config=boto_client_config)
s3 = boto3.resource('s3', config=boto_client_config)


class SynchronizerException(Exception):
    pass


class RunReport:

    def __init__(self):
        """
        An object to track information used in summary notification sent to users.
        """
        self.errors = []
        self.error_count = 0
        self.time_start = datetime.datetime.now(tz=datetime.timezone.utc)
        self.servers_processed = 0

    def report_error(self, log_record: str):
        """
        Record a log record for summary notification.
        """
        self.error_count += 1
        if len(self.errors) > 10:
            return
        self.errors.append(log_record)

    def increment_servers_processed(self):
        """
        Increment the number of servers processed for summary report.
        """
        self.servers_processed += 1

    def send(self):
        """
        Publish the summary report notification to sns
        """
        time_end = datetime.datetime.now(tz=datetime.timezone.utc)
        send_report(self.time_start, time_end, self.servers_processed, self.error_count, self.errors)


class InventoryReport:

    def __init__(self, local_file: typing.TextIO):
        """
        Object to track information about source servers for building CSV summary reports.
        :param local_file:
        """
        self.local_file = local_file
        self.writer = csv.DictWriter(self.local_file,
                                     ["AwsAccountId",
                                      "SourceServerId",
                                      "Hostname",
                                      "ExcludeNetworkConfiguration",
                                      "CopyPrivateIp",
                                      "SourceServerIp",
                                      "LaunchTemplateIp",
                                      "LaunchTemplateSubnet",
                                      "LaunchTemplateSecurityGroups"])
        self.writer.writeheader()
        self.server_count = 0

    def add_server(self, aws_account_id: str, source_server_id: str, hostname: str,
                   is_network_configuration_excluded: bool, copy_private_ip: bool, source_server_ip: str,
                   launch_template_ip: str, launch_template_subnet: str, launch_template_security_group: str):
        """

        :param aws_account_id: AWS Account id in which the source server resides
        :param source_server_id: DRS source server id
        :param hostname: Hostname as returned by DRS
        :param is_network_configuration_excluded: value of ExcludeNetworkConfiguration for this server
        :param copy_private_ip: Value of `copyPrivateIp` in DRS
        :param source_server_ip: IP address associated with source server
        :param launch_template_ip: IP address associated with launch template
        :param launch_template_subnet: Subnet id associated with launch template
        :param launch_template_security_group: EC2 security group associated with launch template
        :return:
        """
        self.server_count += 1
        self.writer.writerow(
            dict(
                AwsAccountId=aws_account_id,
                SourceServerId=source_server_id,
                Hostname=hostname,
                ExcludeNetworkConfiguration=is_network_configuration_excluded,
                CopyPrivateIp=copy_private_ip,
                SourceServerIp=source_server_ip,
                LaunchTemplateIp=launch_template_ip,
                LaunchTemplateSubnet=launch_template_subnet,
                LaunchTemplateSecurityGroups=launch_template_security_group
            )
        )

    def write_to_s3(self, s3):
        """
        Upload CSV report to DR automation S3 bucket.
        :param s3: Boto3 Resource object for s3
        :return:
        """
        bucket = os.environ['DR_AUTOMATION_BUCKET']
        logger.info("writing csv report with %d server(s) to s3://%s/%s", self.server_count, bucket, REPORT_S3_KEY)
        self.local_file.close()
        with open(self.local_file.name, 'rb') as file:
            s3.Object(bucket_name=bucket, key=REPORT_S3_KEY).put(
                Body=file,
                ServerSideEncryption='aws:kms',
                Metadata={
                    "Content-Type": "text/csv"
                }
            )


class ReportLoggingHandler(Handler):
    def __init__(self):
        """
        Logging handler that collects log lines for the summary report notification
        """
        super().__init__()
        self.run_report: Optional[RunReport] = None

    def set_run_report(self, run_report: RunReport):
        """
        Set the report object to record log record to
        :param run_report: Instance of a RunReport object
        """
        self.run_report = run_report

    def emit(self, record: LogRecord):
        if self.run_report:
            self.run_report.report_error(self.format(record))


# setup log handler for run reports
report_logging_handler = ReportLoggingHandler()
report_logging_handler.setFormatter(logger.registered_formatter)
report_logging_handler.setLevel(WARNING)
logger.addHandler(report_logging_handler)


def create_host_to_tag_mapping(config_file: typing.TextIO):
    """
    Ingests a CSV file and returns map of hostnames associated with desired tags.

    :param config_file: CSV file that lists hostnames in "Name" column and desired tags in remaining columns.
    :return: Dictionary of hostnames mapped to a dictionary of tag key / values
    """
    config_csv = csv.DictReader(config_file)
    mapping = {}
    for row in config_csv:
        server_name = row.pop("Name").lower()
        mapping[server_name] = {k: v for k, v in row.items() if v != ""}
    logger.info("loaded tag mapping for source servers", extra={"server_count": len(mapping)})
    return mapping


def create_server_exclusion_list(config_file: typing.TextIO):
    """
    Ingests a CSV file and creates a map of hostnames associated with feature flag toggles.
    :param config_file: CSV file with hostname in Name column, and feature toggles in remaining columns.
    :return: Dictionary with hostname and a list of exclusions set to "true"
    """
    config_csv = csv.DictReader(config_file)
    mapping = {}
    for row in config_csv:
        hostname = row.get("Name")
        if hostname is not None:
            exclusions = tuple([k for k in row if row[k] == "true" and k in EXCLUSIONS])
            mapping[hostname.lower()] = exclusions
    logger.info("loaded server exclusion list", extra={"server_count": len(mapping)})
    return mapping


def create_subnet_cidr_mapping(ec2):
    """
    Builds a mapping of CIDR masks associated with networking information.

    :param ec2: Boto3 client for ec2
    :return: Dictionary with CIDR mask and tuples of networking information (subnet, security group, vpc id)
    """
    cidr_subnet_mapping = {}
    logger.info("looking up subnet cidr information")
    subnet_paginator = ec2.get_paginator('describe_subnets')

    vpcs = {}
    vpcs_ignored = []
    tagged_subnets = subnet_paginator.paginate(Filters=[{"Name": 'tag:drstarget', "Values": ["true"]}])
    total_tagged_subnets = len(list(tagged_subnets))
    logger.info("found {} tagged subnets".format(total_tagged_subnets))
    if total_tagged_subnets < 1:
        message = "No subnets with tag drstarget and value: true found."
        logger.error(message)
        raise
    # for each VPC subnet tagged with drstarget=true
    for page in tagged_subnets:
        for subnet in page["Subnets"]:

            # find security group with a name tag that matched "<VPC>-sg"
            # where "<VPC>" is the value of Name tag of the VPC.
            if subnet['VpcId'] not in vpcs and subnet['VpcId'] not in vpcs_ignored:
                response = ec2.describe_vpcs(VpcIds=[subnet['VpcId']])
                name = [tag["Value"] for tag in response["Vpcs"][0]["Tags"] if tag["Key"] == "Name"][0]
                vpcs[subnet['VpcId']] = {}
                vpcs[subnet['VpcId']]["name"] = name

                expected_name = name + "-sg"
                try:
                    response = ec2.describe_security_groups(Filters=[
                        {"Name": "tag:Name", "Values": [expected_name]}
                    ])
                except Exception as e:
                    logger.error(e)
                # if no expected security groups are found, ignore this VPC
                if len(response["SecurityGroups"]) < 1:
                    logger.warning("VPC {} is tagged as drstarget but contains no matching sg with name: {}".format(
                        subnet['VpcId'], expected_name))
                    vpcs_ignored.append(subnet['VpcId'])
                else:
                    security_group_id = response["SecurityGroups"][0]["GroupId"]
                    vpcs[subnet['VpcId']]["security_group_id"] = security_group_id
                    logger.info(
                        "Found target vpc {} with security group: {}".format(subnet['VpcId'], security_group_id))

            if subnet['VpcId'] not in vpcs_ignored:
                cidr_subnet_mapping[subnet['CidrBlock']] = (
                    subnet['SubnetId'], [vpcs[subnet['VpcId']]["security_group_id"]], subnet['VpcId'])
            else:
                logger.warning("could not find VPC security group for subnet; ignoring subnet", extra={
                    "subnet_id": subnet['SubnetId'],
                    "subnet_cidr": subnet['CidrBlock'],
                    "vpc_id": subnet['VpcId'],
                })

    logger.info(f"found {len(cidr_subnet_mapping)} subnets with tag drstarget=true, properties: {cidr_subnet_mapping}",
                extra=dict(mapping=cidr_subnet_mapping))
    return cidr_subnet_mapping


def get_vpc_info_from_ip_address(cidr_to_subnet_map, ip_address: str):
    """
    Tries to find a subnet with a CIDR block matching `ip_address`.

    :param cidr_to_subnet_map: Dict as returned by `create_subnet_cidr_mapping`
    :param ip_address:
    :return: Tuple of (cidr, subnet id, security group ids, vpc id) or (None, None, None, None) if not subnet is matched
    """
    ip_address_net = ip_network(ip_address)
    for cidr in cidr_to_subnet_map:
        if ip_network(cidr).overlaps(ip_address_net):
            return cidr, *cidr_to_subnet_map[cidr]
    return None, None, None, None


def read_yaml_configuration_file(filename: typing.Union[str, Path]):
    """
    Parse a yaml file and return an object
    :param filename: Path to yaml file
    :return: object
    """
    with open(filename, 'rb') as file:
        return yaml.safe_load(file)


def synchronize_all():
    """
    Synchronize source servers for all AWS accounts found "dr-accounts.yml"
    """
    logger.info("loading host to tag mapping")

    with open(CONFIGURATION_PATH.joinpath("server-tag-mapping.csv")) as file:
        tag_mapping = create_host_to_tag_mapping(file)

    logger.info("loading list of excluded servers")
    with open(CONFIGURATION_PATH.joinpath(CONFIGURATION_PATH_EXCLUSIONS)) as file:
        features = FeaturesConfiguration(exclusions=create_server_exclusion_list(file))

    unique_id = str(uuid.uuid1())
    run_report = RunReport()
    report_logging_handler.set_run_report(run_report)
    inventory_report_file = tempfile.NamedTemporaryFile('w', newline='', encoding="utf-8", delete=False)
    inventory_report = InventoryReport(inventory_report_file)

    # For each account, perform synchronization of all source servers not in excluded_servers
    for account in read_yaml_configuration_file(CONFIGURATION_PATH.joinpath("dr-accounts.yml")):
        logger.append_keys(account=account["account_id"])
        logger.info("synchronizing account")
        try:
            synchronize_account(account["account_id"], tag_mapping, features, unique_id, run_report, inventory_report)
            logger.info("finished synchronizing account")
        except Exception as e:
            logger.error("Exception synchronizing account: {}".format(e))
            log_error("errors while synchronizing account: %s", e)
        finally:
            logger.remove_keys(["account", "server", "host"])

    run_report.send()
    inventory_report.write_to_s3(s3)
    Path(inventory_report_file.name).unlink(missing_ok=True)


def send_report(start_time: datetime, end_time: datetime, servers_processed: int,
                error_count: int, errors: typing.Iterable[str]):
    """
    Send a report
    :param start_time: Time at which the synchronizer lambda started
    :param end_time: Time at which the synchronizer finished processing all AWS accounts
    :param servers_processed: Total number of source servers process
    :param error_count: Number of errors/warnings encountered during processing
    :param errors: Iterable of error strings
    """
    sns_topic = os.environ["DR_CONFIGURATION_SYNCHRONIZER_TOPIC_ARN"]

    duration = end_time - start_time
    hours, rem = divmod(duration.seconds, 3600)
    minutes, seconds = divmod(rem, 60)

    lines = [
        "Time synchronizer started: " + start_time.strftime('%Y-%m-%d %H:%M:%S %Z'),
        "Time synchronizer finished: " + end_time.strftime('%Y-%m-%d %H:%M:%S %Z'),
        f"Duration: {hours:02}:{minutes:02}:{seconds:02}",
        f"Servers processed: {servers_processed}",
        "",
        ""
    ]

    message = "\n".join(lines)

    if len(errors) > 0:
        message += "First %d, of %d total error(s)/warnings(s):" % (min(error_count, 10), error_count)
        for i, error in enumerate(errors):
            message += f"\n\n{(i + 1):02}. {error}"
    else:
        message += "No errors/warnings reported"

    sns.publish(TopicArn=sns_topic, Message=message, Subject="DR configuration synchronizer summary")


def log_error(message: str, exception: Exception):
    """
    Log exception as "error" to logger, include aws_request_id if possible.

    :param message: Log message
    :param exception: Exception object
    """
    extra = {}
    if hasattr(exception, 'response'):
        try:
            extra["aws_request_id"] = exception.response["ResponseMetadata"]["RequestId"]
        except (AttributeError, TypeError, KeyError):
            pass
    logger.error(message, exception, exc_info=exception, extra=extra)


class FeaturesConfiguration:
    def __init__(self, exclusions):
        """
        Object that returns feature toggle/exclusion information for source servers.
        :param exclusions: dict as returned by create_server_exclusion_list
        """
        self.exclusions = exclusions

    def is_excluded(self, hostname: str):
        """
        :param hostname: Hostname of source server returned by DRS
        :return: Return True if this server has EXCLUSION_ALL=true
        """
        return EXCLUSION_ALL in self.exclusions.get(hostname.lower(), tuple())

    def is_network_configuration_excluded(self, hostname: str):
        """
        :param hostname: Hostname of source server returned by DRS
        :return: True if EXCLUSION_NETWORK_CONFIGURATION=True
        """
        host_exclusions = self.exclusions.get(hostname.lower(), tuple())
        return EXCLUSION_ALL in host_exclusions or EXCLUSION_NETWORK_CONFIGURATION in host_exclusions


def synchronize_account(account_id: str, tag_mapping, features: FeaturesConfiguration, unique_id,
                        report: RunReport, inventory_report: InventoryReport):
    """
    Synchronize configuration for all source servers in a give AWS account

    :param account_id: AWS account id to process.
    :param tag_mapping: dict as returned by create_host_to_tag_mapping
    :param features: Instance of FeaturesConfiguration object
    :param unique_id: uuid representing a single invocation of DRS synchronizer
    :param report: instance of RunReport
    :param inventory_report: instance of InventoryReport
    :return:
    """
    role_name = os.environ["DR_CONFIGURATION_SYNCHRONIZER_ROLE_NAME"]
    role_arn = f"arn:aws:iam::{account_id}:role/{role_name}"
    logger.info("assuming role in account", extra=dict(role_arn=role_arn))
    assumed_role_object = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="DRConfigurationSynchronizer"
    )
    credentials = assumed_role_object['Credentials']

    ec2 = boto3.client(
        'ec2',
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
        config=boto_client_config
    )

    drs = boto3.client(
        'drs',
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
        config=boto_client_config
    )
    subnet_cidr_mapping = create_subnet_cidr_mapping(ec2)

    sync = ConfigurationSynchronizer(ec2, drs, features, unique_id, account_id=account_id,
                                     cidr_subnet_mapping=subnet_cidr_mapping,
                                     server_tag_mapping=tag_mapping,
                                     ec2_launch_template_configurations=FileConfiguration(
                                         CONFIGURATION_PATH.joinpath(CONFIGURATION_PATH_EC2_LAUNCH_TEMPLATES)),
                                     drs_launch_configurations=FileConfiguration(
                                         CONFIGURATION_PATH.joinpath(CONFIGURATION_PATH_DRS_LAUNCH_CONFIGURATIONS)),
                                     drs_replication_configurations=FileConfiguration(
                                         CONFIGURATION_PATH.joinpath(CONFIGURATION_PATH_DRS_REPLICATION_CONFIGURATIONS))
                                     )
    logger.info("retrieving list of source servers")
    source_server_paginator = drs.get_paginator("describe_source_servers")
    # for every DRS source server, attempt to synchronize configuration
    for page in source_server_paginator.paginate(filters={}):
        for server in page["items"]:
            report.increment_servers_processed()
            source_server_id = server["sourceServerID"]
            logger.append_keys(server=source_server_id)
            launch_configuration = drs.get_launch_configuration(sourceServerID=source_server_id)
            del launch_configuration["ResponseMetadata"]

            server_host = server.get("sourceProperties", {}).get("identificationHints", {}).get("hostname")

            if server_host is None:
                logger.error("drs did not return hostname for server")
                continue

            # take first segment from hostname returned from DRS
            server_host = server_host.lower().split('.')[0]

            logger.append_keys(host=server_host)

            if features.is_excluded(server_host):
                logger.info(f"skipping server to due to {EXCLUSION_ALL}")
                continue

            if exclude_network_config := features.is_network_configuration_excluded(server_host):
                logger.info("will skip network configuration for this server")

            source_server_ip = None
            subnet_ids = None
            security_group_ids = None
            launch_template_ip = None
            copy_private_ip = None

            try:
                (source_server_ip, subnet_ids, security_group_ids,
                 launch_template_ip) = sync.synchronize_launch_template(
                    server, launch_configuration, exclude_network_config)
            except ClientError as e:
                log_error("service error while synchronizing launch template: %s", e)
            except SynchronizerException as e:
                log_error("error while synchronizing launch template: %s", e)

            try:
                copy_private_ip = sync.synchronize_launch_configuration(
                    server, launch_configuration, exclude_network_config)
            except ClientError as e:
                log_error("service error while synchronizing launch configuration: %s", e)
            except SynchronizerException as e:
                log_error("error while synchronizing launch configuration: %s", e)

            try:
                sync.synchronize_tags(server_host, server["arn"], server["tags"], exclude_network_config)
            except ClientError as e:
                log_error("service error while synchronizing source server tags: %s", e)
            except SynchronizerException as e:
                log_error("error while synchronizing source server tags: %s", e)

            try:
                sync.synchronize_replication_settings(server)
            except ClientError as e:
                log_error("service error while synchronizing replication configuration: %s", e)
            except SynchronizerException as e:
                log_error("error while synchronizing replication configuration: %s", e)

            inventory_report.add_server(
                aws_account_id=account_id,
                source_server_id=server["sourceServerID"],
                hostname=server_host,
                is_network_configuration_excluded=exclude_network_config,
                copy_private_ip=copy_private_ip,
                source_server_ip=source_server_ip,
                launch_template_ip=launch_template_ip,
                launch_template_subnet=subnet_ids,
                launch_template_security_group=security_group_ids
            )

            logger.remove_keys(["server", "host"])


class FileConfiguration:
    """
    An object representing one group of configurations and all possible overrides.

    Utility function, create a configurations dictionary from each override file specified in the directory
    Create a defaults dictionary for use when an override doesn't match a source server
    """

    def __init__(self, directory: Path):
        self.directory = directory
        self.defaults = read_yaml_configuration_file(self.directory.joinpath("defaults.yml"))
        self.configurations = {}
        for filename in self.directory.iterdir():
            if (match := CONFIGURATION_OVERRIDE_PATTERN.fullmatch(filename.name)) is not None:
                tag_key = match.group(1)
                tag_value = match.group(2)
                key = f"{tag_key}__{tag_value}"
                configuration = {}
                override = read_yaml_configuration_file(filename)
                for config_key in override:
                    configuration[config_key] = override[config_key]
                self.configurations[key] = configuration
            elif (match := CONFIGURATION_ACCOUNT_DEFAULT_PATTERN.fullmatch(filename.name)) is not None:
                account_id = match.group(1)
                key = f"account_{account_id}"
                configuration = {}
                override = read_yaml_configuration_file(filename)
                for config_key in override:
                    configuration[config_key] = override[config_key]
                self.configurations[key] = configuration

    def build(self, tags, account_id=None):
        """
        :param tags: dict of tag keys and values
        :param account_id: AWS account id o
        :return: Configuration object dynamically built from defaults and any tag overrides match tags in `tags`.
        """
        config = {}
        for k in self.defaults:
            config[k] = self.defaults[k]

        if account_id:
            account_key = f"account_{account_id}"
            if account_key in self.configurations:
                for k in self.configurations[account_key]:
                    config[k] = self.configurations[account_key][k]

        for tag_key in tags:
            config_key = f"{tag_key}__{tags[tag_key]}"
            if config_key not in self.configurations:
                continue
            for k in self.configurations[config_key]:
                config[k] = self.configurations[config_key][k]

        return copy.deepcopy(config)


class ConfigurationSynchronizer:
    def __init__(self, ec2, drs, features: FeaturesConfiguration, unique_id: str, account_id: str,
                 cidr_subnet_mapping,
                 server_tag_mapping,
                 ec2_launch_template_configurations: FileConfiguration,
                 drs_launch_configurations: FileConfiguration,
                 drs_replication_configurations: FileConfiguration
                 ):
        """
        Creates a synchronizer that can synchronize settings for all source servers in a single AWS account.

        Provide synchronization of launch configs, replication configs, launch templates, and tags.

        :param ec2: boto3 client for ec2
        :param drs: boto3 client for drs
        :param features: Instance of FeaturesConfiguration
        :param unique_id: UUID of current synchronizer execution
        :param account_id: AWS account id
        :param cidr_subnet_mapping: dict as returned by create_subnet_cidr_mapping
        :param server_tag_mapping: dict as returned by create_host_to_tag_mapping
        :param ec2_launch_template_configurations: Instance of FileConfiguration for ec2 template configurations
        :param drs_launch_configurations: Instance of FileConfiguration for drs launch settings
        :param drs_replication_configurations: Instance of FileConfiguration for DRS replication configurations
        """
        self.ec2 = ec2
        self.drs = drs
        self.features = features
        self.account_id = account_id
        self.unique_id = unique_id
        self.cidr_subnet_mapping = cidr_subnet_mapping
        self.server_tag_mapping = server_tag_mapping
        self.ec2_launch_template_configurations = ec2_launch_template_configurations
        self.drs_launch_configurations = drs_launch_configurations
        self.replication_configurations = drs_replication_configurations

    def synchronize_launch_template(self, info: dict, launch_configuration: dict, exclude_network_config: bool):
        """
        :param info: dict for a DRS source server as returned by "DescribeSourceServers" api call.
        :param launch_configuration: dict for a DRS source server as returned by "GetLaunchConfiguration"
        :param exclude_network_config: Boolean indicating if ExcludeNetworkConfiguration=true for this server
        :return: Tuple of (source_server_ip, subnet_id, security_group_ids, launch_template_ip)
        """
        logger.info("synchronizing launch template for source server")

        logger.info("retrieving default launch template version",
                    extra=dict(id=launch_configuration["ec2LaunchTemplateID"]))
        response = self.ec2.describe_launch_template_versions(
            LaunchTemplateId=launch_configuration["ec2LaunchTemplateID"],
            Versions=["$Default"]
        )

        version_number = response["LaunchTemplateVersions"][0]["VersionNumber"]
        logger.info(
            "default launch template version",
            extra=dict(
                id=launch_configuration["ec2LaunchTemplateID"],
                version=version_number))
        old_launch_template_data = response["LaunchTemplateVersions"][0]["LaunchTemplateData"]
        old_network_interfaces = old_launch_template_data.get("NetworkInterfaces", [])

        subnet_id = None
        launch_template_ip = None
        security_group_ids = []

        # retrieve subnet, ip, and security group from current launch template for server
        if len(old_network_interfaces) > 0:
            subnet_id = old_network_interfaces[0].get("SubnetId")
            security_group_ids = old_network_interfaces[0].get("Groups", [])
            if len(old_network_interfaces[0].get("PrivateIpAddresses", [])) > 0:
                launch_template_ip = old_network_interfaces[0]["PrivateIpAddresses"][0]["PrivateIpAddress"]

        source_server_ips = []
        # Find matching DRS account subnet for source servers IP address based on CIDR match.
        for nic in info["sourceProperties"]["networkInterfaces"]:
            for source_server_ip in nic["ips"]:
                source_server_ips.append(source_server_ip)

        if len(source_server_ips) == 0:
            raise SynchronizerException("no ip addresses found for source server")

        source_server_ip = source_server_ips[0]

        if not exclude_network_config:
            logger.info("trying to match subnet", extra=dict(ip_address=source_server_ip))
            (matched_subnet_cidr, matched_subnet_id,
             matched_security_group_ids, matched_vpc_id) = get_vpc_info_from_ip_address(
                self.cidr_subnet_mapping, source_server_ip
            )
            if matched_subnet_id:
                logger.info("subnet located", extra=dict(
                    subnet=matched_subnet_id,
                    cidr=matched_subnet_cidr,
                    security_group_ids=matched_security_group_ids,
                    vpc_id=matched_vpc_id
                ))
                subnet_id = matched_subnet_id
                security_group_ids = matched_security_group_ids
                launch_template_ip = source_server_ip
            else:
                logger.warning("cannot find a target subnet that matches ip address")
                return (source_server_ip, subnet_id, security_group_ids, launch_template_ip)

        new_network_interfaces = []

        # Retrieve NICs in launch template, set NIC0's subnet and SG to DR accounts subnet based on CIDR match.
        for index, network_interface in enumerate(old_launch_template_data.get("NetworkInterfaces", [])):
            new_nic = copy.deepcopy(network_interface)
            if index == 0:
                if not exclude_network_config:
                    new_nic["SubnetId"] = subnet_id
                    new_nic["Groups"] = security_group_ids
            new_network_interfaces.append(new_nic)

        config_desired = {}
        config_current = {}
        # Find matching override_for_tag__([a-zA-Z0-9-]+)__([a-zA-Z0-9-]+).yml files for source server
        # and load launch template overrides
        config_in_source_control = self.ec2_launch_template_configurations.build(info["tags"])

        for key in EC2_LAUNCH_TEMPLATE_KEYS:
            if key in config_in_source_control:
                config_desired[key] = config_in_source_control[key]
                if key in old_launch_template_data:
                    config_current[key] = old_launch_template_data[key]

        if len(new_network_interfaces) > 0 and not exclude_network_config:
            config_desired["NetworkInterfaces"] = new_network_interfaces
            if "NetworkInterfaces" in old_launch_template_data:
                config_current["NetworkInterfaces"] = old_launch_template_data["NetworkInterfaces"]

        diff = DeepDiff(config_current, config_desired)
        if len(diff.affected_root_keys) == 0:
            logger.info("launch template has not changed")
            return (source_server_ip, subnet_id, security_group_ids, launch_template_ip)

        logger.info("creating new launch template version", extra=dict(
            diff=diff.pretty(),
            current=config_current,
            desired=config_desired,
            update_required="true"
        ))
        # Create new launch template with overrides applied, mapped subnet based on source server IP, modified volumes
        new_launch_template = self.ec2.create_launch_template_version(
            LaunchTemplateId=launch_configuration["ec2LaunchTemplateID"],
            SourceVersion=str(version_number),
            ClientToken=self.unique_id + "/" + info["sourceServerID"],
            VersionDescription="updated by DR configuration synchronizer",
            LaunchTemplateData=config_desired
        )
        new_template_id = new_launch_template["LaunchTemplateVersion"]["LaunchTemplateId"]
        new_template_version = str(new_launch_template["LaunchTemplateVersion"]["VersionNumber"])

        logger.info("new launch template version created", extra=dict(
            id=new_template_id,
            version=new_template_version,
            aws_request_id=new_launch_template["ResponseMetadata"]["RequestId"],
            update_success="true"
        ))

        # Set default to new version
        logger.info("setting default version of launch template", extra=dict(
            id=new_template_id,
            version=new_template_version
        ))
        response = self.ec2.modify_launch_template(
            ClientToken=self.unique_id + "/" + info["sourceServerID"] + "/default",
            LaunchTemplateId=new_launch_template["LaunchTemplateVersion"]["LaunchTemplateId"],
            DefaultVersion=new_template_version
        )
        logger.info("default version of launch template updated", extra=dict(
            aws_request_id=response["ResponseMetadata"]["RequestId"],
            id=new_template_id,
            version=new_template_version,
            update_success="true"
        ))

        return (source_server_ip, subnet_id, security_group_ids, launch_template_ip)

    def synchronize_launch_configuration(self, info: dict, launch_configuration: dict,
                                         exclude_network_config: bool) -> bool:
        """
        :param info: dict for a DRS source server as returned by "DescribeSourceServers" api call.
        :param launch_configuration: dict for a DRS source server as returned by "GetLaunchConfiguration"
        :param exclude_network_config: Boolean indicating if ExcludeNetworkConfiguration=true for this server
        :return The value of copyPrivateIp as set in DRS service for this source server.
        """
        logger.info("synchronizing launch configuration for source server")

        # Retrieve default and  override launch configuration files, matched for source server tags
        config_desired = {}
        config_current = {}
        config_in_source_control = self.drs_launch_configurations.build(info["tags"])

        if exclude_network_config:
            logger.info(f"setting copyPrivateIp=false due to {EXCLUSION_NETWORK_CONFIGURATION}")
            config_in_source_control["copyPrivateIp"] = False

        for key in LAUNCH_CONFIGURATION_KEYS:
            if key in config_in_source_control:
                config_desired[key] = config_in_source_control[key]
                config_current[key] = launch_configuration[key]

        diff = DeepDiff(config_current, config_desired)

        if len(diff.affected_root_keys) == 0:
            logger.info("launch configuration has not changed")
            return launch_configuration['copyPrivateIp']

        logger.info("updating launch configuration for source server", extra=dict(
            diff=diff.pretty(),
            current=config_current,
            desired=config_desired,
            update_required="true"
        ))
        response = self.drs.update_launch_configuration(
            sourceServerID=info["sourceServerID"],
            **config_desired
        )
        logger.info("launch configuration updated", dict(
            aws_request_id=response["ResponseMetadata"]["RequestId"],
            update_success="true"
        ))

        return response['copyPrivateIp']

    def synchronize_tags(self, server_host: str, server_arn: str, server_tags: dict, exclude_network_config: bool):
        """
        :param server_host: Hostname of source server as returned by DRS
        :param server_arn: ARN of source server as returned by DRS
        :param server_tags: Dict of tag keys/values returned by DRS DescribeSourceServers API
        :param exclude_network_config: Boolean indicating if ExcludeNetworkConfiguration=true for this server
        """
        logger.info("synchronizing tags")

        if server_host is None:
            logger.warning("drs does not return a hostname for server; cannot lookup tags in tag mapping")
            return

        tags_desired = self.server_tag_mapping.get(server_host, {})

        if exclude_network_config:
            tags_desired["exclude-network-configuration"] = "true"

        tags_current = {}
        for tag_key in tags_desired:
            if tag_key in server_tags:
                tags_current[tag_key] = server_tags[tag_key]

        diff = DeepDiff(tags_current, tags_desired)
        if len(diff.affected_root_keys) == 0:
            logger.info("tags in server tag mapping have not changed")
            return

        tags_to_update = {}
        for key in diff.affected_root_keys:
            tags_to_update[key] = tags_desired[key]

        # apply new and updated tags to DRS source server
        logger.info("updating tags", extra=dict(
            current=tags_current,
            desired=tags_desired,
            diff=diff.pretty(),
            update_required="true"
        ))

        response = self.drs.tag_resource(
            resourceArn=server_arn,
            tags=tags_to_update
        )

        logger.info("tags updated", extra=dict(
            aws_request_id=response["ResponseMetadata"]["RequestId"],
            update_success="true"
        ))

    def synchronize_replication_settings(self, info: dict):
        """
        :param info: dict for a DRS source server as returned by "DescribeSourceServers" api call.
        """
        logger.info("synchronizing replication settings")

        # If the source server is replicating to another AWS account and has been extended to this account,
        # skip updating its settings.  The settings are replicated in each source server account,
        # see https://docs.aws.amazon.com/drs/latest/userguide/multi-account.html
        if info.get("stagingArea", {}).get("status") == "EXTENDED":
            logger.info("skip updating replication settings for extended source server")
            return

        # compare current configuration with desired state
        config_in_drs = self.drs.get_replication_configuration(sourceServerID=info["sourceServerID"])
        config_desired = {}
        # Apply matching override_for_tag__([a-zA-Z0-9-]+)__([a-zA-Z0-9-]+).yml files for replication settings or defaults.yml
        config_in_source_control = self.replication_configurations.build(info["tags"], account_id=self.account_id)
        config_current = {}
        for key in REPLICATION_CONFIGURATION_KEYS:
            if key in config_in_source_control:
                config_desired[key] = config_in_source_control[key]
                config_current[key] = config_in_drs[key]

        diff = DeepDiff(config_current, config_desired)

        if len(diff.affected_root_keys) == 0:
            logger.info("replication configuration has not changed")
            return

        logger.info("updating replication settings in drs", extra=dict(
            current=config_current,
            desired=config_desired,
            diff=diff.pretty(),
            update_required="true"
        ))

        response = self.drs.update_replication_configuration(
            sourceServerID=info["sourceServerID"],
            **config_desired
        )

        logger.info("replication configuration updated", extra=dict(
            aws_request_id=response["ResponseMetadata"]["RequestId"],
            update_success="true"
        ))


def lambda_handler(event, context):
    success = True
    try:
        synchronize_all()
        return {}
    except Exception as e:
        logger.error("synchronizer failed with exception", exc_info=e)
        success = False
