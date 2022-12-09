import boto3
import logging
from botocore.exceptions import ClientError
from botocore.config import Config
import json
from os import getenv
import sys, traceback
from boto3.dynamodb.types import TypeDeserializer, TypeSerializer
from datetime import datetime, date, time, timezone
import time

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
AWS_REGION = getenv('AWS_REGION')

DRS_APPLICATION_TABLE = getenv('DRS_APPLICATION_TABLE_NAME')
DRS_RESULTS_TABLE = getenv('DRS_RESULTS_TABLE_NAME')

drs_client = boto3.client('drs')
sns_client = boto3.client('sns')
ssm_client = boto3.client('ssm')
ddb_client = boto3.client("dynamodb")

ddb_deserializer = TypeDeserializer()
ddb_serializer = TypeSerializer()

AUTOMATION_EXECUTION_WAIT_STATES = ['Pending', 'InProgress', 'Waiting', 'Cancelling', 'PendingApproval', 'Approved',
                                    'Scheduled', 'RunbookInProgress', 'PendingChangeCalendarOverride',
                                    'ChangeCalendarOverrideApproved']
AUTOMATION_EXECUTION_COMPLETE_SUCCESS_STATES = ['Success', 'CompletedWithSuccess']

AUTOMATION_EXECUTION_COMPLETE_FAILURE_STATES = ['TimedOut', 'Cancelled', 'Failed', 'Rejected',
                                                'ChangeCalendarOverrideRejected',
                                                'CompletedWithFailure']

DRS_JOB_STATUS_COMPLETE_STATES = ['COMPLETED']
DRS_JOB_STATUS_WAIT_STATES = ['PENDING', 'STARTED']

DRS_JOB_SERVERS_COMPLETE_SUCCESS_STATES = ['LAUNCHED']
DRS_JOB_SERVERS_COMPLETE_FAILURE_STATES = ['FAILED', 'TERMINATED']
DRS_JOB_SERVERS_COMPLETE_WAIT_STATES = ['PENDING', 'IN_PROGRESS']


def dynamo_obj_to_python_obj(dynamo_obj: dict) -> dict:
    deserializer = TypeDeserializer()
    return {
        k: deserializer.deserialize(v)
        for k, v in dynamo_obj.items()
    }


def python_obj_to_dynamo_obj(python_obj: dict) -> dict:
    serializer = TypeSerializer()
    return {
        k: serializer.serialize(v)
        for k, v in python_obj.items()
    }


def record_status(event):
    result = event['result']
    # find all datetimes and replace them:

    logger.debug("serializing {}".format(result))
    serialized_result = python_obj_to_dynamo_obj(result)
    logger.debug("serialized {}".format(serialized_result))

    try:
        response = ddb_client.put_item(
            TableName=DRS_RESULTS_TABLE,
            Item=serialized_result
        )
    except Exception as err:
        logger.error("Error putting item {} into table: {}: {}".format(serialized_result, DRS_RESULTS_TABLE, err))
        raise err
    else:
        return response


def send_notification(topic_arn, subject, message):
    logger.info("Notifying: {}\nsubject: {}\nmessage: {}\n".format(topic_arn, subject, message))
    try:
        sns_details = sns_client.publish(
            TopicArn=topic_arn,
            Message=message,
            Subject=subject
        )
        logger.info("Sent sns with details: {}".format(sns_details))
    except Exception as e:
        logger.error("Error sending message to topic arn: {}: {}".format(topic_arn, e))


'''
Refer to documentation for latest parameters: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ssm.html#SSM.Client.start_automation_execution
'''


def start_action(**kwargs):
    if 'DocumentName' not in kwargs:
        message = 'Parameter DocumentName not found in parameters {}.  Refer to the request parameters documentation: https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_StartAutomationExecution.html#API_StartAutomationExecution_RequestParameters'.format(
            kwargs)
        logger.error(message)
        return {'status': 'failed', 'message': message}
    try:
        ssm_launch = ssm_client.start_automation_execution(**kwargs)

        if 'AutomationExecutionId' not in ssm_launch:
            message = "StartAutomationExecution({}) didn't return AutomationExecutionId.".format(kwargs)
            logger.error(message)
            return {'status': 'failed', 'message': message}
            raise
        else:
            return {'status': 'success', 'result': ssm_launch['AutomationExecutionId']}
    except Exception as e:
        message = "Error with StartAutomationExecution({}): {}".format(kwargs, e)
        logger.error(message)
        return {'status': 'failed', 'message': message}


