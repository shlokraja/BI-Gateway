/*global require __dirname module console*/
'use strict';

var express = require('express');
var router = express.Router();
var pg = require('pg');
var async = require('async')
var config = require('../models/config');
var conString = config.dbConn
var mailer=require('../utils/mail_helper')

router.get('/', function (req, res, next) {
    console.log("************************ called")
    var context = {
        title: 'Foodbox'
    };

    res.render('pages/live_data_login', context);
});

router.get('/get_sign_up', function (req, res, next) {

    console.log("************************ get_sign_up called")
    async.parallel({
        city: function (callback) {
            config.query('select short_name ,name from city',
              [],
              function (err, result) {
                  if (err) {
                      callback('error running query' + err, null)
                      return
                  }
                  callback(null, result.rows)
              })
        },

        restaurant: function (callback) {
            config.query('select distinct res.id,res.name as name,res.short_name,rcon.sender_email as mail_id,out.city as city from restaurant res \
                        inner join food_item fi on fi.restaurant_id=res.id \
                        inner join outlet out on out.id=fi.outlet_id \
                        inner join restaurant_config rcon on rcon.restaurant_id=res.id \
                        where res.id>0 order by res.name',
              [],
              function (err, result) {
                  if (err) {
                      callback('error running query' + err, null)
                      return
                  }
                  callback(null, result.rows)
              })
        }
    },

      function (err, results) {
          if (err) {
              console.log('Sign up ' + err)
              return
          }

          var context = {
              title: 'Foodbox',
              restaurants: results.restaurant,
              city: results.city
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

    var mpin = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 6; i++)
        mpin += possible.charAt(Math.floor(Math.random() * possible.length));

    pg.connect(conString, function (err, client, done) {
        if (err) {
            console.log('error fetching client from pool' + err)
            return
        }
        client.query('update restaurant_config set mpin=$1 where restaurant_id=$2',
            [mpin, restaurant_id],
              function (query_err, pin_result) {
                  done();
                  if (query_err) {
                      console.log('error running query' + query_err)
                      return
                  }
                  if (pin_result) {
                     var mail_content="Please use this pin to login "+mpin
                     mailer.send_mail("MPIN login details",mail_content,restaurant_email_id,function(err,response){
                        if(err)
                        {
                        res.send('Unknown err occured please try afer some time');
                        }
                        res.send('Successfully generated and mailed');
                     })
                  }
              })
    })
})

router.get('/check_credential', function (req, res) {
    var mpin = req.query.pin;
    console.log("************************ check_credential called" + mpin)

    check_credentials(mpin, function (err, response) {
        if (err) {
            res.send('This pin not yet registered')
            return
        }
        //res.send('Welcome ' + pin_result.rows[0].name);
        if (response) {
            var context = {
                title: 'Foodbox'
            }
            console.log("************************ Above render")
            res.render('pages/live_data_dashboard', context);
        }
    })
});

var check_credentials = function (mpin, callback) {
    pg.connect(conString, function (err, client, done) {
        if (err) {
            console.log('error fetching client from pool' + err)
            return
        }
        client.query('select res.name,res.id,res.short_name from restaurant res \
                inner join restaurant_config rcon on rcon.restaurant_id=res.id where rcon.mpin=$1',
            [mpin],
              function (query_err, pin_result) {
                  done();
                  if (query_err) {
                      console.log('error running query' + query_err)
                      return
                  }
                  if (pin_result.rows[0]) {
                      return callback(null, pin_result.rows)
                  } else {
                      return callback(new Error('No data found'))
                  }
              })
    })
}

module.exports = router;