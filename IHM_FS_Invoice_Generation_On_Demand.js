/**
*@NApiVersion 2.x
*@NScriptType Suitelet
*@NModuleScope public
*/

/*
FRICE ID            : E-024 Invoice Generation
Name                : IHM_FS_Invoice_Generation_On_Demand.js
Purpose             : Suitelet for on-demand invoicing.
                      On submit, map reduce script is called to generate the invoices
Created On          : 28 Nov 2016
Author              : Nitish Mishra
Script Type         : Suitelet
Saved Searches      : customsearch_on_demand_invoicing_so

3/7/2017 : Moved some modules from define to require
*/

define(['/.bundle/176344/IHM_Account_Constant.js', './IHM_Lib_Invoice_Creation.js'],
    function (accountConstant, invoiceCreation) {

        // File Constants
        var FILE_CONSTANT = {
            FORM_TITLE: 'On-Demand Invoice Generation',
            SAVED_SEARCH: {
                ON_DEMAND_SO: 'customsearch_on_demand_invoicing_so'
            },
            REQUEST_TYPE: {
                GET: 'GET'
            },
            SHOW_PLUS_COUNT: 500
        };

        /*
        Function Name : OnRequest
        Purpose       : - Get : Create form to display sales order for invoice Generation
                        - Post : Call the map reduce script to generate invoice for the selected sales order
        */
        function OnRequest(context) {
            try {

                // if the suitelet is opened in Get mode, generate the Invoice Generation - On Demand Form
                if (context.request.method == FILE_CONSTANT.REQUEST_TYPE.GET) {
                    CreateInvoiceGenerationForm(context);
                }
                else { // post the form and trigger the Map / reduce script for invoice generaion
                    PostInvoiceGenerationForm(context);
                }
            }
            catch (err) {
                log.error('OnRequest', err);
            }
        }

        /*
        <purpose>
        Call the map reduce script for invoice generation for the provided sales orders
        </purpose>
        <params name="context" type="NetSuite object">NetSuite standard context object</params>
        <returns> Object as context response </returns>                              
        */
        function PostInvoiceGenerationForm(context) {

            require(['/.bundle/176344/Log_Handler.js'],
                function (errorHandler) {

                    var logObjectInput = errorHandler.Start('custscript_106_log_flag',
                        'custscript_106_fricew_id', 'custscript_106_execution_id',
                        'custscript_106_parent_deploy_id', '', true);

                    var response = {
                        Status: false,
                        Message: 'Not Started'
                    };

                    try {
                        var salesOrderListString = context.request.parameters.salesorders;

                        if (salesOrderListString) {
                            // calling map/reduce script for generating invoice
                            invoiceCreation.triggerInvoiceGenerationScript(salesOrderListString, true, false, logObjectInput);

                            response.Status = true;
                            response.Message = "";
                        }
                        else {
                            response.Message = "No Sales Order Provided";
                        }
                    }
                    catch (err) {
                        log.error('PostInvoiceGenerationForm', err);
                        errorHandler.Error(logObjectInput, err.name, err.message,
                            null, salesOrderListString, null, null, 'PostInvoiceGenerationForm', true);
                        response.Message = err;
                    }

                    context.response.write({ output: JSON.stringify(response) });
                    errorHandler.End(logObjectInput, true);
                });
        }

        /*
        <purpose>
        Create a form to allow customer selection. Pull the Sales Order (that can be invoiced) for this
        customer and show them in a sublist.
        </purpose>
        <params name="context" type="object">NetSuite Context Object</params>
        <returns> NONE </returns>                              
        */
        function CreateInvoiceGenerationForm(context) {
            try {
                require(['N/ui/serverWidget'], function (ui) {
                    var form = ui.createForm({
                        title: FILE_CONSTANT.FORM_TITLE
                    });
                    form.clientScriptFileId = FILE_CONSTANT.CLIENT_SCRIPT_FILE_ID;

                    // get the customer from the request object
                    var customerId = context.request.parameters.custpage_customer;

                    // check if a customer id is passed in the request parameter
                    if (customerId) {
                        form.addSubmitButton({ label: 'Generate Invoice(s)' });
                    }

                    form.addButton({
                        id: 'custpage_btn_get_so',
                        label: 'Refresh',
                        functionName: 'getSalesOrder'
                    });

                    // add customer selection field
                    var customerField = form.addField({
                        id: 'custpage_customer',
                        label: 'Client',
                        type: 'select',
                        source: 'customer'
                    });

                    customerField.isMandatory = true;
                    customerField.setHelpText({
                        help: "Select a customer to display the sales order"
                    });

                    // if a customer id is passed in the request parameter, disabled the customer field
                    if (customerId) {
                        customerField.defaultValue = customerId;
                    }

                    var startIndex = context.request.parameters.custpage_start_index;

                    if (!startIndex) {
                        startIndex = 0;
                    }
                    startIndex = parseFloat(startIndex);

                    // get sales order that are to be invoiced
                    var salesOrderDetails = GetSalesOrderToBeInvoiced(customerId, startIndex);
                    log.debug("salesOrderDetails.HasMoreRecord", salesOrderDetails.HasMoreRecord);
                    log.debug("salesOrderDetails.PageLineLimit", salesOrderDetails.PageLineLimit);
                    log.debug("salesOrderDetails.Total", salesOrderDetails.Total);
                    log.debug("salesOrderDetails.List", salesOrderDetails.List.length);
                    var salesOrderList = salesOrderDetails.List;
                    var pageSoCount = salesOrderList.length;

                    // set the search data in the sublist
                    var totalSoCount = salesOrderDetails.Total;
                    log.debug("soCount", totalSoCount);

                    // create sales order sublist
                    var sublistLabel = "Sales Order";
                    if (totalSoCount > 0) {
                        sublistLabel += " (" + (startIndex + 1).toFixed(0) + " to " +
                            ((startIndex + salesOrderDetails.PageLineLimit) > totalSoCount ? totalSoCount :
                                (startIndex + salesOrderDetails.PageLineLimit)).toFixed(0)
                            + " of " + totalSoCount.toFixed(0) + (salesOrderDetails.HasMoreRecord ? "+" : "")
                            + " )";
                    }

                    var soSublist = form.addSublist({
                        id: 'custpage_so_list',
                        label: sublistLabel,
                        type: ui.SublistType.LIST,
                    });
                    soSublist.addMarkAllButtons();

                    var soInternalIdField = soSublist.addField({
                        id: 'internalid',
                        label: 'Internal Id',
                        type: ui.FieldType.TEXT
                    });
                    soInternalIdField.updateDisplayType({
                        displayType: ui.FieldDisplayType.HIDDEN
                    });

                    soSublist.addField({
                        id: 'check',
                        label: 'Mark',
                        type: ui.FieldType.CHECKBOX
                    });

                    soSublist.addField({
                        id: 'trandate',
                        label: 'Date',
                        type: ui.FieldType.DATE
                    });

                    soSublist.addField({
                        id: 'sonumber',
                        label: 'Sales Order Number',
                        type: ui.FieldType.TEXT
                    });

                    soSublist.addField({
                        id: 'client',
                        label: 'Client Name',
                        type: ui.FieldType.TEXT
                    });

                    soSublist.addField({
                        id: 'agencyname',
                        label: 'Agency Name',
                        type: ui.FieldType.TEXT
                    });

                    soSublist.addField({
                        id: 'billingschedule',
                        label: 'Billing Schedule',
                        type: ui.FieldType.TEXT
                    });

                    for (var i = 0; i < pageSoCount; i++) {
                        var soObj = salesOrderList[i];

                        for (var field in soObj) {
                            soSublist.setSublistValue({
                                id: field,
                                line: i,
                                value: soObj[field]
                            });
                        }
                    }

                    if (customerId) {
                        var startIndexField = form.addField({
                            id: 'custpage_start_index',
                            label: 'Start Index',
                            type: 'integer'
                        });

                        startIndexField.updateDisplayType({
                            displayType: ui.FieldDisplayType.HIDDEN
                        });

                        startIndexField.defaultValue = startIndex;

                        if (startIndex > 0) {
                            soSublist.addButton({
                                id: 'custpage_btn_previous',
                                label: 'Previous Page',
                                functionName: 'lastPage'
                            });
                        }

                        if (startIndex + salesOrderDetails.PageLineLimit < totalSoCount) {
                            soSublist.addButton({
                                id: 'custpage_btn_next',
                                label: 'Next Page',
                                functionName: 'nextPage'
                            });
                        }
                    }

                    // display the form
                    context.response.writePage(form);
                });
            }
            catch (err) {
                log.error('CreateInvoiceGenerationForm', err);
                throw err;
            }
        }

        /*
        <purpose>
        Get the Sales Order (that can be invoiced) for the requested customer, and create
        an array that can be used to set data in the suitelet sublist
        </purpose>
        <params name="customerId" type="internal id">Customer Internal Id</params>
        <returns> array containing sales order details </returns>                              
        */
        function GetSalesOrderToBeInvoiced(customerId, startIndex) {
            try {
                var arrSoSublistData = [], totalSalesOrderCount = 0, hasMoreRecord = false, pageLineLimit = 0;

                if (customerId) {

                    require(['N/search', '/.bundle/176344/IHM_Lib_Utility.js', 'N/config'],
                        function (search, utility, config) {
                            var companyInfo = config.load({
                                type: config.Type.COMPANY_PREFERENCES
                            });

                            pageLineLimit = parseFloat(companyInfo.getValue("custscript_e024_page_line_limit"));
                            var showPlusLimit = parseFloat(companyInfo.getValue("custscript_e024_show_plus_limit"));
                            var endIndex = startIndex + pageLineLimit + showPlusLimit;

                            log.debug("Start Index", startIndex);
                            log.debug("End Index", endIndex);
                            log.debug("showPlusLimit", showPlusLimit);
                            log.debug("pageLineLimit", pageLineLimit);

                            //Perform a search on the Sales Order to get lines where 
                            //  - Fulfilled Quantity > 0
                            //  - Fulfilled Quantity > Quantity Invoiced Yet
                            //  - Customer as passed in the parameter 
                            // Group the search result to get one sales order per row 
                            var salesOrderSearch = search.load({
                                id: FILE_CONSTANT.SAVED_SEARCH.ON_DEMAND_SO
                            });

                            salesOrderSearch.filters.push(search.createFilter({
                                name: 'mainname',
                                operator: search.Operator.ANYOF,
                                values: customerId
                            }));

                            var salesOrderSearch = salesOrderSearch.run();
                            salesOrderRangeSearch = salesOrderSearch.getRange(0, 999);
                            totalSalesOrderCount = salesOrderRangeSearch.length;

                            if (totalSalesOrderCount >= showPlusLimit) {
                                hasMoreRecord = true;
                            }

                            log.debug("totalSalesOrderCount", totalSalesOrderCount);

                            for (var index = startIndex; index < (startIndex + pageLineLimit) &&
                                index < totalSalesOrderCount; index++) {
                                var row = salesOrderRangeSearch[index];

                                arrSoSublistData.push({
                                    internalid: utility.stringNullCheck(row.getValue({ name: 'internalid', summary: 'group' })),
                                    check: 'F', // setting the unchecked by default
                                    sonumber: utility.stringNullCheck(row.getValue({ name: 'tranid', summary: 'group' })),
                                    client: utility.stringNullCheck(row.getText({ name: 'mainname', summary: 'group' })),
                                    agencyname: utility.stringNullCheck(row.getValue({ name: 'custbody_ihm_agency_name', summary: 'group' })),
                                    billingschedule: utility.stringNullCheck(row.getText({ name: 'billingschedule', summary: 'group' })),
                                    trandate: utility.stringNullCheck(row.getValue({ name: 'trandate', summary: 'group' }))
                                });
                            }

                            log.debug("arrSoSublistData", arrSoSublistData.length);

                            /*
                            var salesOrderPagedData = salesOrderSearch.runPaged({ pageSize: 1000 });
                            totalSalesOrderCount = salesOrderPagedData.count;
                            var ordersAdded = 0;
                            var nextPage = true;

                            salesOrderPagedData.pageRanges.forEach(function (pageRange) {
                                var currentPage = salesOrderPagedData.fetch({ index: pageRange.index });
                                var currentPageData = currentPage.data;
                                var pagedDataCount = currentPageData.length;

                                for (var index = 0; index < pagedDataCount; index++) {
                                    var row = currentPageData[index];

                                    arrSoSublistData.push({
                                        internalid: utility.stringNullCheck(row.getValue({ name: 'internalid', summary: 'group' })),
                                        check: 'F', // setting the unchecked by default
                                        sonumber: utility.stringNullCheck(row.getValue({ name: 'tranid', summary: 'group' })),
                                        client: utility.stringNullCheck(row.getText({ name: 'mainname', summary: 'group' })),
                                        agencyname: utility.stringNullCheck(row.getValue({ name: 'custbody_ihm_agency_name', summary: 'group' })),
                                        billingschedule: utility.stringNullCheck(row.getText({ name: 'billingschedule', summary: 'group' })),
                                        trandate: utility.stringNullCheck(row.getValue({ name: 'trandate', summary: 'group' }))
                                    });

                                    ordersAdded += 1;

                                    if (ordersAdded == startIndex + accountConstant.MAX_PAGE_LINE_COUNT) {
                                        nextPage = false;
                                        break;
                                    }
                                }

                                return nextPage;
                            });
                            */
                        });
                }

                return {
                    List: arrSoSublistData,
                    Total: totalSalesOrderCount,
                    HasMoreRecord: hasMoreRecord,
                    PageLineLimit: pageLineLimit
                };
            }
            catch (err) {
                log.error('GetSalesOrderToBeInvoiced', err);
                throw err;
            }
        }

        return {
            onRequest: OnRequest
        };
    });