def update_action_result(action_status, result, action_prefix, wave_number, action_number):
    if 'success' in action_status['status']:
        result['Waves'][wave_number][action_prefix][action_number]['job'] = \
            action_status['result']
        return True
    else:
        result['Waves'][wave_number][action_prefix][action_number][
            'status'] = 'failed'
        result['Waves'][wave_number][action_prefix][action_number]['log'].append(
            action_status['message'])
        result['Waves'][wave_number]['status'] = 'failed'
        result['status'] = 'failed'
        return False


def check_action_status(executionid):
    try:
        describe_result = ssm_client.describe_automation_executions(
            Filters=[{
                'Key': 'ExecutionId',
                'Values': [
                    executionid
                ]
            }]
        )
        if 'AutomationExecutionMetadataList' in describe_result:
            result = describe_result['AutomationExecutionMetadataList'][0]
            if 'ExecutionEndTime' in result:
                result['ExecutionStartTime'] = str(result['ExecutionStartTime'])
                result['ExecutionEndTime'] = str(result['ExecutionEndTime'])
                start = datetime.strptime(str(result['ExecutionStartTime']), "%Y-%m-%d %H:%M:%S.%f%z")
                end = datetime.strptime(str(result['ExecutionEndTime']), "%Y-%m-%d %H:%M:%S.%f%z")
                duration = end - start
                duration_minutes = divmod(duration.total_seconds(), 60)
                result['duration'] = "{}m {}s".format(round(duration_minutes[0]), round(duration_minutes[1]))
            else:
                result['ExecutionStartTime'] = str(result['ExecutionStartTime'])

            return {'status': 'success', 'result': result}
        else:
            message = 'No results returned describing ssm automation execution with id: {}'.format(executionid)
            logger.error(message)
            return {'status': 'failed', 'message': message}

    except Exception as e:
        message = "Error retrieving status for execution id {}: {}".format(executionid, e)
        logger.error(message)
        return {'status': 'failed', 'message': message}


def start_wave_recovery(event):
    application = event['application']
    wave_plan = application['wave_plan']
    wave_number = application['current_wave_number']
    isdrill = event['isdrill']
    topic_arn = event['topic_arn']
    result = event['result']
    servers = wave_plan[wave_number]

    if isdrill:
        recovery_type = "drill"
    else:
        recovery_type = "recovery"

    wave_detail = ""
    for index, wave in enumerate(wave_plan):
        wave_detail += "Wave {}:\n\n".format(index)
        for server in wave_plan[index]:
            wave_detail += "Server {}\n".format(server['sourceServerID'])

    logger.info("Starting recovery for source servers: {}, Drill setting is: {}".format(servers, isdrill))

    try:
        drs_launch = drs_client.start_recovery(
            isDrill=isdrill,
            sourceServers=servers
        )
        logger.info("Recovery job started with details: {}".format(drs_launch['job']))
        application['wave_completed'] = False
        application['job_id'] = drs_launch['job']['jobID']
        event['action'] = 'update_wave_status'
        result['Waves'][wave_number]['drs']['status'] = 'started'
        result['Waves'][wave_number]['drs']['job'] = drs_launch['job']
        return event

    except Exception as e:
        error_message = "Error starting recovery for servers {}: {}".format(servers, e)
        logger.error(error_message)
        result['Waves'][wave_number]['log'].append(error_message)
        result['Waves'][wave_number]['drs']['status'] = 'failed'
        result['Waves'][wave_number]['status'] = 'failed'
        result['status'] = 'failed'
        record_wave_completion(result, wave_number)
        record_completion(result)
        return event


