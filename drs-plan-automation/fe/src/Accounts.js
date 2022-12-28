//Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//SPDX-License-Identifier: Apache-2.0

import React, {useEffect, useState} from 'react'
import './App.css';
import UserAppBar from "./UserAppBar";

import '@aws-amplify/ui-react/styles.css';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';


import DeleteIcon from '@mui/icons-material/Delete';
import ListItemButton from "@mui/material/ListItemButton";
import Grow from '@mui/material/Grow';

import empty_account from "./data/account.js"
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import {API} from "aws-amplify";
import TextField from "@mui/material/TextField";
import Skeleton from "@mui/material/Skeleton";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";

const apiName = 'drsplangui';
const accounts_path = '/accounts';
const myInit = { // OPTIONAL
    // response: true
};


function putAccount(account, cb) {
    try {
        const putData = {
            body: {
                account: account
            }
        }
        API.put(apiName, accounts_path, putData).then((results) => {
                console.log("results from put on /accounts: " + JSON.stringify(results));
                cb(results);
            }
        );
    } catch (e) {
        console.log('putAccount failed: ' + e);
    }
}


function deleteAccount(account, cb) {
    try {
        const deleteData = {
            body: {  // OPTIONAL
                AccountId: account.AccountId
            }
        }
        console.log("Account to delete: " + JSON.stringify(account));

        API.del(apiName, accounts_path, deleteData).then((results) => {
            console.log("results from delete: " + JSON.stringify(results));
            cb(results);

        });
    } catch (e) {
        console.log('Delete failed: ' + e);
    }
}


const CreateAccountsDialog = ({
                                  fetchAccounts,
                                  createDialogVisible,
                                  setCreateDialogVisible,
                                  setAccounts,
                                  setTitle
                              }) => {
    const [accountId, setAccountId] = useState('');
    const [region, setRegion] = useState('');

    function closeDialog() {
        setCreateDialogVisible(false);
        setAccountId('');
        setRegion('');
    }

    function handleCreateAccount() {
        let account = JSON.parse(JSON.stringify(empty_account));
        account.AccountId = accountId;
        account.Region = region;

        console.log("Create account details are: " + JSON.stringify(account))

        putAccount(account,
            (results) => {
                if ("success" in results) {
                    fetchAccounts(
                        (fetch_results) => {
                            if ("success" in fetch_results) {
                                setAccounts(fetch_results.data);
                                setTitle(fetch_results.data.length + " Accounts")
                                closeDialog();
                            } else if ("error" in fetch_results) {
                                console.log("an error occurred retrieving accounts list: " + fetch_results.error)
                            }
                        }
                    )
                } else if ("error" in results) {
                    console.log("error creating accounts record: " + results.error)
                }
            })
    }


    return (
        <Dialog
            fullWidth
            maxWidth="xl"
            scroll="paper"
            open={createDialogVisible}
            // style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <DialogTitle>Create Account</DialogTitle>
            <DialogContent dividers>
                <Grid container spacing={1}>
                    <Grid item xs={12}>

                        <TextField fullWidth id="account-accountId" margin="normal" label="AWS Account ID"
                                   helperText="Enter 12 digit account id, e.g. 123456789012" value={accountId}
                                   onChange={(e) => {
                                       setAccountId(e.target.value);
                                   }} required/>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth id="account-region" margin="normal" label="AWS Region"
                                   helperText="Enter the AWS DRS region for the account, e.g. us-west-2" value={region}
                                   onChange={(e) => {
                                       setRegion(e.target.value)
                                   }}/>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button onClick={handleCreateAccount}>Create</Button>
            </DialogActions>
        </Dialog>
    )
}

