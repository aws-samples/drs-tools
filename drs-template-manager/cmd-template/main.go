// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

//Create re-usable error checking function for handling errors.
func check(e error) {
	if e != nil {
		panic(e)
	}
}

//Lambda handler receives template from S3 as S3event.
func SetTemplates(ctx context.Context, s3Event events.S3Event) {
	var object string
	var bucket string
	for _, record := range s3Event.Records {
		s3 := record.S3
		//Log output of what bucket and key triggered event.
		fmt.Printf("[%s - %s] Bucket = %s, Key = %s \n", record.EventSource, record.EventTime, s3.Bucket.Name, s3.Object.Key)
		object = s3.Object.Key
		bucket = s3.Bucket.Name
	}
	//Get launch template data from S3 json object.
	TemplateDat := GetTemplateFromS3(object, bucket)
	//Get list of launch templates to update.
	templates := getLaunchTemplates(object)
	//Create new template version and set it as default for all servers that match template prefix
	for _, templateId := range templates {
		loadTemplate(templateId, TemplateDat)
	}
}

//Start lambda here and trigger lamba handler.
func main() {
	lambda.Start(SetTemplates)
}
