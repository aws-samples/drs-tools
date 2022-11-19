#!/bin/sh
# Add cwagent user (CloudWatch Agent user) to the aws-replication user group
# Update permissions on agent.log.* to provide read access to aws-replication group
usermod -a -G aws-replication cwagent
chmod 640 /var/lib/aws-replication-agent/agent.log.*
