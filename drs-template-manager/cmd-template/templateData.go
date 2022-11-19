// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache 2.0
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/ec2/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

//Function that pulls template down from S3.
func GetTemplateFromS3(object string, bucket string) (TemplateDat *types.RequestLaunchTemplateData) {
	//Create S3 client
	cfg, err := config.LoadDefaultConfig(context.TODO())
	check(err)
	client := s3.NewFromConfig(cfg)

	//Get the object that triggered the lambda function
	TemplateData, err := client.GetObject(context.TODO(), &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(object),
	})
	check(err)

	//Write the object body to json.
	buf := new(strings.Builder)
	_, prob := io.Copy(buf, TemplateData.Body)
	check(prob)
	p := []byte(buf.String())
	e := json.Unmarshal(p, &TemplateDat)
	check(e)
	return TemplateDat
}

func loadTemplate(i string, TemplateDat *types.RequestLaunchTemplateData) {
	//Create ec2 client
	cfg, err := config.LoadDefaultConfig(context.TODO())
	check(err)
	client := ec2.NewFromConfig(cfg)

	//Create new template version
	_, p := client.CreateLaunchTemplateVersion(context.TODO(), &ec2.CreateLaunchTemplateVersionInput{
		LaunchTemplateId:   aws.String(i),
		LaunchTemplateData: TemplateDat,
	})
	check(p)

	//Set newly created version to default
	resp, err := client.ModifyLaunchTemplate(context.TODO(), &ec2.ModifyLaunchTemplateInput{
		DefaultVersion:   aws.String("$Latest"),
		LaunchTemplateId: aws.String(i),
	})
	check(err)
	respDecrypted, _ := json.MarshalIndent(resp, "", "\t")
	fmt.Println(string(respDecrypted))
}
