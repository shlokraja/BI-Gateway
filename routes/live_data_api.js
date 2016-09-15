/*global require __dirname module console*/
'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var pg = require('pg');
var async = require('async')
var config = require('../models/config');
var general = require('./general');
var conString = config.dbConn
var encrypt_decrypt = require('../utils/encryption_decryption')
var mailer = require('../utils/mail_helper')
var live_data_model = require('../models/live_data_model')



app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// router.get('/', function (req, res, next) {
//     console.log("************************ called")
//     var context = {
//         title: 'Foodbox'
//     };

//     res.render('pages/live_data_login', context);
// });

var success_status = "SUCCESS";
var fail_status = "FAIL";
var no_data_found = "NO DATA FOUND";

var output = '';
var message_text = '';
var status_text = '';
var context = '';

var handleError = function (msg) {
    general.genericError("api.js :: " + msg);
};

app.get('/get_city_restaurant', function (req, res, next) {
    try {
        console.log("************************ get_sign_up called")
        live_data_model.initial_seed_data_signup(function (err, response) {
            if (err) {
                handleError('error fetching client from pool' + err);
                message_text = no_data_found;
                status_text = fail_status;
                context = { data: { 'restaurants': output, 'city': output }, message: message_text, status: status_text };
                res.send(context);
                return;
            }

            var context = { data: { 'restaurants': response.restaurant, 'city': response.city }, status: success_status };
            res.json(context);
            return
        })
    } catch (ex) {
        general.genericError("live_dataq_api.js :: get_city_restaurant: " + ex);
        message_text = no_data_found;
        status_text = fail_status;
        context = { data: { 'restaurants': output, 'city': output }, message: message_text, status: status_text };
        res.send(context);
        return;
    }

});

app.get('/generate_pin', function (req, res) {
    try {
        var restaurant_id = req.query.restaurant_id;
        var restaurant_email_id = req.query.restaurant_email_id;
        var selected_city = req.query.selected_city;

        live_data_model.get_random_pin(function (err, response) {
            if (err) {
                handleError('error fetching client from pool live_data_model.get_random_pin' + err);
                message_text = no_data_found;
                status_text = fail_status;
                context = { data: { 'result': output }, message: message_text, status: status_text };
                res.send(context);
                return;
            }
            if (response) {
                var encrypted_response = encrypt_decrypt.text_encrypt(response.alphanumeric_generator)
                live_data_model.update_pin_to_restaurant(encrypted_response, restaurant_id, function (err, update_response) {
                    if (err) {
                        handleError('error fetching client from pool live_data_model.update_pin_to_restaurant' + err);
                        message_text = no_data_found;
                        status_text = fail_status;
                        context = { data: { 'result': output }, message: message_text, status: status_text };
                        res.send(context);
                        return;
                    }
                    if (update_response) {
                        var mpin_value = response.alphanumeric_generator
                        var mail_content = "Please use this pin to login " + mpin_value
                        console.log("mail_content " + mail_content)
                        mailer.send_mail("MPIN login details", mail_content, restaurant_email_id, function (err, response) {
                            if (err) {
                                handleError('error fetching client from pool mailer.send_mail' + err);
                                message_text = no_data_found;
                                status_text = fail_status;
                                context = { data: { 'result': output }, message: message_text, status: status_text };
                                res.send(context);
                                return;
                            }
                            message_text = 'Successfully generated and mailed';
                            var context = { data: { 'mpin': mpin_value }, 'message_text': message_text, status: success_status };
                            res.json(context);
                            return
                        })
                    }
                })
            }
        })
    } catch (ex) {
        general.genericError("live_dataq_api.js :: generate_pin: " + ex);
        message_text = no_data_found;
        status_text = fail_status;
        context = { data: { 'mpin': output }, message: message_text, status: status_text };
        res.send(context);
        return;
    }
})

app.get('/check_credential', function (req, res) {
    try {
        var mpin = req.query.pin;
        console.log("************************ check_credential called" + mpin)
        var encrypted_response = encrypt_decrypt.text_encrypt(mpin)
        live_data_model.check_credentials(encrypted_response, function (err, response) {
            if (err) {
                message_text = 'This PIN is not yet registered'
                var context = { data: { 'result': '' }, 'message_text': message_text, status: fail_status };
                res.json(context);
                return
            }
            //res.send('Welcome ' + pin_result.rows[0].name);
            if (response) {
                var context = { data: { 'restaurant_id': response.id, 'restaurant_name': response.name, 'short_name': response.short_name }, status: success_status };
                res.json(context);
                return
            }
        })
    } catch (ex) {
        general.genericError("live_dataq_api.js :: check_credential: " + ex);
        message_text = no_data_found;
        status_text = fail_status;
        console.log(ex.TypeError)
        context = { data: { 'result': '' }, message: message_text, status: status_text };
        res.send(context);
        return;
    }
});

//By default current date
app.get('/get_volume_plan_data', function (req, res) {
    try {
        var restaurant_id = req.query.restaurant_id;

        //var date=req.query.date;
        live_data_model.get_session_data(restaurant_id, function (err, response) {
            if (err) {
                handleError("Error occured while getting value from live_data_model.get_session_data" + err);
                message_text = no_data_found;
                status_text = fail_status;
                context = { data: { 'result': output }, message: message_text, status: status_text };
                res.send(context);
                return;
            }

            message_text = 'Query returns with ' + response.length + ' rows'
            var context = { data: { 'volume_plan': response }, message_text: message_text, status: success_status };
            res.json(context);
            return
        })
    } catch (ex) {
        general.genericError("live_dataq_api.js :: get_volume_plan_data: " + ex);
        message_text = no_data_found;
        status_text = fail_status;
        context = { data: { 'result': '' }, message: message_text, status: status_text };
        res.send(context);
        return;
    }
})

app.get('/get_live_sales_data', function (req, res) {
    try {
        var restaurant_id = req.query.restaurant_id;
        live_data_model.get_sales_data(restaurant_id, function (err, response) {
            if (err) {
                handleError("Error occured while getting value from live_data_model.get_sales_data" + err);
                message_text = no_data_found;
                status_text = fail_status;
                context = { data: { 'result': output }, message: message_text, status: status_text };
                res.send(context);
                return;
            }
            message_text = 'Query returns with ' + response.length + ' rows'
            var context = { data: { live_sales_data: response },message_text:message_text, status: success_status };
            res.json(context);
            return
        })
    } catch (ex) {
        general.genericError("live_dataq_api.js :: get_volume_plan_data: " + ex);
        message_text = no_data_found;
        status_text = fail_status;
        context = { data: { 'result': '' }, message: message_text, status: status_text };
        res.send(context);
        return;
    }
})

app.listen('9090');

module.exports = app;