const express = require('express');
const app = express();
const Sequelize = require('sequelize');
const { Op } = require('sequelize');
const bodyParser = require('body-parser'); //post body handler
const { check, validationResult } = require('express-validator/check'); //form validation
const { matchedData, sanitize } = require('express-validator/filter'); //sanitize form params
const multer = require('multer'); //multipar form-data
const path = require('path');
const crypto = require('crypto');

const sequelize = new Sequelize('db_api', 'root', '', {
    host: 'localhost',
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        idle: 10000
    }
});

//Set body parser for HTTP post operation
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({
    extended: true
})); // support encoded bodies

//set static assets to public directory
app.use(express.static('public'));
const uploadDir = '/img/';
const storage = multer.diskStorage({
    destination: "./public" + uploadDir,
    filename: function (req, file, cb) {
        crypto.pseudoRandomBytes(16, function (err, raw) {
            if (err) return cb(err)

            cb(null, raw.toString('hex') + path.extname(file.originalname))
        })
    }
});

const upload = multer({
    storage: storage,
    dest: uploadDir
});

//table_bus
const bus = sequelize.define('tb_bus', {
    'bus_id': {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    'bus_station_id': { type: Sequelize.UUID },
    'bus_name': Sequelize.STRING,
    'bus_img': {
        type: Sequelize.STRING,
        get() {
            const image_bus = this.getDataValue('bus_img');
            return "/img/" + image_bus;
        }
    },
    'createdAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },
    'updatedAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    }
}, {
    //prevent sequelize transform table name into plural
    freezeTableName: true,
});

//table_bus_station
const bus_station = sequelize.define('tb_bus_station', {
    'bus_station_id': {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    'bus_station_from': Sequelize.STRING,
    'bus_station_to': Sequelize.STRING,
    'createdAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },
    'updatedAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    }
}, {
    //prevent sequelize transform table name into plural
    freezeTableName: true,
});

//table_schedule
const schedule = sequelize.define('tb_schedule', {
    'schedule_id': {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    'schedule_day': Sequelize.STRING,
    'schedule_depature': Sequelize.TIME,
    'schedule_arrival': Sequelize.TIME,
    'bus_station_id': { type: Sequelize.UUID },
    'createdAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },
    'updatedAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    }
}, {
    //prevent sequelize transform table name into plural
    freezeTableName: true,
});

//realtion
bus.hasMany(bus_station, { foreignKey: 'bus_station_id' });
bus_station.belongsTo(bus, { foreignKey: 'bus_station_id' });
bus_station.hasMany(schedule, { foreignKey: 'schedule_id' });
schedule.belongsTo(bus_station, { foreignKey: 'schedule_id' });

//bus_api
//get bus all
app.get('/bus/', (req, res) => {
    bus.findAndCountAll({
        include: [{
            all: true,
            nested: true
        }]
    }).then(bus => {
        res.json({
            "status": "success",
            "message": " Terdapat " + bus.count + " Bus",
            "data": bus
        });
    })
});

//search bus by bus name
app.get('/bus_search/:bus_name', (req, res) => {
    bus.findAll({
        include: [{
            all: true,
            nested: true
        }],
        where: {
            [Op.or]: [
                { bus_name: req.params.bus_name }
                // { schedule_day: req.params.bus_name }
            ]
        }
    }).then(bus => {
        if (bus) {
            res.json({
                "status": "success",
                "message": "Bus Berhasil Ditemukan",
                "data": bus
            });
        } else {
            res.json({
                "status": "not found",
                "message": req.params.bus_name + " Tidak Ditemukan",
                "data": null
            })
        }
    })
})

//search bus by day
app.get('/bus_search_day/:schedule_day', (req, res) => {
    schedule.findAll({
        include: [{
            all: true,
            nested: true
        }],
        where: {
            [Op.or]: [
                { schedule_day: req.params.schedule_day }
                // { schedule_day: req.params.bus_name }
            ]
        }
    }).then(bus => {
        if (bus) {
            res.json({
                "status": "success",
                "message": "Bus Berhasil Ditemukan",
                "data": bus
            });
        } else {
            res.json({
                "status": "not found",
                "message": req.params.bus_name + " Tidak Ditemukan",
                "data": null
            })
        }
    })
})

//add bus
app.post('/bus_add/', [
    //File upload
    upload.single('bus_img'),

    //Set form validation rule
    check(['bus_name', 'bus_station_id'])
        .isLength({
            min: 5
        })
        .custom(value => {
            return bus.findOne({
                where: {
                    bus_name: value,
                    bus_station_id: value
                }
            }).then(b => {
                if (b) {
                    throw new Error('Bus already');
                }
            })
        })
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            errors: errors.mapped()
        });
    }

    bus_create = bus.create({
        bus_name: req.body.bus_name,
        bus_img: req.file === undefined ? "" : req.file.filename,
        bus_station_id: req.body.bus_station_id
    }).then(newBus => {
        res.json({
            "status": "success",
            "message": "Bus added",
            "data": newBus
        })
    })
});