def check_recovery_status(jobID):
    recovery_status = None
    try:
        job_result = drs_client.describe_jobs(
            filters={
                'jobIDs': [
                    jobID
                ]
            }
        )
        total_results = len(job_result['items'])
        if total_results != 1:
            logger.warning("describe_jobs() returned {} items, expected only 1: {}".format(total_results, jobID))

        recovery_status = job_result['items'][0]
    except Exception as e:
        logger.error("Error describe_jobs() for job {}: {}".format(jobID, e))

    logger.info('getting recovery status details for job with id: {}'.format(jobID))
    recovery_items = []
    try:
        paginator = drs_client.get_paginator('describe_job_log_items')
        response_iterator = paginator.paginate(
            jobID=jobID
        )
        for i in response_iterator:
            recovery_items += i.get('items')
    except Exception as e:
        logger.error("Error checking recovery status for job id {}: {}".format(jobID, e))

    recovery_status['detail'] = recovery_items

    logger.debug("check_recovery_status({}) returning {}".format(jobID, recovery_status))
    return recovery_status


def process_wave(event, wave_number, recovery_type):
    application = event['application']
    plan_details = event['plan_details']
    waves = plan_details['Waves']
    wave_plan = application['wave_plan']
    application_name = application["AppName"]
    topic_arn = event['topic_arn']

    result = event['result']

    notification_subject = "Update for {} {}".format(application_name, recovery_type)

    application['action_type'] = None
    application['current_wave_number'] = wave_number
    application['all_waves_completed'] = False

    application['current_wave_total_wait_time'] = 0
    application['current_wave_wait_time'] = waves[wave_number]['MaxWaitTime']
    application['current_wave_update_time'] = waves[wave_number]['UpdateTime']

    prewaveactions = plan_details['Waves'][wave_number]['PreWaveActions']
    result['Waves'][wave_number]['PreWaveActions'] = [{
        "status": "pending",
        "id": "",
        "log": []
    } for prewaveaction in prewaveactions]

    result['Waves'][wave_number]['PostWaveActions'] = result['Waves'][wave_number]['PostWaveActions'] = [{
        "status": "pending",
        "id": "",
        "log": []
    } for postwaveaction in plan_details['Waves'][wave_number]['PostWaveActions']]

    result['Waves'][wave_number]['ExecutionStartTime'] = datetime.now(timezone.utc).isoformat()
    result['Waves'][wave_number]['status'] = 'started'

    # check for pre_actions and start first one...
    application['action_type'] = "pre"
    if len(prewaveactions):
        process_action(application, 0, event, prewaveactions, wave_number)
    else:
        # no prewaveactions, start wave recovery...
        application['all_actions_completed'] = True
        result['Waves'][wave_number]['log'].append("No PreWave Actions")
        event = start_wave_recovery(event)
    return event


def process_action(application, current_action_number, event, actions, wave_number):
    result = event['result']
    action_type = application['action_type']

    if action_type == "pre":
        actions_prefix = "PreWave"
    elif action_type == "post":
        actions_prefix = "PostWave"

    application['current_action_number'] = current_action_number
    action_parameters = actions[current_action_number]['StartAutomationExecution']
    logger.debug("Action Parameters for action {} is: {}".format(current_action_number,
                                                                 action_parameters))
    start_action_results = start_action(**action_parameters)
    if 'success' in start_action_results['status']:
        application['current_action_execution_id'] = start_action_results['result']
        application['action_completed'] = False
        application['all_actions_completed'] = False
        application['current_action_total_wait_time'] = 0
        application['current_action_wait_time'] = actions[current_action_number][
            'MaxWaitTime']
        application['current_action_update_time'] = actions[current_action_number][
            'UpdateTime']
        event['action'] = 'update_action_status'

        result['Waves'][wave_number]['{}Actions'.format(actions_prefix)][current_action_number][
            'id'] = start_action_results['result']
        result['Waves'][wave_number]['{}Actions'.format(actions_prefix)][current_action_number]['status'] = "started"
    else:
        message = start_action_results['message']
        logger.error(message)
        result['Waves'][wave_number]['{}Actions'.format(actions_prefix)][current_action_number][
            'log'].append(message)
        result['Waves'][wave_number]['{}Actions'.format(actions_prefix)][current_action_number]['status'] = "failed"
        result['Waves'][wave_number]['status'] = "failed"
        result['failed']
        record_wave_completion(result, wave_number)
        record_completion(result)


