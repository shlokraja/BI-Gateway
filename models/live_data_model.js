var _ = require('underscore');
var pg = require('pg');
var async = require('async');
var moment = require('moment');

var config = require('../models/config');
var conString = config.dbConn;
var format = require('string-format');
format.extend(String.prototype);
var Firebase = require('firebase');

var get_live_packing_data = function (restaurant_id, callback) {
    pg.connect(conString, function (err, client, done) {
        if (err) {
            return callback(new Error(err, null));
        }
        client.query(
            "select sum(polist.quantity) as total_quantity,recon.firebase_url from purchase_order  po \
            inner join purchase_order_master_list polist on polist.purchase_order_id=po.id \
            inner join restaurant_config recon on recon.restaurant_id=po.restaurant_id \
            where po.restaurant_id=$1 and scheduled_delivery_time::date=now()::date \
            group by recon.firebase_url",
            [restaurant_id],
            function (query_err, total_live_count) {
                done();
                if (query_err) {
                    return callback(new Error(query_err, null));
                }
                if (total_live_count.row) {
                    var total_quantity = total_live_count.rows[0].total_quantity;
                    var rootref = new Firebase(total_live_count.rows[0].firebase_url);
                    var total_packed = 0;
                    var live_packing_data = rootref.child('{}/'.format(restaurant_id));
                    var item_data = [];
                    // Getting the stock data
                    live_packing_data.once("value", function (data) {
                        var data = data.val();
                        var flat = _.flatten(_.map(data, _.values))
                        _.map(_.pluck(flat, 'barcodes'), function (barcode) {
                            total_packed += Object.keys(barcode).length;
                        })
                        var unpacked = total_quantity - total_packed;
                        var context = { total_packed: total_packed, unpacked: unpacked }
                        return callback(null, context);
                    });
                }
            }
        );
    });
}

var get_session_data = function (restaurant_id, callback) {
    pg.connect(conString, function (err, client, done) {
        if (err) {
            return callback(new Error(err, null));
        }
        client.query(
            "select vpa.restaurant_id,food_item_id,fi.name,qty,session,po_id,master_fooditem_id,session_start,city_id \
            from volume_plan_automation vpa \
            inner join food_item fi on fi.id=vpa.food_item_id \
            inner join session ses on ses.name=vpa.session \
            where vpa.restaurant_id = $1 and vpa.date = current_date \
            order by ses.sequence",
            [restaurant_id],
            function (query_err, restaurant) {
                done();
                if (query_err) {
                    return callback(new Error(query_err, null));
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
                        return callback('error running query' + err, null)
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
        client.query('select alphanumeric_generator(4)',
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


var get_sales_data = function (restaurant_id, callback) {
    pg.connect(conString, function (err, client, done) {
        if (err) {
            return callback(err, null)
        }
        client.query('select sum(batch.quantity) as taken from purchase_order po \
                     inner join purchase_order_batch batch on batch.purchase_order_id=po.id \
                    where po.restaurant_id=$1 and received_time::date=now()::date'
            , [restaurant_id],
            function (query_err, taken_result) {
                if (query_err) {
                    return callback(query_err, null)
                }
                if (taken_result) {
                    client.query(
                        "select \
                        sum(soi.quantity) as qty,out.name as outlet_name, \
                        fi.name as food_item_name from sales_order so \
                        inner join sales_order_items soi on soi.sales_order_id=so.id \
                        inner join food_item fi on fi.id=soi.food_item_id \
                        inner join outlet out on  out.id=so.outlet_id \
                        where time::date=now()::date and fi.restaurant_id=$1 \
                        group by so.outlet_id,out.name,soi.food_item_id,fi.name \
                        order by out.name ",
                        [restaurant_id],
                        function (query_err, sales_data) {
                            done();
                            if (query_err) {
                                return callback(query_err, null)
                            } else {
                                return callback(null, { taken_data: taken_result.rows[0].taken, sales_data: sales_data.rows })
                            }
                        });
                }
            })

    });
};

var get_sales_summary = function (restaurant_id, callback) {
    pg.connect(conString, function (err, client, done) {
        if (err) {
            return callback(err, null)
        }
        client.query(
            "select s.outlet_id,f.location, sum(f.mrp*si.quantity) as sale ,'Daily' as period from food_item f, \
            sales_order_items si, sales_order s where s.id=si.sales_order_id and \
            si.food_item_id=f.id and s.outlet_id=f.outlet_id and f.restaurant_id=$1 \
            and s.time > (select max(time) \
            from supplies s, supplies_master_list m \
            where s.phase='start_of_day' \
            and s.food_item_id=m.food_item_id ) \
            group by f.location , s.outlet_id \
            union all \
            select s.outlet_id,f.location, sum(f.mrp*si.quantity) as sale,'Monthly' as period  from food_item f, \
            sales_order_items si, sales_order s where s.id=si.sales_order_id and f.restaurant_id=$1 and  \
            si.food_item_id=f.id and s.outlet_id=f.outlet_id  \
            and to_char(time,'MMYYYY') = to_char(now(),'MMYYYY') \
            group by f.location , s.outlet_id \
            union all \
            select s.outlet_id,f.location, sum(f.mrp*si.quantity) as sale,'Weekly' as period  from food_item f, \
            sales_order_items si, sales_order s where s.id=si.sales_order_id and f.restaurant_id=$1 and \
            si.food_item_id=f.id and s.outlet_id=f.outlet_id  \
            and date_part('week',time) = date_part('week',now())  \
            group by f.location , s.outlet_id \
            union all \
            select s.outlet_id,f.location, sum(f.mrp*si.quantity) as sale,'Quarterly' as period  from food_item f, \
            sales_order_items si, sales_order s where s.id=si.sales_order_id and f.restaurant_id=$1 and \
            si.food_item_id=f.id and s.outlet_id=f.outlet_id \
            and date_part('quarter',time) = date_part('quarter',now()) \
            group by f.location , s.outlet_id \
            union all \
            select s.outlet_id,f.location, sum(f.mrp*si.quantity) as sale,'Halfyearly' as period  from food_item f, \
            sales_order_items si, sales_order s where s.id=si.sales_order_id and f.restaurant_id=$1 and \
            si.food_item_id=f.id and s.outlet_id=f.outlet_id \
            and date_part('quarter',time)  between  date_part('quarter',time) -1 and date_part('quarter',time) \
            group by f.location , s.outlet_id",
            [restaurant_id],
            function (query_err, get_sales_summary) {
                done();
                if (query_err) {
                    return callback(query_err, null)
                } else {
                    return callback(null, get_sales_summary.rows)
                }
            }
        );
    });
};

module.exports = {
    get_live_packing_data: get_live_packing_data,
    get_session_data: get_session_data,
    initial_seed_data_signup: initial_seed_data_signup,
    get_random_pin: get_random_pin,
    update_pin_to_restaurant: update_pin_to_restaurant,
    check_credentials: check_credentials,
    get_sales_data: get_sales_data,
    get_sales_summary: get_sales_summary
}