//edit bus
app.put('/bus_edit/:bus_id', [
    //File upload
    upload.single('bus_img'),

    //Set form validation rule
    check('bus_name')
        .custom(value => {
            return bus.findOne({
                where: {
                    bus_name: value
                }
            }).then(b => {
                if (b) {
                    throw new Error('Bus already');
                }
            })
        })

], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.mapped() });
    }
    const update = {
        bus_name: req.body.bus_name,
        bus_img: req.file === undefined ? "" : req.file.filename,
        bus_station_id: req.body.bus_station_id
    }
    bus.update(update, { where: { bus_id: req.params.bus_id } })
        .then(affectedRow => {
            return bus.findOne({ where: { bus_id: req.params.bus_id } })
        })
        .then(b => {
            res.json({
                "status": "success",
                "message": "Bus updated",
                "data": b
            })
        })
});

//delete bus
app.delete('/bus_delete/:bus_id', [
    //Set form validation rule
    check('bus_id')
        .isLength({ min: 5 })
        .isNumeric()
        .custom(value => {
            return bus.findOne({ where: { bus_id: value } }).then(b => {
                if (!b) {
                    throw new Error('Bus not found');
                }
            })
        }
        ),
], (req, res) => {
    bus.destroy({ where: { bus_id: req.params.bus_id } })
        .then(affectedRow => {
            if (affectedRow) {
                return {
                    "status": "success",
                    "message": "Bus deleted",
                    "data": null
                }
            }

            return {
                "status": "error",
                "message": "Failed",
                "data": null
            }

        })
        .then(r => {
            res.json(r)
        })
});

//api bus station
//get all bus station
app.get('/bus_station/', (req, res) => {
    bus_station.findAndCountAll().then(bus_station => {
        res.json({
            "status": "success",
            "message": "Terdapat " + bus_station.count + " Terminal Bus",
            "data": bus_station
        });
    })
});

//get bus station by name
app.get('/bus_station_search/:bus_station_from', (req, res) => {
    bus_station.findAll({ where: { bus_station_from: req.params.bus_station_from } }).then(bus_station => {
        if (bus_station) {
            res.json({
                "status": "success",
                "message": "Terminal Bus Ditemukan",
                "data": bus_station
            });
        } else {
            res.json({
                "status": "not found",
                "message": req.params.bus_station_from + " Tidak Ditemukan",
                "data": null
            });
        }

    })
});

//add bus station
app.post('/bus_station_add/', [
    upload.single('img'),

    //Set form validation rule
    check('bus_station_from')
        .isLength({
            min: 5
        }),
    check('bus_station_to')
        .isLength({
            min: 5
        })
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            errors: errors.mapped()
        });
    }

    bus_station_create = bus_station.create({
        bus_station_from: req.body.bus_station_from,
        bus_station_to: req.body.bus_station_to
    }).then(newBusStation => {
        res.json({
            "status": "success",
            "message": "Bus station added",
            "data": newBusStation
        })
    })
});

//edit bus staion
app.put('/bus_station_edit/:bus_station_id', [
    upload.single('img'),

    //Set form validation rule
    check('bus_station_from')
        .isLength({
            min: 5
        }),
    check('bus_station_to')
        .isLength({
            min: 5
        })
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.mapped() });
    }
    const update_station = {
        bus_station_from: req.body.bus_station_from,
        bus_station_to: req.body.bus_station_to,
    }
    bus_station.update(update_station, { where: { bus_station_id: req.params.bus_station_id } })
        .then(affectedRow => {
            return bus_station.findOne({ where: { bus_station_id: req.params.bus_station_id } })
        })
        .then(bs => {
            res.json({
                "status": "success",
                "message": "Bus station updated",
                "data": bs
            })
        })
});