def record_wave_completion(result, wave_number):
    result['Waves'][wave_number]['ExecutionEndTime'] = datetime.now(timezone.utc).isoformat()
    result['Waves'][wave_number]['ExecutionEndTimeMs'] = round(time.time() * 1000)
    start = datetime.strptime(result['Waves'][wave_number]['ExecutionStartTime'], "%Y-%m-%dT%H:%M:%S.%f%z")
    end = datetime.strptime(result['Waves'][wave_number]['ExecutionEndTime'], "%Y-%m-%dT%H:%M:%S.%f%z")
    duration = end - start
    duration_minutes = divmod(duration.total_seconds(), 60)
    result['Waves'][wave_number]['duration'] = "{}m {}s".format(round(duration_minutes[0]), round(duration_minutes[1]))
    result['Waves'][wave_number]['status'] = 'completed'
    return result


def record_completion(result):
    result['ExecutionEndTime'] = datetime.now(timezone.utc).isoformat()
    start = datetime.strptime(result['ExecutionStartTime'], "%Y-%m-%dT%H:%M:%S.%f%z")
    end = datetime.strptime(result['ExecutionEndTime'], "%Y-%m-%dT%H:%M:%S.%f%z")
    duration = end - start
    duration_minutes = divmod(duration.total_seconds(), 60)
    result['duration'] = "{}m {}s".format(round(duration_minutes[0]), round(duration_minutes[1]))
    return result


