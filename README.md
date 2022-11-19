# AWS Elastic Disaster Recovery (DRS) Tools

This repository includes a collection of solutions and tools for the AWS Elastic Disaster Recovery (DRS) service.  You can use one or all of them to customize and enhance your DRS deployments.

* **[DRS Configuration Synchronizer](./drs-configuration-synchronizer)**:  This solution provides a flexible, configuration-based approach for synchronizing launch templates, launch configurations, and replication settings.  It provides many options to override specific servers as well as provide default settings across your DRS servers and support multi-account DRS deployments.
  ![](drs-configuration-synchronizer/diagrams/dr-synchronizer-diagrams-architecture.png)
  ![](drs-configuration-synchronizer/diagrams/dr-synchronizer-diagrams-flow.png)

* **[Synch Source Server Tags](./synch-source-server-tags)**: When you are replicating EC2 instances, the tags from your EC2 instances are not applied to the source servers in the DRS service.  This script enables you to replicate / synchronize the tags from your EC2 instances to DRS Source Servers.
  ![](synch-source-server-tags/diagrams/single_account.png)
  ![](synch-source-server-tags/diagrams/multi_account.png)

* **[DRS Template Manager](./drs-template-manager)**:  When using DRS, every source server has a corresponding launch template. Launch templates cannot be edited in a batch using the native DRS tooling. This solution will enable you to use a single file as a baseline template that can be replicated, edited, and used for each source server tagged with a corresponding key in the DRS console.
  ![](drs-template-manager/images/drs-template-manager-architecture.png)

* **[DRS Observability](./drs-observability)**:  When you deploy the DRS service, it is important to establish / update your logging and monitoring so you have observability on the health of your DRS deployment.  This folder contains tools such as CloudWatch dashboards and CloudWatch logging configuration that you can use to establish observability for your DRS deployment. 

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the Apache 2.0 License. See the LICENSE file.

