"""
Running this script in a development environment simulates how the lambda function
will run on AWS. The following environment variables must be defined before running.

DR_CONFIGURATION_SYNCHRONIZER_ROLE_NAME="DR-Automation-Roles-DRConfigurationSynchronizer"

"""
import configsynchronizer

configsynchronizer.synchronize_all()