const DeleteAccountDialog = ({
                                 fetchAccounts,
                                 deleteDialogVisible,
                                 setDeleteDialogVisible,
                                 currentAccountIndex,
                                 setCurrentAccountIndex,
                                 setAccounts,
                                 accounts,
                                 setTitle
                             }) => {

    function closeDialog() {
        setDeleteDialogVisible(false);
    }

    //TODO:  Add an error alert to dialog on error.
    async function handleDeleteAccount() {
        deleteAccount(accounts[currentAccountIndex],
            (results) => {
                if ("success" in results) {
                    fetchAccounts(
                        (fetch_results) => {
                            if ("success" in fetch_results) {
                                setCurrentAccountIndex(currentAccountIndex > 0 ? (currentAccountIndex - 1) : 0)
                                setAccounts(fetch_results.data);
                                setTitle(fetch_results.data.length + " Accounts")
                                closeDialog();
                            } else if ("error" in fetch_results) {
                                console.log("an error occurred retrieving the accounts list: " + fetch_results.error)
                            }
                        }
                    )
                } else if ("error" in results) {
                    console.log("an error occurred deleting the account: " + results.error)
                }
            }
        );
    }


    return (
        <Dialog
            sx={{'& .MuiDialog-paper': {width: '80%', maxHeight: 435}}}
            maxWidth="xs"
            open={deleteDialogVisible}
            // style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <DialogTitle>Delete Account: {accounts[currentAccountIndex].AccountId}?</DialogTitle>
            <DialogContent dividers>
                <Typography>You are about to delete the Account: <b>{accounts[currentAccountIndex].AccountId}</b> from
                    the
                    available list.
                    This process removes the account from the account list so that new applications can't be assigned
                    this account or existing applications can't be updated to use this account.
                    Any existing applications that are using this account will not be changed.
                    <br/>
                    <br/>
                    This process
                    can't be undone.
                    Are you sure
                    you want to proceed?</Typography>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={closeDialog}>
                    Cancel
                </Button>
                <Button onClick={handleDeleteAccount}>Delete</Button>
            </DialogActions>
        </Dialog>
    )
}


function Accounts({
                      fetchAccounts,
                      accounts,
                      setAccounts,
                      user,
                      signOut
                  }) {
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [createDialogVisible, setCreateDialogVisible] = useState(false);
    const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
    const [title, setTitle] = useState("")

    return (
        <Grow in={true}>
            <Box sx={{flexGrow: 1}}>
                <Box sx={{flexGrow: 1}}>
                    <AppBar position="static">
                        <Toolbar>
                            <Typography variant="h6" component="div" sx={{flexGrow: 1}}>
                                {title}
                            </Typography>
                            <Button color="inherit" onClick={signOut}>SignOut {user.attributes.email}</Button>
                        </Toolbar>
                    </AppBar>
                </Box>

                <Box sx={{flexGrow: 1}}>
                    {
                        accounts == null && <Skeleton animation="wave"/>
                    }

                    {
                        accounts != null && (accounts.length === 0 ?
                                <Typography variant="h5" align="center" sx={{m: 2}}>No accounts exist, please create
                                    one.</Typography> : (
                                    <Box sx={{flexGrow: 1}}>
                                        <List dense sx={{width: '100%', bgcolor: 'background.paper'}}>
                                            {
                                                accounts.map((account_item, idx) => {
                                                    return (
                                                        <ListItem key={account_item.AccountId}
                                                        >
                                                            <Grid container direction="row" align="center">
                                                                <Grid item xs={11}>
                                                                    <ListItemButton role={undefined}
                                                                                    dense>
                                                                        <ListItemText
                                                                            primary={`AWS Account ID: ${account_item.AccountId}`}
                                                                            secondary={`Description: ${account_item.Region}`}
                                                                        />
                                                                    </ListItemButton>
                                                                </Grid>
                                                                <Grid item xs={1} align="center">
                                                                    <IconButton aria-label="delete"
                                                                                onClick={() => {
                                                                                    setCurrentAccountIndex(idx)
                                                                                    setDeleteDialogVisible(true);
                                                                                }}
                                                                    >
                                                                        <DeleteIcon/>
                                                                    </IconButton>
                                                                </Grid>
                                                            </Grid>
                                                        </ListItem>
                                                    )
                                                })}
                                        </List>
                                    </Box>
                                )
                        )
                    }

                    {
                        accounts != null && accounts.length !== 0 &&
                        <DeleteAccountDialog
                            fetchAccounts={fetchAccounts}
                            setCurrentAccountIndex={setCurrentAccountIndex}
                            setAccounts={setAccounts}
                            accounts={accounts}
                            deleteDialogVisible={deleteDialogVisible}
                            setDeleteDialogVisible={setDeleteDialogVisible}
                            currentAccountIndex={currentAccountIndex}
                            setTitle={setTitle}

                        />
                    }
                    <CreateAccountsDialog
                        fetchAccounts={fetchAccounts}
                        createDialogVisible={createDialogVisible}
                        setCreateDialogVisible={setCreateDialogVisible}
                        setAccounts={setAccounts}
                        setTitle={setTitle}
                    />

                </Box>
                <Stack spacing={4} direction="row" justifyContent="center" alignItems="center">
                    <Button variant="contained"
                            onClick={() => {
                                setCreateDialogVisible(true);
                            }}
                    >
                        Create Account
                    </Button>
                </Stack>
            </Box>
        </Grow>
    );
}

export default Accounts;
