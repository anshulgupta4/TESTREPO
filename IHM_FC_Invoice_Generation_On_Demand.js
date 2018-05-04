/**
*@NApiVersion 2.x.1
*@NScriptType ClientScript
*/
//FOR DEMO on FRIDAY
/*
FRICE ID            : E-024 Invoice Generation
Name                : IHM_FC_Invoice_Generation_On_Demand.js
Purpose             : Client Script for On Demand Invoicing Suitelet
Created On          : 28 Nov 2016
Author              : Nitish Mishra
Script Type         : Client Script
*/

define(['N/currentRecord', 'N/url', 'N/https', '/.bundle/176344/IHM_Account_Constant.js'],
    function (currentRecord, url, https, accountConstant) {

        // File Constants
        var FILE_CONSTANT = {
            ON_DEMAND_SUITELET: {
                SCRIPT_ID: 'customscript_ihm_fs_inv_gen_on_demand',
                DEPLOY_ID: 'customdeploy_ihm_fs_inv_gen_on_demand'
            },
            URL: {
                DASHBOARD: '/app/center/card.nl?sc=-29&whence='
            },
            CONFIRMATION_MESSAGE: 'Creating an On-Demand Invoice may not include all Spots for the' +
            ' Client(s) because of a delay in receiving fulfillment data into NetSuite.' +
            '  If additional spots are expected to be added to this Order, please wait ' +
            'until tomorrow to create this Invoice.  This will prevent Spots from being missed on' +
            ' the Invoice.',
            PAGE_CHANGE_MESSAGE: 'Changing the page will unselect the selected sales order.\n' +
            'Are you sure you want to continue ?'
        };

        /*
        Function Name : SaveRecord
        Purpose       : - Show a confirmation message for submit.
                        - Pass the selected sales order to the suitelet for processing
                        - Redirect the user to the dashboard
        */
        function SaveRecord() {
            try {
                var confirmationValue = window.confirm(FILE_CONSTANT.CONFIRMATION_MESSAGE);

                if (confirmationValue) {
                    var record = currentRecord.get();
                    var lineCount = record.getLineCount({ sublistId: 'custpage_so_list' });
                    var arrSelectedSoList = [];

                    // add all the selected orders to the array
                    for (var i = 0; i < lineCount; i++) {
                        var recordId = record.getSublistValue({ sublistId: 'custpage_so_list', fieldId: 'internalid', line: i });

                        if (record.getSublistValue({ sublistId: 'custpage_so_list', fieldId: 'check', line: i })) {
                            arrSelectedSoList.push(recordId);
                        }
                    }

                    if (arrSelectedSoList.length > 0) {
                        // generate the suitelet url for posting the data
                        var suiteletUrl = url.resolveScript({
                            scriptId: FILE_CONSTANT.ON_DEMAND_SUITELET.SCRIPT_ID,
                            deploymentId: FILE_CONSTANT.ON_DEMAND_SUITELET.DEPLOY_ID
                        });

                        // post data to the suitelet
                        var dataFromSuiteletText = https
                            .post({
                                url: suiteletUrl,
                                body: { salesorders: arrSelectedSoList }
                            });
                        var dataFromSuiteletObj = JSON.parse(dataFromSuiteletText.body);

                        // if success, redirect to dashboard else show error message
                        if (dataFromSuiteletObj.Status) {
                            window.onbeforeunload = null;
                            window.location = FILE_CONSTANT.URL.DASHBOARD;
                        }
                        else {
                            alert(dataFromSuiteletObj.Message);
                        }
                    }
                    else {
                        alert("No lines selected for invoicing");
                    }
                }
            }
            catch (err) {
                console.log(err);
                alert(err.message);
            }

            return false;
        }


        /*
        Function Name : GetSalesOrder
        Purpose       : Pass the entered client to the suitelet and load it, to show the sales order as per that customer
        */
        function GetSalesOrder() {
            var record = currentRecord.get();
            var selectedCustomer = record.getValue({ fieldId: 'custpage_customer' });

            if (selectedCustomer) {
                var suiteletUrl = url.resolveScript({
                    scriptId: FILE_CONSTANT.ON_DEMAND_SUITELET.SCRIPT_ID,
                    deploymentId: FILE_CONSTANT.ON_DEMAND_SUITELET.DEPLOY_ID,
                    params: {
                        custpage_customer: selectedCustomer
                    }
                });
                window.onbeforeunload = null;
                window.location = suiteletUrl;
            }
            else {
                alert("Please select a client");
            }
        }

        /*
        Function Name : NextPage
        Purpose       : Show the next page
        */
        function NextPage() {
            var record = currentRecord.get();
            var selectedCustomer = record.getValue({ fieldId: 'custpage_customer' });

            if (selectedCustomer) {
                var doRedirect = true;

                if (IsAnyOrderSelected(record)) {
                    doRedirect = confirm(FILE_CONSTANT.PAGE_CHANGE_MESSAGE);
                }

                if (doRedirect) {
                    var suiteletUrl = url.resolveScript({
                        scriptId: FILE_CONSTANT.ON_DEMAND_SUITELET.SCRIPT_ID,
                        deploymentId: FILE_CONSTANT.ON_DEMAND_SUITELET.DEPLOY_ID,
                        params: {
                            custpage_customer: selectedCustomer,
                            custpage_start_index: parseFloat(record.getValue({ fieldId: 'custpage_start_index' }))
                            + accountConstant.MAX_PAGE_LINE_COUNT
                        }
                    });
                    window.onbeforeunload = null;
                    window.location = suiteletUrl;
                }
            }
            else {
                alert("Please select a client");
            }
        }

        /*
        Function Name : LastPage
        Purpose       : Show the previous page
        */
        function LastPage() {
            var record = currentRecord.get();
            var selectedCustomer = record.getValue({ fieldId: 'custpage_customer' });

            if (selectedCustomer) {
                var doRedirect = true;

                if (IsAnyOrderSelected(record)) {
                    doRedirect = confirm(FILE_CONSTANT.PAGE_CHANGE_MESSAGE);
                }

                if (doRedirect) {
                    var suiteletUrl = url.resolveScript({
                        scriptId: FILE_CONSTANT.ON_DEMAND_SUITELET.SCRIPT_ID,
                        deploymentId: FILE_CONSTANT.ON_DEMAND_SUITELET.DEPLOY_ID,
                        params: {
                            custpage_customer: selectedCustomer,
                            custpage_start_index: parseFloat(record.getValue({ fieldId: 'custpage_start_index' }))
                            - accountConstant.MAX_PAGE_LINE_COUNT
                        }
                    });
                    window.onbeforeunload = null;
                    window.location = suiteletUrl;
                }
            }
        }

        /*
        <purpose>
        Check if any line was selected on the current page
        </purpose>
        <params name="record" type="NetSuite object">Current Record object</params>
        <returns> boolean </returns>                              
        */
        function IsAnyOrderSelected(record) {
            var lineCount = record.getLineCount({ sublistId: 'custpage_so_list' });

            for (var i = 0; i < lineCount; i++) {

                if (record.getSublistValue({ sublistId: 'custpage_so_list', fieldId: 'check', line: i })) {
                    return true;
                }
            }

            return false;
        }

        return {
            saveRecord: SaveRecord,
            getSalesOrder: GetSalesOrder,
            nextPage: NextPage,
            lastPage: LastPage
        };
    });