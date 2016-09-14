
var _ = require('underscore');
var pg = require('pg');
var async = require('async');
var moment = require('moment');

var config = require('../models/config');
var conString = config.dbConn;

var get_session_data = function (restaurant_id, callback) {
    pg.connect(conString, function (err, client, done) {
        if (err) {
            callback(err, null);
            return;
        }
        client.query(
            "select vpa.restaurant_id,food_item_id,fi.name,qty,session,po_id,master_fooditem_id,session_start,city_id \
            from volume_plan_automation vpa \
            inner join food_item fi on fi.id=vpa.food_item_id \
            where vpa.restaurant_id = $1 and vpa.date = current_date \
            order by CASE WHEN vpa.session='EarlyBreakFast' THEN 1 \
            WHEN vpa.session='BreakFast' THEN 2 WHEN session='Lunch' THEN 3 \
            WHEN vpa.session='Lunch2' THEN 4 WHEN session='Dinner' THEN 5 \
            WHEN vpa.session='LateDinner' THEN 6 END",
            [restaurant_id],
            function (query_err, restaurant) {
                done();
                if (query_err) {
                    return callback(query_err, null);
                } else {
                    return callback(null, restaurant.rows);
                }
            }
        );
    });
};

var initial_seed_data_signup = function (callback) {
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
                return callback(new Error('Sign up ' + err))
            }
            return callback(null, results)
        })
}

var get_random_pin = function (callback) {
    pg.connect(conString, function (err, client, done) {
        if (err) {
            return callback(new Error('error fetching client from pool' + err))
        }
        client.query('select alphanumeric_generator(6)',
            [],
            function (query_err, pin_result) {
                done();
                if (query_err) {
                    return callback(new Error('error running query' + query_err))
                }
                if (pin_result.rows[0]) {
                    return callback(null, pin_result.rows[0])
                } else {
                    return callback(new Error('No pin found'))
                }
            })
    })
}

var update_pin_to_restaurant = function (mpin, restaurant_id, callback) {
    pg.connect(conString, function (err, client, done) {
        if (err) {
            return callback(new Error('error fetching client from pool' + err))
        }
        client.query('update restaurant_config set mpin=$1 where restaurant_id=$2',
            [mpin, restaurant_id],
            function (query_err, pin_result) {
                done();
                if (query_err) {
                    return callback(new Error('error running query' + query_err))
                }
                if (pin_result) {
                    return callback(null, 'Successfully inserted')
                }
            })
    })
}

var check_credentials = function (mpin, callback) {
    pg.connect(conString, function (err, client, done) {
        if (err) {
            return callback(new Error('error fetching client from pool' + err))
        }
        client.query('select res.name,res.id,res.short_name from restaurant res \
                inner join restaurant_config rcon on rcon.restaurant_id=res.id where rcon.mpin=$1',
            [mpin],
            function (query_err, pin_result) {
                done();
                if (query_err) {
                    return callback(new Error('error running query' + query_err))
                }
                if (pin_result.rows[0]) {
                    return callback(null, pin_result.rows[0])
                } else {
                    return callback(new Error('No data found'))
                }
            })
    })
}


module.exports = {
    get_session_data: get_session_data,
    initial_seed_data_signup:initial_seed_data_signup,
    get_random_pin: get_random_pin,
    update_pin_to_restaurant: update_pin_to_restaurant,
    check_credentials: check_credentials
}