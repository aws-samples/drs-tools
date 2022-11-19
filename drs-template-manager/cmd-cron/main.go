// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go/aws"
)

func main() {
	lambda.Start(templateScheduler)
}

func templateScheduler() (resp string, err error) {

	//Declare which bucket to interact with
	bucket := os.Getenv("BUCKET")

	//make the list of objects
	objectList := listObjects(bucket)

	//write bodys to files
	writeObjects(bucket, objectList)

	//uploadfiles
	resp, err = uploadObjects(bucket, objectList)
	return resp, err

}

//Make a list of Objects in the S3 bucket
func listObjects(bucket string) (objectList []string) {

	//Create S3 client
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(err)
	}
	s3client := s3.NewFromConfig(cfg)

	//List the objects
	listObjsResponse, err := s3client.ListObjectsV2(context.TODO(), &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		panic(err)
	}

	//Return the object list.
	for _, object := range listObjsResponse.Contents {
		//fmt.Printf("%s \n", *object.Key)
		objectList = append(objectList, *object.Key)
	}
	return objectList
}

//Get all objects in list and write to local file
func writeObjects(bucket string, objectList []string) {

	//Create S3 client
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(err)
	}
	s3client := s3.NewFromConfig(cfg)

	//get each object and save to local file
	for _, object := range objectList {
		getObject, err := s3client.GetObject(context.TODO(), &s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(object),
		})

		//check the error and close response Body
		if err != nil {
			panic(err)
		}
		defer getObject.Body.Close()

		//make filestring
		filestring := "/tmp/" + object

		//create file
		outFile, err := os.Create(filestring)
		if err != nil {
			panic(err)
		}
		defer outFile.Close()

		//write to file
		_, err = io.Copy(outFile, getObject.Body)
		if err != nil {
			panic(err)
		}

	}

}

func uploadObjects(bucket string, objectList []string) (response string, err error) {

	//Create S3 client
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(err)
	}
	s3client := s3.NewFromConfig(cfg)

	//iterate through object key list and upload the matching key in tmp
	for _, object := range objectList {

		//make filestring
		filestring := "/tmp/" + object

		//open file
		f, err := os.Open(filestring)
		if err != nil {
			panic(err)
		}
		defer f.Close()

		//upload file to bucket and return a string response
		_, error := s3client.PutObject(context.TODO(), &s3.PutObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(object),
			Body:   f,
		})
		if error != nil {
			panic(error)
		}
	}
	uploadedTemplates := fmt.Sprint(len(objectList))
	response = "Uploading " + uploadedTemplates + " templates."
	return response, err
}
