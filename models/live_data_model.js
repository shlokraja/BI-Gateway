
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
        //and vpa.date = $2 
        client.query(
            "select vpa.restaurant_id,food_item_id,fi.name,qty,session,po_id,master_fooditem_id,session_start,city_id \
            from volume_plan_automation vpa \
            inner join food_item fi on fi.id=vpa.food_item_id \
            where vpa.restaurant_id = $1 \
            order by vpa.session",
            [restaurant_id],
            function (query_err, restaurant) {
                if (query_err) {
                    done(client);
                    return callback(query_err, null);
                } else {
                    done();
                    return callback(null, restaurant.rows);
                }
            }
        );
    });
};

module.exports={
    get_session_data:get_session_data
}