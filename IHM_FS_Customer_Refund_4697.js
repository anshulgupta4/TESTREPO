/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 *@NModuleScope public
 * testing ns files
 */

/*
FRICE ID            : E-017 Refund Engine
Name                : IHM_FS_Customer_Refund.js
Purpose             : Suitelet to allow user to create / approve / reject a custom Customer Refund record
Created On          : 6 March 2017
Author              : Nitish Mishra
Script Type         : Suitelet
Saved Searches      : customsearch_unapplied_payment_amount
*/

define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/format', '/.bundle/176344/Log_Handler.js', 'N/file'],
    function (ui, record, search, format, errorHandler, file) {

        // File Constants
        var FILE_CONSTANT = {
        	PAGE_SIZE : 25,	
            RECORDS: {
                CUSTOMER_REFUND: 'customrecord_customer_refund'
            },
            FORM_TITLE: "Customer Refund",
            CLIENT_SCRIPT_FILE_ID: "./IHM_FC_Customer_Refund.js",
            PAYMENT_RECORD_LINK: "/app/accounting/transactions/custpymt.nl?id=",
            REQUEST_TYPE: {
                GET: 'GET'
            },
            SAVED_SEARCH: {
                UNAPPLIED_PAYMENT_SEARCH: 'customsearch_unapplied_payment_amount'
            },
            DEFAULT_VALUES: {
                AP_ACCOUNT: '',
                AR_ACCOUNT: '',
                SUBSIDIARY: 2,
                SALES_CHANNEL: '',
                NEW_BUSINESS: '',
                BU: '',
                DEPT: ''
            },
            MODE: {
                VIEW: "view",
                CREATE: "create",
                LEVEL_1_APPROVAL_SUBMIT: "level1",
                LEVEL_2_APPROVAL_SUBMIT: "level2"
            },
            STATUS: {
                PENDING_LEVEL_1_APPROVAL: '1',
                PENDING_LEVEL_2_APPROVAL: '2',
                APPROVED: '3',
                REJECTED: '4'
            },
            APPROVAL_LIST_SUITELET: {
                SCRIPT_ID: 'customscript_ihm_fs_pending_approval_cr',
                DEPLOY_ID: 'customdeploy_ihm_fs_pending_approval_cr'
            },
            SUBMITTED_LIST_SUITELET: {
                SCRIPT_ID: 'customscript_ihm_fs_submitted_refunds',
                DEPLOY_ID: 'customdeploy_ihm_fs_submitted_refunds'
            },
            ROLES: {
                SUBMITTER: [],
                APPROVER_1: [],
                APPROVER_2: []
            },
            PARENT_FOLDER_ID: ''
        };

        /*
        <purpose>
        Initialize the values of the file constants
        </purpose>
        <params name="" type=""> NONE </params>
        <returns> NONE </returns>    
        */
        function Constructor() {
            try {
                require(["N/config"], function (config) {
                    var companyInfo = config.load({
                        type: config.Type.COMPANY_PREFERENCES
                    });

                    FILE_CONSTANT.ROLES.SUBMITTER = companyInfo.getValue("custscript_refund_requestor_roles").split(",");
                    FILE_CONSTANT.ROLES.APPROVER_1 = companyInfo.getValue("custscript_refund_approver_1_roles").split(",");
                    FILE_CONSTANT.ROLES.APPROVER_2 = companyInfo.getValue("custscript_refund_approver_2_roles").split(",");
                    FILE_CONSTANT.DEFAULT_VALUES.AP_ACCOUNT = companyInfo.getValue("custscript_sb3_222_bnr_credit_account").trim();
                    FILE_CONSTANT.DEFAULT_VALUES.AR_ACCOUNT = companyInfo.getValue("custscript_sb3_222_bnr_debit_account").trim();

                    FILE_CONSTANT.DEFAULT_VALUES.SALES_CHANNEL = companyInfo.getValue("custscript_refund_sales_channel").trim();
                    FILE_CONSTANT.DEFAULT_VALUES.NEW_BUSINESS = companyInfo.getValue("custscript_refund_new_business").trim();
                    FILE_CONSTANT.DEFAULT_VALUES.BU = companyInfo.getValue("custscript_refund_default_bu").trim();
                    FILE_CONSTANT.DEFAULT_VALUES.DEPT = companyInfo.getValue("custscript_refund_default_dept").trim();

                    FILE_CONSTANT.PARENT_FOLDER_ID = companyInfo.getValue("custscript_refund_supporting_doc_folder");
                });
            } catch (err) {
                log.error("Constructor", err);
                throw err;
            }
        }

        /*
        Function Name : OnRequest
        Purpose       : - Create a form to submit / approve / reject a custom Refund record based on the logged user role and record status
                        - Submit / Approve/Reject a custom Refund based on the request type
        */
        function OnRequest(context) {
            var logObjectInput = errorHandler.Start('custscript_sb3_238_log_flag',
                'custscript_sb3_238_frice_id', 'custscript_sb3_238_execution_id',
                'custscript_sb3_238_parent_deploy_id', '', false);
            try {
                Constructor();

                if (context.request.method == FILE_CONSTANT.REQUEST_TYPE.GET) {
                    GetForm(context);
                } else {
                    PostForm(context);
                }
            } catch (err) {
                log.error('OnRequest', err);
                errorHandler.Error(logObjectInput, err.name, err.message, null, null, null, null, 'OnRequest', true);
            }
            errorHandler.End(logObjectInput, false);
        }

        /*
        <purpose>
        Create a form to submit / approve / reject a custom Refund record based on the logged user role and record status
        </purpose>
        <params name="context" type="NetSuite object">NetSuite standard context object</params>
        <returns> NONE </returns>    
        */
        function GetForm(context) {
            try {
                // Create form for the refund 
                var form = ui.createForm({
                    title: FILE_CONSTANT.FORM_TITLE
                });
                form.clientScriptFileId = FILE_CONSTANT.CLIENT_SCRIPT_FILE_ID;

                // Primary Information group
                form.addFieldGroup({
                    id: 'custpage_grp_primary',
                    label: 'Primary Information'
                });

                var modeField = form.addField({
                    id: 'custpage_mode',
                    label: 'Mode',
                    type: 'text',
                    container: 'custpage_grp_primary'
                });

                var internalIdField = form.addField({
                    id: 'custpage_internal_id',
                    label: 'Internal Id',
                    type: 'text',
                    container: 'custpage_grp_primary'
                });

                var idField = form.addField({
                    id: 'custpage_id',
                    label: 'Id',
                    type: 'text',
                    container: 'custpage_grp_primary'
                });

                var customerField = form.addField({
                    id: 'custpage_customer',
                    label: 'Customer',
                    type: 'select',
                    source: 'customer',
                    container: 'custpage_grp_primary'
                });
                customerField.isMandatory = true;

                var refundMethodField = form.addField({
                    id: 'custpage_refund_method',
                    label: 'Refund Method',
                    type: 'select',
                    source: 'paymentmethod',
                    container: 'custpage_grp_primary'
                });
                refundMethodField.isMandatory = true;

                var apAccountField = form.addField({
                    id: 'custpage_ap_account',
                    label: 'A/P Account',
                    type: 'select',
                    source: 'account',
                    container: 'custpage_grp_primary'
                });
                apAccountField.isMandatory = true;

                var arAccountField = form.addField({
                    id: 'custpage_ar_account',
                    label: 'A/R Account',
                    type: 'select',
                    source: 'account',
                    container: 'custpage_grp_primary'
                });
                arAccountField.isMandatory = true;

                var tranDateField = form.addField({
                    id: 'custpage_tran_date',
                    label: 'Date',
                    type: 'date',
                    container: 'custpage_grp_primary'
                });
                tranDateField.isMandatory = true;

                var memoField = form.addField({
                    id: 'custpage_memo',
                    label: 'Memo',
                    type: 'text',
                    container: 'custpage_grp_primary'
                });
                memoField.isMandatory = false;

                var addressField = form.addField({
                    id: 'custpage_address',
                    label: 'Address',
                    type: 'textarea',
                    container: 'custpage_grp_primary'
                });
                addressField.isMandatory = true;

                var rejectReasonField = form.addField({
                    id: 'custpage_rejection_reason',
                    label: 'Rejection Reason',
                    type: 'textarea',
                    container: 'custpage_grp_primary'
                });
                rejectReasonField.isMandatory = false;

                var refundJustificationField = form.addField({
                    id: 'custpage_refund_justification',
                    label: 'Refund Justification',
                    type: 'textarea',
                    container: 'custpage_grp_primary'
                });
                refundJustificationField.isMandatory = true;

                var supportingDocumentRefField = form.addField({
                    id: 'custpage_supporting_doc_ref',
                    label: 'Supporting Document',
                    type: ui.FieldType.INLINEHTML
                    //container: 'custpage_grp_primary'
                });
                supportingDocumentRefField.isMandatory = false;

                var folderField = form.addField({
                    id: 'custpage_folder',
                    label: 'Folder',
                    type: 'text'
                    //container: 'custpage_grp_primary'
                });
                folderField.isMandatory = false;

                var supportingDocumentField = form.addField({
                    id: 'custpage_supporting_doc',
                    label: 'Supporting Document',
                    type: ui.FieldType.FILE
                    //container: 'custpage_grp_primary'
                });
                supportingDocumentField.isMandatory = false;

                // Classification group
                form.addFieldGroup({
                    id: 'custpage_grp_classification',
                    label: 'Classification'
                });
                var subsidiaryField = form.addField({
                    id: 'custpage_subsidiary',
                    label: 'Subsidiary',
                    type: 'select',
                    source: 'subsidiary',
                    container: 'custpage_grp_classification'
                });
                
                var linesSelected1 = form.addField({
                    id: 'custpage_lines_selected',
                    label: 'Lines Selected',
                    type: "text"
                });
                
                var deptField = form.addField({
                    id: 'custpage_dept',
                    label: 'Dept',
                    type: 'select',
                    source: 'customrecord_cseg_ihm_dept_segme',
                    container: 'custpage_grp_classification'
                });

                var buField = form.addField({
                    id: 'custpage_bu',
                    label: 'Business Unit',
                    type: 'select',
                    source: 'department',
                    container: 'custpage_grp_classification'
                });

                var newBusinessField = form.addField({
                    id: 'custpage_new_business',
                    label: 'New Business',
                    type: 'select',
                    source: 'customrecord_cseg_ihm_new_busine',
                    container: 'custpage_grp_classification'
                });

                var salesChannelField = form.addField({
                    id: 'custpage_sales_channel',
                    label: 'Sales Channel',
                    type: 'select',
                    source: 'customrecord_cseg_ihm_sale_chan',
                    container: 'custpage_grp_classification'
                });

                var marketIdField = form.addField({
                    id: 'custpage_market_id',
                    label: 'Market Id',
                    type: 'text',
                    container: 'custpage_grp_classification'
                });
                marketIdField.isMandatory = true;

                // apply tab
                form.addTab({
                    id: 'custpage_apply',
                    label: 'Apply'
                });

                var totalRefundAmountField = form.addField({
                    id: 'custpage_total_refund_amount',
                    label: 'Total Refund Amount',
                    type: 'currency',
                    container: 'custpage_apply'
                });

                // Payable Tab
                form.addTab({
                    id: 'custpage_payables',
                    label: 'Payable'
                });

                var payToField = form.addField({
                    id: 'custpage_pay_to',
                    label: 'Pay To',
                    type: 'text',
                    //source: 'customer',
                    container: 'custpage_payables'
                });
                payToField.isMandatory = true;

                var payGroupField = form.addField({
                    id: 'custpage_pay_group',
                    label: 'Pay Group',
                    type: 'select',
                    source: 'customlist_ihm_pay_group',
                    container: 'custpage_payables'
                });
                payGroupField.isMandatory = true;

                var descriptionField = form.addField({
                    id: 'custpage_description',
                    label: 'Description',
                    type: 'textarea',
                    container: 'custpage_payables'
                });
                descriptionField.isMandatory = true;

                var accountMessageField = form.addField({
                    id: 'custpage_account_message',
                    label: 'Account Message',
                    type: 'text',
                    container: 'custpage_payables'
                });
                accountMessageField.isMandatory = true;

                var requestedByField = form.addField({
                    id: 'custpage_requested_by',
                    label: 'Requested By',
                    type: 'select',
                    source: 'employee',
                    container: 'custpage_payables'
                });
                requestedByField.isMandatory = true;

                var glRefundAccountField = form.addField({
                    id: 'custpage_gl_refund_account',
                    label: 'GL Refund Account',
                    type: 'select',
                    source: 'account',
                    container: 'custpage_payables'
                });
                glRefundAccountField.isMandatory = true;

                var level1ApproverField = form.addField({
                    id: 'custpage_level_1_approver',
                    label: 'Level 1 Approver',
                    type: 'select',
                    source: 'employee',
                    container: 'custpage_payables'
                });
                level1ApproverField.isMandatory = false;

                // create refund sublist
                var refundSublist = form.addSublist({
                    id: 'custpage_refund_list',
                    label: 'Refund',
                    type: "list",
                    tab: 'custpage_apply'
                });
                                
                form.clientScriptFileId = FILE_CONSTANT.CLIENT_SCRIPT_FILE_ID;
              
                
                
                var applyField = refundSublist.addField({
                    id: 'apply',
                    label: 'Mark',
                    type: ui.FieldType.CHECKBOX
                });

                var paymentDateField = refundSublist.addField({
                    id: 'paymentdate',
                    label: 'Payment Date',
                    type: "date"
                });

                var documentIdField = refundSublist.addField({
                    id: 'documentnumber',
                    label: 'Ref No.',
                    type: "text"
                });

                var paymentIdField = refundSublist.addField({
                    id: 'paymentid',
                    label: 'Payment',
                    type: "text"
                });

                var paymentAmountField = refundSublist.addField({
                    id: 'originalamount',
                    label: 'Orig. Amt.',
                    type: "currency"
                });

                var amountRemainingField = refundSublist.addField({
                    id: 'amountremaining',
                    label: 'Amount Remaining - Hidden',
                    type: "currency"
                });

                var amountRemainingCopyField = refundSublist.addField({
                    id: 'amountremainingcopy',
                    label: 'Amount Remaining',
                    type: "currency"
                });

                var currencyField = refundSublist.addField({
                    id: 'currency',
                    label: 'Currency',
                    type: "text"
                });


                
                var amountField = refundSublist.addField({
                    id: 'amount',
                    label: 'Amount',
                    type: "currency"
                });
                
                
                // get the values to be populated on the form
                var requestParameters = context.request.parameters;
                
                // get the customer id (if passed) from the request
                var requestCustomer = requestParameters.custpage_customer;
                var linesSelected = requestParameters.custpage_lines_selected;
                
                // get the custom refund id (if passed) from the request
                var customerRefundId = requestParameters.custpage_internal_id;
                
                var startIndex = context.request.parameters.custpage_start_index;
                log.debug('LINES SELECTED ' , linesSelected);
                if (!startIndex) {
                    startIndex = 0;
                }
                if (!linesSelected) {
                	linesSelected = '';
                }
                startIndex = parseFloat(startIndex);
                linesSelected1.defaultValue = linesSelected;
                // get the default values to be set on the form
                var defaultValues = GetDefaultValues(customerRefundId, requestCustomer,startIndex,linesSelected);
                
                // set the value on the form
                form.updateDefaultValues(defaultValues.Body);
              
                if (requestCustomer) {//TODO:Code added
                    var startIndexField = form.addField({
                        id: 'custpage_start_index',
                        label: 'Start Index',
                        type: 'integer'
                    });

                    startIndexField.updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });

                    startIndexField.defaultValue = startIndex;
                    
                    if(startIndex > 0)
                    	refundSublist.addButton({ id: "tab3nextpage", label: "Last Page", functionName: "lastPage" });
                    
                   	refundSublist.addButton({ id: "tab3nextpage", label: "Next Page", functionName: "nextPage" });
                
                    
                /*    if (startIndex > 0) {
                    	refundSublist.addButton({ id: "tab3nextpage", label: "Previous Page", functionName: "lastPage"});
                    }

                    if (startIndex + defaultValues.PageLineLimit < defaultValues) {//TODO:How to check this
                    	refundSublist.addButton({ id: "tab3nextpage", label: "Next Page", functionName: "nextPage" });
                    }*/
                }
                //IHM_FC_DepositTransfer.js 
                // loop and set the values in the sublist
                var lineNumber = 0;
                var paymentList = defaultValues.Sublist;
                
                for (var paymentId in paymentList) {
                	
                    for (var field in paymentList[paymentId]) {
                    	
                        refundSublist.setSublistValue({
                            id: field,
                            line: lineNumber,
                            value: paymentList[paymentId][field]
                        });
                    }
                    lineNumber++;
                    if(lineNumber >= FILE_CONSTANT.PAGE_SIZE)
                    	break;
                }

                // set the display type and add buttons based on role and record status
                var arrHiddenFields = [],
                    arrDisabledFields = [],
                    arrEntryFields = [],
                    arrInlineFields = [];

                arrHiddenFields = [
                    modeField,
                    internalIdField,
                    //paymentIdField,
                    amountRemainingField,
                    folderField
                ];

                arrDisabledFields = [
                    subsidiaryField,
                    deptField,
                    buField,
                    newBusinessField,
                    salesChannelField,
                    totalRefundAmountField,
                    arAccountField,
                    apAccountField,
                    glRefundAccountField
                ];

                arrInlineFields = [
                    paymentDateField,
                    documentIdField,
                    paymentAmountField,
                    amountRemainingCopyField,
                    currencyField
                ];

                // if the suitelet is opened in View mode
                if (defaultValues.Body.custpage_mode == FILE_CONSTANT.MODE.VIEW) {
                    arrInlineFields.push(idField);
                    arrInlineFields.push(customerField);
                    arrInlineFields.push(tranDateField);
                    arrInlineFields.push(memoField);
                    arrInlineFields.push(refundMethodField);
                    arrInlineFields.push(payToField);
                    arrInlineFields.push(payGroupField);
                    arrInlineFields.push(descriptionField);
                    arrInlineFields.push(accountMessageField);
                    arrInlineFields.push(marketIdField);
                    arrInlineFields.push(requestedByField);
                    arrDisabledFields.push(applyField);
                    arrInlineFields.push(amountField);
                    arrInlineFields.push(addressField);
                    arrHiddenFields.push(level1ApproverField);
                    arrInlineFields.push(rejectReasonField);
                    arrInlineFields.push(refundJustificationField);
                }
                // if the suitelet is opened for first level approval
                else if (defaultValues.Body.custpage_mode == FILE_CONSTANT.MODE.LEVEL_1_APPROVAL_SUBMIT) {
                    form.addSubmitButton({
                        label: 'Approve'
                    });
                    form.addButton({
                        id: 'custpage_btn_reject',
                        label: 'Reject',
                        functionName: 'rejectButtonClick'
                    });

                    /*
                    arrInlineFields.push(idField);
                    arrInlineFields.push(customerField);
                    arrInlineFields.push(tranDateField);
                    arrInlineFields.push(memoField);
                    arrInlineFields.push(refundMethodField);
                    arrInlineFields.push(payToField);
                    arrInlineFields.push(payGroupField);
                    arrInlineFields.push(descriptionField);
                    arrInlineFields.push(accountMessageField);
                    arrInlineFields.push(requestedByField);
                    arrInlineFields.push(marketIdField);
                    arrDisabledFields.push(applyField);
                    arrDisabledFields.push(amountField);
                    arrInlineFields.push(addressField);
                    arrHiddenFields.push(level1ApproverField);
                    */

                    arrInlineFields.push(idField);
                    arrDisabledFields.push(customerField);
                    arrEntryFields.push(amountField);
                    arrEntryFields.push(addressField);
                    arrHiddenFields.push(level1ApproverField);
                    arrEntryFields.push(rejectReasonField);
                    arrEntryFields.push(refundJustificationField);
                }
                // if the suitelet is opened for second level approval
                else if (defaultValues.Body.custpage_mode == FILE_CONSTANT.MODE.LEVEL_2_APPROVAL_SUBMIT) {
                    form.addSubmitButton({
                        label: 'Approve'
                    });
                    form.addButton({
                        id: 'custpage_btn_reject',
                        label: 'Reject',
                        functionName: 'rejectButtonClick'
                    });

                    arrInlineFields.push(idField);
                    arrDisabledFields.push(customerField);
                    arrEntryFields.push(amountField);
                    arrEntryFields.push(addressField);
                    arrInlineFields.push(level1ApproverField);
                    arrEntryFields.push(rejectReasonField);
                    arrEntryFields.push(refundJustificationField);
                } else { // if the suitelet is opened in create mode
                    form.addSubmitButton({
                        label: 'Submit'
                    });
                    arrHiddenFields.push(idField);
                    arrEntryFields.push(customerField);
                    arrEntryFields.push(tranDateField);
                    arrEntryFields.push(payToField);
                    arrEntryFields.push(payGroupField);
                    arrEntryFields.push(descriptionField);
                    arrEntryFields.push(accountMessageField);
                    arrEntryFields.push(requestedByField);
                    arrEntryFields.push(applyField);
                    arrEntryFields.push(amountField);
                    arrEntryFields.push(addressField);
                    arrHiddenFields.push(level1ApproverField);
                    arrHiddenFields.push(rejectReasonField);
                    arrEntryFields.push(refundJustificationField);
                }

                //arrDisabledFields.push(supportingDocumentField);
                // set the display type of the fields
                arrDisabledFields.forEach(function (suiteletField) {
                    suiteletField.updateDisplayType({
                        displayType: ui.FieldDisplayType.DISABLED
                    });
                });
                arrHiddenFields.forEach(function (suiteletField) {
                    suiteletField.updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });
                });
                arrInlineFields.forEach(function (suiteletField) {
                    suiteletField.updateDisplayType({
                        displayType: ui.FieldDisplayType.INLINE
                    });
                });
                arrEntryFields.forEach(function (suiteletField) {
                    suiteletField.updateDisplayType({
                        displayType: ui.FieldDisplayType.ENTRY
                    });
                });

                // display the form
                context.response.writePage(form);
            } catch (err) {
                log.error('OnRequest', err);
                throw err;
            }
        }

        /*
        <purpose>
        Get all the unapplied payments for the customer
        </purpose>
        <params name="customerId" type="integer">Customer Internal Id</params>
        <returns>
        Object 
        - TotalRefundableAmount : total unapplied amount for all payment
        - PaymentList : list of payments and their unapplied amount
        </returns>    
        */
        function GetUnappliedPaymentRecord(customerId,startIndex,linesSelected) {
            try {
                var refundDetails = {
                    PaymentList: {},
                    TotalRefundableAmount: 0
                };

                if (customerId) {
                    // perform a search on the payment record to get all unapplied payments
                    var paymentSearch = search.load({
                        id: FILE_CONSTANT.SAVED_SEARCH.UNAPPLIED_PAYMENT_SEARCH
                    });

                    paymentSearch.filters.push(
                        search.createFilter({
                            name: "mainname",
                            operator: search.Operator.ANYOF,
                            values: [customerId]
                        })
                    );

                    var totalRefundableAmount = 0;
                    var paymentObject = {};

                    // loop through the search result and push all payment details into the paymentObject object
                    var paymentSearchPagedData = paymentSearch.runPaged({
                        pageSize: 1000
                    });
                    var count = -1;
                    paymentSearchPagedData.pageRanges.forEach(function (pageRange) {
                    	
                    	
                        var currentPage = paymentSearchPagedData.fetch({
                            index: pageRange.index
                        });
                        currentPage.data.forEach(function (row) {
                        	count++;
                        	
                        	if(count <= startIndex || count >= (startIndex + FILE_CONSTANT.PAGE_SIZE)){
                        		return true;
                        	}
                        	
                            var paymentId = row.getValue({
                                name: "internalid"
                            });
                            var amountRemaining = row.getValue({
                                name: "amountremaining"
                            });
                            var documentNumber = row.getValue({
                                name: "tranid"
                            });
                            totalRefundableAmount += parseFloat(amountRemaining);
                            var array = linesSelected.split(',');
                            var cb = count + startIndex;
                            var index = array.indexOf(cb+'');
                            log.debug('ARRAY ' + linesSelected + "," + (cb) + ","+index);
                            
                            paymentObject[paymentId] = {
                            	apply: (index>-1)?'T':'F',
                                documentnumber: documentNumber,
                                paymentid: paymentId,
                                paymentlink: GeneratePaymentLink(documentNumber, paymentId),
                                paymentdate: row.getValue({
                                    name: "trandate"
                                }),
                                amountremainingcopy: amountRemaining,
                                amountremaining: amountRemaining,
                                originalamount: row.getValue({
                                    name: "total"
                                }),
                                currency: row.getText({
                                    name: "currency"
                                }),
                                amount: 0
                            };
                        });
                    });
                    refundDetails.PaymentList = paymentObject;
                    refundDetails.TotalRefundableAmount = totalRefundableAmount;
                    refundDetails.pageLines = paymentSearchPagedData.count;
                    log.debug('LINES ON PAGE ',paymentSearchPagedData.count);
                }

                return refundDetails;
            } catch (err) {
                log.error("GetUnappliedPaymentRecord", err);
                throw err;
            }
        }

        /*
       <purpose>
       Create a link to view the payment record
       </purpose>
       <params name="documentNumber" type="string">Payment Id</params>
       <params name="internalid" type="integer">Internal Id of the payment record</params>
       <returns>
       String : link to the payment record
       </returns>    
       */
        function GeneratePaymentLink(documentNumber, internalid) {
            return "<a href='" + FILE_CONSTANT.PAYMENT_RECORD_LINK + internalid + "' target='_blank'>" + documentNumber + "</a>";
        }

        /*
        <purpose>
        Depending on the mode of submit :
        - create : create a new custom refund record
        - approve1 : set the status of the custom refund record as "Pending Level 2 Approval"
        - approve2 : set the status of the custom refund record as "Approved"
        </purpose>
        <params name="context" type="NetSuite object">NetSuite standard context object</params>       
        <returns> NONE </returns>    
        */
        function PostForm(context) {
            try {
                var request = context.request;
                var requestParameters = context.request.parameters;
                var mode = requestParameters.custpage_mode;
                var customerRefundId = requestParameters.custpage_internal_id;

                // get the logged user
                var loggedUser = "";
                require(['N/runtime'], function (runtime) {
                    loggedUser = runtime.getCurrentUser().id;
                });

                // if mode is set to create, create a new custom refund record
                if (mode == FILE_CONSTANT.MODE.CREATE) {
                    var customerRefundRec = record.create({
                        type: FILE_CONSTANT.RECORDS.CUSTOMER_REFUND,
                        isDynamic: true
                    });

                    // save the supporting document
                    var attachedFiles = context.request.files;
                    var supportingDoc = attachedFiles["custpage_supporting_doc"];
                    var supportingDocId = "";
                    var folderId = CreateSubFolder();

                    if (supportingDoc) {
                        supportingDoc.folder = folderId;
                        supportingDoc.name = supportingDoc.name;
                        supportingDocId = supportingDoc.save();
                        log.audit("Supporting Doc Id", supportingDocId);
                        customerRefundRec.setValue('custrecord_cr_supporting_document', supportingDocId);
                    }

                    customerRefundRec.setValue('custrecord_cr_customer', requestParameters.custpage_customer);
                    customerRefundRec.setValue('custrecord_cr_status', FILE_CONSTANT.STATUS.PENDING_LEVEL_1_APPROVAL);
                    customerRefundRec.setValue('custrecord_cr_created_by', loggedUser);
                    customerRefundRec.setValue('custrecord_cr_folder_id', folderId);

                    customerRefundId = CreateUpdateCustomerRefund(customerRefundRec, context);
                    log.audit("Customer Refund Record Created", customerRefundId);

                    // redirect the user to the Submitted Refund list  
                    context.response.sendRedirect({
                        type: 'SUITELET',
                        identifier: FILE_CONSTANT.SUBMITTED_LIST_SUITELET.SCRIPT_ID,
                        id: FILE_CONSTANT.SUBMITTED_LIST_SUITELET.DEPLOY_ID,
                        parameters: {
                            refund_id: customerRefundId,
                            title: 'New Customer Refund Created',
                            message: ' has been created and is send for approval'
                        }
                    });
                }
                // if the mode is set to approve1, set the status as "Pending Level 2 Approval"
                else if (mode == FILE_CONSTANT.MODE.LEVEL_1_APPROVAL_SUBMIT) {

                    if (customerRefundId) {
                        /*
                        record.submitFields({
                            type: FILE_CONSTANT.RECORDS.CUSTOMER_REFUND,
                            id: customerRefundId,
                            values: {
                                custrecord_cr_level_1_approval_date: new Date(),
                                custrecord_cr_level_1_approver: loggedUser,
                                custrecord_cr_status: FILE_CONSTANT.STATUS.PENDING_LEVEL_2_APPROVAL
                            },
                            options: {
                                ignoreMandatoryFields: true
                            }
                        });
                        */

                        // load the record
                        var customerRefundRec = record.load({
                            type: FILE_CONSTANT.RECORDS.CUSTOMER_REFUND,
                            id: customerRefundId,
                            isDynamic: true
                        });

                        // save the supporting document
                        var attachedFiles = context.request.files;
                        var supportingDoc = attachedFiles["custpage_supporting_doc"];
                        var supportingDocId = "";
                        var folderId = CreateSubFolder();

                        if (supportingDoc) {
                            supportingDoc.folder = folderId;
                            supportingDoc.name = supportingDoc.name;
                            supportingDocId = supportingDoc.save();
                            log.audit("Supporting Doc Id", supportingDocId);
                            customerRefundRec.setValue('custrecord_cr_supporting_document', supportingDocId);
                        }

                        // set the status as Pending Level 2 Approval
                        customerRefundRec.setValue('custrecord_cr_folder_id', folderId);
                        customerRefundRec.setValue('custrecord_cr_status', FILE_CONSTANT.STATUS.PENDING_LEVEL_2_APPROVAL);
                        customerRefundRec.setValue('custrecord_cr_level_1_approver', loggedUser);
                        customerRefundRec.setValue('custrecord_cr_level_1_approval_date', new Date());

                        // remove all the lines already in the customer refund record
                        var lineCount = customerRefundRec.getLineCount('recmachcustrecord_crl_customer_refund');

                        for (var line = lineCount - 1; line >= 0; line--) {
                            customerRefundRec.removeLine('recmachcustrecord_crl_customer_refund', line, true);
                        }

                        // update the record and submit
                        customerRefundId = CreateUpdateCustomerRefund(customerRefundRec, context);
                        log.audit("Customer Refund Record 1nd Level Approved", customerRefundId);

                        // redirect the user to the Pending Approval Refund list                   
                        context.response.sendRedirect({
                            type: 'SUITELET',
                            identifier: FILE_CONSTANT.APPROVAL_LIST_SUITELET.SCRIPT_ID,
                            id: FILE_CONSTANT.APPROVAL_LIST_SUITELET.DEPLOY_ID,
                            parameters: {
                                refund_id: customerRefundId,
                                title: 'Customer Refund First Level Approved',
                                message: ' has been first level approved and is send for second level approval'
                            }
                        });
                    } else {
                        throw "Customer Refund Internal Id missing in the request object";
                    }
                }
                // if the mode is set to approve2, submit the details of the record and set the status as "Approved"
                else if (mode == FILE_CONSTANT.MODE.LEVEL_2_APPROVAL_SUBMIT) {

                    if (customerRefundId) {
                        // load the record
                        var customerRefundRec = record.load({
                            type: FILE_CONSTANT.RECORDS.CUSTOMER_REFUND,
                            id: customerRefundId,
                            isDynamic: true
                        });

                        // save the supporting document
                        var attachedFiles = context.request.files;
                        var supportingDoc = attachedFiles["custpage_supporting_doc"];
                        var supportingDocId = "";
                        var folderId = CreateSubFolder();

                        if (supportingDoc) {
                            supportingDoc.folder = folderId;
                            supportingDoc.name = supportingDoc.name;
                            supportingDocId = supportingDoc.save();
                            log.audit("Supporting Doc Id", supportingDocId);
                            customerRefundRec.setValue('custrecord_cr_supporting_document', supportingDocId);
                        }

                        // set the status as Approved
                        customerRefundRec.setValue('custrecord_cr_folder_id', folderId);
                        customerRefundRec.setValue('custrecord_cr_status', FILE_CONSTANT.STATUS.APPROVED);
                        customerRefundRec.setValue('custrecord_cr_level_2_approver', loggedUser);
                        customerRefundRec.setValue('custrecord_cr_level_2_approval_date', new Date());

                        // remove all the lines already in the customer refund record
                        var lineCount = customerRefundRec.getLineCount('recmachcustrecord_crl_customer_refund');

                        for (var line = lineCount - 1; line >= 0; line--) {
                            customerRefundRec.removeLine('recmachcustrecord_crl_customer_refund', line, true);
                        }

                        // update the record and submit
                        customerRefundId = CreateUpdateCustomerRefund(customerRefundRec, context);
                        log.audit("Customer Refund Record 2nd Level Approved", customerRefundId);

                        // redirect the user to the Pending Approval Refund list
                        context.response.sendRedirect({
                            type: 'SUITELET',
                            identifier: FILE_CONSTANT.APPROVAL_LIST_SUITELET.SCRIPT_ID,
                            id: FILE_CONSTANT.APPROVAL_LIST_SUITELET.DEPLOY_ID,
                            parameters: {
                                refund_id: customerRefundId,
                                title: 'Customer Refund Second Level Approved',
                                message: ' has been approved'
                            }
                        });
                    } else {
                        throw "Customer Refund Internal Id missing in the request object";
                    }
                }
            } catch (err) {
                log.error("PostForm", err);
                throw err;
            }
        }

        /*
		    <purpose>
		    Create / Update Custom Refund record
		    </purpose>
		    <params name="customerRefundRec" type="NetSuite record object">NetSuite record object</params>   
		    <params name="context" type="NetSuite object">NetSuite standard context object</params>       
		    <returns> record id </returns>    
        */
        function CreateUpdateCustomerRefund(customerRefundRec, context) {
            try {
                var request = context.request;
                var requestParameters = request.parameters;

                var enteredDateAsString = requestParameters.custpage_tran_date;
                var enteredDateAsDate = format.parse({
                    value: enteredDateAsString,
                    type: format.Type.DATE
                });
                customerRefundRec.setValue('custrecord_cr_transaction_date', enteredDateAsDate);
                customerRefundRec.setValue('custrecord_cr_refund_method', requestParameters.custpage_refund_method);
                customerRefundRec.setValue('custrecord_cr_ap_account', requestParameters.custpage_ap_account);
                customerRefundRec.setValue('custrecord_cr_ar_account', requestParameters.custpage_ar_account);
                customerRefundRec.setValue('custrecord_cr_memo', requestParameters.custpage_memo);
                customerRefundRec.setValue('custrecord_cr_address', requestParameters.custpage_address);
                customerRefundRec.setValue('custrecord_cr_market_id', requestParameters.custpage_market_id);
                customerRefundRec.setValue('custrecord_cr_subsidiary', requestParameters.custpage_subsidiary);
                customerRefundRec.setValue('custrecord_cr_business_unit', requestParameters.custpage_bu);
                customerRefundRec.setValue('custrecord_cr_sales_channel', requestParameters.custpage_sales_channel);
                customerRefundRec.setValue('custrecord_cr_dept', requestParameters.custpage_dept);
                customerRefundRec.setValue('custrecord_cr_new_business', requestParameters.custpage_new_business);
                customerRefundRec.setValue('custrecord_cr_pay_to', requestParameters.custpage_pay_to);
                customerRefundRec.setValue('custrecord_cr_pay_group', requestParameters.custpage_pay_group);
                customerRefundRec.setValue('custrecord_cr_descripton', requestParameters.custpage_description);
                customerRefundRec.setValue('custrecord_cr_account_message', requestParameters.custpage_account_message);
                customerRefundRec.setValue('custrecord_cr_requested_by', requestParameters.custpage_requested_by);
                customerRefundRec.setValue('custrecord_cr_gl_refund_account', requestParameters.custpage_gl_refund_account);
                customerRefundRec.setValue('custrecord_cr_total_refund_amount', parseFloat(requestParameters.custpage_total_refund_amount));
                customerRefundRec.setValue('custrecord_cr_refund_justification', requestParameters.custpage_refund_justification);

                // apply lines
                var refundListCount = context.request.getLineCount("custpage_refund_list");
                
                for (var line = 0; line < refundListCount; line++) {
                    var apply = request.getSublistValue("custpage_refund_list", "apply", line);

                    if (apply == 'T') {
                        customerRefundRec.selectNewLine("recmachcustrecord_crl_customer_refund");
                        customerRefundRec.setCurrentSublistValue("recmachcustrecord_crl_customer_refund",
                            "custrecord_crl_refund_tran_number",
                            request.getSublistValue("custpage_refund_list", "documentnumber", line));
                        customerRefundRec.setCurrentSublistValue("recmachcustrecord_crl_customer_refund",
                            "custrecord_crl_applied_transaction",
                            request.getSublistValue("custpage_refund_list", "paymentid", line));

                        var enteredDateAsString = request.getSublistValue("custpage_refund_list", "paymentdate", line);
                        var enteredDateAsDate = format.parse({
                            value: enteredDateAsString,
                            type: format.Type.DATE
                        });
                        customerRefundRec.setCurrentSublistValue("recmachcustrecord_crl_customer_refund",
                            "custrecord_crl_refunded_tran_date",
                            enteredDateAsDate
                        );

                        customerRefundRec.setCurrentSublistValue("recmachcustrecord_crl_customer_refund",
                            "custrecord_crl_amount_remaining",
                            parseFloat(request.getSublistValue("custpage_refund_list", "amountremaining", line)));
                        customerRefundRec.setCurrentSublistValue("recmachcustrecord_crl_customer_refund",
                            "custrecord_crl_original_amount",
                            parseFloat(request.getSublistValue("custpage_refund_list", "originalamount", line)));
                        customerRefundRec.setCurrentSublistValue("recmachcustrecord_crl_customer_refund",
                            "custrecord_crl_currency",
                            request.getSublistValue("custpage_refund_list", "currency", line));
                        customerRefundRec.setCurrentSublistValue("recmachcustrecord_crl_customer_refund",
                            "custrecord_crl_amount_refunded",
                            parseFloat(request.getSublistValue("custpage_refund_list", "amount", line)));
                        customerRefundRec.commitLine("recmachcustrecord_crl_customer_refund");
                    }
                }
                return customerRefundRec.save();
            } catch (err) {
                log.error("CreateUpdateCustomerRefund", err);
                throw err;
            }
        }

        /*
        <purpose>
        Get the default values to be set on the form
        </purpose>
        <params name="customerRefundId" type="string">Customer Refund Id</params>   
        <params name="customerId" type="string">Customer Id</params>       
        <returns> object </returns>    
        */
        function GetDefaultValues(customerRefundId, customerId,startIndex,linesSelected) {
            try {
                var defaultValues = {
                    Body: {},
                    Sublist: {},
                    pageLines: 0
                };
                
                // if the custom refund id is provided, load the custom record to get the values
                if (customerRefundId) {
                    var customerRefundRec = record.load({
                        type: FILE_CONSTANT.RECORDS.CUSTOMER_REFUND,
                        id: customerRefundId
                    });

                    var recordStatus = customerRefundRec.getValue('custrecord_cr_status');

                    defaultValues.Body = {
                        custpage_mode: GetModeBasedOnRole(recordStatus),
                        custpage_status: recordStatus,
                        custpage_internal_id: customerRefundId,
                        custpage_id: customerRefundRec.getValue('name'),
                        custpage_customer: customerRefundRec.getValue('custrecord_cr_customer'),
                        custpage_market_id: customerRefundRec.getValue('custrecord_cr_market_id'),
                        custpage_tran_date: format.format({
                            value: customerRefundRec.getValue('custrecord_cr_transaction_date'),
                            type: format.Type.DATE
                        }),
                        custpage_refund_method: customerRefundRec.getValue('custrecord_cr_refund_method'),
                        custpage_ap_account: customerRefundRec.getValue('custrecord_cr_ap_account'),
                        custpage_ar_account: customerRefundRec.getValue('custrecord_cr_ar_account'),
                        custpage_memo: customerRefundRec.getValue('custrecord_cr_memo'),
                        custpage_address: customerRefundRec.getValue('custrecord_cr_address'),
                        custpage_subsidiary: customerRefundRec.getValue('custrecord_cr_subsidiary'),
                        custpage_bu: customerRefundRec.getValue('custrecord_cr_business_unit'),
                        custpage_sales_channel: customerRefundRec.getValue('custrecord_cr_sales_channel'),
                        custpage_dept: customerRefundRec.getValue('custrecord_cr_dept'),
                        custpage_new_business: customerRefundRec.getValue('custrecord_cr_new_business'),
                        custpage_pay_to: customerRefundRec.getValue('custrecord_cr_pay_to'),
                        custpage_pay_group: customerRefundRec.getValue('custrecord_cr_pay_group'),
                        custpage_description: customerRefundRec.getValue('custrecord_cr_descripton'),
                        custpage_account_message: customerRefundRec.getValue('custrecord_cr_account_message'),
                        custpage_requested_by: customerRefundRec.getValue('custrecord_cr_requested_by'),
                        custpage_gl_refund_account: customerRefundRec.getValue('custrecord_cr_gl_refund_account'),
                        custpage_total_refund_amount: parseFloat(customerRefundRec.getValue('custrecord_cr_total_refund_amount')),
                        custpage_level_1_approver: customerRefundRec.getValue('custrecord_cr_level_1_approver'),
                        custpage_refund_justification: customerRefundRec.getValue('custrecord_cr_refund_justification'),
                        custpage_rejection_reason: customerRefundRec.getValue('custrecord_cr_rejection_reason'),
                        custpage_supporting_doc_ref: customerRefundRec.getValue('custrecord_cr_supporting_document'),
                        custpage_folder: customerRefundRec.getValue('custrecord_cr_folder_id')
                    };

                    // get the URL for the file
                    if (defaultValues.Body.custpage_supporting_doc_ref) {
                        var docFile = file.load({
                            id: defaultValues.Body.custpage_supporting_doc_ref
                        });

                        var fileUrl = docFile.url;
                        var fileName = docFile.name;

                        var href = "<a href='" + fileUrl + "' target='_BLANK' " +
                            "style='font-size: 12px;'>" + fileName + "</a>";
                        defaultValues.Body.custpage_supporting_doc_ref = href;
                    }

                    var lineCount = customerRefundRec.getLineCount('recmachcustrecord_crl_customer_refund');

                    for (var line = 0; line < lineCount; line++) {
                        var paymentId = customerRefundRec.getSublistValue('recmachcustrecord_crl_customer_refund',
                            'custrecord_crl_applied_transaction', line);
                        var paymentLineObj = {
                            apply: 'T',
                            documentnumber: customerRefundRec.getSublistValue('recmachcustrecord_crl_customer_refund',
                                'custrecord_crl_refund_tran_number', line),
                            paymentid: paymentId,
                            paymentdate: format.format({
                                value: customerRefundRec.getSublistValue('recmachcustrecord_crl_customer_refund',
                                    'custrecord_crl_refunded_tran_date', line),
                                type: format.Type.DATE
                            }),
                            amountremainingcopy: parseFloat(customerRefundRec.getSublistValue('recmachcustrecord_crl_customer_refund',
                                'custrecord_crl_amount_remaining', line)),
                            amountremaining: parseFloat(customerRefundRec.getSublistValue('recmachcustrecord_crl_customer_refund',
                                'custrecord_crl_amount_remaining', line)),
                            originalamount: parseFloat(customerRefundRec.getSublistValue('recmachcustrecord_crl_customer_refund',
                                'custrecord_crl_original_amount', line)),
                            currency: customerRefundRec.getSublistValue('recmachcustrecord_crl_customer_refund',
                                'custrecord_crl_currency', line),
                            amount: parseFloat(customerRefundRec.getSublistValue('recmachcustrecord_crl_customer_refund',
                                'custrecord_crl_amount_refunded', line))
                        };
                        defaultValues.Sublist[paymentId] = paymentLineObj;
                        
                    }
                } else {
                    // search and get the unapplied payment details
                    var refundDetails = GetUnappliedPaymentRecord(customerId,startIndex,linesSelected);

                    defaultValues.Body = {
                        custpage_mode: GetModeBasedOnRole(""),
                        custpage_status: "",
                        custpage_internal_id: "",
                        custpage_market_id: "",
                        custpage_id: "To Be Generated",
                        custpage_customer: customerId,
                        custpage_refund_method: "",
                        custpage_ap_account: FILE_CONSTANT.DEFAULT_VALUES.AP_ACCOUNT,
                        custpage_ar_account: FILE_CONSTANT.DEFAULT_VALUES.AR_ACCOUNT,
                        custpage_tran_date: format.format({
                            value: new Date(),
                            type: format.Type.DATE
                        }),
                        custpage_memo: "",
                        custpage_address: "",
                        custpage_subsidiary: FILE_CONSTANT.DEFAULT_VALUES.SUBSIDIARY,
                        custpage_dept: FILE_CONSTANT.DEFAULT_VALUES.DEPT,
                        custpage_bu: FILE_CONSTANT.DEFAULT_VALUES.BU,
                        custpage_new_business: FILE_CONSTANT.DEFAULT_VALUES.NEW_BUSINESS,
                        custpage_sales_channel: FILE_CONSTANT.DEFAULT_VALUES.SALES_CHANNEL,
                        custpage_total_refund_amount: 0,
                        custpage_pay_to: "",
                        custpage_pay_group: "",
                        custpage_description: "",
                        custpage_account_message: "",
                        custpage_requested_by: "",
                        custpage_gl_refund_account: FILE_CONSTANT.DEFAULT_VALUES.AP_ACCOUNT,
                        custpage_level_1_approver: "",
                        custpage_rejection_reason: "",
                        custpage_refund_justification: "",
                        custpage_folder: ""
                    }

                    defaultValues.Sublist = refundDetails.PaymentList;
                    defaultValues.pageLines = refundDetails.pageLines;
                }

                return defaultValues;
            } catch (err) {
                log.error("GetDefaultValues", err);
                throw err;
            }
        }

        /*
        <purpose>
        Based on the role and record status, return the mode of display for the suitelet
        </purpose>
        <params name="currentStatus" type="string">Current Record Status</params>
        <returns> string </returns>    
        */
        function GetModeBasedOnRole(currentStatus) {
            var roleId = "";
            require(['N/runtime'], function (runtime) {
                roleId = runtime.getCurrentUser().role.toString();
            });

            if (!currentStatus && FILE_CONSTANT.ROLES.SUBMITTER.indexOf(roleId) != -1) {
                return FILE_CONSTANT.MODE.CREATE;
            } else if (currentStatus == FILE_CONSTANT.STATUS.PENDING_LEVEL_1_APPROVAL &&
                FILE_CONSTANT.ROLES.APPROVER_1.indexOf(roleId) != -1) {
                return FILE_CONSTANT.MODE.LEVEL_1_APPROVAL_SUBMIT;
            } else if (currentStatus == FILE_CONSTANT.STATUS.PENDING_LEVEL_2_APPROVAL &&
                FILE_CONSTANT.ROLES.APPROVER_2.indexOf(roleId) != -1) {
                return FILE_CONSTANT.MODE.LEVEL_2_APPROVAL_SUBMIT;
            } else {
                return FILE_CONSTANT.MODE.VIEW;
            }
        }

        /*
        <purpose>
        Display the error page
        </purpose>
        <params name="context" type="NetSuite object">NetSuite standard context object</params> 
        <params name="errorMessage" type="Error">Error Message String</params> 
        <returns> NONE </returns>    
        */
        function ShowErrorPage(context, errorMessage) {
            try {
                var form = ui.createForm({
                    title: FILE_CONSTANT.FORM_TITLE
                });

                var errorMessageField = form.addField({
                    id: 'custpage_error',
                    label: 'Error',
                    type: 'text'
                });

                errorMessageField.defaultValue = errorMessage;
                errorMessageField.updateDisplayType({
                    displayType: ui.FieldDisplayType.INLINE
                });

                context.response.writePage(form);
            } catch (err) {
                log.error('OnRequest', err);
                throw err;
            }
        }

        /*
        <purpose>
        Format the date for the file name
        </purpose>
        <params name="" type=""></params>
        <returns> string </returns>    
        */
        function FormatDateForFileName() {
            var dateObj = new Date();
            return dateObj.toISOString();
        }

        function CreateSubFolder() {
            try {
                var newFolder = record.create({
                    type: record.Type.FOLDER
                });
                newFolder.setValue('name', FormatDateForFileName());
                newFolder.setValue('parent', FILE_CONSTANT.PARENT_FOLDER_ID);
                var folderId = newFolder.save();
                log.audit("New Folder Created", folderId);
                return folderId;
            } catch (err) {
                log.error('CreateSubFolder', err);
                throw err;
            }
        }

        return {
            onRequest: OnRequest
        };
    });