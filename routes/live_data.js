/*global require __dirname module console*/
'use strict';

var express = require('express');
var router = express.Router();
var pg = require('pg');
var async = require('async')
var config = require('../models/config');
var conString = config.dbConn
var encrypt_decrypt = require('../utils/encryption_decryption')
var mailer = require('../utils/mail_helper')
var live_data_model = require('../models/live_data_model')

router.get('/', function (req, res, next) {
    console.log("************************ called")
    var context = {
        title: 'Foodbox'
    };

    res.render('pages/live_data_login', context);
});

router.get('/get_sign_up', function (req, res, next) {

    console.log("************************ get_sign_up called")
    live_data_model.initial_seed_data_signup(function (err, response) {
        var context = {
            title: 'Foodbox',
            restaurants: response.restaurant,
            city: response.city
        }
        res.render('pages/live_data_signup', context)
    })
});

router.post('/generate_pin', function (req, res) {
    console.log("Generate pin called from live data")
    var restaurant_detail = req.body.selected_restaurant.split('_');
    var restaurant_id = restaurant_detail[0];
    var restaurant_email_id = restaurant_detail[1];
    var selected_city = req.body.selected_city;
    live_data_model.get_random_pin(function (err, response) {
        if (err) {
            console.log("Error occured while getting value from live_data_model.get_random_pin" + err)
            return
        }
        if (response) {
            var encrypted_response = encrypt_decrypt.text_encrypt(response.alphanumeric_generator)
            live_data_model.update_pin_to_restaurant(encrypted_response, restaurant_id, function (err, update_response) {
                if (err) {
                    console.log("Error occured while getting value from live_data_model.update_pin_to_restaurant" + err)
                    return
                }
                if (update_response) {
                    var mail_content = "Please use this pin to login " + response.alphanumeric_generator
                    mailer.send_mail("MPIN login details", mail_content, restaurant_email_id, function (err, response) {
                        if (err) {
                            res.send('Unknown err occured please try afer some time');
                        }
                        res.send('Successfully generated and mailed');
                    })
                }
            })
        }
    })
})

router.get('/check_credential', function (req, res) {
    var mpin = req.query.pin;
    console.log("************************ check_credential called" + mpin)
    var encrypted_response = encrypt_decrypt.text_encrypt(mpin)
    live_data_model.check_credentials(encrypted_response, function (err, response) {
        if (err) {
            var context = {
                title: 'Foodbox',
                err: 'This PIN is not yet registered'
            }
            res.render('pages/live_data_login', context);
        }
        //res.send('Welcome ' + pin_result.rows[0].name);
        if (response) {
            var context = {
                title: 'Foodbox',
                restaurant_id: response.id,
                restaurant_name: response.name
            }
            console.log("************************ Above render")
            res.render('pages/live_data_dashboard', context);
        }
    })
});

//By default current date
router.get('/get_volume_plan', function (req, res) {
    var restaurant_id = req.query.restaurant_id;

    //var date=req.query.date;
    live_data_model.get_session_data(1, function (err, response) {
        if (err) {
            console.log("Error occured while getting value from live_data_model.get_session_data" + err)
            return
        }
        res.send(response);
    })
})

router.get('/get_live_sales_data', function (req, res) {
    var restaurant_id=req.query.restaurant_id;
    live_data_model.get_sales_data(4,function (err, response) {
        if (err) {
            console.log("Error occured while getting value from live_data_model.get_sales_data" + err)
            return
        }
        res.send(response)
    })
})

module.exports = router;