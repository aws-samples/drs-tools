//Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//SPDX-License-Identifier: Apache-2.0

import React, {useEffect, useState} from 'react'
import {Authenticator, Heading, useAuthenticator, View} from '@aws-amplify/ui-react';
import { Text, useTheme } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import './App.css';
import Applications from './Applications'
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

const formFields = {
    confirmVerifyUser: {
        confirmation_code: {
            labelHidden: false,
            label: 'New Label',
            placeholder: 'Enter your Confirmation Code:',
            isRequired: false,
        },
    },
};

const components = {
    VerifyUser: {
        Header() {
            const {tokens} = useTheme();
            return (
                <Heading
                    padding={`${tokens.space.xl} 0 0 ${tokens.space.xl}`}
                    level={3}
                >
                    Enter Information:
                </Heading>
            );
        },
        Footer() {
            return <Text>Footer Information</Text>;
        },
    },

    ConfirmVerifyUser: {
        Header() {
            const {tokens} = useTheme();
            return (
                <Heading
                    padding={`${tokens.space.xl} 0 0 ${tokens.space.xl}`}
                    level={3}
                >
                    Enter Information:
                </Heading>
            );
        },
        Footer() {
            return <Text>Footer Information</Text>;
        },
    },
    SignIn: {
        Header() {
            const { tokens } = useTheme();

            return (
                <Heading
                    level={6}
                    textAlign="center"
                    padding={10}
                >
                    New account creation is disabled, login with account created for solution or create an account through Cognito.
                </Heading>
            );
        },
        Footer() {
            const { toResetPassword } = useAuthenticator();

            return (
                <View textAlign="center">
                    <Button
                        fontWeight="normal"
                        onClick={toResetPassword}
                        size="small"
                        variation="link"
                    >
                        Reset Password
                    </Button>
                </View>
            );
        },
    },


};


export default function App() {
    const [title, setTitle] = useState("DRS Accelerator Plan Automation");
    useEffect(() => {
        document.title = 'AWS Disaster Recovery Accelerator - Plan Automation';
    });
    return (
        <Authenticator
            socialProviders={['facebook', 'google']}
            loginMechanisms={['email']}
            formFields={formFields}
            components={components}
            hideSignUp={true}
            variation="default"
        >
            {({signOut, user}) => (
                <Applications user={user} signOut={signOut}/>
            )}
        </Authenticator>
    )
}
