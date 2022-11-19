// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache 2.0
package main

import (
	"fmt"
	"strings"

	awsv2 "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/drs"
)

func getSource() (srcServerList []*drs.DescribeSourceServersOutput) {
	// Load session from shared config
	sess := session.Must(session.NewSessionWithOptions(session.Options{
		SharedConfigState: session.SharedConfigEnable,
	}))

	//Create DRS Client
	drsSvc := drs.New(sess)

	//Get paginated DRS source servers
	helper := int64(1000)
	describeInput := &drs.DescribeSourceServersInput{
		Filters:    &drs.DescribeSourceServersRequestFilters{},
		MaxResults: &helper,
	}
	pageNum := 0
	drsSvc.DescribeSourceServersPages(describeInput,
		func(page *drs.DescribeSourceServersOutput, lastPage bool) bool {
			pageNum++
			srcServerList = append(srcServerList, page)
			//fmt.Println(page.Items)
			return len(srcServerList) <= 1000
		})
	//fmt.Println(srcServerList)
	return srcServerList
}

//Create a map of source server IDs and their associated tags.
func getTags() (taglist map[string]map[string]string) {
	servers := getSource()
	taglist = make(map[string]map[string]string)
	for _, sourceServer := range servers {
		for _, v := range sourceServer.Items {
			taglist[awsv2.ToString(v.SourceServerID)] = awsv2.ToStringMap(v.Tags)
		}
	}
	return taglist
}

//Function to match a certain tag with the launch template to update.
func getSourceServerIdsWithTag(object string) (sourceServerList []string) {
	key := object
	formatKey := strings.Split(key, ".")[0]
	tagMap := getTags()
	for k, v := range tagMap {
		if _, ok := v[formatKey]; ok {
			sourceServerList = append(sourceServerList, k)
		}
	}
	fmt.Println("Updating ", len(sourceServerList), "servers")
	return sourceServerList
}

func getLaunchTemplates(object string) (ec2LaunchTemplateList []string) {
	// Load session from shared config
	sess := session.Must(session.NewSessionWithOptions(session.Options{
		SharedConfigState: session.SharedConfigEnable,
	}))

	//Create DRS Client
	drsSvc := drs.New(sess)

	//Get launch configuration for all source server IDs
	serverList := getSourceServerIdsWithTag(object)
	for _, i := range serverList {
		launchConfig, err := drsSvc.GetLaunchConfiguration(&drs.GetLaunchConfigurationInput{
			SourceServerID: aws.String(i),
		})
		check(err)
		ec2LaunchTemplateList = append(ec2LaunchTemplateList, *launchConfig.Ec2LaunchTemplateID)
	}
	return ec2LaunchTemplateList
}
