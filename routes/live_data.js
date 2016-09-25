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
var request = require('request')

var api_url = process.env.Service_Uri || 'http://localhost:9090/';

router.get('/', function (req, res, next) {
    var context = {
        title: ''
    };
    var cookie = req.cookies.login_details;

    if (cookie != undefined) {
        var context = {
            title: '',
            restaurant_id: cookie.restaurant_id,
            restaurant_name: cookie.restaurant_name,
            restaurant_short_name: cookie.restaurant_short_name
        }

        res.render('pages/live_data_dashboard', context);
    } else {
        res.render('pages/live_data_login', context);
    }
});

router.get('/get_sign_up', function (req, res, next) {
    var url = api_url + 'get_city_restaurant';
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            var context = {
                title: '',
                restaurants: info.data.restaurants,
                city: info.data.city
            }
            res.render('pages/live_data_signup', context)
        }
        if (error) {
            res.status(500).send({ error: 'Something failed ' });
        }
    })
});

router.post('/generate_pin', function (req, res) {
    console.log("Generate pin called from live data")
    var restaurant_detail = req.body.selected_restaurant.split('_');
    var restaurant_id = restaurant_detail[0];
    var restaurant_email_id = restaurant_detail[1];
    var selected_city = req.body.selected_city;

    var url = api_url + 'generate_pin?restaurant_id=' + restaurant_id + '&restaurant_email_id=' + restaurant_email_id + '&selected_city=' + selected_city
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            if (info.status == "FAIL") {
                res.send('Unknown err occured please try afer some time');
            } else {
                res.send(info.message_text);
            }
        }
        if (error) {
            res.status(500).send('Something failed ');
        }
    })
})

router.get('/check_credential', function (req, res) {
    var mpin = req.query.pin;
    res.clearCookie('login_details');
    var url = api_url + 'check_credential?pin=' + mpin;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            if (info.status == "FAIL") {
                var context = {
                    title: '',
                    err: info.message_text
                }
                res.render('pages/live_data_login', context);
            } else {
                var context = {
                    title: '',
                    restaurant_id: info.data.restaurant_id,
                    restaurant_name: info.data.restaurant_name,
                    restaurant_short_name: info.data.short_name
                }

                var cookie = req.cookies.login_details;
                if (cookie === undefined) {
                    res.cookie('login_details', { restaurant_id: info.data.restaurant_id, restaurant_name: info.data.restaurant_name, firebase_url: info.data.firebase_url, restaurant_short_name: info.data.short_name }, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
                    console.log('cookie created successfully');
                }

                console.log("************************ Above render")
                res.render('pages/live_data_dashboard', context);
            }
        }
        if (error) {
            res.status(500).send('Something failed ');
        }
    })
})

//By default current date
router.get('/get_volume_plan', function (req, res) {
    var restaurant_id = req.query.restaurant_id;

    var url = api_url + 'get_volume_plan_data?restaurant_id=' + restaurant_id;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            if (info.status != 'FAIL') {
                res.send(info.data.volume_plan)
            } else {
                res.status(500).send('No data found ');
            }

        }
        if (error) {
            res.status(500).send('Something failed ');
        }
    })
})

router.get('/get_live_sales_data', function (req, res) {
    var restaurant_id = req.query.restaurant_id;
    var url = api_url + 'get_live_sales_data?restaurant_id=' + restaurant_id;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            if (info.status != 'FAIL') {
                res.send({ sales_data: info.data.live_sales_data.sales_data, taken_data: info.data.live_sales_data.taken_data })
            } else {
                res.status(500).send('No data found ');
            }
        }
        if (error) {
            res.status(500).send('Something failed ');
        }
    })
})

router.get('/get_sales_summary', function (req, res) {
    var restaurant_id = req.query.restaurant_id;

    var url = api_url + 'get_sales_summary?restaurant_id=' + restaurant_id;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            res.send(info.data.sales_summary)
        }
        if (error) {
            res.status(500).send('Something failed ');
        }
    })
})

router.get('/live_packing_data', function (req, res) {
    var restaurant_id = req.query.restaurant_id;
    var cookie = req.cookies.login_details;
    if (cookie != undefined) {
        var url = api_url + 'get_live_packing_data?restaurant_id=' + cookie.restaurant_id + '&firebase_url=' + cookie.firebase_url;
        request(url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var info = JSON.parse(body)
                if (info.status != 'FAIL') {
                    res.send(info.data.live_packing)
                } else {
                    res.status(500).send('No data found ');
                }
            }
            if (error) {
                res.status(500).send('Something failed ');
            }
        })
    } else {
        res.render('pages/live_data_login', context);
    }
})

module.exports = router;