//delete bus station
app.delete('/bus_station_delete/:bus_station_id', [
    //Set form validation rule
    check('bus_id')
        .isLength({ min: 5 })
        .isNumeric()
        .custom(value => {
            return bus_station.findOne({ where: { bus_station_id: value } }).then(b => {
                if (!b) {
                    throw new Error('Bus station not found');
                }
            })
        }
        ),
], (req, res) => {
    bus_station.destroy({ where: { bus_station_id: req.params.bus_station_id } })
        .then(affectedRow => {
            if (affectedRow) {
                return {
                    "status": "success",
                    "message": "Bus station deleted",
                    "data": null
                }
            }

            return {
                "status": "error",
                "message": "Failed",
                "data": null
            }

        })
        .then(r => {
            res.json(r)
        })
});

//api schedule
//get all schedule
app.get('/schedule/', (req, res) => {
    schedule.findAll().then(schedule => {
        res.json({
            "status": "success",
            "message": "Jadwal Berhasil Ditemukan",
            "data": schedule
        });
    })
});

//get schedule by day
app.get('/bus_schedule_search/:schedule_day', (req, res) => {
    schedule.findAll({ where: { schedule_day: req.params.schedule_day } }).then(schedule => {
        if (schedule) {
            res.json({
                "status": "success",
                "message": "Jadwal pada hari " + req.params.schedule_day + " ditemukan",
                "data": schedule
            });
        } else {
            res.json({
                "status": "not found",
                "message": "Jadwal pada hari " + req.params.schedule_day + " tidak ditemukan",
                "data": null
            });
        }

    })
});

//add schedule
app.post('/schedule_add/', [
    upload.single('img'),

    //Set form validation rule
    check('schedule_day')
        .isLength({
            min: 3
        })
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            errors: errors.mapped()
        });
    }

    schedule_create = schedule.create({
        schedule_day: req.body.schedule_day,
        schedule_depature: req.body.schedule_depature,
        schedule_arrival: req.body.schedule_arrival,
        bus_station_id: req.body.bus_station_id
    }).then(newSchedule => {
        res.json({
            "status": "success",
            "message": "Schedule added",
            "data": newSchedule
        })
    })
});

//edit schedule
app.put('/schedule_edit/:schedule_id', [
    upload.single('img'),

    //Set form validation rule
    check('schedule_day')
        .isLength({
            min: 3
        })
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.mapped() });
    }
    const update_schedule = {
        schedule_day: req.body.schedule_day,
        schedule_depature: req.body.schedule_depature,
        schedule_arrival: req.body.schedule_arrival,
        bus_station_id: req.body.bus_station_id
    }
    schedule.update(update_schedule, { where: { schedule_id: req.params.schedule_id } })
        .then(affectedRow => {
            return schedule.findOne({ where: { schedule_id: req.params.schedule_id } })
        })
        .then(s => {
            res.json({
                "status": "success",
                "message": "Schedule updated",
                "data": s
            })
        })
});

//delete schedule
app.delete('/schedule_delete/:schedule_id', [
    //Set form validation rule
    check('schedule_id')
        .isLength({ min: 5 })
        .isNumeric()
        .custom(value => {
            return schedule.findOne({ where: { schedule_id: value } }).then(b => {
                if (!b) {
                    throw new Error('Schedule not found');
                }
            })
        }
        ),
], (req, res) => {
    schedule.destroy({ where: { schedule_id: req.params.schedule_id } })
        .then(affectedRow => {
            if (affectedRow) {
                return {
                    "status": "success",
                    "message": "Schedule deleted",
                    "data": null
                }
            }

            return {
                "status": "error",
                "message": "Failed",
                "data": null
            }

        })
        .then(r => {
            res.json(r)
        })
});

app.listen(3000, () => console.log("server berjalan pada http://localhost:3000"))