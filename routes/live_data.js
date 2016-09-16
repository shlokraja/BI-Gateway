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

var api_url = 'http://localhost:9090/';

router.get('/', function (req, res, next) {
    console.log("************************ called")
    var context = {
        title: 'Foodbox'
    };

    res.render('pages/live_data_login', context);
});

router.get('/get_sign_up', function (req, res, next) {
    var url = api_url + 'get_city_restaurant';
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            var context = {
                title: 'Foodbox',
                restaurants: info.data.restaurants,
                city: info.data.city
            }
            res.render('pages/live_data_signup', context)
        }
        if (error) {
            res.status(500).send({ error: 'Something failed ' + error.errno });
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
            res.status(500).send({ error: 'Something failed ' + error.errno });
        }
    })
})

router.get('/check_credential', function (req, res) {
    var mpin = req.query.pin;
    var url = api_url + 'check_credential?pin=' + mpin;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            if (info.status == "FAIL") {
                var context = {
                    title: 'Foodbox',
                    err: info.message_text
                }
                res.render('pages/live_data_login', context);
            } else {
                var context = {
                    title: 'Foodbox',
                    restaurant_id: info.data.restaurant_id,
                    restaurant_name: info.data.restaurant_name
                }
                console.log("************************ Above render")
                res.render('pages/live_data_dashboard', context);
            }
        }
        if (error) {
            res.status(500).send({ error: 'Something failed ' + error.errno });
        }
    })
});

//By default current date
router.get('/get_volume_plan', function (req, res) {
    var restaurant_id = req.query.restaurant_id;

    var url = api_url + 'get_volume_plan_data?restaurant_id=' + restaurant_id;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            res.send(info.data.volume_plan)
        }
        if (error) {
            res.status(500).send({ error: 'Something failed ' + error.errno });
        }
    })
})

router.get('/get_live_sales_data', function (req, res) {
    var restaurant_id = req.query.restaurant_id;
    var url = api_url + 'get_live_sales_data?restaurant_id=' + restaurant_id;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            res.send({sales_data:info.data.live_sales_data.sales_data,taken_data:info.data.live_sales_data.taken_data})
        }
        if (error) {
            res.status(500).send({ error: 'Something failed ' + error.errno });
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
            res.status(500).send({ error: 'Something failed ' + error.errno });
        }
    })
})

router.get('/live_packing_data', function (req, res) {
    var restaurant_id = req.query.restaurant_id;

    var url = api_url + 'get_live_packing_data?restaurant_id=' + restaurant_id;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body)
            res.send(info.data.live_packing)
        }
        if (error) {
            res.status(500).send({ error: 'Something failed ' + error.errno });
        }
    })
})

module.exports = router;