def handler(event, context):
    try:
        logger.debug("Event is: {}".format(json.dumps(event)))
        logger.debug("Context is: {}".format(vars(context)))

        execution_arn = event.get('execution')

        execution_details = event.get('execution_details', None)
        logger.debug("Execution ARN is: {}".format(execution_arn))

        application_details = execution_details.get('application', None)
        logger.info("Application is: {}".format(json.dumps(application_details)))

        selected_plan = execution_details.get('plan')
        plan_details = application_details["Plans"][selected_plan]

        event["plan_details"] = plan_details
        event["execution_arn"] = execution_arn

        logger.debug("Plan is: {}".format(json.dumps(plan_details)))

        application = application_details

        topic_arn = application.get('SnsTopic', None)
        logger.info("Topic ARN is: {}".format(topic_arn)
                    )

        isdrill = event.get('isdrill')
        user = event.get('user')
        logger.info("IsDrill is: {}".format(isdrill))

        result = event.get('result', {
            'AppId_PlanId': "{}_{}".format(application_details["AppId"], plan_details["PlanId"]),
            'planDetails': plan_details,
            'ExecutionId': execution_arn,
            'status': 'pending',
            'isDrill': isdrill,
            'topicArn': topic_arn,
            'user': user,
            'AppName': application["AppName"],
            "KeyName": application["KeyName"],
            "KeyValue": application["KeyValue"],
            "Owner": application["Owner"],
            'log': [],
            'SourceServers': [],
            'ExecutionStartTime': datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f%z"),
            'ExecutionStartTimeMs': round(time.time() * 1000)
        })

        if isdrill:
            recovery_type = "drill"
        else:
            recovery_type = "recovery"

        action = event.get('action')
        logger.info("Action is: {}".format(action))

        event['application'] = application
        application_name = application.get('AppName')

        if action == 'begin':
            event["result"] = result
            waves = plan_details.get('Waves', None)

            if not waves:
                message = 'Required key, "Waves" is missing from request'
                logger.error(message)
                result['log'].append(message)
                result['status'] = 'failed'
                record_completion(result)
                record_status(event)
                raise Exception('ERROR:  Key Waves is missing from application')
            else:
                plan_details['Waves'] = waves

            wave_plan = [[] for wave in waves]

            result['Waves'] = [{
                'status': 'pending',
                'SourceServers': [],
                'drs': {'status': 'pending'},
                'log': [],
                'PreWaveActions': [],
                'PostWaveActions': []
            } for wave in waves]

            # get list of source servers that match tag
            paginator = drs_client.get_paginator('describe_source_servers')
            response_iterator = paginator.paginate(
                filters={},
                maxResults=200,
                PaginationConfig={
                    'MaxItems': 200,
                    'PageSize': 200
                }
            )
            serverItems = []
            source_servers = dict()
            for i in response_iterator:
                serverItems += i.get('items')
            for i in serverItems:
                source_servers[i['sourceServerID']] = i
            # print(serverTagsDict)

            # for each source server, determine if it is targeted for recovery in any of the startup order steps
            for index, wave in enumerate(waves):
                wave_key_name = wave['KeyName']
                wave_key_value = wave['KeyValue']
                for k, v in source_servers.items():
                    logger.debug('tags for source server {} are {}'.format(k, v['tags']))
                    if application_details['KeyName'] in v['tags'] and v['tags'][application_details['KeyName']] == \
                            application_details['KeyValue']:
                        logger.debug(
                            "Adding source server {} with matching Application KeyName: {}, KeyValue: {}".format(k,
                                                                                                                 application_details[
                                                                                                                     'KeyName'],
                                                                                                                 application_details[
                                                                                                                     'KeyValue']))
                        result['SourceServers'].append({k: v})
                        if wave_key_name in v['tags'] and v['tags'][
                            wave_key_name] == wave_key_value:
                            logger.info("Adding Source server {} to wave {} with tags {}".format(k, index, v['tags']))
                            wave_plan[index].append(
                                {
                                    'sourceServerID': k
                                }
                            )
                            result['Waves'][index]['SourceServers'].append(k)

            logger.debug("wave_plan is {}".format(wave_plan))

            notification_subject = "Update for {} {}".format(application_name, recovery_type)
            notification_message = "Source Servers Tag Key: {}, Source Servers Tag Value: {}\n".format(
                application_details[
                    'KeyName'],
                application_details[
                    'KeyValue'])

            no_servers_found = False
            if result['SourceServers']:
                notification_message += "Source Servers for Application: {}\n".format(
                    ", ".join([list(server.keys())[0] for server in result['SourceServers']]))
            else:
                notification_message += "ERROR:  No DRS source servers found with tags indicated\n"
                no_servers_found = True

            for idx, wave in enumerate(wave_plan):
                if len(wave) == 0:
                    notification_message += "ERROR: Wave {} with Key Name: {} and Key Value: {} has no matching servers for application specified.\n".format(
                        idx, waves[idx]['KeyName'], waves[idx]['KeyValue'])
                    no_servers_found = True

            # End immediately if a wave is found with no servers.
            if no_servers_found:
                result['status'] = 'failed'
                result['log'].append(notification_message)
                record_status(event)
                if topic_arn:
                    send_notification(topic_arn, notification_subject, notification_message)
                return event

            application['wave_plan'] = wave_plan
            application['all_waves_completed'] = False
            current_wave_number = 0
            result['status'] = 'started'

            event = process_wave(event, current_wave_number, recovery_type)
            if topic_arn:
                send_notification(topic_arn, notification_subject, notification_message)

            record_status(event)
            return event

        # The update_status action can be modified to interrogate the servers and provide more application specific
        # recovery status details rather than just launch status details.
        if action == 'update_action_status':
            action_type = application.get('action_type')
            execution_id = application.get('current_action_execution_id')
            current_wave_number = application.get('current_wave_number')
            current_action_number = application.get('current_action_number')
            total_wait_time = application.get('current_action_total_wait_time')
            max_wait_time = application.get('current_action_wait_time')
            update_time = application.get('current_action_update_time')
            wave_plan = application.get('wave_plan')

            current_action_total_wait_time = total_wait_time + update_time
            application['current_action_total_wait_time'] = current_action_total_wait_time

            if action_type == "pre":
                action_prefix = "PreWaveActions"
            else:
                action_prefix = "PostWaveActions"

            actions = plan_details['Waves'][current_wave_number][action_prefix]

            notification_subject = "Update for {} {}".format(application_name, recovery_type)
            notification_message = "Application: {}\nCurrent Wave: {}\nCurrent {}: {}\nTotal wait time: {}\n".format(
                application_name,
                current_wave_number,
                action_prefix,
                current_action_number,
                total_wait_time)

            action_status = check_action_status(execution_id)
            action_status_result = update_action_result(action_status, result, action_prefix,
                                                        current_wave_number, current_action_number)
            # action failed
            if not action_status_result:
                record_wave_completion(result, current_wave_number)
                record_completion(result)
                record_status(event)
                notification_message += "\nFailed: {}".format(action_status['message'])
                logger.error(notification_message)
                if topic_arn:
                    send_notification(topic_arn, notification_subject, notification_message)
                return event

            logger.debug("{} Automation Execution Result object is: {}".format(action_prefix, action_status))
            logger.info(notification_message)

            notification_subject = "Update for {} {}".format(application_name, recovery_type)
            notification_message = "Current Wave Number: {}\nCurrent {}: {}\nTotal wait time: {}\n".format(
                current_wave_number,
                action_prefix,
                current_action_number,
                total_wait_time)

            if current_action_total_wait_time >= max_wait_time:
                message = "Maximum wait time met for {} {}, Wave: {}, {} {}".format(application['AppName'],
                                                                                    recovery_type,
                                                                                    current_wave_number,
                                                                                    action_prefix,
                                                                                    current_action_number)
                logger.info(message)
                result['Waves'][current_wave_number][action_prefix][current_action_number]['log'].append(
                    message)
                result['Waves'][current_wave_number][action_prefix][current_action_number][
                    'status'] = 'timeout'
                result['Waves'][current_wave_number]['status'] = 'timeout'
                result['status'] = 'timeout'
                result['log'].append(message)
                notification_message += "Maximum wait time of {} met.\n".format(max_wait_time)
                if topic_arn:
                    send_notification(topic_arn, notification_subject, notification_message)
            elif action_status['result'][
                'AutomationExecutionStatus'] in AUTOMATION_EXECUTION_COMPLETE_FAILURE_STATES:
                notification_message += "Failed with state: {}\n".format(
                    action_status['result']['AutomationExecutionStatus'])

                logger.error(notification_message)
                result['Waves'][current_wave_number][action_prefix][current_action_number][
                    'status'] = 'failed'
                result['Waves'][current_wave_number]['status'] = 'failed'
                result['status'] = 'failed'
                result['log'].append(notification_message)
                record_wave_completion(result, current_wave_number)
                record_completion(result)
                if topic_arn:
                    send_notification(topic_arn, notification_subject, notification_message)
            elif action_status['result']['AutomationExecutionStatus'] in AUTOMATION_EXECUTION_WAIT_STATES:
                result['Waves'][current_wave_number]['PreWaveActions'][current_action_number][
                    'status'] = 'started'
            elif action_status['result'][
                'AutomationExecutionStatus'] in AUTOMATION_EXECUTION_COMPLETE_SUCCESS_STATES:
                result['Waves'][current_wave_number][action_prefix][current_action_number][
                    'status'] = 'completed'
                notification_message += "Action Completed Successfully\n"
                logger.info(notification_message)

                is_last_action = current_action_number == (len(actions) - 1)
                is_last_wave = current_wave_number == (len(wave_plan) - 1)

                if is_last_action:
                    notification_message += "All {} completed\n".format(action_prefix)
                    logger.info(notification_message)
                    application['all_actions_completed'] = True

                    # all prewave actions completed, start wave recovery...
                    if action_type == "pre":
                        logger.info("starting wave recovery")
                        notification_message += "Starting Server Recovery for Wave {}\nServers: {}\n".format(
                            current_wave_number, wave_plan[current_wave_number])
                        event = start_wave_recovery(event)
                    if action_type == "post":
                        if is_last_wave:
                            notification_message = "All waves completed.\n"
                            application['all_waves_completed'] = True
                            event['action'] = 'all_waves_completed'
                        else:
                            current_wave_number += 1
                            notification_message = "Starting next wave {}\n".format(current_wave_number)
                            event = process_wave(event, current_wave_number, recovery_type)
                else:
                    # process next action
                    current_action_number += 1
                    notification_message += "Starting next action {}\n".format(current_action_number)
                    process_action(application, current_action_number, event, actions,
                                   current_wave_number)

                if topic_arn:
                    send_notification(topic_arn, notification_subject, notification_message)

            logger.info(notification_message)
            record_status(event)
            return event

        if action == 'update_wave_status':
            job_id = application.get('job_id')
            current_wave_number = application.get('current_wave_number')
            wave_plan = application.get('wave_plan')
            total_wait_time = application.get('current_wave_total_wait_time')
            update_time = application.get('current_wave_update_time')
            max_wait_time = application.get('current_wave_wait_time')
            application_name = application.get('AppName')

            total_wait_time += update_time

            notification_subject = "Update for {} {}".format(application_name, recovery_type)
            notification_message = "Current Wave Number: {}\nTotal wait time: {}\n".format(
                current_wave_number,
                total_wait_time)

            recovery_status = check_recovery_status(job_id)
            result['Waves'][current_wave_number]['drs']['job'] = recovery_status

            logger.debug("recovery status object is: {}".format(recovery_status))

            # TODO:  Option to fail plan when a certain threshold of servers fail to launch from job
            if total_wait_time >= max_wait_time:
                notification_message += "Maximum wait time of {} reached.".format(total_wait_time)
                result['status'] = 'failed'
                result['log'].append(notification_message)
                result['Waves'][current_wave_number]['drs']['status'] = 'timeout'
                result['Waves'][current_wave_number]['status'] = 'timeout'
                result['Waves'][current_wave_number]['log'].append(notification_message)
                record_wave_completion(result, current_wave_number)
                record_completion(result)
                logger.info(notification_message)
                if topic_arn:
                    send_notification(topic_arn, notification_subject, notification_message)
            elif recovery_status['status'] in DRS_JOB_STATUS_COMPLETE_STATES:
                event['action'] = 'wave_completed'
                result['Waves'][current_wave_number]['drs']['status'] = 'completed'
                record_wave_completion(result, current_wave_number)
                application['wave_completed'] = True

                notification_message += "Wave Number {} Completed\n".format(
                    current_wave_number)

                postwaveactions = plan_details['Waves'][current_wave_number]['PostWaveActions']
                # check for post_actions and start first one...
                if len(postwaveactions):
                    application['action_type'] = "post"
                    process_action(application, 0, event, postwaveactions,
                                   current_wave_number)
                    notification_message += "Starting First Post Wave Action\n"
                else:
                    if current_wave_number == (len(wave_plan) - 1):
                        notification_message += "All waves completed.\n"
                        application['all_waves_completed'] = True
                        event['action'] = 'all_waves_completed'
                    else:
                        # process next wave
                        result['Waves'][current_wave_number]['PostWaveActions'] = []
                        result['Waves'][current_wave_number]['log'].append("No postwave actions to process.")
                        record_wave_completion(result, current_wave_number)
                        current_wave_number = current_wave_number + 1
                        notification_message += "No Post Wave Actions, Starting Next Wave #{}".format(
                            current_wave_number + 1)
                        event = process_wave(event, current_wave_number, recovery_type)
                if topic_arn:
                    send_notification(topic_arn, notification_subject, notification_message)
            else:
                application['current_wave_total_wait_time'] = total_wait_time

            logger.debug('returning event: {}'.format(event))

            logger.info(notification_message)
            record_status(event)
            return event

        if action == 'all_waves_completed':
            result['status'] = 'completed'
            record_completion(result)

            notification_subject = "Update for {} {}".format(application_name, recovery_type)
            notification_message = "Plan Completed.\nTotal time: {}\n".format(
                result['duration'])
            logger.info(notification_message)

            if topic_arn:
                send_notification(topic_arn, notification_subject, notification_message)
            record_status(event)
            return event
    except Exception:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        message = repr(traceback.format_exception(exc_type, exc_value, exc_traceback))
        print(message)
        result['log'].append(message)
        result['status'] = 'failed'
        record_completion(result)
        record_status(event)
        return event
        raise
